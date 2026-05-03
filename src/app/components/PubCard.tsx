import { Pub, SLIDERS } from "./vibe";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function PubCard({
  pub,
  onClick,
  compact,
  selected,
}: {
  pub: Pub;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl transition-all overflow-hidden ${
        selected
          ? "shadow-[0_2px_16px_rgba(0,0,0,0.06)] border-2 border-gray-900"
          : "shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)] border border-gray-100"
      }`}
    >
      <div className="flex gap-3 p-3">
        <ImageWithFallback
          src={pub.image}
          alt={pub.name}
          className="w-20 h-20 rounded-xl object-cover flex-none"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-gray-900">{pub.name}</div>
              <div className="text-[12px] text-gray-500 truncate">
                {pub.area} · {pub.ratings} ratings
              </div>
            </div>
            <div className="flex-none px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] border border-emerald-100">
              {pub.match}% match
            </div>
          </div>

          <p className="text-[12px] text-gray-600 mt-1 line-clamp-1">{pub.summary}</p>

          {/* Vibe bars */}
          <div className="flex gap-1 mt-2">
            {SLIDERS.map((s) => (
              <div key={s.key} className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pub.vibe[s.key]}%`, background: s.color }}
                />
              </div>
            ))}
          </div>

          {/* Vibe legend — only shown on selected card */}
          {selected && (
            <div className="flex gap-1 mt-0.5">
              {SLIDERS.map((s) => {
                const label = pub.vibe[s.key] > 50 ? s.right : s.left;
                return (
                  <div key={s.key} className="flex-1 text-center overflow-hidden">
                    <span
                      className="text-[8px] leading-none"
                      style={{ color: s.color }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}