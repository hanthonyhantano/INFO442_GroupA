import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useNavigation } from "../navigation/useNavigation";
import { PRODUCTS } from "../lib/products";

  const FARMS = [
  {
    id: 1,
    name: "Lorem Ranch",
    town: "Ellensburg, WA",
    owners: "Lorem & Ipsum Dolor",
    founded: 2014,
    coverUrl: null,
    logoUrl: null,
    story: "Lorem Ranch is a family-owned ranch focused on rotational grazing and responsibly raised livestock.",
    tags: ["Rotational grazing", "Grass-finished"],
    photos: [],
    delivery: { zips: ["98105", "98101"], nextDate: "Tue, Oct 21", fee: "$15", minimum: "$75" },
    pickups: [
      { id: "p1", name: "Farm Stand", address: "1 Ranch Rd, Ellensburg, WA", days: "Sat", times: "9–12" },
      { id: "p2", name: "Ellensburg Farmers Market", address: "400 N Pearl St, Ellensburg, WA", days: "Sat", times: "9–1" },
    ],
    contact: { email: "lorem@ranch.com", phone: "(509) 555-0100" },
  },
  {
    
    id: 2,
    name: "Dolor Farm",
    town: "Enumclaw, WA",
    owners: "Jane & Tom Dolor",
    founded: 2018,
    coverUrl: null,
    logoUrl: null,
    story: "Dolor Farm specializes in pasture-raised beef and direct-to-consumer sales.",
    tags: ["Grass-fed", "Pasture Raised"],
    photos: [],
    delivery: { zips: ["98105", "98101"], nextDate: "Wed, Oct 22", fee: "$12", minimum: "$50" },
    pickups: [
      { id: "p1", name: "Enumclaw Pickup", address: "123 Main St, Enumclaw, WA", days: "Sat", times: "8–11" },
    ],
    contact: { email: "hello@dolorfarm.com", phone: "(206) 555-0199" },
  },
  {
    id: 3,
    name: "Ipsum Grazing",
    town: "Walla Walla, WA",
    owners: "",
    founded: null,
    coverUrl: null,
    logoUrl: null,
    story: "Ipsum Grazing raises grass-finished cattle in southeastern Washington.",
    tags: ["Grass-finished"],
    photos: [],
    delivery: { zips: [], nextDate: "", fee: "", minimum: "" },
    pickups: [],
    contact: { email: "hi@ipsumgrazing.com", phone: "(509) 555-0123" },
  },
  {
    id: 4,
    name: "Amet Cattle Co.",
    town: "Sequim, WA",
    owners: "",
    founded: null,
    coverUrl: null,
    logoUrl: null,
    story: "Amet Cattle Co. delivers locally raised beef across the Olympic Peninsula.",
    tags: [],
    photos: [],
    delivery: { zips: ["98105"], nextDate: "Thu, Oct 23", fee: "$10", minimum: "$40" },
    pickups: [],
    contact: { email: "info@ametcattle.com", phone: "(360) 555-0188" },
  },
];

// const PRODUCTS = [
//   { id: 1, farmId: 2, name: "Ground Beef", pricePerLb: 9.5, lbsPerPackage: 2.5, photoUrl: null, availablePackages: 12 },
//   { id: 2, farmId: 2, name: "Ribeye Steak", pricePerLb: 19.5, lbsPerPackage: 1, photoUrl: null, availablePackages: 0 },
//   { id: 3, farmId: 1, name: "Chuck Roast", pricePerLb: 12.5, lbsPerPackage: 3, photoUrl: null, availablePackages: 5 },
//   { id: 4, farmId: 1, name: "Short Ribs", pricePerLb: 11.99, lbsPerPackage: 2, photoUrl: null, availablePackages: 8 },
// ];

function fetchFarm(id) {
  return new Promise((resolve) =>
    setTimeout(() => {
      const farm = FARMS.find((f) => f.id === id) ?? null;
      resolve({ farm, products: farm ? PRODUCTS.filter((p) => p.farm.id === farm.id) : [] });
    }, 300)
  );
}

