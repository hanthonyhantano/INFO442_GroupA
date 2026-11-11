import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GoogleMap,
  Marker,
  Circle,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useNavigation } from "../navigation/useNavigation";
import {
  fetchFarmList as fetchFarms,
  fetchZipCenter,
  normalizeZip,
} from "../lib/farmsApi";

const DEFAULT_CENTER = { lat: 47.655, lng: -122.303 };
const METERS_PER_MILE = 1609.34;

// A farm delivers to you if your ZIP is in one of its delivery zones,
// or if you're inside its delivery radius. Both come from the database.
function checkDelivers(farm, zip, exactMiles) {
  if (!zip) return false;

  const inZone = (farm.deliveryZips ?? []).some((z) => normalizeZip(z) === zip);
  const inRadius =
    exactMiles != null &&
    farm.deliveryRadiusMiles != null &&
    exactMiles <= Number(farm.deliveryRadiusMiles);

  return inZone || inRadius;
}

const deliversTo = (farm) => farm.delivers;

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

  // Google reports bad key / billing / referrer problems here, not in loadError
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
  const cleanZip = normalizeZip(zip);
  const [origin, setOrigin] = useState(null);

  useEffect(() => {
    // Drop the old ZIP's distances right away so they never show for the new ZIP
    setOrigin(null);
    if (!cleanZip) return;

    let cancelled = false;

    // Runs again once Google Maps has loaded, so the geocoding fallback can work
    fetchZipCenter(cleanZip)
      .then((center) => {
        if (cancelled) return;
        const point = toLatLng(center);
        if (!point) console.warn(`No coordinates for ZIP ${cleanZip}:`, center);
        setOrigin(point);
      })
      .catch((err) => {
        console.error("fetchZipCenter failed:", err);
        if (!cancelled) setOrigin(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanZip, isLoaded]);

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

  // Add a distance to each farm once we know where the ZIP is
  const farmsWithMiles = useMemo(
    () =>
      data.farms.map((farm) => {
        const exactMiles = origin
          ? milesBetween(origin, { lat: Number(farm.lat), lng: Number(farm.lng) })
          : null;
        const valid = Number.isFinite(exactMiles);

        const miles = valid ? exactMiles : null;

        return {
          ...farm,
          exactMiles: miles,
          miles: valid ? Math.round(exactMiles) : null,
          delivers: checkDelivers(farm, cleanZip, miles),
        };
      }),
    [data.farms, origin, cleanZip]
  );

  const results = useMemo(() => {
    const activeFilters = FILTERS.filter((f) => filters.includes(f.id));
    const filtered = farmsWithMiles.filter((farm) =>
      activeFilters.every((f) => f.test(farm))
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
  }, [farmsWithMiles, filters, sort]);

  const deliverCount = results.filter(deliversTo).length;
  // Remember the last farm hovered, so the circle stays after the mouse leaves
  const [lastHoveredId, setLastHoveredId] = useState(null);

  useEffect(() => {
    if (hoveredId != null) setLastHoveredId(hoveredId);
  }, [hoveredId]);

  // The circle is always shown: hovered farm, then last hovered, then the first in the list
  const circleFarm =
    results.find((farm) => farm.id === hoveredId) ??
    results.find((farm) => farm.id === lastHoveredId) ??
    results[0] ??
    null;
  const showCircle = Boolean(circleFarm && circleFarm.deliveryRadiusMiles != null);

  // Starting view: the ZIP, then Seattle. The map then pans to the circle's farm.
  const mapCenter = useMemo(() => origin ?? DEFAULT_CENTER, [origin]);

  // Keep the map instance so we can pan without re-rendering the whole map
  const [map, setMap] = useState(null);

  const circleLat = circleFarm ? Number(circleFarm.lat) : null;
  const circleLng = circleFarm ? Number(circleFarm.lng) : null;

  useEffect(() => {
    if (!map || circleLat == null || circleLng == null) return;
    if (!Number.isFinite(circleLat) || !Number.isFinite(circleLng)) return;
    map.panTo({ lat: circleLat, lng: circleLng });
  }, [map, circleLat, circleLng]);

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
              {/* One circle that stays mounted and moves between farms, so a
                  stale copy can't be left behind on the map */}
              <Circle
                center={
                  showCircle
                    ? { lat: Number(circleFarm.lat), lng: Number(circleFarm.lng) }
                    : mapCenter
                }
                radius={showCircle ? circleFarm.deliveryRadiusMiles * METERS_PER_MILE : 0}
                options={{
                  visible: showCircle,
                  fillColor: "#1d4aa8",
                  fillOpacity: 0.08,
                  strokeColor: "#1d4aa8",
                  strokeWeight: 2,
                  clickable: false,
                }}
              />

              {results.map((farm) => {
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