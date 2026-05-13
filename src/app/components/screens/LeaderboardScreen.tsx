import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Trophy, Star, MapPin, City } from "@phosphor-icons/react";

import { getLeaderboard, type LeaderboardEntry } from "@/lib/services/profile";
import { getActiveCup, getCupLeaderboard } from "@/lib/services/cups";
import { svgMarkupToDataUri } from "@/lib/cup-artwork";
import type { CupLeaderboardEntry, CupRecord } from "@/types/cup";

import { useAuth } from "../../context/AuthContext";
import { BottomNav } from "../BottomNav";

type PodiumPlace = 1 | 2 | 3;

type TabKey = "cup" | "all-time";

type LeaderRowData = {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  city: string;
  score: number;
  reviews: number;
  cities: number;
  cityList: string[];
};

const PODIUM_THEME: Record<
  PodiumPlace,
  { blockHeight: string; blockBg: string; blockBorder: string; number: string; review: string }
> = {
  1: {
    blockHeight: "h-44",
    blockBg: "linear-gradient(180deg, #F8EEDD 0%, #F6EADF 100%)",
    blockBorder: "#EFC58D",
    number: "#A8A097",
    review: "#D97706",
  },
  2: {
    blockHeight: "h-40",
    blockBg: "linear-gradient(180deg, #EDEBF9 0%, #EEEAF6 100%)",
    blockBorder: "#B8B8EE",
    number: "#A0A0AA",
    review: "#64748B",
  },
  3: {
    blockHeight: "h-36",
    blockBg: "linear-gradient(180deg, #E3F1EB 0%, #E5F0EC 100%)",
    blockBorder: "#A8DBC7",
    number: "#9CA8A3",
    review: "#C2410C",
  },
};

function normalizeUsername(value: string): string {
  return value.replace(/^@+/, "").trim();
}

