import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useNavigation } from "../navigation/useNavigation";
import { PRODUCTS } from "../lib/products";
import CowDiagram from "../discovery/CowDiagram";
import { supabase } from "../lib/supabase";
import { useCart } from "../cart/CartContext";

// Local farm logos, used when a farm row has no logo_url in Supabase (same fallback as FarmPage).
import farm1 from "../assets/farm/farm1.jpg";
import farm2 from "../assets/farm/farm2.jpg";
import farm3 from "../assets/farm/farm3.jpg";
import farm4 from "../assets/farm/farm4.jpg";
const LOCAL_LOGOS = { 1: farm1, 2: farm2, 3: farm3, 4: farm4 };

// Makes an <img> fill whatever box its class already sizes.
const fill = { width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "inherit" };

const money = (n) => `$${n.toFixed(2)}`;

// The cart stores Supabase cuts.id. If a PRODUCTS entry has a `cutId`
// field it's used; otherwise the product's own id must match cuts.id.
const cutIdFor = (p) => p.cutId ?? p.id;

export default function ProductPage() {
  const { productId } = useParams();
  const { zip } = useNavigation();
  const { items: cartItems, addToCart } = useCart();

  const product = PRODUCTS.find((p) => p.id === parseInt(productId, 10));
  const cut = product?.cut
  ? product.cut[0].toUpperCase() + product.cut.slice(1)
  : null;

  const related = PRODUCTS.filter((p) => p.id !== product?.id).slice(0, 3);

  const [size, setSize] = useState(product?.defaultSize ?? 2.5);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState("Braise");
  const [farmLogo, setFarmLogo] = useState(null);

  // "idle" | "adding" | "added" | "error"
  const [addStatus, setAddStatus] = useState("idle");
  // Related item ids currently being added / just added
  const [relatedStatus, setRelatedStatus] = useState({});

  // Farm logo comes from Supabase farms.logo_url, falling back to the local image.
  useEffect(() => {
    const farmId = product?.farm?.id;
    if (!farmId) return;
    let cancelled = false;
    setFarmLogo(LOCAL_LOGOS[farmId] ?? null);
    supabase
      .from("farms")
      .select("logo_url")
      .eq("id", farmId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.logo_url) setFarmLogo(data.logo_url);
      });
    return () => { cancelled = true; };
  }, [product?.farm?.id]);

  useEffect(() => {
    setSize(product?.defaultSize ?? 2.5);
    setQty(1);
    setMethod("Braise");
    setAddStatus("idle");
    setRelatedStatus({});
  }, [productId]);

  // Clear the "Added" confirmation after a few seconds
  useEffect(() => {
    if (addStatus !== "added") return;
    const t = setTimeout(() => setAddStatus("idle"), 4000);
    return () => clearTimeout(t);
  }, [addStatus]);

  if (!product) {
    return (
      <div className="product-page">
        <div className="product-container product-notice">
          <h1 className="product-notice__title">We couldn't find that product</h1>
          <p className="product-notice__text">It may have sold out or been removed.</p>
          <Link to="/shop" className="product-notice__action">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  // How many of this cut are already in the cart, and how many more can be added
  const inCart =
    cartItems.find((i) => i.cutId === cutIdFor(product))?.quantity ?? 0;
  const canAdd = Math.max(product.inStock - inCart, 0);

  const cook = product.cook[method];
  const total = product.pricePerLb * size * qty;
  const delivers = Boolean(zip) && product.deliveryZips.includes(zip);
  const deliveryText = delivers
    ? `Delivers ${product.nextDelivery}`
    : zip
    ? "Pickup only"
    : "Set your ZIP for delivery";

  const handleAddToCart = async () => {
    if (qty > canAdd || addStatus === "adding") return;
    setAddStatus("adding");
    try {
      await addToCart(cutIdFor(product), qty);
      setAddStatus("added");
      setQty(1);
    } catch (err) {
      console.error("Add to cart failed:", err);
      setAddStatus("error");
    }
  };

  const handleAddRelated = async (r) => {
    if (relatedStatus[r.id] === "adding") return;
    setRelatedStatus((s) => ({ ...s, [r.id]: "adding" }));
    try {
      await addToCart(cutIdFor(r), 1);
      setRelatedStatus((s) => ({ ...s, [r.id]: "added" }));
    } catch (err) {
      console.error("Add to cart failed:", err);
      setRelatedStatus((s) => ({ ...s, [r.id]: "error" }));
    }
  };

  const ctaLabel =
    canAdd === 0
      ? "All available in your cart"
      : addStatus === "adding"
      ? "Adding…"
      : addStatus === "added"
      ? "Added ✓"
      : `Add to cart · ${money(total)}`;

  return (
    <div className="product-page">
      <div className="product-container">
        <Link to="/shop" className="product-back-link">
          <span aria-hidden="true">←</span> To Shop
        </Link>
        {/* TOP: image + summary */}
        <section className="product-top">
          {product.photoUrl ? (
            <img
              className="product-top__image"
              src={product.photoUrl}
              alt={product.name}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              className="product-placeholder product-top__image"
              role="img"
              aria-label={product.name}
            />
          )}

          <div className="product-summary">
            <div className="product-tags">
              {product.tags.map((tag, i) => (
                <span
                  key={tag}
                  className={`product-tag ${
                    i === 0 ? "product-tag--blue" : "product-tag--gray"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="product-summary__name">{product.name}</h1>
            <p className="product-summary__blurb">{product.blurb}</p>

            <div className="product-why">
              <h2 className="product-why__label">Why it's underrated</h2>
              <p className="product-why__text">{product.underrated}</p>
            </div>

            <div className="product-farm">
              {farmLogo ? (
                <img
                  className="product-farm__avatar"
                  src={farmLogo}
                  alt=""
                  aria-hidden="true"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div className="product-farm__avatar" aria-hidden="true" />
              )}
              <div>
                <div className="product-farm__name">
                  Raised by {product.farm.name}
                </div>
                <div className="product-farm__meta">
                  {product.farm.town} ·{" "}
                  <Link to={`/farms/${product.farm.id}`} className="product-link">
                    Meet the farmer
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PANELS */}
        <section className="product-panels">
          <div className="product-panel">
          <h2 className="product-panel__title">Where on the cow</h2>
          <div className="product-cow">
            <CowDiagram
              selected={cut}
              onSelect={() => {}}
            />
          </div>
          <p className="product-panel__caption">{product.cowCaption}</p>
        </div>
          <div className="product-panel">
            <div className="product-panel__header">
              <h2 className="product-panel__title">Cook it</h2>
              <div className="product-pills" role="tablist" aria-label="Cooking method">
                {Object.keys(product.cook).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={method === m}
                    className={`product-pill ${method === m ? "is-active" : ""}`}
                    onClick={() => setMethod(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <ol className="product-steps">
              {cook.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <div className="product-cook-footer">
              <span className="product-cook-footer__stats">
                {cook.time} <span className="product-cook-footer__gap" /> {cook.temp}
              </span>
              <Link to={`/recipes/${product.id}`} className="product-link">
                Full recipe
              </Link>
            </div>
          </div>

          <div className="product-panel">
            <h2 className="product-panel__title">If you like this, try</h2>
            <ul className="product-related">
              {related.map((r) => {
                const status = relatedStatus[r.id];
                return (
                  <li key={r.id} className="product-related__item">
                    <Link to={`/shop/product/${r.id}`} className="product-related__thumb" aria-hidden="true" tabIndex={-1}>
                      {r.photoUrl && <img src={r.photoUrl} alt="" style={fill} />}
                    </Link>
                    <div className="product-related__text">
                      <Link to={`/shop/product/${r.id}`} className="product-related__name">
                        {r.name}
                      </Link>
                      <span className="product-related__meta">
                        {r.farm.name} · {money(r.pricePerLb)}/lb
                      </span>
                    </div>
                    <button
                      type="button"
                      className="product-related__add"
                      disabled={status === "adding"}
                      aria-label={`Add ${r.name} to cart`}
                      onClick={() => handleAddRelated(r)}
                    >
                      {status === "adding"
                        ? "…"
                        : status === "added"
                        ? "Added ✓"
                        : status === "error"
                        ? "Retry"
                        : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>

      {/* STICKY ADD-TO-CART BAR */}
      <div className="product-bar">
        <div className="product-bar__inner">
          <div className="product-bar__item">
            {product.photoUrl ? (
              <img
                className="product-bar__thumb"
                src={product.photoUrl}
                alt=""
                aria-hidden="true"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div className="product-placeholder product-bar__thumb" aria-hidden="true" />
            )}
            <div className="product-bar__text">
              <div className="product-bar__name">
                {product.name} · {product.farm.name}
              </div>
              <div className="product-bar__meta">
                {money(product.pricePerLb)}/lb · {deliveryText} · {product.inStock} left
                {inCart > 0 && (
                  <>
                    {" · "}
                    <Link to="/cart" className="product-link">
                      {inCart} in your cart
                    </Link>
                  </>
                )}
              </div>
              {addStatus === "error" && (
                <div className="product-bar__meta" role="alert">
                  Couldn't add to cart. Please try again.
                </div>
              )}
            </div>
          </div>

          <div className="product-bar__controls">
            <div className="product-sizes" role="radiogroup" aria-label="Package size">
              {product.packSizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={size === s}
                  className={`product-size ${size === s ? "is-selected" : ""}`}
                  onClick={() => setSize(s)}
                >
                  ≈ {s} lb
                </button>
              ))}
            </div>

            <div className="product-qty" role="group" aria-label="Quantity">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
              >
                −
              </button>
              <span className="product-qty__value" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(canAdd, q + 1))}
                disabled={qty >= canAdd}
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="product-cta"
              onClick={handleAddToCart}
              disabled={canAdd === 0 || addStatus === "adding"}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}