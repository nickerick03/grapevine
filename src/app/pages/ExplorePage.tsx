import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { AppLogo } from "@/app/components/AppLogo";
import { generatePlaceChips } from "@/lib/chips";
import { buildEmptySummary } from "@/lib/place-summary";
import { getAllPlaceSummaries, getCityOptions, getPlaces } from "@/lib/services/places";
import { DEFAULT_CITY } from "@/lib/vibe-config";
import type { PlaceRecord, PlaceVibeSummary } from "@/types/place";

import { AdSlot } from "@/components/common/AdSlot";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { ExploreMap } from "@/components/map/ExploreMap";
import { PlaceCard } from "@/components/places/PlaceCard";

const quickChips = [
  "cozy",
  "cheap",
  "classic",
  "modern",
  "lively",
  "quiet",
  "local",
  "tourist-friendly",
  "good for talking",
  "good for groups",
];

export function ExplorePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [summaryMap, setSummaryMap] = useState<Map<string, PlaceVibeSummary>>(new Map());
  const [cityOptions, setCityOptions] = useState<string[]>([DEFAULT_CITY]);

  const [query, setQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [loadedPlaces, loadedCities] = await Promise.all([getPlaces(), getCityOptions()]);
        const summaries = await getAllPlaceSummaries(loadedPlaces.map((place) => place.id));

        if (cancelled) return;

        setPlaces(loadedPlaces);
        setSummaryMap(new Map(summaries.map((summary) => [summary.place_id, summary])));

        const nextCities = loadedCities.length > 0 ? loadedCities : [DEFAULT_CITY];
        setCityOptions(nextCities);
        if (!nextCities.includes(selectedCity)) {
          setSelectedCity(nextCities[0]);
        }
      } catch (loadError) {
        if (cancelled) return;

        setError(loadError instanceof Error ? loadError.message : "Failed to load places.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return places.filter((place) => {
      if (selectedCity && place.city !== selectedCity) {
        return false;
      }

      if (selectedCategory !== "all" && place.category !== selectedCategory) {
        return false;
      }

      const summary = summaryMap.get(place.id) ?? buildEmptySummary(place);
      const chips = generatePlaceChips(summary);

      if (selectedChip && !chips.includes(selectedChip)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchable = [place.name, place.city, place.address ?? "", place.category, chips.join(" ")]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [places, query, selectedCategory, selectedChip, selectedCity, summaryMap]);

  useEffect(() => {
    if (filteredPlaces.length === 0) {
      setSelectedPlaceId(undefined);
      return;
    }

    if (!selectedPlaceId || !filteredPlaces.some((place) => place.id === selectedPlaceId)) {
      setSelectedPlaceId(filteredPlaces[0].id);
    }
  }, [filteredPlaces, selectedPlaceId]);

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>(["all"]);

    for (const place of places) {
      categories.add(place.category);
    }

    return [...categories];
  }, [places]);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#fbf8f3] px-4 py-4 pb-[76px]">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="order-2 space-y-3 lg:order-1">
          <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex items-center gap-2">
              <AppLogo />
              <p className="text-[14px] text-gray-700">Explore</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, address, city, category, or chip"
                className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-gray-400"
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12px] text-gray-500">City</span>
                <select
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px]"
                >
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] text-gray-500">Category</span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px]"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3">
              <p className="mb-2 text-[12px] text-gray-500">Quick chips</p>
              <div className="flex flex-wrap gap-1.5">
                {quickChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setSelectedChip((current) => (current === chip ? null : chip))}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      selectedChip === chip
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {loading ? <LoadingState label="Loading places..." /> : null}
          {error ? <EmptyState title="Could not load places" message={error} /> : null}

          {!loading && !error ? (
            filteredPlaces.length === 0 ? (
              <EmptyState title="No matching places" message="Try a different search, city, category, or chip." />
            ) : (
              <div className="space-y-3">
                {filteredPlaces.map((place, index) => {
                  const summary = summaryMap.get(place.id) ?? buildEmptySummary(place);

                  return (
                    <div key={place.id}>
                      {index > 0 && index % 4 === 0 ? <AdSlot className="mb-3" /> : null}
                      <PlaceCard
                        place={place}
                        summary={summary}
                        onSelect={() => setSelectedPlaceId(place.id)}
                        selected={selectedPlaceId === place.id}
                      />
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>

        <div className="order-1 lg:order-2">
          <ExploreMap
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
          />
        </div>
      </div>
    </div>
  );
}
