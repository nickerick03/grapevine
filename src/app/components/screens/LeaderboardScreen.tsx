import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Trophy, Star, MapPin, City } from "@phosphor-icons/react";

import { getLeaderboard, type LeaderboardEntry } from "@/lib/services/profile";

import { useAuth } from "../../context/AuthContext";
import { BottomNav } from "../BottomNav";

type PodiumPlace = 1 | 2 | 3;

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

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const next = await getLeaderboard(50);
        if (!cancelled) {
          setEntries(next);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load leaderboard.";
          setError(message);
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rankMap = useMemo(() => {
    const map = new Map<number, LeaderboardEntry>();
    for (const entry of entries) {
      map.set(entry.rank, entry);
    }
    return map;
  }, [entries]);
  const top3 = useMemo(
    () => ({
      first: rankMap.get(1) ?? null,
      second: rankMap.get(2) ?? null,
      third: rankMap.get(3) ?? null,
    }),
    [rankMap],
  );
  const rest = useMemo(() => entries.filter((entry) => entry.rank > 3).slice(0, 12), [entries]);
  const yourEntry = useMemo(() => {
    if (!user) return null;
    return entries.find((entry) => entry.userId === user.id) ?? null;
  }, [entries, user]);

  const openPublicProfile = (username: string) => {
    const normalized = normalizeUsername(username);
    if (!normalized) return;
    navigate(`/profile/${encodeURIComponent(normalized)}`);
  };

  const hiddenFromLeaderboard = user?.hideScore === true;

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

      <div className="flex-1 overflow-y-auto pb-[84px]">
        {hiddenFromLeaderboard ? (
          <div className="px-4 pt-4">
            <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-[12px] text-purple-700">
              Your Grapevine Score is hidden in profile privacy settings, so you are not shown on the leaderboard.
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="px-4 pt-8 text-center text-[13px] text-gray-500">Loading leaderboard…</div>
        ) : error ? (
          <div className="px-4 pt-8 text-center text-[13px] text-red-500">{error}</div>
        ) : entries.length === 0 ? (
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
  entry: LeaderboardEntry | null;
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
        <span className="text-[32px]">{hasEntry ? entry!.emoji : ""}</span>
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
              {formatScore(entry!.grapevineScore)} score
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
  entry: LeaderboardEntry;
  isYou: boolean;
  onOpenProfile: (username: string) => void;
}) {
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
        <span className="text-xl">{entry.emoji}</span>
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
          <span>{formatScore(entry.grapevineScore)}</span>
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
