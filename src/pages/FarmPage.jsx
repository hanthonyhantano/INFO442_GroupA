import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useNavigation } from "../navigation/useNavigation";
import { PRODUCTS } from "../lib/products";
import { supabase } from "../lib/supabase"; 
import FarmBatches from '../components/FarmBatches';

// Local images, used when a farm row has no cover_url / logo_url in Supabase.
import farm1 from "../assets/farm/farm1.jpg";
import farm2 from "../assets/farm/farm2.jpg";
import farm3 from "../assets/farm/farm3.jpg";
import farm4 from "../assets/farm/farm4.jpg";
import farm7 from "../assets/farm/farm7.jpg";

const DEFAULT_COVER = farm7;
const LOCAL_LOGOS = { 1: farm1, 2: farm2, 3: farm3, 4: farm4 }; 

// 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
function getNextDeliveryDate(weekdays, from = new Date()) {
  if (!weekdays || weekdays.length === 0) return null;
  for (let offset = 1; offset <= 7; offset++) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    if (weekdays.includes(d.getDay())) return d;
  }
  return null;
}

// Turns day names from pickup_locations.days (["Sat"], ["Saturday"], "sat") into weekday numbers.
const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
function dayNamesToWeekdays(days) {
  const list = Array.isArray(days) ? days : typeof days === "string" ? days.split(/[,\s]+/) : [];
  return list
    .map((d) => DAY_INDEX[String(d).trim().slice(0, 3).toLowerCase()])
    .filter((n) => n !== undefined);
}

function formatDeliveryDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Money columns can be numeric (15) or text ("$15") — show both as "$15".
function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
  return value;
}

function mapFarmRow(row) {
  return {
    id: row.id,
    name: row.name,
    coverUrl: row.cover_url || DEFAULT_COVER,
    logoUrl: row.logo_url || LOCAL_LOGOS[row.id] || null,
    town: row.town ?? "",
    owners: row.owners ?? "",
    founded: row.founded ?? null,
    story: row.story ?? "",
    tags: row.tags ?? [],
    photos: row.photos ?? [],
    delivery: {
      zips: row.delivery_zips ?? [],
      weekdays: row.delivery_weekdays ?? [],
      fee: formatMoney(row.delivery_fee),
      minimum: formatMoney(row.delivery_minimum),
    },
    pickups: (row.pickups ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address ?? "",
      nextDate: getNextDeliveryDate(dayNamesToWeekdays(p.days)),
      times: p.times ?? "",
    })),
    contact: {
      email: row.contact_email ?? "",
      phone: row.contact_phone ?? "",
    },
  };
}

async function fetchFarm(id) {
  if (!Number.isFinite(id)) return { farm: null, products: [] };

  const { data, error } = await supabase
    .from("farms")
    .select("*, pickups:pickup_locations(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { farm: null, products: [] };

  const farm = mapFarmRow(data);
  const products = PRODUCTS.filter((p) => p.farm.id === farm.id);
  return { farm, products };
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
  const hasPickups = farm.pickups.length > 0;

  const nextDelivery = getNextDeliveryDate(farm.delivery.weekdays);
  const deliveryMeta = [
    nextDelivery && `Next delivery ${formatDeliveryDate(nextDelivery)}`,
    farm.delivery.fee,
    farm.delivery.minimum && `${farm.delivery.minimum} minimum`,
  ]
    .filter(Boolean)
    .join(" · ");

  let noDeliveryTitle;
  let noDeliveryText;
  if (!zip) {
    noDeliveryTitle = hasPickups ? "Pickup only" : "Delivery";
    noDeliveryText = "Set your ZIP to see if this farm delivers to you.";
  } else if (hasPickups) {
    noDeliveryTitle = "Pickup only";
    noDeliveryText = `${farm.name} doesn't deliver to ${zip}. Pickup is available below.`;
  } else {
    noDeliveryTitle = "Not available in your area";
    noDeliveryText = `${farm.name} doesn't deliver to ${zip} and has no pickup locations right now.`;
  }

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
                    <Link key={p.id} to={`/shop/product/${p.id}`} className="farm-product">
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
                {deliveryMeta && <div className="farm-delivery__meta">{deliveryMeta}</div>}
              </div>
            ) : (
              <div className="farm-card farm-card--delivery-none">
                <div className="farm-card__title">{noDeliveryTitle}</div>
                <div className="farm-delivery__meta">{noDeliveryText}</div>
              </div>
            )}

            {hasPickups && (
              <div className="farm-card">
                <div className="farm-card__title">Pickup</div>
                <div className="farm-pickup">
                  {farm.pickups.map((p) => (
                    <div key={p.id} className="farm-pickup__item">
                      {/* <div className="farm-placeholder farm-pickup__thumb" />  UNSURE WHAT THIS THUMBNAIL WOULD BE IN THE FIGMA*/} 
                      <div className="farm-pickup__text">
                        <span className="farm-pickup__name">{p.name}</span>
                        <span className="farm-pickup__detail">{p.address}</span>
                        {(p.nextDate || p.times) && (
                          <span className="farm-pickup__detail">
                            {[p.nextDate && `Next: ${formatDeliveryDate(p.nextDate)}`, p.times]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
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