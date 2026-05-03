import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Settings } from "lucide-react";
import {
  Star,
  Bookmark,
  MapPin,
  PencilSimple,
  Clock,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { PUBS, SLIDERS } from "../vibe";
import { BottomNav } from "../BottomNav";
import { AdUnit } from "../AdUnit";

const MOCK_RATINGS = [
  { pub: PUBS[0], visitType: "Weekend evening", note: "Incredible atmosphere, went twice this trip!" },
  { pub: PUBS[1], visitType: "Weekday evening", note: "Perfect for a quiet catch-up." },
  { pub: PUBS[5], visitType: "Late night",      note: "Hidden gem, recommend to everyone." },
];

const MOCK_SAVED = [PUBS[2], PUBS[3]];

export function ProfileScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* Sticky header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-white/70 backdrop-blur border-b border-gray-100 z-10">
        <div className="w-9" /> {/* spacer */}
        <div className="text-gray-900">Profile</div>
        <button
          onClick={() => navigate("/settings")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <Settings className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero / Avatar */}
        <div className="px-4 pt-6 pb-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-5">
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg flex-none"
                style={{
                  background: `linear-gradient(135deg, ${user.gradientFrom}, ${user.gradientTo})`,
                }}
              >
                {user.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 text-[17px]">{user.name}</div>
                <div className="text-[12px] text-gray-500 mt-0.5 truncate">{user.email}</div>
                <button className="mt-2 flex items-center gap-1 text-[12px] text-gray-600 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                  <PencilSimple size={12} /> Edit profile
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
              {[
                { icon: <Star weight="duotone" size={16} className="text-amber-500" />, value: "12", label: "Pubs rated" },
                { icon: <Bookmark weight="duotone" size={16} className="text-blue-500" />, value: "8", label: "Saved" },
                { icon: <MapPin weight="duotone" size={16} className="text-emerald-500" />, value: "3", label: "Cities" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {stat.icon}
                    <span className="text-gray-900">{stat.value}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Saved Places */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 text-gray-700">
              <Bookmark weight="duotone" size={16} className="text-blue-500" />
              Saved places
            </div>
            <button
              onClick={() => navigate("/saved")}
              className="text-[12px] text-gray-500"
            >
              See all
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MOCK_SAVED.map((pub) => (
              <button
                key={pub.id}
                onClick={() => navigate(`/detail/${pub.id}`)}
                className="text-left bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
              >
                <img src={pub.image} alt={pub.name} className="w-full h-20 object-cover" />
                <div className="p-2.5">
                  <div className="text-[12px] text-gray-900 truncate">{pub.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{pub.area}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Ad — between saved places and recent ratings */}
        <div className="px-4 pb-3">
          <AdUnit variant="native" index={0} />
        </div>

        {/* Recent Ratings */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 text-gray-700">
              <Star weight="duotone" size={16} className="text-amber-500" />
              Recent ratings
            </div>
            <button className="text-[12px] text-gray-500">See all</button>
          </div>
          <div className="space-y-2">
            {MOCK_RATINGS.map(({ pub, visitType, note }, i) => (
              <button
                key={i}
                onClick={() => navigate(`/detail/${pub.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-3"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={pub.image}
                    alt={pub.name}
                    className="w-12 h-12 rounded-xl object-cover flex-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900 text-[13px] truncate">{pub.name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                      <Clock size={11} /> {visitType}
                    </div>
                    <div className="text-[12px] text-gray-600 mt-1 line-clamp-1">{note}</div>
                  </div>
                </div>
                <div className="flex gap-1 mt-2.5">
                  {SLIDERS.map((s) => (
                    <div key={s.key} className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full opacity-70"
                        style={{ width: `${pub.vibe[s.key]}%`, background: s.color }}
                      />
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Log out */}
        <div className="px-4 pb-[84px]">
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="w-full py-3 rounded-2xl border border-red-100 bg-red-50 text-red-600 text-[14px] hover:bg-red-100 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}