export default function FarmPage() {
  const { zip } = useNavigation(); 
  const { farmId } = useParams();
  const [state, setState] = useState({ status: "loading", farm: null, products: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", farm: null, products: [] });
    fetchFarm(parseInt(farmId, 10))
      .then(({ farm, products }) => {
        if (!cancelled) setState({ status: farm ? "ready" : "notfound", farm, products });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", farm: null, products: [] });
      });
    return () => { cancelled = true; };
  }, [farmId, attempt]);

  if (state.status === "notfound") {
    return (
      <div className="farm-page">
        <div className="farm-container farm-notice">
          <h1 className="farm-notice__title">This farm isn't on Cat Cow</h1>
          <p className="farm-notice__text">We couldn't find the farm you're looking for.</p>
          <Link to="/farms" className="farm-notice__action">Back to Farms</Link>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="farm-page">
        <div className="farm-container farm-notice">
          <h1 className="farm-notice__title">Something went wrong. Try again.</h1>
          <button className="farm-notice__action" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="farm-page" aria-busy="true">
        <section className="farm-hero">
          <div className="farm-placeholder farm-hero__image" />
        </section>
        <div className="farm-container">
          <div className="farm-layout">
            <main>
              <section className="farm-intro">
                <div className="farm-placeholder farm-intro__avatar" />
                <div className="farm-intro__text">
                  <span className="farm-bar" style={{ width: 200 }} />
                </div>
              </section>
              <div className="farm-skeleton-text">
                <span /><span /><span style={{ width: "60%" }} />
              </div>
            </main>
            <aside className="farm-side">
              <div className="farm-card"><span className="farm-bar" /></div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  const { farm, products } = state;
  const inStock = products.filter((p) => p.availablePackages > 0); 
  const deliversToZip = !!zip && farm.delivery.zips.includes(zip);
  const meta = [farm.town, farm.owners, farm.founded && `Since ${farm.founded}`]
    .filter(Boolean)
    .join(" · "); 

  return (
    <div className="farm-page">
      <section className="farm-hero">
        {farm.coverUrl ? (
          <img className="farm-hero__image" src={farm.coverUrl} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <div className="farm-placeholder farm-hero__image" />
        )}
        <Link to="/farms" className="farm-back-link">← All farms</Link>
      </section>

      <div className="farm-container">
        <div className="farm-layout">
          <main>
            <section className="farm-intro">
              {farm.logoUrl ? (
                <img className="farm-intro__avatar" src={farm.logoUrl} alt={`${farm.name} logo`} />
              ) : (
                <div className="farm-placeholder farm-intro__avatar" />
              )}
              <div className="farm-intro__text">
                <h1 className="farm-intro__name">{farm.name}</h1>
                <div className="farm-intro__meta">{meta}</div>
              </div>
            </section>

            {farm.tags.length > 0 && (
              <div className="farm-tags">
                {farm.tags.map((tag) => (
                  <span key={tag} className="farm-tag farm-tag--blue">{tag}</span>
                ))}
              </div>
            )}

            <h2 className="farm-sr-only">About the farm</h2>
            <p className="farm-description">{farm.story}</p>

            {farm.photos.length > 0 && (
              <div className="farm-gallery">
                {farm.photos.slice(0, 4).map((url) => (
                  <img key={url} className="farm-gallery__item" src={url} alt="" />
                ))}
              </div>
            )}

            <section className="farm-stock">
              <div className="farm-stock__header">
                <h2 className="farm-stock__title">
                  In stock{inStock.length > 0 && ` · ${inStock.length}`}
                </h2>
                <Link to={`/shop?farm=${farm.id}`} className="farm-stock__link">
                  Shop all →
                </Link>
              </div>

              {inStock.length === 0 ? (
                <p className="farm-stock__empty">
                  {farm.name} has no products available right now.
                </p>
              ) : (
                <div className="farm-stock__grid">
                  {inStock.map((p) => (
                    <Link key={p.id} to={`/products/${p.id}`} className="farm-product">
                      {p.photoUrl ? (
                        <img className="farm-product__image" src={p.photoUrl} alt={p.name} />
                      ) : (
                        <div className="farm-placeholder farm-product__image" />
                      )}
                      <div className="farm-product__body">
                        <div className="farm-product__name">{p.name}</div>
                        <div className="farm-product__meta">
                          ${p.pricePerLb.toFixed(2)}/lb · ≈ {p.defaultSize} lb
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </main>

          <aside className="farm-side">
            {deliversToZip ? (
              <div className="farm-card farm-card--delivery">
                <div className="farm-delivery__title">
                  <span className="farm-delivery__dot" />
                  Delivers to {zip}
                </div>
                <div className="farm-delivery__meta">
                  Next delivery {farm.delivery.nextDate} · {farm.delivery.fee} · {farm.delivery.minimum} minimum
                </div>
              </div>
            ) : (
              <div className="farm-card farm-card--delivery-none">
                <div className="farm-card__title">Pickup only</div>
                <div className="farm-delivery__meta">
                  {zip
                    ? `${farm.name} doesn't deliver to ${zip}. Pickup is available below.`
                    : "Set your ZIP to see if this farm delivers to you."}
                </div>
              </div>
            )}

            {farm.pickups.length > 0 && (
              <div className="farm-card">
                <div className="farm-card__title">Pickup</div>
                <div className="farm-pickup">
                  {farm.pickups.map((p) => (
                    <div key={p.id} className="farm-pickup__item">
                      <div className="farm-placeholder farm-pickup__thumb" />
                      <div className="farm-pickup__text">
                        <span className="farm-pickup__name">{p.name}</span>
                        <span className="farm-pickup__detail">{p.address}</span>
                        <span className="farm-pickup__detail">{p.days} · {p.times}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="farm-card">
              <div className="farm-card__title">Contact</div>
              <div className="farm-contact__line">
                <a href={`mailto:${farm.contact.email}`}>{farm.contact.email}</a>
              </div>
              <div className="farm-contact__line">
                <a href={`tel:${farm.contact.phone}`}>{farm.contact.phone}</a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}