function formatScore(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}`;
  }

  return rounded.toFixed(1);
}

function formatCountdown(secondsLeft: number): string {
  const safe = Math.max(0, Math.floor(secondsLeft));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
}

function toAllTimeRows(entries: LeaderboardEntry[]): LeaderRowData[] {
  return entries.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    username: entry.username,
    avatarUrl: entry.avatarUrl ?? null,
    emoji: entry.emoji,
    gradientFrom: entry.gradientFrom,
    gradientTo: entry.gradientTo,
    city: entry.city,
    score: entry.grapevineScore,
    reviews: entry.reviews,
    cities: entry.cities,
    cityList: entry.cityList,
  }));
}

function toCupRows(entries: CupLeaderboardEntry[]): LeaderRowData[] {
  return entries.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    username: entry.username,
    avatarUrl: entry.avatarUrl ?? null,
    emoji: entry.emoji,
    gradientFrom: entry.gradientFrom,
    gradientTo: entry.gradientTo,
    city: entry.city,
    score: entry.cupScore,
    reviews: entry.reviews,
    cities: entry.cities,
    cityList: entry.cityList,
  }));
}

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("cup");

  const [allTimeEntries, setAllTimeEntries] = useState<LeaderboardEntry[]>([]);
  const [allTimeLoading, setAllTimeLoading] = useState(true);
  const [allTimeError, setAllTimeError] = useState<string | null>(null);

  const [activeCup, setActiveCup] = useState<CupRecord | null>(null);
  const [cupEntries, setCupEntries] = useState<CupLeaderboardEntry[]>([]);
  const [cupLoading, setCupLoading] = useState(true);
  const [cupError, setCupError] = useState<string | null>(null);
  const [countdownTick, setCountdownTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAllTime() {
      setAllTimeLoading(true);
      setAllTimeError(null);

      try {
        const next = await getLeaderboard(50);
        if (!cancelled) {
          setAllTimeEntries(next);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load leaderboard.";
          setAllTimeError(message);
          setAllTimeEntries([]);
        }
      } finally {
        if (!cancelled) {
          setAllTimeLoading(false);
        }
      }
    }

    void loadAllTime();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCup() {
      setCupLoading(true);
      setCupError(null);
      try {
        const cup = await getActiveCup();
        if (cancelled) return;

        setActiveCup(cup);

        if (!cup) {
          setCupEntries([]);
          setCupLoading(false);
          return;
        }

        const ranking = await getCupLeaderboard(50, cup.id);
        if (!cancelled) {
          setCupEntries(ranking);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load cup leaderboard.";
          setCupError(message);
          setCupEntries([]);
        }
      } finally {
        if (!cancelled) {
          setCupLoading(false);
        }
      }
    }

    void loadCup();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownTick((value) => value + 1);
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const allTimeRows = useMemo(() => toAllTimeRows(allTimeEntries), [allTimeEntries]);
  const cupRows = useMemo(() => toCupRows(cupEntries), [cupEntries]);

  const visibleRows = tab === "cup" ? cupRows : allTimeRows;
  const loading = tab === "cup" ? cupLoading : allTimeLoading;
  const error = tab === "cup" ? cupError : allTimeError;

  const rankMap = useMemo(() => {
    const map = new Map<number, LeaderRowData>();
    for (const entry of visibleRows) {
      map.set(entry.rank, entry);
    }
    return map;
  }, [visibleRows]);

  const top3 = useMemo(
    () => ({
      first: rankMap.get(1) ?? null,
      second: rankMap.get(2) ?? null,
      third: rankMap.get(3) ?? null,
    }),
    [rankMap],
  );
  const rest = useMemo(() => visibleRows.filter((entry) => entry.rank > 3).slice(0, 12), [visibleRows]);

  const yourEntry = useMemo(() => {
    if (!user) return null;
    return visibleRows.find((entry) => entry.userId === user.id) ?? null;
  }, [visibleRows, user]);

  const hiddenFromLeaderboard = user?.hideScore === true;

  const openPublicProfile = (username: string) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return;
    navigate(`/profile/${encodeURIComponent(normalized)}`);
  };

  const cupCountdown = activeCup ? formatCountdown(Math.max(0, activeCup.secondsLeft - countdownTick * 60)) : "";
  const cupSvgUri = activeCup ? svgMarkupToDataUri(activeCup.svgMarkup) : null;

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-white/70 backdrop-blur border-b border-gray-100 z-10">
        <button
          onClick={() => navigate("/profile")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="text-gray-900">Leaderboard</div>
        <div className="w-9" />
      </div>

      <div className="flex-none px-4 pt-3 pb-1">
        <div className="rounded-2xl border border-gray-100 bg-white p-1 flex gap-1">
          <button
            type="button"
            onClick={() => setTab("cup")}
            className={`flex-1 h-9 rounded-xl text-[12px] ${tab === "cup" ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            Cup leaderboard
          </button>
          <button
            type="button"
            onClick={() => setTab("all-time")}
            className={`flex-1 h-9 rounded-xl text-[12px] ${tab === "all-time" ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            All-time leaderboard
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[84px]">
        {hiddenFromLeaderboard ? (
          <div className="px-4 pt-3">
            <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-[12px] text-purple-700">
              Your Grapevine Score is hidden in profile privacy settings, so you are not shown on leaderboards.
            </div>
          </div>
        ) : null}

        {tab === "cup" ? (
          <div className="px-4 pt-3">
            {!cupLoading && !cupError && activeCup ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-3 py-3 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                {cupSvgUri ? (
                  <img src={cupSvgUri} alt={`${activeCup.name} artwork`} className="w-14 h-14 rounded-lg border border-gray-100 bg-white object-contain" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">🏆</div>
                )}
                <div className="min-w-0">
                  <div className="text-[15px] text-gray-900 truncate">{activeCup.name}</div>
                  <div className="text-[12px] text-gray-500">{cupCountdown}</div>
                  <div className="text-[11px] text-gray-400">Reward: {activeCup.rewardPoints} all-time pts</div>
                </div>
              </div>
            ) : null}

            {!cupLoading && !cupError && !activeCup ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 text-center">
                <div className="text-[14px] text-gray-900">No active Cup right now</div>
                <div className="text-[12px] text-gray-500 mt-1">Once a Cup is activated, rankings will appear here.</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="px-4 pt-8 text-center text-[13px] text-gray-500">Loading leaderboard...</div>
        ) : error ? (
          <div className="px-4 pt-8 text-center text-[13px] text-red-500">{error}</div>
        ) : visibleRows.length === 0 ? (
          <div className="px-4 pt-8 text-center">
            <div className="text-[14px] text-gray-900">No leaderboard data yet</div>
            <div className="text-[12px] text-gray-500 mt-1">As soon as users add ratings, rankings will appear here.</div>
          </div>
        ) : (
          <>
            <div className="px-4 pt-5 pb-1">
              <div className="flex items-end justify-center gap-3">
                <PodiumCard entry={top3.second} place={2} onOpenProfile={openPublicProfile} />
                <PodiumCard entry={top3.first} place={1} onOpenProfile={openPublicProfile} crown />
                <PodiumCard entry={top3.third} place={3} onOpenProfile={openPublicProfile} />
              </div>
            </div>

            <div className="px-4 pb-2 pt-4">
              <div className="text-[11px] text-gray-400 uppercase tracking-widest px-1">Rankings</div>
            </div>

            <div className="px-4 space-y-2">
              {rest.map((entry) => (
                <LeaderRow
                  key={entry.userId}
                  entry={entry}
                  isYou={user?.id === entry.userId}
                  onOpenProfile={openPublicProfile}
                />
              ))}
            </div>

            {yourEntry && yourEntry.rank > 3 && !rest.some((entry) => entry.userId === yourEntry.userId) ? (
              <div className="px-4 pt-4 pb-2">
                <div className="text-[11px] text-gray-400 uppercase tracking-widest px-1 mb-2">Your position</div>
                <LeaderRow entry={yourEntry} isYou onOpenProfile={openPublicProfile} />
              </div>
            ) : null}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function PodiumCard({
  entry,
  place,
  onOpenProfile,
  crown,
}: {
  entry: LeaderRowData | null;
  place: PodiumPlace;
  onOpenProfile: (username: string) => void;
  crown?: boolean;
}) {
  const theme = PODIUM_THEME[place];
  const hasEntry = Boolean(entry);
  const crownColor = hasEntry ? "#D97706" : "#C9B79C";
  const fallbackGradient = "linear-gradient(135deg, #E5E7EB, #D1D5DB)";
  const numberSize = place === 1 ? "text-[40px]" : "text-[33px]";
  const filledNumberColor = hasEntry ? `${entry!.gradientFrom}99` : theme.number;
  const blockBackground = hasEntry
    ? `linear-gradient(180deg, ${entry!.gradientFrom}26 0%, ${entry!.gradientTo}14 100%)`
    : theme.blockBg;
  const blockBorder = hasEntry ? `${entry!.gradientFrom}66` : theme.blockBorder;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatarImage = hasEntry && !!entry!.avatarUrl && !avatarFailed;

  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      {crown ? <Trophy weight="fill" size={18} style={{ color: crownColor }} /> : <div className="h-[18px]" />}

      <div
        className="w-20 h-20 rounded-[26px] flex items-center justify-center shadow-md flex-none"
        style={{
          background: hasEntry ? `linear-gradient(135deg, ${entry!.gradientFrom}, ${entry!.gradientTo})` : fallbackGradient,
          opacity: hasEntry ? 1 : 0.72,
        }}
      >
        {showAvatarImage ? (
          <img
            src={entry!.avatarUrl ?? ""}
            alt={normalizeUsername(entry!.username)}
            className="w-full h-full object-cover rounded-[26px]"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <span className="text-[32px]">{hasEntry ? entry!.emoji : ""}</span>
        )}
      </div>

      <div className="text-center">
        {hasEntry ? (
          <>
            <button
              type="button"
              onClick={() => onOpenProfile(entry!.username)}
              className="text-[14px] text-gray-900 truncate max-w-[110px] hover:underline underline-offset-2"
              title={`Open @${normalizeUsername(entry!.username)} profile`}
            >
              {normalizeUsername(entry!.username)}
            </button>
            <div className="text-[12px] mt-0.5" style={{ color: theme.review }}>
              {formatScore(entry!.score)} score
            </div>
          </>
        ) : (
          <>
            <div className="text-[14px] text-gray-400 max-w-[110px]">Open spot</div>
            <div className="text-[12px] mt-0.5 text-gray-400">No score yet</div>
          </>
        )}
      </div>

      <div
        className={`w-full ${theme.blockHeight} rounded-t-[28px] flex items-center justify-center`}
        style={{
          background: blockBackground,
          border: `2px solid ${blockBorder}`,
        }}
      >
        <span className={`${numberSize} leading-none font-light`} style={{ color: filledNumberColor }}>
          {place}
        </span>
      </div>
    </div>
  );
}

function LeaderRow({
  entry,
  isYou,
  onOpenProfile,
}: {
  entry: LeaderRowData;
  isYou: boolean;
  onOpenProfile: (username: string) => void;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatarImage = !!entry.avatarUrl && !avatarFailed;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3 py-3 border transition-colors ${
        isYou
          ? "bg-gray-900 border-gray-800"
          : "bg-white border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
      }`}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-none bg-gray-100 text-gray-500 text-[14px]">
        {entry.rank}
      </div>

      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-none shadow"
        style={{ background: `linear-gradient(135deg, ${entry.gradientFrom}, ${entry.gradientTo})` }}
      >
        {showAvatarImage ? (
          <img
            src={entry.avatarUrl ?? ""}
            alt={normalizeUsername(entry.username)}
            className="w-full h-full object-cover rounded-2xl"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <span className="text-xl">{entry.emoji}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onOpenProfile(entry.username)}
          className={`text-[13px] truncate hover:underline underline-offset-2 ${isYou ? "text-white" : "text-gray-900"}`}
          title={`Open @${normalizeUsername(entry.username)} profile`}
        >
          {normalizeUsername(entry.username)}
        </button>
        <div className="flex items-center gap-1 text-[11px] mt-0.5 text-gray-400">
          <MapPin size={10} weight="fill" />
          <span className="truncate">
            {entry.cityList.slice(0, 3).join(", ")}
            {entry.cities > 3 ? ` +${entry.cities - 3}` : ""}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-none">
        <div className={`flex items-center gap-1 text-[13px] ${isYou ? "text-white" : "text-gray-900"}`}>
          <Star weight="fill" size={12} className="text-amber-400" />
          <span>{formatScore(entry.score)}</span>
        </div>
        <div className={`flex items-center gap-1 text-[11px] ${isYou ? "text-gray-400" : "text-gray-500"}`}>
          <City size={11} weight="duotone" />
          <span>
            {entry.reviews} {entry.reviews === 1 ? "review" : "reviews"} · {entry.cities} {entry.cities === 1 ? "city" : "cities"}
          </span>
        </div>
      </div>
    </div>
  );
}
