import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigation } from "../navigation/useNavigation";
import { formatMoney, itemEstimate, useCart } from "../cart/CartContext";
import "./cart.css";

const SHOP_PATH = "/shop";
const CHECKOUT_PATH = "/checkout";

export default function Cart() {
  const navigate = useNavigate();
  const { zip } = useNavigation();
  const {
    items,
    notices,
    loading,
    error,
    packageCount,
    subtotal,
    increase,
    decrease,
    remove,
    dismissNotice,
  } = useCart();

  const isEmpty = !loading && !error && items.length === 0;

  // C7 / FG3 – group items by farm, keeping first-seen order
  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (!map.has(item.farm.id)) {
        map.set(item.farm.id, { farm: item.farm, items: [] });
      }
      map.get(item.farm.id).items.push(item);
    });
    return [...map.values()].map((group) => ({
      ...group,
      subtotal: group.items.reduce((s, i) => s + itemEstimate(i), 0),
    }));
  }, [items]);

  return (
    <main className="cart-page">
      <div className="cart-layout">
        <section className="cart-main" aria-labelledby="cart-title">
          <h1 id="cart-title" className="cart-title">
            Your cart
          </h1>

          {error && (
            <p className="cart-notice cart-notice--soldout" role="alert">
              Something went wrong updating your cart. Please refresh and try
              again.
            </p>
          )}

          {/* CI14 / CI15 – availability messages */}
          {notices.length > 0 && (
            <ul className="cart-notices" aria-live="polite">
              {notices.map((n) => (
                <li
                  key={n.id}
                  className={`cart-notice cart-notice--${n.type}`}
                >
                  <span>{n.text}</span>
                  <button
                    type="button"
                    className="cart-notice-dismiss"
                    aria-label="Dismiss message"
                    onClick={() => dismissNotice(n.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {loading ? (
            <p className="cart-loading">Loading your cart…</p>
          ) : isEmpty ? (
            /* C8 / C8a */
            <div className="cart-empty">
              <p className="cart-empty-text">Your cart is empty</p>
              <button
                type="button"
                className="cart-btn cart-btn--primary"
                onClick={() => navigate(SHOP_PATH)}
              >
                Shop beef
              </button>
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <FarmGroup
                  key={group.farm.id}
                  group={group}
                  onIncrease={increase}
                  onDecrease={decrease}
                  onRemove={remove}
                />
              ))}

              {/* C5 / C10 */}
              <button
                type="button"
                className="cart-btn cart-btn--outline"
                onClick={() => navigate(SHOP_PATH)}
              >
                <span aria-hidden="true">←</span> Continue shopping
              </button>
            </>
          )}
        </section>

        {/* S1–S7, CO1–CO2, C9 */}
        <aside className="cart-summary" aria-labelledby="summary-title">
          <h2 id="summary-title" className="cart-summary-title">
            Summary
          </h2>

          <div className="cart-summary-row">
            <span>
              {packageCount} {packageCount === 1 ? "package" : "packages"}
            </span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="cart-summary-row">
            <span>Delivery to {zip}</span>
            <span>Set by each farm</span>
          </div>

          <div className="cart-summary-total">
            <span>Estimated subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>

          <p className="cart-summary-note">
            Final price is based on actual package weights. Nothing is charged
            until the rancher replies.
          </p>

          <button
            type="button"
            className="cart-btn cart-btn--checkout"
            disabled={loading || items.length === 0}
            onClick={() => navigate(CHECKOUT_PATH)}
          >
            Proceed to checkout
          </button>
        </aside>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function FarmGroup({ group, onIncrease, onDecrease, onRemove }) {
  const { farm, items, subtotal } = group;
  const shortfall =
    farm.deliveryEnabled && farm.deliveryMinimum != null
      ? farm.deliveryMinimum - subtotal
      : 0;

  return (
    <section className="cart-farm" aria-label={`${farm.name} items`}>
      {/* FG1 / FG2 */}
      <header className="cart-farm-header">
        <p className="cart-farm-name">
          <strong>{farm.name}</strong>
          {farm.location && (
            <span className="cart-farm-location"> · {farm.location}</span>
          )}
        </p>
        <span className="cart-farm-label">Confirms separately</span>
      </header>

      {/* D1 / D2 */}
      {shortfall > 0 && (
        <p className="cart-farm-minimum">
          Add {formatMoney(shortfall)} more for delivery, or choose pickup
        </p>
      )}

      <ul className="cart-items">
        {items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}

function CartItem({ item, onIncrease, onDecrease, onRemove }) {
  const atMax = item.quantity >= item.available;

  return (
    <li className="cart-item">
      {/* CI1 */}
      <div className="cart-item-image">
        {item.image ? (
          <img src={item.image} alt={item.name} />
        ) : (
          <span className="cart-item-placeholder" aria-hidden="true" />
        )}
      </div>

      {/* CI2 / CI3 */}
      <div className="cart-item-info">
        <p className="cart-item-name">{item.name}</p>
        <p className="cart-item-meta">
          {formatMoney(item.pricePerLb)}/lb · ≈ {item.lbsPerPackage} lb per
          package
        </p>
      </div>

      {/* CI4–CI7, CI12 */}
      <div className="cart-qty-wrap">
        <div
          className="cart-qty"
          role="group"
          aria-label={`${item.name} quantity`}
        >
          <button
            type="button"
            className="cart-qty-btn"
            aria-label={
              item.quantity === 1
                ? `Remove ${item.name}`
                : `Decrease ${item.name} quantity`
            }
            onClick={() => onDecrease(item.id)}
          >
            −
          </button>
          <span className="cart-qty-value" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="button"
            className="cart-qty-btn"
            aria-label={`Increase ${item.name} quantity`}
            disabled={atMax}
            onClick={() => onIncrease(item.id)}
          >
            +
          </button>
        </div>
        {atMax && (
          <p className="cart-qty-limit">Only {item.available} available</p>
        )}
      </div>

      {/* CI8 / CI8a */}
      <div className="cart-item-price">
        <span>{formatMoney(itemEstimate(item))}</span>
        <span className="cart-item-est">EST.</span>
      </div>

      {/* CI9 / CI10 */}
      <button
        type="button"
        className="cart-item-remove"
        onClick={() => onRemove(item.id)}
      >
        Remove
      </button>
    </li>
  );
}