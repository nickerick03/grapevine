import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Trophy, Medal, Star, MapPin, City } from "@phosphor-icons/react";
import { BottomNav } from "../BottomNav";

interface LeaderEntry {
  rank: number;
  name: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  reviews: number;
  cities: number;
  cityList: string[];
  badge?: "gold" | "silver" | "bronze";
}

const LEADERBOARD: LeaderEntry[] = [
  {
    rank: 1,
    name: "Harriet Bloom",
    emoji: "🏆",
    gradientFrom: "#f59e0b",
    gradientTo: "#ef4444",
    reviews: 84,
    cities: 9,
    cityList: ["London", "Manchester", "Edinburgh", "Bristol", "Leeds", "Glasgow", "Bath", "Oxford", "Cambridge"],
    badge: "gold",
  },
  {
    rank: 2,
    name: "James Alderton",
    emoji: "🦁",
    gradientFrom: "#6366f1",
    gradientTo: "#8b5cf6",
    reviews: 71,
    cities: 7,
    cityList: ["London", "Brighton", "Liverpool", "Cardiff", "Nottingham", "York", "Newcastle"],
    badge: "silver",
  },
  {
    rank: 3,
    name: "Priya Nair",
    emoji: "🌊",
    gradientFrom: "#10b981",
    gradientTo: "#06b6d4",
    reviews: 63,
    cities: 6,
    cityList: ["London", "Birmingham", "Manchester", "Leicester", "Coventry", "Derby"],
    badge: "bronze",
  },
  {
    rank: 4,
    name: "Tom Cavendish",
    emoji: "🎯",
    gradientFrom: "#3b82f6",
    gradientTo: "#06b6d4",
    reviews: 58,
    cities: 5,
    cityList: ["London", "Oxford", "Reading", "Southampton", "Portsmouth"],
  },
  {
    rank: 5,
    name: "Mei Lin",
    emoji: "🌸",
    gradientFrom: "#ec4899",
    gradientTo: "#f43f5e",
    reviews: 52,
    cities: 5,
    cityList: ["London", "Manchester", "Liverpool", "Sheffield", "Leeds"],
  },
  {
    rank: 6,
    name: "Declan O'Brien",
    emoji: "🍺",
    gradientFrom: "#f97316",
    gradientTo: "#eab308",
    reviews: 47,
    cities: 4,
    cityList: ["Dublin", "Cork", "Belfast", "Galway"],
  },
  {
    rank: 7,
    name: "Sofia Reyes",
    emoji: "🦋",
    gradientFrom: "#8b5cf6",
    gradientTo: "#ec4899",
    reviews: 41,
    cities: 4,
    cityList: ["London", "Edinburgh", "Glasgow", "Inverness"],
  },
  {
    rank: 8,
    name: "Noah Fletcher",
    emoji: "🚀",
    gradientFrom: "#14b8a6",
    gradientTo: "#3b82f6",
    reviews: 38,
    cities: 3,
    cityList: ["London", "Bristol", "Bath"],
  },
  {
    rank: 9,
    name: "Amara Osei",
    emoji: "🌈",
    gradientFrom: "#f59e0b",
    gradientTo: "#10b981",
    reviews: 33,
    cities: 3,
    cityList: ["Birmingham", "Coventry", "Wolverhampton"],
  },
  {
    rank: 10,
    name: "Lena Hartmann",
    emoji: "🔮",
    gradientFrom: "#6366f1",
    gradientTo: "#3b82f6",
    reviews: 29,
    cities: 2,
    cityList: ["London", "Brighton"],
  },
  // "You" entry (mock logged-in user)
  {
    rank: 14,
    name: "You",
    emoji: "⭐",
    gradientFrom: "#374151",
    gradientTo: "#111827",
    reviews: 12,
    cities: 3,
    cityList: ["London", "Manchester", "Edinburgh"],
  },
];

const BADGE_CONFIG = {
  gold:   { icon: <Trophy  weight="fill" size={16} />, bg: "#FEF3C7", border: "#FDE68A", text: "#92400E", label: "#d97706" },
  silver: { icon: <Medal   weight="fill" size={16} />, bg: "#F1F5F9", border: "#CBD5E1", text: "#475569", label: "#64748b" },
  bronze: { icon: <Medal   weight="fill" size={16} />, bg: "#FEF0E7", border: "#FDBA8C", text: "#92400E", label: "#c2410c" },
};

