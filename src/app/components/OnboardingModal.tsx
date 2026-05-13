import { useMemo, useRef, useState, type TouchEventHandler } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SLIDERS, type SliderKey, type VibeProfile } from "./vibe";
import { VibeSlider } from "./VibeSlider";
import { directionalToLegacyScore, legacyScoreToDirectional } from "@/lib/vibe-scale";

type OnboardingModalProps = {
  initialValues: VibeProfile;
  onComplete: (payload: { values: VibeProfile; enabled: Record<SliderKey, boolean> }) => void;
};

type OnboardingSlide = {
  title: string;
  description: string;
  image?: string;
};

const slides: OnboardingSlide[] = [
  {
    title: "Find your kind of place",
    description: "Choose the vibe you want and discover venues that match your mood.",
    image: "/onboarding/Onboarding_1.jpg",
  },
  {
    title: "Set the mood sliders",
    description: "Adjust the sliders to find a venue that fits your taste.",
    image: "/onboarding/Onboarding_2.jpg",
  },
  {
    title: "Rate the venues",
    description: "Rate places to shape their mood profile and build confidence in each venue’s atmosphere.",
    image: "/onboarding/Onboarding_3.jpg",
  },
  {
    title: "Earn points by helping",
    description: "Rate places, add notes, and collect points as you improve the map.",
    image: "/onboarding/Onboarding_4.jpg",
  },
  {
    title: "Set your mood now",
    description: "Choose the atmosphere you are looking for. We will use this as your initial filter setup.",
  },
];

export function OnboardingModal({ initialValues, onComplete }: OnboardingModalProps) {
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<VibeProfile>(initialValues);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const touchBlockedByInteractiveTarget = useRef(false);

  const isLast = index === slides.length - 1;
  const currentSlide = slides[index];

  const enabledAll = useMemo<Record<SliderKey, boolean>>(
    () => ({
      modern: true,
      lively: true,
      premium: true,
      touristy: true,
      spacious: true,
    }),
    [],
  );

  const next = () => {
    if (isLast) {
      onComplete({ values, enabled: enabledAll });
      return;
    }
    setIndex((prev) => Math.min(slides.length - 1, prev + 1));
  };

  const prev = () => setIndex((prevIndex) => Math.max(0, prevIndex - 1));

  const onTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    const firstTouch = event.changedTouches[0];
    touchStartX.current = firstTouch?.clientX ?? null;
    touchStartY.current = firstTouch?.clientY ?? null;
    touchEndX.current = null;
    touchEndY.current = null;

    const target = event.target as HTMLElement | null;
    touchBlockedByInteractiveTarget.current = Boolean(
      target?.closest(
        'input,textarea,select,button,[role="slider"],[data-no-onboarding-swipe="1"]',
      ),
    );
  };

  const onTouchMove: TouchEventHandler<HTMLDivElement> = (event) => {
    const firstTouch = event.changedTouches[0];
    touchEndX.current = firstTouch?.clientX ?? null;
    touchEndY.current = firstTouch?.clientY ?? null;
  };

  const onTouchEnd: TouchEventHandler<HTMLDivElement> = () => {
    if (touchBlockedByInteractiveTarget.current) {
      touchBlockedByInteractiveTarget.current = false;
      return;
    }

    if (
      touchStartX.current == null
      || touchEndX.current == null
      || touchStartY.current == null
      || touchEndY.current == null
    ) {
      return;
    }

    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;

    if (Math.abs(diffX) < 40) {
      return;
    }

    // Only treat as swipe if horizontal movement is clearly dominant.
    if (Math.abs(diffX) <= Math.abs(diffY) * 1.2) {
      return;
    }

    if (diffX > 0) {
      next();
    } else if (diffX < 0 && index > 0) {
      prev();
    }
  };

  return (
    <div className="absolute inset-0 z-[75] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]">
      <div
        className="w-full max-w-[380px] rounded-3xl bg-white border border-gray-100 shadow-[0_24px_70px_rgba(0,0,0,0.22)] overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="aspect-square bg-[#f6f1e6] overflow-hidden">
          {currentSlide.image ? (
            <img
              src={currentSlide.image}
              alt={currentSlide.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="h-full p-4 overflow-y-auto bg-gradient-to-b from-[#fffaf2] via-white to-[#fff7eb]">
              <div
                className="rounded-2xl border border-[#f3d8a5] bg-white/95 shadow-[0_10px_30px_rgba(250,162,36,0.12)] p-3"
                data-no-onboarding-swipe="1"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b56d00]">
                    Interactive filters
                  </p>
                  <span className="text-[11px] font-medium text-[#c57c0e] animate-pulse">Drag sliders</span>
                </div>
                <div className="space-y-3">
                  {SLIDERS.map((slider) => (
                    <VibeSlider
                      key={slider.key}
                      def={slider}
                      value={legacyScoreToDirectional(values[slider.key])}
                      onChange={(nextValue) =>
                        setValues((previous) => ({
                          ...previous,
                          [slider.key]: directionalToLegacyScore(nextValue),
                        }))
                      }
                      enabled
                      scaleMode="centered"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pt-4 pb-4">
          <h3 className="text-[20px] text-gray-900 tracking-tight">{currentSlide.title}</h3>
          <p className="mt-1 text-[13px] leading-5 text-gray-600">{currentSlide.description}</p>

          <div className="mt-3 flex items-center justify-center gap-2">
            {slides.map((_, dotIndex) => (
              <span
                key={dotIndex}
                className={`h-1.5 rounded-full transition-all ${dotIndex === index ? "w-5 bg-gray-900" : "w-1.5 bg-gray-300"}`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              className="h-10 px-4 rounded-full border border-gray-200 text-[13px] font-medium text-gray-700 disabled:opacity-50 inline-flex items-center justify-center"
            >
              <span className="inline-flex items-center gap-1 leading-none">
                <ChevronLeft className="w-4 h-4 shrink-0" />
                Previous
              </span>
            </button>
            <button
              type="button"
              onClick={next}
              className="h-10 px-5 rounded-full bg-gray-900 text-white text-[13px] font-medium inline-flex items-center justify-center"
            >
              <span className="inline-flex items-center gap-1 leading-none">
                {isLast ? "Start exploring" : "Next"}
                {!isLast ? <ChevronRight className="w-4 h-4 shrink-0" /> : null}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
