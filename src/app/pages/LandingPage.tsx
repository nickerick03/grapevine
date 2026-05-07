import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { buildEmptySummary } from "@/lib/place-summary";
import { getAllPlaceSummaries, getPlaces } from "@/lib/services/places";
import type { PlaceRecord, PlaceVibeSummary } from "@/types/place";

import { LoadingState } from "@/components/common/LoadingState";
import { PlaceCard } from "@/components/places/PlaceCard";

const features = [
  "Community place ratings",
  "Search by traits",
  "Similar places",
  "Save favorites",
];

export function LandingPage() {
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [summaryMap, setSummaryMap] = useState<Map<string, PlaceVibeSummary>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loadedPlaces = await getPlaces({ city: "Budapest" });
        const top = loadedPlaces.slice(0, 3);
        const summaries = await getAllPlaceSummaries(top.map((place) => place.id));

        if (cancelled) return;

        setPlaces(top);
        setSummaryMap(new Map(summaries.map((summary) => [summary.place_id, summary])));
      } catch (error) {
        if (!cancelled) {
          setPlaces([]);
          setSummaryMap(new Map());
        }
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

  const previewPlaces = useMemo(() => places.slice(0, 3), [places]);

  return (
    <div className="absolute inset-0 overflow-y-auto space-y-8 bg-[#fbf8f3] px-4 py-4 pb-[76px]">
      <section className="grid gap-6 rounded-3xl border border-black/5 bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div className="space-y-3">
          <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-800">
            Community-powered place discovery
          </p>
          <h1 className="text-[34px] leading-tight tracking-tight text-gray-900">
            Find places by character, not just stars.
          </h1>
          <p className="text-[14px] text-gray-600">
            Grapevine helps you discover places by atmosphere. Every profile is built from real community impressions
            and evolves over time.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/explore" className="rounded-full bg-gray-900 px-5 py-2.5 text-[13px] text-white">
              Explore places
            </Link>
            <Link to="/account" className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[13px] text-gray-800">
              My account
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-rose-50 to-blue-50 p-4">
          <h2 className="text-[14px] text-gray-800">What you can do</h2>
          <ul className="mt-2 space-y-1.5 text-[13px] text-gray-600">
            {features.map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[22px] text-gray-900">Character sheet preview</h2>
        {loading ? (
          <LoadingState label="Loading featured places..." />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {previewPlaces.map((place) => (
              <PlaceCard key={place.id} place={place} summary={summaryMap.get(place.id) ?? buildEmptySummary(place)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
