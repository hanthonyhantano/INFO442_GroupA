import { GoogleMap, Marker, Circle } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const mapCenter = {
  lat: 47.655,
  lng: -122.303, // 98105
};

export default function FarmsMap({
  farms,
  selectedFarm,
  hoveredId,
  onSelectFarm,
}) {
  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={mapCenter}
      zoom={7}
    >
      {selectedFarm && (
        <Circle
          center={{
            lat: selectedFarm.lat,
            lng: selectedFarm.lng,
          }}
          radius={selectedFarm.deliveryRadiusMiles * 1609}
          options={{
            fillColor: "#1d4aa8",
            fillOpacity: 0.15,
            strokeColor: "#1d4aa8",
            strokeWeight: 2,
          }}
        />
      )}

      {farms.map((farm) => (
        <Marker
          key={farm.id}
          position={{
            lat: farm.lat,
            lng: farm.lng,
          }}
          onClick={() => onSelectFarm(farm.id)}
        />
      ))}
    </GoogleMap>
  );
}