function RankBadge({ badge, rank }: { badge?: "gold" | "silver" | "bronze"; rank: number }) {
  if (badge) {
    const cfg = BADGE_CONFIG[badge];
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-none"
        style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, color: cfg.label }}
      >
        {cfg.icon}
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-none bg-gray-100 text-gray-500 text-[13px]">
      {rank}
    </div>
  );
}

export function LeaderboardScreen() {
  const navigate = useNavigate();

  const top3 = LEADERBOARD.slice(0, 3);
  const rest = LEADERBOARD.slice(3, 10);
  const you = LEADERBOARD[LEADERBOARD.length - 1];

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* Header */}
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

        {/* Podium */}
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-end justify-center gap-3">
            {/* 2nd */}
            <PodiumCard entry={top3[1]} height="h-28" labelColor="#64748b" />
            {/* 1st */}
            <PodiumCard entry={top3[0]} height="h-36" labelColor="#d97706" crown />
            {/* 3rd */}
            <PodiumCard entry={top3[2]} height="h-24" labelColor="#c2410c" />
          </div>
        </div>

        {/* Section label */}
        <div className="px-4 pb-2 pt-4">
          <div className="text-[11px] text-gray-400 uppercase tracking-widest px-1">Rankings</div>
        </div>

        {/* Rows 4–10 */}
        <div className="px-4 space-y-2">
          {rest.map((entry) => (
            <LeaderRow key={entry.rank} entry={entry} isYou={false} />
          ))}
        </div>

        {/* Your position */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-[11px] text-gray-400 uppercase tracking-widest px-1 mb-2">Your position</div>
          <LeaderRow entry={you} isYou />
        </div>

      </div>

      <BottomNav />
    </div>
  );
}

/* ─── Podium card ─── */
function PodiumCard({
  entry,
  height,
  labelColor,
  crown,
}: {
  entry: LeaderEntry;
  height: string;
  labelColor: string;
  crown?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      {crown && (
        <Trophy weight="fill" size={20} style={{ color: "#d97706" }} />
      )}
      {/* Avatar */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md flex-none"
        style={{ background: `linear-gradient(135deg, ${entry.gradientFrom}, ${entry.gradientTo})` }}
      >
        <span className="text-2xl">{entry.emoji}</span>
      </div>
      <div className="text-center">
        <div className="text-[12px] text-gray-900 truncate max-w-[80px]">{entry.name.split(" ")[0]}</div>
        <div className="text-[11px] mt-0.5" style={{ color: labelColor }}>
          {entry.reviews} reviews
        </div>
      </div>
      {/* Podium block */}
      <div
        className={`w-full ${height} rounded-t-xl flex items-center justify-center`}
        style={{
          background: `linear-gradient(180deg, ${entry.gradientFrom}22 0%, ${entry.gradientTo}11 100%)`,
          border: `1.5px solid ${entry.gradientFrom}44`,
        }}
      >
        <span className="text-[22px] opacity-30">{entry.rank}</span>
      </div>
    </div>
  );
}

/* ─── Leader row ─── */
function LeaderRow({ entry, isYou }: { entry: LeaderEntry; isYou: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3 py-3 border transition-colors ${
        isYou
          ? "bg-gray-900 border-gray-800"
          : "bg-white border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
      }`}
    >
      <RankBadge badge={entry.badge} rank={entry.rank} />

      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-none shadow"
        style={{ background: `linear-gradient(135deg, ${entry.gradientFrom}, ${entry.gradientTo})` }}
      >
        <span className="text-lg">{entry.emoji}</span>
      </div>

      {/* Name + cities */}
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] truncate ${isYou ? "text-white" : "text-gray-900"}`}>
          {entry.name}
        </div>
        <div className={`flex items-center gap-1 text-[11px] mt-0.5 ${isYou ? "text-gray-400" : "text-gray-400"}`}>
          <MapPin size={10} weight="fill" />
          <span className="truncate">{entry.cityList.slice(0, 3).join(", ")}{entry.cities > 3 ? ` +${entry.cities - 3}` : ""}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col items-end gap-1 flex-none">
        <div className={`flex items-center gap-1 text-[13px] ${isYou ? "text-white" : "text-gray-900"}`}>
          <Star weight="fill" size={12} className="text-amber-400" />
          <span>{entry.reviews}</span>
        </div>
        <div className={`flex items-center gap-1 text-[11px] ${isYou ? "text-gray-400" : "text-gray-500"}`}>
          <City size={11} weight="duotone" />
          <span>{entry.cities} {entry.cities === 1 ? "city" : "cities"}</span>
        </div>
      </div>
    </div>
  );
}