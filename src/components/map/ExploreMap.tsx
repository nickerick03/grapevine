import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { divIcon, type LatLngExpression } from "leaflet";

import { DEFAULT_BUDAPEST_CENTER } from "@/lib/vibe-config";
import type { PlaceRecord } from "@/types/place";

interface ExploreMapProps {
  places: PlaceRecord[];
  selectedPlaceId?: string;
  onSelectPlace: (placeId: string) => void;
}

function buildMarkerIcon(active: boolean) {
  return divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:${
      active ? "#111827" : "#E87531"
    };border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.24);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function ExploreMap({ places, selectedPlaceId, onSelectPlace }: ExploreMapProps) {
  const center = useMemo<LatLngExpression>(() => {
    if (places.length === 0) {
      return [DEFAULT_BUDAPEST_CENTER.lat, DEFAULT_BUDAPEST_CENTER.lng];
    }

    const selected = places.find((place) => place.id === selectedPlaceId);

    if (selected) {
      return [selected.latitude, selected.longitude];
    }

    return [places[0].latitude, places[0].longitude];
  }, [places, selectedPlaceId]);

  return (
    <div className="h-[320px] overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] md:h-[560px]">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {places.map((place) => (
          <Marker
            key={place.id}
            icon={buildMarkerIcon(place.id === selectedPlaceId)}
            position={[place.latitude, place.longitude]}
            eventHandlers={{ click: () => onSelectPlace(place.id) }}
          >
            <Popup>
              <div className="text-[12px]">
                <p className="text-[13px] text-gray-900">{place.name}</p>
                <p className="text-gray-500">{place.address ?? `${place.city}`}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
