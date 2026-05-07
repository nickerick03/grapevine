type AdVariant = "native" | "banner" | "rectangle" | "card";

interface AdUnitProps {
  variant?: AdVariant;
  className?: string;
}

const VARIANT_STYLES: Record<AdVariant, string> = {
  native: "min-h-[88px]",
  banner: "min-h-[100px]",
  rectangle: "min-h-[250px]",
  card: "min-h-[250px]",
};

const VARIANT_LABELS: Record<AdVariant, string> = {
  native: "In-feed ad slot",
  banner: "Banner ad slot",
  rectangle: "Rectangle ad slot",
  card: "Card ad slot",
};

export function AdUnit({ variant = "native", className = "" }: AdUnitProps) {
  return (
    <div
      className={[
        "rounded-2xl border border-dashed border-amber-200/80 bg-amber-50/55 px-4 py-3",
        "flex items-center justify-center text-center",
        VARIANT_STYLES[variant],
        className,
      ].join(" ")}
      aria-label="Ad placement reserved"
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-amber-700/80">Ad Placement Reserved</div>
        <div className="text-[12px] text-amber-800 mt-1">{VARIANT_LABELS[variant]}</div>
        <div className="text-[11px] text-amber-700/75 mt-1">Google AdSense will render here after integration.</div>
      </div>
    </div>
  );
}
