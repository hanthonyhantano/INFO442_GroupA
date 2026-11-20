import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

const CART_ITEM_SELECT = `
  id, quantity, created_at, pack_size_lb,
  cut:cuts (
    id, name, photo, price_per_pound, pounds_per_package,
    packages_on_hand, held, is_live,
    farm:farms ( id, name, town, state, delivery_enabled, delivery_minimum )
  )
`;

// Match checkout by excluding stock already held for orders.
export const stockFor = (cut) =>
  cut.is_live ? Math.max((cut.packages_on_hand ?? 0) - (cut.held ?? 0), 0) : 0;

function toCartItem(row) {
  const { cut } = row;
  const farm = cut.farm;
  return {
    id: row.id, // cart_items.id – used for updates/deletes
    cutId: cut.id,
    name: cut.name,
    image: cut.photo ?? "",
    pricePerLb: Number(cut.price_per_pound),
    // The package size picked on the product page; falls back to the cut's
    // own weight for items added before sizes were saved.
    lbsPerPackage: Number(row.pack_size_lb ?? cut.pounds_per_package),
    quantity: row.quantity,
    // Packages of this cut in stock, shared by every cart row for the cut.
    stock: stockFor(cut),
    farm: {
      id: farm.id,
      name: farm.name,
      location: [farm.town, farm.state].filter(Boolean).join(", "),
      deliveryEnabled: farm.delivery_enabled,
      deliveryMinimum:
        farm.delivery_minimum == null ? null : Number(farm.delivery_minimum),
    },
  };
}

// CI8a – price/lb × lb/package × quantity
export const itemEstimate = (item) =>
  item.pricePerLb * item.lbsPerPackage * item.quantity;

export const formatMoney = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// The same cut can be in the cart more than once (one row per package size),
// and they all share the cut's stock. `available` is the most this row can
// go up to: stock minus what the cut's other rows already use.
function withAvailability(items) {
  const usedByCut = {};
  for (const i of items) usedByCut[i.cutId] = (usedByCut[i.cutId] ?? 0) + i.quantity;
  return items.map((i) => ({
    ...i,
    available: Math.max(i.stock - (usedByCut[i.cutId] - i.quantity), 0),
  }));
}

// CI13–CI15 – compare cart quantities against current stock
// (oldest rows keep their packages first)
function reconcile(rawItems) {
  const kept = [];
  const notices = [];
  const toUpdate = [];
  const toDelete = [];
  const stamp = Date.now();
  const usedByCut = {};

  for (const raw of rawItems) {
    const used = usedByCut[raw.cutId] ?? 0;
    const item = { ...raw, available: Math.max(raw.stock - used, 0) };

    if (item.available <= 0) {
      toDelete.push(item.id);
      notices.push({
        id: `${item.id}-soldout-${stamp}`,
        type: "soldout",
        text: `${item.name} from ${item.farm.name} sold out and was removed from your cart.`,
      });
    } else if (item.quantity > item.available) {
      toUpdate.push({ id: item.id, quantity: item.available });
      notices.push({
        id: `${item.id}-lowered-${stamp}`,
        type: "lowered",
        text: `Only ${item.available} ${item.name.toLowerCase()} ${
          item.available === 1 ? "package is" : "packages are"
        } left, so we lowered your quantity from ${item.quantity} to ${item.available}.`,
      });
      kept.push({ ...item, quantity: item.available });
      usedByCut[item.cutId] = used + item.available;
    } else {
      kept.push(item);
      usedByCut[item.cutId] = used + item.quantity;
    }
  }
  return { kept: withAvailability(kept), notices, toUpdate, toDelete };
}

// Cached so React StrictMode's double effect doesn't create two
// anonymous users or two carts.
let cartIdPromise = null;

