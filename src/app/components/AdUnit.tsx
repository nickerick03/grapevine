/**
 * Ad size reference (Google AdSense best performers for mobile):
 *
 *  variant="rectangle"  →  Medium Rectangle 300×250  ★ #1 fill rate globally
 *                           Use for: prominent between-section placements
 *
 *  variant="banner"     →  Large Mobile Banner 320×100  (2× standard 320×50)
 *                           Use for: inline list breaks, under-map strips
 *
 *  variant="native"     →  In-feed / in-article fluid  (no fixed px dimensions)
 *                           Use for: list feed insertions, search results
 *
 *  variant="card"       →  Square 250×250  (grid cell ad)
 *                           Use for: 2-column grid inserts
 *
 * Replace mock content with real AdSense tags, e.g.:
 *   <ins class="adsbygoogle"
 *        data-ad-client="ca-pub-XXXXXXXXXXXX"
 *        data-ad-slot="XXXXXXXXXX"
 *        data-ad-format="rectangle"
 *        style="display:inline-block;width:300px;height:250px" />
 */

type AdVariant = "native" | "banner" | "rectangle" | "card";

interface AdUnitProps {
  variant?: AdVariant;
  className?: string;
  /** Rotates through mock ad creatives */
  index?: number;
}

const MOCK_ADS = [
  {
    brand: "Birra Moretti",
    headline: "Experience the Italian spirit",
    body: "Find pubs serving authentic Italian craft beers near you. 100% brewed in Italy since 1859.",
    cta: "Discover now",
    color: "#e8a020",
    colorLight: "#fef3dc",
    bg: "from-amber-100 via-orange-50 to-amber-50",
    tag: "Craft Beer",
  },
  {
    brand: "BrewDog",
    headline: "Craft beer, done different",
    body: "Over 200 bars worldwide. Find your nearest BrewDog and try the award-winning Punk IPA today.",
    cta: "Find a bar",
    color: "#1e3a5f",
    colorLight: "#dce8f5",
    bg: "from-blue-100 via-indigo-50 to-blue-50",
    tag: "Craft Bars",
  },
  {
    brand: "Heineken®",
    headline: "Open your world",
    body: "Enjoy responsibly. Ask your bartender for ice-cold Heineken.",
    cta: "Learn more",
    color: "#007a33",
    colorLight: "#d4f0e0",
    bg: "from-emerald-100 via-green-50 to-emerald-50",
    tag: "Premium Lager",
  },
  {
    brand: "Guinness",
    headline: "Good things come to those who wait",
    body: "The perfect pint, poured exactly right. Find a Guinness-certified pub near you tonight.",
    cta: "Find a pub",
    color: "#1a1a1a",
    colorLight: "#e8e8e8",
    bg: "from-gray-200 via-slate-100 to-gray-50",
    tag: "Stout",
  },
];

