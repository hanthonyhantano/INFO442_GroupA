import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GoogleMap,
  Marker,
  Circle,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useNavigation } from "../navigation/useNavigation";
import { fetchFarmList as fetchFarms, fetchZipCenter, normalizeZip } from "../lib/farmsApi";

const DEFAULT_CENTER = { lat: 47.655, lng: -122.303 };
const METERS_PER_MILE = 1609.34;

// A farm delivers to you if your ZIP is in its delivery ZIPs (same rule as the Farm page),
// or if you're inside its delivery radius.
const deliversTo = (farm, zip) => {
  const clean = normalizeZip(zip);
  if (clean && (farm.deliveryZips ?? []).includes(clean)) return true;
  return (
    farm.exactMiles != null &&
    farm.deliveryRadiusMiles != null &&
    farm.exactMiles <= farm.deliveryRadiusMiles
  );
};

// Farms without usable coordinates get no map pin (avoids pins at NaN).
const hasCoords = (farm) =>
  Number.isFinite(Number(farm.lat)) && Number.isFinite(Number(farm.lng)) &&
  farm.lat !== null && farm.lng !== null;

const FILTERS = [
  { id: "delivers", label: "Delivers to me", test: deliversTo },
  { id: "pickup", label: "Pickup nearby", test: (farm) => Boolean(farm.pickup) },
  {
    id: "grass",
    label: "Grass-finished",
    test: (farm) => (farm.tags ?? []).includes("Grass-finished"),
  },
];

// Straight-line distance in miles between two { lat, lng } points
const toRad = (deg) => (deg * Math.PI) / 180;

