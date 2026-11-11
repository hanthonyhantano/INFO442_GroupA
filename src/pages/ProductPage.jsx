import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useNavigation } from "../navigation/useNavigation";
import { PRODUCTS } from "../lib/products";
import CowDiagram from "../discovery/CowDiagram";
 
const money = (n) => `$${n.toFixed(2)}`;
 
export default function ProductPage() {
  const { productId } = useParams();
  const { zip } = useNavigation();
 
  const product = PRODUCTS.find((p) => p.id === parseInt(productId, 10));
  const cut = product?.cut
  ? product.cut[0].toUpperCase() + product.cut.slice(1)
  : null;

  const related = PRODUCTS.filter((p) => p.id !== product?.id).slice(0, 3);
 
  const [size, setSize] = useState(product?.defaultSize ?? 2.5);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState("Braise");

  useEffect(() => {
    setSize(product?.defaultSize ?? 2.5);
    setQty(1);
    setMethod("Braise");
  }, [productId]);
 
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
 
  const cook = product.cook[method];
  const total = product.pricePerLb * size * qty;
  const delivers = Boolean(zip) && product.deliveryZips.includes(zip);
  const deliveryText = delivers
    ? `Delivers ${product.nextDelivery}`
    : zip
    ? "Pickup only"
    : "Set your ZIP for delivery";
 
  const handleAddToCart = () => {
    // TODO: connect to cart
    console.log("add to cart", { productId: product.id, size, qty });
  };
 
  return (
    <div className="product-page">
      <div className="product-container">
        <Link to="/shop" className="product-back-link">
          <span aria-hidden="true">←</span> To Shop
        </Link>
        {/* TOP: image + summary */}
        <section className="product-top">
          <div
            className="product-placeholder product-top__image"
            role="img"
            aria-label={product.name}
          />
 
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
              <div className="product-farm__avatar" aria-hidden="true" />
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
              {related.map((r) => (
                <li key={r.id} className="product-related__item">
                  <Link to={`/products/${r.id}`} className="product-related__thumb" aria-hidden="true" tabIndex={-1} />
                  <div className="product-related__text">
                    <Link to={`/products/${r.id}`} className="product-related__name">
                      {r.name}
                    </Link>
                    <span className="product-related__meta">
                      {r.farm.name} · {money(r.pricePerLb)}/lb
                    </span>
                  </div>
                  <button type="button" className="product-related__add">
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
 
      {/* STICKY ADD-TO-CART BAR */}
      <div className="product-bar">
        <div className="product-bar__inner">
          <div className="product-bar__item">
            <div className="product-placeholder product-bar__thumb" aria-hidden="true" />
            <div className="product-bar__text">
              <div className="product-bar__name">
                {product.name} · {product.farm.name}
              </div>
              <div className="product-bar__meta">
                {money(product.pricePerLb)}/lb · {deliveryText} · {product.inStock} left
              </div>
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
                onClick={() => setQty((q) => Math.min(product.inStock, q + 1))}
                disabled={qty >= product.inStock}
              >
                +
              </button>
            </div>
 
            <button type="button" className="product-cta" onClick={handleAddToCart}>
              Add to cart · {money(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}