function getOrCreateCartId() {
  if (!cartIdPromise) {
    cartIdPromise = (async () => {
      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }

      const userId = session.user.id;

      const { data: existing, error: selectError } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) return existing.id;

      const { data: created, error: insertError } = await supabase
        .from("carts")
        .insert({ user_id: userId })
        .select("id")
        .single();
      if (insertError) throw insertError;
      return created.id;
    })().catch((err) => {
      cartIdPromise = null;
      throw err;
    });
  }
  return cartIdPromise;
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cartId, setCartId] = useState(null);
  const [items, setItems] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Load the cart, fix anything that's over stock, save the fixes.
  const refresh = useCallback(async (id) => {
    const { data, error: loadError } = await supabase
      .from("cart_items")
      .select(CART_ITEM_SELECT)
      .eq("cart_id", id)
      .order("created_at");
    if (loadError) throw loadError;

    const { kept, notices: newNotices, toUpdate, toDelete } = reconcile(
      data.map(toCartItem)
    );

    await Promise.all([
      toDelete.length
        ? supabase.from("cart_items").delete().in("id", toDelete)
        : null,
      ...toUpdate.map((u) =>
        supabase
          .from("cart_items")
          .update({ quantity: u.quantity })
          .eq("id", u.id)
      ),
    ]);

    // CI16 – everything on the page is derived from `items`
    itemsRef.current = kept;
    setItems(kept);
    if (newNotices.length) setNotices((prev) => [...prev, ...newNotices]);
  }, []);

  // C7 – load on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getOrCreateCartId();
        if (cancelled) return;
        setCartId(id);
        await refresh(id);
      } catch (err) {
        console.error("Cart failed to load:", err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // CI13–CI16 – re-check whenever a cut in the cart changes
  const cutIdsKey = useMemo(
    () =>
      [...new Set(items.map((i) => i.cutId))]
        .sort((a, b) => a - b)
        .join(","),
    [items]
  );

  useEffect(() => {
    if (!cartId || !cutIdsKey) return;
    const channel = supabase
      .channel(`cart-cuts-${cartId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cuts",
          filter: `id=in.(${cutIdsKey})`,
        },
        () => {
          refresh(cartId).catch((err) => {
            console.error("Cart refresh failed:", err);
            setError(err);
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cartId, cutIdsKey, refresh]);

  // Update the screen first, then save; undo if the save fails.
  const mutate = useCallback(async (changedItems, write) => {
    const prev = itemsRef.current;
    // Keep each row's `available` right after a quantity change or removal
    const nextItems = withAvailability(changedItems);
    itemsRef.current = nextItems;
    setItems(nextItems);
    const { error: writeError } = await write();
    if (writeError) {
      console.error("Cart update failed:", writeError);
      itemsRef.current = prev;
      setItems(prev);
      setError(writeError);
    }
  }, []);

  // CI10
  const remove = useCallback(
    (id) =>
      mutate(
        itemsRef.current.filter((i) => i.id !== id),
        () => supabase.from("cart_items").delete().eq("id", id)
      ),
    [mutate]
  );

  // CI5 / CI12
  const increase = useCallback(
    (id) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item || item.quantity >= item.available) return;
      const quantity = item.quantity + 1;
      return mutate(
        itemsRef.current.map((i) => (i.id === id ? { ...i, quantity } : i)),
        () => supabase.from("cart_items").update({ quantity }).eq("id", id)
      );
    },
    [mutate]
  );

  // CI6 / CI7
  const decrease = useCallback(
    (id) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      if (item.quantity <= 1) return remove(id);
      const quantity = item.quantity - 1;
      return mutate(
        itemsRef.current.map((i) => (i.id === id ? { ...i, quantity } : i)),
        () => supabase.from("cart_items").update({ quantity }).eq("id", id)
      );
    },
    [mutate, remove]
  );

  // For the shop / product pages.
  // sizeLb = the package size picked on the product page. If it's left out
  // (e.g. a quick "Add" on the shop page), the cut's own weight is used.
  const addToCart = useCallback(
    async (cutId, qty = 1, sizeLb) => {
      const id = await getOrCreateCartId();

      let packSize = Number(sizeLb);
      if (!packSize) {
        const { data: cut, error: cutError } = await supabase
          .from("cuts")
          .select("pounds_per_package")
          .eq("id", cutId)
          .single();
        if (cutError) throw cutError;
        packSize = Number(cut.pounds_per_package) || 1;
      }

      // Read the current quantity from the database, not local state,
      // so adding before the cart finishes loading can't overwrite it.
      // Each package size of a cut is its own cart row.
      const { data: existing, error: readError } = await supabase
        .from("cart_items")
        .select("quantity")
        .eq("cart_id", id)
        .eq("cut_id", cutId)
        .eq("pack_size_lb", packSize)
        .maybeSingle();
      if (readError) throw readError;

      const { error: upsertError } = await supabase.from("cart_items").upsert(
        {
          cart_id: id,
          cut_id: cutId,
          pack_size_lb: packSize,
          quantity: (existing?.quantity ?? 0) + qty,
        },
        { onConflict: "cart_id,cut_id,pack_size_lb" }
      );
      if (upsertError) throw upsertError;
      setCartId(id);
      await refresh(id); // also caps the quantity at what's in stock
    },
    [refresh]
  );

  const dismissNotice = useCallback((noticeId) => {
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
  }, []);

  const value = useMemo(() => {
    const packageCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + itemEstimate(i), 0);
    return {
      items,
      notices,
      loading,
      error,
      packageCount,
      subtotal,
      increase,
      decrease,
      remove,
      addToCart,
      dismissNotice,
      refreshCart: () => refresh(cartId),
    };
  }, [
    cartId,
    refresh,
    items,
    notices,
    loading,
    error,
    increase,
    decrease,
    remove,
    addToCart,
    dismissNotice,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}