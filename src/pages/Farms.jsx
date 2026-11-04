import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GoogleMap,
  Marker,
  Circle,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useNavigation } from "../navigation/useNavigation";

const FARMS = [
  {
    id: 1,
    name: "Lorem Ranch",
    town: "Ellensburg, WA",
    miles: 108,
    deliveryZips: ["98105", "98101"],
    pickup: true,
    tags: ["Grass-finished"],
    lat: 47.0030,
    lng: -120.5478,
    deliveryRadiusMiles: 15,
  },
  {
    id: 2,
    name: "Dolor Farm",
    town: "Enumclaw, WA",
    miles: 42,
    deliveryZips: ["98105", "98101"],
    pickup: true,
    tags: [],
    lat: 47.2043,
    lng: -121.9915,
    deliveryRadiusMiles: 10,
  },
  {
    id: 3,
    name: "Ipsum Grazing",
    town: "Walla Walla, WA",
    miles: 260,
    deliveryZips: [],
    pickup: false,
    tags: ["Grass-finished"],
    lat: 46.0646,
    lng: -118.3430,
    deliveryRadiusMiles: 8,
  },
  {
    id: 4,
    name: "Amet Cattle Co.",
    town: "Sequim, WA",
    miles: 78,
    deliveryZips: ["98105"],
    pickup: false,
    tags: [],
    lat: 48.0795,
    lng: -123.1012,
    deliveryRadiusMiles: 12,
  },
];

const deliversTo = (farm, zip) =>
  Boolean(zip) && farm.deliveryZips.includes(zip);

const FILTERS = [
  {
    id: "delivers",
    label: "Delivers to me",
    test: (farm, zip) => deliversTo(farm, zip),
  },
  {
    id: "pickup",
    label: "Pickup nearby",
    test: (farm) => farm.pickup,
  },
  {
    id: "grass",
    label: "Grass-finished",
    test: (farm) => farm.tags.includes("Grass-finished"),
  },
];

export default function FarmsPage() {
  const { zip } = useNavigation(); 
  
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey:
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  }); 

  const [sort, setSort] = useState("closest");
  const [filters, setFilters] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(2);
  const [view, setView] = useState("list");

  const toggleFilter = (id) => {
    setFilters((prev) =>
      prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id]
    );
  };

  const results = useMemo(() => {
  const activeFilters = FILTERS.filter((filter) => filters.includes(filter.id));

  const filtered = FARMS.filter((farm) =>
    activeFilters.every((filter) => filter.test(farm, zip))
  );

  return [...filtered].sort((a, b) =>
    sort === "az" ? a.name.localeCompare(b.name) : a.miles - b.miles
  );
}, [filters, sort, zip]);

const deliverCount = results.filter((farm) => deliversTo(farm, zip)).length;

  const selectedFarm =
    results.find((farm) => farm.id === selectedId) || null;

  return (
    <div className="farm-page">
      <div className={`farms-layout farms-layout--${view}`}>
        {/* Left Panel */}

        <section className="farms-panel">
          <h1 className="farms-panel__title">
            {zip ? `Farms near ${zip}` : "Farms"}
          </h1>

          <p className="farms-panel__count">
            {results.length} farms
            {zip
              ? ` · ${deliverCount} deliver to you`
              : " · Set your ZIP to see which deliver to you"}
          </p>
          <div className="farms-filters">
            <div className="farms-filters__chips">
              {FILTERS.map((filter) => {
                const active = filters.includes(filter.id);

                return (
                  <button
                    key={filter.id}
                    type="button"
                    className={`farms-chip ${
                      active ? "is-active" : ""
                    }`}
                    onClick={() => toggleFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <label className="farms-sort">
              <span>Sort:</span>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="closest">Closest</option>
                <option value="az">A–Z</option>
              </select>
            </label>
          </div>

          {results.length === 0 ? (
            <div className="farms-state">
              <p className="farms-state__title">
                No farms match these filters
              </p>

              <p className="farms-state__text">
                There are no farms that match the
                selected filters.
              </p>

              <button
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
                    className={`farms-row ${
                      selectedId === farm.id ? "is-selected" : ""
                    }`}
                    onClick={() => setSelectedId(farm.id)}
                    onMouseEnter={() => setHoveredId(farm.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div className="farm-placeholder farms-row__thumb" />

                    <div className="farms-row__text">
                      <span className="farms-row__name">
                        {farm.name}
                      </span>

                      <span className="farms-row__location">
                        {farm.town}
                      </span>

                      <span className="farms-row__skeleton" />
                    </div>

                    <span className="farms-row__distance">
                      {farm.miles} MI
                    </span>

                    <span className="farms-row__chevron">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Map */}

        <section
        className="farms-map"
        aria-label="Map of farms"
        >
        {isLoaded ? (
          <GoogleMap
            key={selectedId}
            mapContainerStyle={{
              width: "100%",
              height: "100%",
            }}
            center={{
              lat: selectedFarm?.lat ?? 47.655,
              lng: selectedFarm?.lng ?? -122.303,
            }}
            zoom={9}
          >
            {selectedFarm ? (
              <Circle
                key={selectedFarm.id}
                center={{
                  lat: selectedFarm.lat,
                  lng: selectedFarm.lng,
                }}
                radius={selectedFarm.deliveryRadiusMiles * 1609.34}
                options={{
                  fillColor: "#1d4aa8",
                  fillOpacity: 0.08,
                  strokeColor: "#1d4aa8",
                  strokeWeight: 2,
                  clickable: false,
                }}
              />
            ) : null}

            {results.map((farm) => (
              <Marker
                key={farm.id}
                position={{
                  lat: farm.lat,
                  lng: farm.lng,
                }}
                onClick={() => {
                  console.log("clicked", farm.id);
                  setSelectedId(farm.id);
                }}
              />
            ))}
          </GoogleMap>
        ) : (
          <div className="farm-placeholder farms-map__surface" />
        )}
      </section>
              

        {/* Mobile Toggle */}

        <div
          className="farms-viewswitch"
          role="group"
          aria-label="Map List Toggle"
        >
          <button
            type="button"
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            Map
          </button>

          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </div>
    </div>
  );
}