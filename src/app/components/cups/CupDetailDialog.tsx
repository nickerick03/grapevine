import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/app/components/ui/dialog";
import { formatCupPeriod } from "@/lib/cup-display";
import { resolveCupArtworkUrl, svgMarkupToDataUri } from "@/lib/cup-artwork";

export interface CupDetailData {
  name: string;
  description?: string | null;
  artworkUrl?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  rewardPoints?: number | null;
  placement?: 1 | 2 | 3 | null;
  cupScore?: number | null;
  rewardPointsAwarded?: number | null;
  awardedAt?: string | null;
  badgeSvgMarkup?: string | null;
}

interface CupDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cup: CupDetailData | null;
}

export function CupDetailDialog({ open, onOpenChange, cup }: CupDetailDialogProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [open]);

  const artworkUrl = resolveCupArtworkUrl({
    artworkUrl: cup?.artworkUrl,
    svgMarkup: cup?.badgeSvgMarkup ?? null,
  }) ?? (cup?.badgeSvgMarkup ? svgMarkupToDataUri(cup.badgeSvgMarkup) : null);

  const description = cup?.description?.trim() || "No description available.";
  const period = cup ? formatCupPeriod(cup.startAt ?? null, cup.endAt ?? null, cup.awardedAt ?? null) : "";
  const rewardPoints = Math.max(0, Math.round(cup?.rewardPoints ?? 0));

  const timeLeftLabel = useMemo(() => {
    const endAt = cup?.endAt ? new Date(cup.endAt) : null;
    if (!endAt || Number.isNaN(endAt.getTime())) {
      return "Time left unavailable";
    }

    const diffMs = endAt.getTime() - nowTick;
    if (diffMs <= 0) {
      return "Cup has ended";
    }

    const totalMinutes = Math.floor(diffMs / 60_000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    return `${days}d ${hours}h ${minutes}m left`;
  }, [cup?.endAt, nowTick]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!top-3 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%] max-w-[calc(100%-1.5rem)] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-0 sm:max-w-md sm:max-h-[calc(100dvh-2rem)] [&>button]:hidden">
        <div className="relative">
          <div className="w-full aspect-[6/5] bg-[#f6f1e6] overflow-hidden flex items-center justify-center">
            {artworkUrl ? (
              <img src={artworkUrl} alt={`${cup?.name ?? "Cup"} artwork`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl">🏆</div>
            )}
          </div>

          <div className="absolute top-3 right-3 z-10">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full border border-white/80 bg-black/45 text-white flex items-center justify-center backdrop-blur-sm"
              aria-label="Close cup details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4 pb-6 sm:p-5">

          <div className="mt-4">
            <DialogTitle className="text-[20px] leading-tight text-gray-900">{cup?.name ?? "Cup details"}</DialogTitle>
            <DialogDescription className="mt-1 text-[12px] text-gray-500">{period}</DialogDescription>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
              <div className="text-[11px] text-blue-700">Time remaining</div>
              <div className="mt-0.5 text-[15px] text-blue-900">{timeLeftLabel}</div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[11px] text-emerald-700">All-time points reward</div>
              <div className="mt-0.5 text-[18px] text-emerald-900">{rewardPoints} pts</div>
              {cup?.placement ? (
                <div className="mt-1 text-[11px] text-emerald-800">
                  Placement #{cup.placement} · Cup score {cup.cupScore ?? 0}
                </div>
              ) : null}
              {cup?.rewardPointsAwarded ? (
                <div className="text-[11px] text-emerald-800">Reward awarded: {Math.max(0, Math.round(cup.rewardPointsAwarded))} pts</div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[13px] leading-relaxed text-gray-700">{description}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
