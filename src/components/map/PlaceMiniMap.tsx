import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { divIcon } from "leaflet";

interface PlaceMiniMapProps {
  latitude: number;
  longitude: number;
  name: string;
}

const markerIcon = divIcon({
  className: "",
  html: "<div style='width:20px;height:20px;border-radius:999px;background:#E87531;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.24);'></div>",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export function PlaceMiniMap({ latitude, longitude, name }: PlaceMiniMapProps) {
  return (
    <div className="h-44 overflow-hidden rounded-2xl border border-gray-200">
      <MapContainer center={[latitude, longitude]} zoom={15} style={{ height: "100%", width: "100%" }} dragging>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={markerIcon} title={name} />
      </MapContainer>
    </div>
  );
}
