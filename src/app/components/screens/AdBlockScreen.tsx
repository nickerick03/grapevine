import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ShieldWarning,
  ShieldCheck,
  CheckCircle,
  PintGlass,
  PlugsConnected,
  ArrowLeft,
} from "@phosphor-icons/react";
import { useAdBlockDetection } from "../../hooks/useAdBlockDetection";

const STEPS = [
  {
    browser: "Chrome / Edge",
    icon: "🟢",
    steps:
      "Click the puzzle piece (extensions) → find your blocker → toggle off for this site.",
  },
  {
    browser: "Firefox",
    icon: "🟠",
    steps:
      "Click the shield icon in the address bar → turn off Enhanced Tracking Protection for this site.",
  },
  {
    browser: "Safari",
    icon: "🔵",
    steps:
      "Go to Safari → Settings → Extensions → disable your blocker for grapevine.app.",
  },
  {
    browser: "uBlock / Adblock Plus",
    icon: "🔴",
    steps:
      "Click the extension icon → click the big power button to pause on this site.",
  },
];

export function AdBlockScreen() {
  const navigate = useNavigate();
  const { status, recheck } = useAdBlockDetection();
  const [recheckPending, setRecheckPending] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const handleRecheck = async () => {
    setRecheckPending(true);
    await recheck();
    setRecheckPending(false);
  };

  /* ── Shared header ── */
  const Header = () => (
    <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 bg-white/70 backdrop-blur-sm">
      <button
        onClick={() => navigate(-1 as any)}
        className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"
      >
        <ArrowLeft size={16} weight="bold" />
      </button>
      <div className="text-gray-900 text-[16px]">Ad Block Check</div>
    </div>
  );

  /* ── Checking ── */
  if (status === "checking") {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span className="text-[13px] text-gray-400">Checking for ad blocker…</span>
        </div>
      </div>
    );
  }

  /* ── No blocker detected ── */
  if (status === "allowed") {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 text-center">
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
            <ShieldCheck size={42} weight="duotone" className="text-emerald-500" />
          </div>
          <div>
            <div className="text-gray-900 text-[20px]">No ad blocker detected</div>
            <div className="text-gray-500 text-[13px] mt-2 leading-relaxed">
              Great — ads are loading normally. Grapevine can continue to offer a
              free experience thanks to readers like you.
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200/70 rounded-2xl p-4 flex gap-3 items-start text-left w-full">
            <PintGlass size={20} weight="duotone" className="text-emerald-500 flex-none mt-0.5" />
            <div className="text-[13px] text-emerald-900 leading-relaxed">
              Every ad impression directly funds pub data maintenance, community
              ratings, and new features — at zero cost to you.
            </div>
          </div>

          <button
            onClick={handleRecheck}
            disabled={recheckPending}
            className="w-full py-3.5 rounded-2xl bg-gray-900 text-white text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {recheckPending ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Re-checking…
              </>
            ) : (
              "Run check again"
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ── Blocker detected ── */
  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3] overflow-y-auto">
      {/* Hero strip */}
      <div
        className="relative flex-none h-52 overflow-hidden"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1697843898689-b6f6b27481ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdWIlMjBiYXIlMjBwaW50JTIwYmVlciUyMHdhcm0lMjBsaWdodHxlbnwxfHx8fDE3NzcyOTk0MDJ8MA&ixlib=rb-4.1.0&q=80&w=1080)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-[#fbf8f3]" />

        {/* Back */}
        <button
          onClick={() => navigate(-1 as any)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center"
        >
          <ArrowLeft size={16} className="text-white" />
        </button>

        {/* Shield badge */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] flex items-center justify-center border border-gray-100">
            <ShieldWarning size={34} weight="duotone" className="text-amber-500" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 pt-12 pb-8 flex flex-col gap-5">
        <div className="text-center">
          <div className="text-gray-900 text-[20px] leading-snug">Ad blocker detected</div>
          <div className="text-gray-500 text-[13px] mt-2 leading-relaxed">
            Grapevine is free to use — our only revenue comes from the ads you see
            while discovering pubs. With an ad blocker active, we can't keep the
            lights on.
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-4 flex gap-3 items-start">
          <PintGlass size={22} weight="duotone" className="text-amber-500 flex-none mt-0.5" />
          <div className="text-[13px] text-amber-900 leading-relaxed">
            Ads help us maintain live pub data, community ratings, and new features —
            all completely free for you. Disabling your blocker on Grapevine takes
            under 10 seconds.
          </div>
        </div>

        <button
          onClick={() => setShowSteps((v) => !v)}
          className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm text-[13px] text-gray-700 active:scale-[0.98] transition-transform"
        >
          <span className="flex items-center gap-2">
            <PlugsConnected size={17} weight="duotone" className="text-blue-500" />
            How do I turn it off?
          </span>
          <span className="text-gray-400 text-[11px]">{showSteps ? "Hide ▲" : "Show ▼"}</span>
        </button>

        {showSteps && (
          <div className="space-y-2 -mt-2">
            {STEPS.map((s) => (
              <div
                key={s.browser}
                className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex gap-3 items-start shadow-sm"
              >
                <span className="text-[18px] flex-none leading-none mt-0.5">{s.icon}</span>
                <div>
                  <div className="text-[12px] text-gray-900">{s.browser}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{s.steps}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleRecheck}
          disabled={recheckPending}
          className="w-full py-4 rounded-2xl bg-gray-900 text-white text-[15px] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {recheckPending ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <CheckCircle size={18} weight="bold" />
              I've turned it off — check again
            </>
          )}
        </button>

        {!recheckPending && (
          <p className="text-center text-[12px] text-gray-400 -mt-2">
            After disabling, refresh the page or tap the button above.
          </p>
        )}

        <div className="text-center mt-auto pt-2">
          <button
            onClick={() => navigate(-1 as any)}
            className="text-[12px] text-gray-400 underline underline-offset-2 active:text-gray-600 transition-colors"
          >
            Go back without changing
          </button>
        </div>
      </div>
    </div>
  );
}
