import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CowDiagram from "../components/CowDiagram";
import { CUTS } from "../lib/cuts";
import { PRODUCTS } from "../lib/products";
import { useNavigation } from "../navigation/useNavigation";
 
const money = (n) => `$${n.toFixed(2)}`;
 
const availablePackages = (p) => p.availablePackages ?? p.inStock ?? 0;

const servesZip = (product, zip) =>
  !zip ||
  Boolean(product.deliveryZips?.includes(zip)) ||
  Boolean(product.pickupZips?.includes(zip));

function fetchCutProducts(cutId, zip) {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve(
        PRODUCTS.filter(
          (p) =>
            p.cut === cutId &&
            p.live !== false &&
            availablePackages(p) > 0 &&
            servesZip(p, zip)
        ).sort((a, b) => a.pricePerLb - b.pricePerLb)
      );
    }, 250)
  );
}
 
function ProductRow({ product }) {
  return (
    <li className="cuts-item">
      <div className="cuts-row">
        {product.photoUrl ? (
          <img className="cuts-row__thumb" src={product.photoUrl} alt="" />
        ) : (
          <div className="cuts-placeholder cuts-row__thumb" aria-hidden="true" />
        )}
 
        <div className="cuts-row__text">
          <Link to={`/products/${product.id}`} className="cuts-row__name">
            {product.name}
          </Link>
          <span className="cuts-row__meta">
            {product.farm.name} · {money(product.pricePerLb)}/lb
          </span>
        </div>
 
        {/* Cart not wired up yet */}
        <button type="button" className="cuts-row__add">
          Add
        </button>
      </div>
    </li>
  );
}
 
function SkeletonRows() {
  return (
    <ul className="cuts-list" aria-busy="true" aria-label="Loading products">
      {[0, 1, 2].map((i) => (
        <li key={i} className="cuts-item">
          <div className="cuts-row">
            <div className="cuts-placeholder cuts-row__thumb" />
            <div className="cuts-row__text">
              <span className="cuts-bar" style={{ width: "55%" }} />
              <span className="cuts-bar" style={{ width: "75%" }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
 
export default function ExploreCuts() {
  const { zip } = useNavigation();
  const [selectedId, setSelectedId] = useState("chuck"); // EC8
  const [state, setState] = useState({ status: "loading", products: [] });
  const [attempt, setAttempt] = useState(0);
 
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", products: [] });
 
    fetchCutProducts(selectedId, zip) 
      .then((products) => {
        if (!cancelled) setState({ status: "ready", products });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", products: [] });
      });
 
    return () => {
      cancelled = true;
    };
  }, [selectedId, zip, attempt]);
 
  const cut = CUTS[selectedId];
 
  return (
    <div className="cuts-page">
      <header className="cuts-hero">
        <h1 className="cuts-hero__title">Pick a part of the cow.</h1>
        <p className="cuts-hero__text">
          Hover over the diagram to preview a cut, then click it to see what's in
          stock near you.
        </p>
      </header>
 
      <div className="cuts-layout">
        <section className="cuts-diagram" aria-label="Cow diagram">
          <CowDiagram selected={selectedId} onSelect={setSelectedId} />
        </section>
 
        <aside className="cuts-panel" aria-live="polite">
          <p className="cuts-panel__eyebrow">SELECTED</p>
          <h2 className="cuts-panel__name">{cut.name}</h2>
          <p className="cuts-panel__description">{cut.description}</p>
 
          <ul className="cuts-tags">
            {cut.tags.map((tag) => (
              <li key={tag} className="cuts-tag">
                {tag}
              </li>
            ))}
          </ul>
 
          <Link to={`/recipes/${selectedId}`} className="cuts-panel__recipe">
            {cut.name} recipes
          </Link>
 
          <p className="cuts-panel__label">
            IN STOCK NOW
            {state.status === "ready" && ` · ${state.products.length}`}
          </p>
 
          {state.status === "loading" && <SkeletonRows />}
 
          {state.status === "error" && (
            <div className="cuts-state">
              <p className="cuts-state__text">Something went wrong. Try again.</p>
              <button
                type="button"
                className="cuts-state__action"
                onClick={() => setAttempt((a) => a + 1)}
              >
                Try again
              </button>
            </div>
          )}
 
          {state.status === "ready" &&
            (state.products.length === 0 ? (
              <p className="cuts-state__text">
                Nothing from the {cut.name.toLowerCase()} in stock near you right now.
              </p>
            ) : (
              <ul className="cuts-list">
                {state.products.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </ul>
            ))}
        </aside>
      </div>
    </div>
  );
}
