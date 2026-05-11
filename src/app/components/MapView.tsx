import { useEffect, useMemo, useRef } from "react";
import { divIcon, point } from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useMapEvents } from "react-leaflet";

import { getMatchPinColor } from "./matchColors";
import { Pub } from "./vibe";

function MapFocus({
  selectedPub,
  selectionFocusToken,
  userLocation,
  located,
  focusYRatio,
}: {
  selectedPub?: Pub;
  selectionFocusToken: number;
  userLocation?: { lat: number; lng: number };
  located?: boolean;
  focusYRatio: number;
}) {
  const map = useMap();
  const lastSelectionFocusToken = useRef<number>(selectionFocusToken);

  useEffect(() => {
    const clampedFocusY = Math.min(0.9, Math.max(0.1, focusYRatio));

    const flyToWithVerticalFocus = (lat: number, lng: number, minZoom: number, duration: number) => {
      const zoom = Math.max(map.getZoom(), minZoom);

      if (Math.abs(clampedFocusY - 0.5) < 0.001) {
        map.flyTo([lat, lng], zoom, { duration });
        return;
      }

      const mapSize = map.getSize();
      const viewportCenter = point(mapSize.x / 2, mapSize.y / 2);
      const desiredTarget = point(mapSize.x / 2, mapSize.y * clampedFocusY);
      const delta = desiredTarget.subtract(viewportCenter);
      const projectedTarget = map.project([lat, lng], zoom).subtract(delta);
      const adjustedCenter = map.unproject(projectedTarget, zoom);

      map.flyTo(adjustedCenter, zoom, { duration });
    };

    if (userLocation && located) {
      flyToWithVerticalFocus(userLocation.lat, userLocation.lng, 14, 0.8);
      return;
    }

    if (selectedPub && selectionFocusToken !== lastSelectionFocusToken.current) {
      lastSelectionFocusToken.current = selectionFocusToken;
      flyToWithVerticalFocus(selectedPub.lat, selectedPub.lng, 13, 0.5);
    }
  }, [focusYRatio, located, map, selectedPub, selectionFocusToken, userLocation]);

  return null;
}

function MapViewportReporter({
  onMoveEnd,
  onBackgroundClick,
  bottomInsetPx = 0,
}: {
  onMoveEnd?: (payload: {
    lat: number;
    lng: number;
    zoom: number;
    bounds: { north: number; south: number; east: number; west: number };
  }) => void;
  onBackgroundClick?: () => void;
  bottomInsetPx?: number;
}) {
  const emitViewport = (targetMap: ReturnType<typeof useMap>) => {
    if (!onMoveEnd) {
      return;
    }
    const center = targetMap.getCenter();
    const bounds = targetMap.getBounds();
    onMoveEnd({
      lat: center.lat,
      lng: center.lng,
      zoom: targetMap.getZoom(),
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
    });
  };

  const map = useMapEvents({
    moveend(event) {
      emitViewport(event.target);
    },
    click() {
      onBackgroundClick?.();
    },
  });

  useEffect(() => {
    if (!onMoveEnd) {
      return;
    }

    // The map viewport height changes when drawer height changes.
    // Keep Leaflet bounds/center synced with the resized container.
    map.invalidateSize({ pan: false, animate: false });
    emitViewport(map);
  }, [bottomInsetPx, map, onMoveEnd]);

  return null;
}

function pinIcon(selected: boolean, match: number) {
  const pinColor = getMatchPinColor(match);
  const classes = [
    "map-pin",
    selected ? "map-pin--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
    html: `<div class="${classes}" ${selected ? "" : `style="background:${pinColor};"`}></div>`,
  });
}

export function MapView({
  pubs,
  selected,
  onSelect,
  located = false,
  userLocation,
  mapCenter,
  mapZoom = 13,
  selectionFocusToken = 0,
  focusYRatio = 0.5,
  onMapMoveEnd,
  onMapBackgroundClick,
  bottomInsetPx = 0,
}: {
  pubs: Pub[];
  selected?: string;
  onSelect: (id: string) => void;
  located?: boolean;
  userLocation?: { lat: number; lng: number };
  mapCenter?: { lat: number; lng: number };
  mapZoom?: number;
  selectionFocusToken?: number;
  focusYRatio?: number;
  onMapMoveEnd?: (payload: {
    lat: number;
    lng: number;
    zoom: number;
    bounds: { north: number; south: number; east: number; west: number };
  }) => void;
  onMapBackgroundClick?: () => void;
  bottomInsetPx?: number;
}) {
  const selectedPub = useMemo(() => pubs.find((pub) => pub.id === selected), [pubs, selected]);

  const center = useMemo<[number, number]>(() => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lng];
    }

    if (mapCenter) {
      return [mapCenter.lat, mapCenter.lng];
    }

    if (selectedPub) {
      return [selectedPub.lat, selectedPub.lng];
    }

    return [47.4979, 19.0402];
  }, [mapCenter, selectedPub, userLocation]);

  return (
    <div className="absolute left-0 right-0 top-0 overflow-hidden z-0" style={{ bottom: `${Math.max(0, bottomInsetPx)}px` }}>
      <MapContainer
        className="simple-leaflet-map"
        center={center}
        zoom={mapZoom}
        style={{ width: "100%", height: "100%", zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {pubs.map((pub) => {
          const isSelected = selected === pub.id;
          const matchScore = Number.isFinite(pub.match) ? pub.match : 0;
          return (
            <Marker
              key={pub.id}
              position={[pub.lat, pub.lng]}
              icon={pinIcon(isSelected, matchScore)}
              zIndexOffset={isSelected ? 500 : 0}
              eventHandlers={{
                click: () => onSelect(pub.id),
              }}
            >
              {isSelected ? (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="map-pill-tooltip map-pill-tooltip--active"
                  opacity={1}
                >
                  <div className="map-pill map-pill--active">{pub.name}</div>
                </Tooltip>
              ) : null}
            </Marker>
          );
        })}

        {userLocation ? (
          <>
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#3B82F6", fillOpacity: 1 }}
            />
            {located ? (
              <CircleMarker
                center={[userLocation.lat, userLocation.lng]}
                radius={18}
                pathOptions={{ color: "#60A5FA", weight: 1, fillColor: "#60A5FA", fillOpacity: 0.2 }}
              />
            ) : null}
          </>
        ) : null}

        <MapFocus
          selectedPub={selectedPub}
          selectionFocusToken={selectionFocusToken}
          userLocation={userLocation}
          located={located}
          focusYRatio={focusYRatio}
        />
        <MapViewportReporter
          onMoveEnd={onMapMoveEnd}
          onBackgroundClick={onMapBackgroundClick}
          bottomInsetPx={bottomInsetPx}
        />
      </MapContainer>
      <div className="map-warm-overlay pointer-events-none absolute inset-0" />
    </div>
  );
}
