import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cuts } from "../discovery/cuts";
import CowDiagram from "../discovery/CowDiagram";
import { CatalogState } from "../discovery/Content";
import { useCatalog } from "../discovery/useCatalog";
import { useNavigation } from "../navigation/useNavigation";
function StockItem({ cut }) {
  const { quantities, addPackage } = useNavigation();
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 2000);
    return () => clearTimeout(timer);
  }, [message]);
  function add() {
    if ((quantities[cut.id] ?? 0) >= cut.available_packages) {
      setMessage("All available packages are already in your cart");
      return;
    }
    addPackage(cut.id, cut.available_packages);
    setMessage("Added ✓");
  }
  return (
    <li>
      <div>
        <Link to={"/shop/" + cut.id}>{cut.name}</Link>
        <small>
          {cut.farm.name} · ${Number(cut.price_per_lb).toFixed(2)}/lb
        </small>
      </div>
      {cut.available_packages != null && (
        <button onClick={add}>{message === "Added ✓" ? message : "Add"}</button>
      )}
      {message && (
        <span className="dc-feedback" role="status">
          {message}
        </span>
      )}
    </li>
  );
}
export default function ExploreCuts() {
  const [part, setPart] = useState("Chuck");
  const catalog = useCatalog();
  const items = (catalog.data?.items ?? [])
    .filter((p) => String(p.cut_category).toLowerCase() === part.toLowerCase())
    .sort((a, b) => a.price_per_lb - b.price_per_lb);
  const [description, ...methods] = cuts[part];
  return (
    <article className="dc dc-explorer">
      <header>
        <h1>Pick a part of the cow.</h1>
        <p>
          Select a region to see how to cook it and what’s available nearby.
        </p>
      </header>
      <div className="dc-explore-grid">
        <CowDiagram selected={part} onSelect={setPart} />
        <section>
          <small>Selected</small>
          <h2>{part}</h2>
          <p>{description}</p>
          <div className="dc-tags">
            {methods.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          <CatalogState catalog={catalog}>
            <h3>In stock now · {items.length}</h3>
            {items.length ? (
              <ul className="dc-stock">
                {items.map((p) => (
                  <StockItem key={p.id} cut={p} />
                ))}
              </ul>
            ) : (
              <p>
                Nothing from the {part.toLowerCase()} in stock near you right
                now.
              </p>
            )}
          </CatalogState>
        </section>
      </div>
    </article>
  );
}