export function AdUnit({ variant = "native", className = "", index = 0 }: AdUnitProps) {
  const ad = MOCK_ADS[index % MOCK_ADS.length];

  /* ─────────────────────────────────────────────────────────────────────
     RECTANGLE variant — 300×250 Medium Rectangle (full-width on mobile)
     The highest-earning AdSense format.
  ───────────────────────────────────────────────────────────────────── */
  if (variant === "rectangle") {
    return (
      <div
        className={`relative rounded-2xl border border-gray-200 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.07)] overflow-hidden ${className}`}
        /*
         * Replace with:
         * <ins class="adsbygoogle"
         *      style="display:block"
         *      data-ad-client="ca-pub-XXXXXXXXXXXX"
         *      data-ad-slot="XXXXXXXXXX"
         *      data-ad-format="rectangle"
         *      data-full-width-responsive="true" />
         */
      >
        {/* Visual zone */}
        <div className={`relative h-40 bg-gradient-to-br ${ad.bg} flex flex-col items-center justify-center gap-3`}>
          <div className="absolute top-2 left-3">
            <span className="text-[9px] text-gray-400 uppercase tracking-widest">Sponsored</span>
          </div>

          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/60"
            style={{ background: ad.color }}
          >
            <span className="text-white text-[22px] font-semibold tracking-tight">
              {ad.brand.slice(0, 2).toUpperCase()}
            </span>
          </div>

          <div
            className="px-3 py-0.5 rounded-full text-[10px] border"
            style={{ background: ad.colorLight, color: ad.color, borderColor: `${ad.color}33` }}
          >
            {ad.tag}
          </div>
        </div>

        {/* Text zone */}
        <div className="px-4 py-3">
          <div className="text-gray-900 text-[14px] leading-snug">{ad.headline}</div>
          <div className="text-gray-500 text-[12px] mt-1 leading-relaxed line-clamp-2">{ad.body}</div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-gray-400">{ad.brand}</span>
            <button
              className="px-4 py-1.5 rounded-full text-white text-[12px] shadow-sm active:scale-95 transition-transform"
              style={{ background: ad.color }}
            >
              {ad.cta}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────
     BANNER variant — Large Mobile Banner 320×100
  ───────────────────────────────────────────────────────────────────── */
  if (variant === "banner") {
    return (
      <div
        className={`relative rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden ${className}`}
      >
        <div className="absolute top-1.5 left-2.5">
          <span className="text-[9px] text-gray-300 uppercase tracking-widest">Sponsored</span>
        </div>

        <div className={`flex items-center gap-3 px-3 pt-6 pb-3 bg-gradient-to-r ${ad.bg}`}>
          <div
            className="w-10 h-10 rounded-xl flex-none flex items-center justify-center shadow-sm border border-white/80"
            style={{ background: ad.color }}
          >
            <span className="text-white text-[10px] font-medium leading-none text-center px-1">
              {ad.brand.slice(0, 2).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-gray-900 text-[12px] truncate">{ad.headline}</div>
            <div className="text-gray-500 text-[10px] mt-0.5 truncate">{ad.brand}</div>
          </div>

          <button
            className="flex-none px-3 py-1.5 rounded-full text-white text-[11px] shadow-sm whitespace-nowrap"
            style={{ background: ad.color }}
          >
            {ad.cta}
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────
     CARD variant — Square 250×250 (grid cell)
  ───────────────────────────────────────────────────────────────────── */
  if (variant === "card") {
    return (
      <div className={`relative rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden ${className}`}>
        <div className="absolute top-1.5 left-2.5 z-10">
          <span className="text-[9px] text-gray-300 uppercase tracking-widest">Ad</span>
        </div>

        <div className={`h-28 bg-gradient-to-br ${ad.bg} flex items-center justify-center`}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow"
            style={{ background: ad.color }}
          >
            <span className="text-white text-[14px] font-medium">{ad.brand.slice(0, 2).toUpperCase()}</span>
          </div>
        </div>

        <div className="p-2.5">
          <div className="text-gray-900 text-[12px] truncate">{ad.brand}</div>
          <div className="text-gray-500 text-[10px] mt-0.5 truncate">{ad.headline}</div>
          <button
            className="mt-2 w-full py-1.5 rounded-xl text-white text-[10px] shadow-sm"
            style={{ background: ad.color }}
          >
            {ad.cta}
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────
     NATIVE variant (default) — In-feed / in-article fluid
  ───────────────────────────────────────────────────────────────────── */
  return (
    <div
      className={`relative rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden ${className}`}
    >
      <div className="absolute top-1.5 left-2.5">
        <span className="text-[9px] text-gray-300 uppercase tracking-widest">Sponsored</span>
      </div>

      <div className={`flex items-start gap-3 px-3 pt-6 pb-3 bg-gradient-to-br ${ad.bg}`}>
        <div
          className="w-14 h-14 rounded-xl flex-none flex items-center justify-center shadow border border-white/60"
          style={{ background: ad.color }}
        >
          <span className="text-white text-[13px] font-medium leading-tight text-center px-1">
            {ad.brand.slice(0, 2).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-gray-900 text-[13px]">{ad.headline}</div>
          <div className="text-gray-500 text-[11px] mt-0.5 line-clamp-1">{ad.body}</div>
          <div className="flex items-center gap-2 mt-2">
            <button
              className="px-3 py-1 rounded-full text-white text-[11px] shadow-sm"
              style={{ background: ad.color }}
            >
              {ad.cta}
            </button>
            <span className="text-[10px] text-gray-400">{ad.brand}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
