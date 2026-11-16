import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { groupItems, money, validateCheckout } from "./checkout";
import "./checkout.css";

// submitOrder must atomically validate current prices/stock and save one request
// per farm. It returns { orders: [{ id, farmName, estimatedTotal }] } only on success.
export default function CheckoutPage({
  items,
  loading,
  error,
  submitOrder,
  options = [],
}) {
  const navigate = useNavigate();
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    address: "",
    zip: "",
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(null);
  const lock = useRef(false);
  const [fulfillment, setFulfillment] = useState({});
  const groups = groupItems(items);
  const total = groups.reduce((sum, group) => sum + group.subtotal, 0);

  async function submit(event) {
    event.preventDefault();
    if (lock.current || !submitOrder) return;
    const found = validateCheckout(contact, items);
    for (const group of groups) {
      const option = options.find(
        (farm) => String(farm.id) === String(group.farm.id),
      );
      const choice = fulfillment[group.farm.id];
      if (
        options.length &&
        (!choice || (choice.method === "pickup" && !choice.pickupId))
      )
        found.cart = "Choose fulfillment for each farm.";
      if (
        choice?.method === "delivery" &&
        (!contact.address.trim() ||
          !/^\d{5}$/.test(contact.zip) ||
          group.subtotal < Number(option?.delivery_minimum ?? 0) ||
          !option?.delivery_zones.some((zone) =>
            zone.zip_codes.includes(contact.zip),
          ))
      )
        found.cart = "Check the delivery address, ZIP, and farm minimum.";
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    lock.current = true;
    setSending(true);
    try {
      // Retain the same request ID after a lost response to prevent duplicate orders.
      const payload = pending ?? {
        requestId: crypto.randomUUID(),
        contact: {
          ...contact,
          name: contact.name.trim(),
          email: contact.email.trim(),
        },
        fulfillment,
        items: items.map((item) => ({
          cartItemId: item.id,
          cutId: item.cutId,
          quantity: item.quantity,
        })),
      };
      setPending(payload);
      const receipt = await submitOrder(payload);
      if (
        !receipt?.orders?.length ||
        receipt.orders.some(
          (order) =>
            !order.id ||
            !order.farmName ||
            !Number.isFinite(order.estimatedTotal),
        )
      )
        throw new Error("Invalid receipt");
      navigate("/request-sent", { replace: true, state: { receipt } });
    } catch (failure) {
      setErrors({
        submit:
          failure.message || "We could not confirm your request. Try again.",
      });
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  if (loading) return <p role="status">Loading checkout…</p>;
  if (error)
    return (
      <p role="alert">
        Your cart could not load. <Link to="/cart">Return to cart</Link>
      </p>
    );
  if (!items.length)
    return (
      <section className="checkout-page">
        <h1>Your cart is empty</h1>
        <Link to="/shop">Shop beef</Link>
      </section>
    );
  return (
    <section className="checkout-page">
      <Link to="/cart">← Back to cart</Link>
      <h1>Guest checkout</h1>
      <p>No account required. Each farm confirms its request separately.</p>
      <div className="checkout-layout">
        <form onSubmit={submit} noValidate>
          <h2>Your contact information</h2>
          {["name", "email", "phone"].map((key) => (
            <label key={key}>
              {
                {
                  name: "Full name",
                  email: "Email",
                  phone: "Phone (optional)",
                }[key]
              }
              <input
                value={contact[key]}
                type={
                  key === "email" ? "email" : key === "phone" ? "tel" : "text"
                }
                autoComplete={key === "phone" ? "tel" : key}
                disabled={sending || Boolean(pending)}
                required={key !== "phone"}
                aria-invalid={Boolean(errors[key])}
                aria-describedby={errors[key] ? key + "-error" : undefined}
                onChange={(event) =>
                  setContact({ ...contact, [key]: event.target.value })
                }
              />
              {errors[key] && (
                <span id={key + "-error"} className="checkout-error">
                  {errors[key]}
                </span>
              )}
            </label>
          ))}
          <h2>Pickup or delivery</h2>
          {groups.map((group) => {
            const option = options.find(
              (farm) => String(farm.id) === String(group.farm.id),
            );
            const choice = fulfillment[group.farm.id] ?? {};
            const change = (value) =>
              setFulfillment({
                ...fulfillment,
                [group.farm.id]: { ...choice, ...value },
              });
            return (
              <fieldset
                key={group.farm.id}
                disabled={sending || Boolean(pending)}
              >
                <legend>{group.farm.name}</legend>
                <label>
                  Fulfillment method
                  <select
                    value={choice.method ?? ""}
                    onChange={(event) => change({ method: event.target.value })}
                  >
                    <option value="">Choose pickup or delivery</option>
                    {option?.pickup_enabled && (
                      <option value="pickup">Pickup</option>
                    )}
                    {option?.delivery_enabled && (
                      <option value="delivery">Delivery</option>
                    )}
                  </select>
                </label>
                {choice.method === "pickup" && (
                  <label>
                    Pickup location
                    <select
                      value={choice.pickupId ?? ""}
                      onChange={(event) =>
                        change({ pickupId: event.target.value })
                      }
                    >
                      <option value="">Choose location</option>
                      {option.pickup_locations.map((place) => (
                        <option key={place.id} value={place.id}>
                          {place.name} — {place.address}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {choice.method === "delivery" && (
                  <p>
                    Delivery minimum:{" "}
                    {money(Number(option.delivery_minimum ?? 0))}. Delivery fee:{" "}
                    {option.delivery_zones.find((zone) =>
                      zone.zip_codes.includes(contact.zip),
                    )
                      ? money(
                          Number(
                            option.delivery_zones.find((zone) =>
                              zone.zip_codes.includes(contact.zip),
                            ).fee,
                          ),
                        )
                      : "Enter an eligible ZIP"}
                  </p>
                )}
              </fieldset>
            );
          })}
          {Object.values(fulfillment).some(
            (choice) => choice.method === "delivery",
          ) && (
            <>
              <label>
                Delivery address
                <input
                  autoComplete="street-address"
                  value={contact.address}
                  disabled={sending || Boolean(pending)}
                  onChange={(event) =>
                    setContact({ ...contact, address: event.target.value })
                  }
                />
              </label>
              <label>
                ZIP code
                <input
                  autoComplete="postal-code"
                  inputMode="numeric"
                  value={contact.zip}
                  disabled={sending || Boolean(pending)}
                  onChange={(event) =>
                    setContact({ ...contact, zip: event.target.value })
                  }
                />
              </label>
            </>
          )}
          <p>
            Final price depends on actual package weights. This is an order
            request, not a payment.
          </p>
          {!submitOrder && (
            <p role="status">
              Order submission is not connected yet. Your cart has not been
              submitted.
            </p>
          )}
          {(errors.cart || errors.submit) && (
            <p role="alert">{errors.cart || errors.submit}</p>
          )}
          <button
            className="checkout-primary"
            disabled={sending || !submitOrder}
          >
            {sending ? "Sending request…" : "Send order request"}
          </button>
        </form>
        <aside className="checkout-summary" aria-label="Order summary">
          <h2>Review your request</h2>
          {groups.map((group) => (
            <section key={group.farm.id}>
              <h3>{group.farm.name}</h3>
              <p>Confirms separately</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    {item.name} × {item.quantity}
                  </li>
                ))}
              </ul>
              <p>Estimated subtotal: {money(group.subtotal)}</p>
            </section>
          ))}
          <strong>Estimated total: {money(total)}</strong>
        </aside>
      </div>
    </section>
  );
}
