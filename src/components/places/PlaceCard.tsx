import { Link } from "react-router";

import { generatePlaceChips } from "@/lib/chips";
import type { PlaceRecord, PlaceVibeSummary } from "@/types/place";

import { Chip } from "@/components/common/Chip";
import { ConfidenceBadge } from "@/components/common/ConfidenceBadge";
import { MiniVibeProfile } from "@/components/places/MiniVibeProfile";

interface PlaceCardProps {
  place: PlaceRecord;
  summary: PlaceVibeSummary;
  onSelect?: () => void;
  selected?: boolean;
}

export function PlaceCard({ place, summary, onSelect, selected = false }: PlaceCardProps) {
  const chips = generatePlaceChips(summary).slice(0, 4);

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition ${
        selected ? "border-gray-900" : "border-gray-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to={`/places/${place.slug}`} className="text-[16px] text-gray-900 hover:text-gray-700">
            {place.name}
          </Link>
          <p className="text-[12px] text-gray-500">
            {place.category} · {place.address ?? "Address unavailable"}
          </p>
        </div>
        <ConfidenceBadge confidence={summary.confidence_level} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <Chip key={chip} label={chip} />
        ))}
      </div>

      <p className="mt-2 text-[12px] text-gray-500">{summary.rating_count} ratings</p>

      <div className="mt-3">
        <MiniVibeProfile summary={summary} />
      </div>

      {onSelect ? (
        <button
          onClick={onSelect}
          className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 text-[12px] text-gray-700 hover:border-gray-300"
        >
          {selected ? "Selected on map" : "Highlight on map"}
        </button>
      ) : null}
    </article>
  );
}
