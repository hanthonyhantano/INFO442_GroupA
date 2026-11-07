import { Link, useSearchParams } from "react-router-dom";
import { useCatalog } from "../discovery/useCatalog";
import { CutCard, CatalogState } from "../discovery/Content";
export default function Shop() {
  const catalog = useCatalog();
  const [params] = useSearchParams();
  const farmId = params.get("farm");
  const items =
    catalog.data?.items.filter(
      (p) => !farmId || String(p.farm_id) === farmId,
    ) ?? [];
  const farm = catalog.data?.farms.find((f) => String(f.id) === farmId);
  return (
    <article className="dc">
      <small>Marketplace</small>
      <h1>{farm ? "Shop " + farm.name : "Shop beef"}</h1>
      <p>Browse available cuts from participating ranches.</p>
      {farmId && <Link to="/shop">See all farms’ cuts →</Link>}
      <CatalogState catalog={catalog}>
        {items.length ? (
          <div className="dc-grid">
            {items.map((p) => (
              <CutCard key={p.id} cut={p} />
            ))}
          </div>
        ) : (
          <p>
            No cuts available for this selection.{" "}
            <Link to="/farms">Browse farms</Link>
          </p>
        )}
      </CatalogState>
    </article>
  );
}
