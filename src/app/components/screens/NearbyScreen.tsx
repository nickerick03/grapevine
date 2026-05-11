import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Search, X } from "lucide-react";
import { NavigationArrow, MapPin, Star } from "@phosphor-icons/react";
import { SLIDERS, type Pub } from "../vibe";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { BottomNav } from "../BottomNav";
import { useUI } from "../../context/UIContext";
import { AdUnit } from "../AdUnit";
import { MapView } from "../MapView";
import { useFilters } from "../../context/FilterContext";
import { usePlaces } from "../../context/PlacesContext";
import { radiusValueToKm, TOURIST_HEAVY_THRESHOLD } from "../filtering";
import { formatDistance, useSettings } from "../../context/SettingsContext";
import { formatPubAddress } from "../placeAddress";
import { getTraitPillSlug } from "@/lib/chips";
import { AppLogo } from "../AppLogo";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type NearbyItem = {
  pub: Pub;
  distanceKm: number;
};

export function NearbyScreen() {
  const navigate = useNavigate();
  const { openRate } = useUI();
  const { pubs } = usePlaces();
  const { searchRadius } = useFilters();
  const { distanceUnit, showTouristHeavyBars } = useSettings();

  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [locationError, setLocationError] = useState<string | null>(null);

  const openPill = (pill: string, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    navigate(`/pill/${getTraitPillSlug(pill)}`);
  };

  const radiusKm = useMemo(() => radiusValueToKm(searchRadius), [searchRadius]);
  const effectiveRadiusKm = Number.isFinite(radiusKm) ? radiusKm : 30;
  const effectiveRadiusLabel = effectiveRadiusKm < 10
    ? formatDistance(effectiveRadiusKm, distanceUnit, 1)
    : formatDistance(Math.round(effectiveRadiusKm), distanceUnit, 0);

  const nearbyWithDistance = useMemo<NearbyItem[]>(() => {
    if (!userLocation) {
      return [];
    }

    return pubs.map((pub) => ({
      pub,
      distanceKm: haversineKm(userLocation.lat, userLocation.lng, pub.lat, pub.lng),
    }))
      .filter((item) => (showTouristHeavyBars ? true : item.pub.vibe.touristy < TOURIST_HEAVY_THRESHOLD))
      .filter((item) => item.distanceKm <= effectiveRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [effectiveRadiusKm, pubs, showTouristHeavyBars, userLocation]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return nearbyWithDistance;
    }

    const q = query.toLowerCase();
    return nearbyWithDistance.filter(
      ({ pub }) => pub.name.toLowerCase().includes(q) || pub.area.toLowerCase().includes(q) || pub.city.toLowerCase().includes(q),
    );
  }, [nearbyWithDistance, query]);

  const selectedPub = useMemo(
    () => filtered.find((item) => item.pub.id === selected)?.pub ?? filtered[0]?.pub,
    [filtered, selected],
  );

  useEffect(() => {
    if (filtered.length > 0) {
      setSelected((current) => current ?? filtered[0].pub.id);
    } else {
      setSelected(undefined);
    }
  }, [filtered]);

  const locateUser = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not available on this device.");
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location access is blocked. Allow location to see nearby bars."
            : "Could not get your location right now. Please try again.";
        setLocationError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 45000 },
    );
  };

  useEffect(() => {
    locateUser();
    // Intentionally run once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      <div className="flex-none px-4 pt-3 pb-2 bg-white/80 backdrop-blur border-b border-gray-100 z-10">
        <div className="flex items-center gap-2 mb-2">
          <AppLogo className="h-9 w-9" />
          <div className="flex-1">
            <div className="text-gray-900 text-[16px]">Bars Near You</div>
          </div>
          <button
            onClick={locateUser}
            className={`w-9 h-9 rounded-full shadow border flex items-center justify-center transition-all duration-300 ${
              locating
                ? "bg-blue-500 border-blue-400 text-white"
                : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            <NavigationArrow weight={locating ? "fill" : "regular"} size={18} className={locating ? "animate-pulse" : ""} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nearby bars…"
            className="w-full pl-9 pr-9 py-2 rounded-full bg-gray-100 text-[13px] outline-none focus:bg-white border border-transparent focus:border-gray-200 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[76px]">
        <div className="px-4 pt-3 pb-2">
          <div className="text-[12px] text-gray-500">
            {locating && "Finding your location…"}
            {!locating && locationError}
            {!locating &&
              !locationError &&
              userLocation &&
              `${filtered.length} ${filtered.length === 1 ? "place" : "places"} within ${effectiveRadiusLabel} radius`}
            {!locating && !locationError && !userLocation && "Enable location to discover bars around you."}
          </div>
        </div>

        <div className="mx-4 mb-3 h-48 rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative">
          <MapView
            pubs={filtered.map((item) => item.pub)}
            selected={selectedPub?.id}
            onSelect={setSelected}
            located={locating}
            userLocation={userLocation}
          />
        </div>

        <div className="px-4 mb-3">
          <AdUnit variant="rectangle" />
        </div>

        <div className="px-4 space-y-2">
          {!userLocation ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
              <div className="text-gray-900 text-[15px]">Location needed</div>
              <div className="text-[12px] text-gray-500 mt-1">
                Turn on location access so we can show nearby places on the map and list.
              </div>
              <button
                onClick={locateUser}
                className="mt-4 px-4 py-2 rounded-full bg-gray-900 text-white text-[13px]"
              >
                Use my location
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-2xl mb-3">📍</div>
              <div className="text-gray-700">No bars matched your nearby search</div>
              <div className="text-[12px] text-gray-500 mt-1">Try a larger radius or clear the search text.</div>
            </div>
          ) : (
            filtered.map(({ pub, distanceKm }, index) => (
              <div key={pub.id}>
                {index > 0 && index % 3 === 0 ? <AdUnit variant="native" className="mb-2" /> : null}
                <button
                  onClick={() => navigate(`/detail/${pub.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex gap-0"
                >
                  <div className="relative w-24 flex-none">
                    <ImageWithFallback src={pub.image} alt={pub.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5" />
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-gray-900 text-[14px] truncate">{pub.name}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} weight="duotone" className="text-blue-400" />
                          <span className="truncate">{formatPubAddress(pub)}</span>
                        </div>
                      </div>
                      <div className="flex-none text-right">
                        <div className="text-[12px] text-blue-600">{formatDistance(distanceKm, distanceUnit, 1)}</div>
                        <div className="flex items-center gap-0.5 mt-0.5 justify-end">
                          <Star size={10} weight="fill" className="text-amber-400" />
                          <span className="text-[11px] text-gray-500">{pub.ratings}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1 mt-2">
                      {SLIDERS.map((slider) => (
                        <div key={slider.key} className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                          {pub.ratings > 0 ? (
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pub.vibe[slider.key]}%`, background: slider.color, opacity: 0.65 }}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {pub.chips.slice(0, 2).map((chip) => (
                        <span
                          key={chip}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors"
                          onClick={(event) => openPill(chip, event)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openPill(chip);
                            }
                          }}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              </div>
            ))
          )}

          <div className="pt-2 pb-2">
            <button
              onClick={() => openRate(selectedPub?.id)}
              className="w-full py-3 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-[13px] hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              + Rate a place you've visited
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