function milesBetween(a, b) {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

// fetchZipCenter may return [lat, lng], { lat, lng } or { latitude, longitude }.
// Turn any of those into { lat, lng }, or null if it isn't usable.
function toLatLng(center) {
  if (!center) return null;

  const lat = Number(Array.isArray(center) ? center[0] : center.lat ?? center.latitude);
  const lng = Number(Array.isArray(center) ? center[1] : center.lng ?? center.lon ?? center.longitude);

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export default function FarmsPage() {
  const { zip } = useNavigation();

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });

  const [mapAuthFailed, setMapAuthFailed] = useState(false);

  useEffect(() => {
    window.gm_authFailure = () => setMapAuthFailed(true);
    return () => {
      delete window.gm_authFailure;
    };
  }, []);

  const mapFailed = Boolean(loadError) || mapAuthFailed;

  // Farm data: loading / error / ready
  const [data, setData] = useState({ status: "loading", farms: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData({ status: "loading", farms: [] });

    fetchFarms()
      .then((farms) => {
        if (!cancelled) setData({ status: "ready", farms: farms ?? [] });
      })
      .catch((err) => {
        console.error("fetchFarms failed:", err);
        if (!cancelled) setData({ status: "error", farms: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // ZIP -> coordinates, so distances follow the ZIP
  const [origin, setOrigin] = useState(null);

  useEffect(() => {
    // Drop the old ZIP's distances right away so they never show for the new ZIP
    setOrigin(null);
    if (!zip) return;

    let cancelled = false;

    fetchZipCenter(zip)
      .then((center) => {
        if (cancelled) return;
        const point = toLatLng(center);
        if (!point) console.warn(`No coordinates for ZIP ${zip}:`, center);
        setOrigin(point);
      })
      .catch((err) => {
        console.error("fetchZipCenter failed:", err);
        if (!cancelled) setOrigin(null);
      });

    return () => {
      cancelled = true;
    };
  }, [zip, isLoaded]);

  const [sort, setSort] = useState("closest");
  const [filters, setFilters] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("list");

  const toggleFilter = (id) => {
    setFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const farmsWithMiles = useMemo(
    () =>
      data.farms.map((farm) => {
        const exactMiles = origin && hasCoords(farm)
          ? milesBetween(origin, { lat: Number(farm.lat), lng: Number(farm.lng) })
          : null;
        const valid = Number.isFinite(exactMiles);

        return {
          ...farm,
          exactMiles: valid ? exactMiles : null,
          miles: valid ? Math.round(exactMiles) : null,
        };
      }),
    [data.farms, origin]
  );

  const results = useMemo(() => {
    const activeFilters = FILTERS.filter((f) => filters.includes(f.id));
    const filtered = farmsWithMiles.filter((farm) =>
      activeFilters.every((f) => f.test(farm, zip))
    );

    return [...filtered].sort((a, b) => {
      if (sort === "closest") {
        // Farms without a distance go last
        if (a.exactMiles == null && b.exactMiles != null) return 1;
        if (b.exactMiles == null && a.exactMiles != null) return -1;
        if (a.exactMiles != null && b.exactMiles != null && a.exactMiles !== b.exactMiles) {
          return a.exactMiles - b.exactMiles;
        }
      }
      return a.name.localeCompare(b.name);
    });
  }, [farmsWithMiles, filters, sort, zip]);

  const deliverCount = results.filter((farm) => deliversTo(farm, zip)).length;
  const hoveredFarm = results.find((farm) => farm.id === hoveredId) || null;

  const circleFarm = hoveredFarm;

  const mapCenter = useMemo(() => origin ?? DEFAULT_CENTER, [origin]);

  const [map, setMap] = useState(null);

  const hoverLat = hoveredFarm ? Number(hoveredFarm.lat) : null;
  const hoverLng = hoveredFarm ? Number(hoveredFarm.lng) : null;

  useEffect(() => {
    if (!map || hoverLat == null || hoverLng == null) return;
    if (!Number.isFinite(hoverLat) || !Number.isFinite(hoverLng)) return;
    map.panTo({ lat: hoverLat, lng: hoverLng });
  }, [map, hoverLat, hoverLng]);

  return (
    <div className="farm-page">
      <div className={`farms-layout farms-layout--${view}`}>
        {/* Left Panel */}
        <section className="farms-panel">
          <h1 className="farms-panel__title">
            {zip ? `Farms near ${zip}` : "Farms"}
          </h1>

          {data.status === "ready" && (
            <p className="farms-panel__count">
              {results.length} {results.length === 1 ? "farm" : "farms"}
              {zip
                ? ` · ${deliverCount} deliver to you`
                : " · Set your ZIP to see which deliver to you"}
            </p>
          )}

          <div className="farms-filters">
            <div className="farms-filters__chips">
              {FILTERS.map((filter) => {
                const active = filters.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={active}
                    className={`farms-chip ${active ? "is-active" : ""}`}
                    onClick={() => toggleFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <label className="farms-sort">
              <span>Sort:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="closest">Closest</option>
                <option value="az">A–Z</option>
              </select>
            </label>
          </div>

          {/* Loading */}
          {data.status === "loading" && (
            <ul className="farms-list" aria-busy="true" aria-label="Loading farms">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <div className="farms-row">
                    <div className="farm-placeholder farms-row__thumb" />
                    <div className="farms-row__text">
                      <span className="farms-row__skeleton" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Error */}
          {data.status === "error" && (
            <div className="farms-state" role="alert">
              <p className="farms-state__title">Something went wrong</p>
              <p className="farms-state__text">We couldn't load the farms.</p>
              <button
                type="button"
                className="farms-state__action"
                onClick={() => setAttempt((a) => a + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {/* Ready */}
          {data.status === "ready" &&
            (results.length === 0 ? (
              <div className="farms-state">
                <p className="farms-state__title">No farms match these filters</p>
                <p className="farms-state__text">
                  There are no farms that match the selected filters.
                </p>
                <button
                  type="button"
                  className="farms-state__action"
                  onClick={() => setFilters([])}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="farms-list">
                {results.map((farm) => (
                  <li key={farm.id}>
                    <Link
                      to={`/farms/${farm.id}`}
                      className={`farms-row ${selectedId === farm.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedId(farm.id)}
                      onMouseEnter={() => setHoveredId(farm.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(farm.id)}
                      onBlur={() => setHoveredId(null)}
                    >
                      {farm.photo ? (
                        <img className="farms-row__thumb" src={farm.photo} alt="" />
                      ) : (
                        <div className="farm-placeholder farms-row__thumb" />
                      )}

                      <div className="farms-row__text">
                        <span className="farms-row__name">{farm.name}</span>
                        <span className="farms-row__location">{farm.town}</span>
                      </div>

                      {farm.miles != null && (
                        <span className="farms-row__distance">{farm.miles} MI</span>
                      )}

                      <span className="farms-row__chevron" aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
        </section>

        {/* Map */}
        <section className="farms-map" aria-label="Map of farms">
          {mapFailed ? (
            <div className="farms-map__error" role="alert">
              <p>The map couldn't be loaded.</p>
              <p>You can still browse and open farms from the list.</p>
            </div>
          ) : isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={mapCenter}
              zoom={9}
              onLoad={setMap}
              onUnmount={() => setMap(null)}
            >
              {circleFarm && hasCoords(circleFarm) && circleFarm.deliveryRadiusMiles != null && (
                <Circle
                  key={circleFarm.id}
                  center={{ lat: Number(circleFarm.lat), lng: Number(circleFarm.lng) }}
                  radius={circleFarm.deliveryRadiusMiles * METERS_PER_MILE}
                  options={{
                    fillColor: "#1d4aa8",
                    fillOpacity: 0.08,
                    strokeColor: "#1d4aa8",
                    strokeWeight: 2,
                    clickable: false,
                  }}
                />
              )}

              {results.filter(hasCoords).map((farm) => {
                const hovered = farm.id === hoveredId;
                return (
                  <Marker
                    key={farm.id}
                    position={{ lat: Number(farm.lat), lng: Number(farm.lng) }}
                    title={farm.name}
                    animation={hovered ? window.google.maps.Animation.BOUNCE : null}
                    zIndex={hovered ? 999 : undefined}
                    onClick={() => setSelectedId(farm.id)}
                  />
                );
              })}
            </GoogleMap>
          ) : (
            <div className="farm-placeholder farms-map__surface" />
          )}
        </section>

        <div className="farms-viewswitch" role="group" aria-label="Map or list view">
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
            Map
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
            List
          </button>
        </div>
      </div>
    </div>
  );
}