import { type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import {
  Star,
  Bookmark,
  GearSix,
  ChatCircle,
  SignOut,
  MapPin,
  User,
} from "@phosphor-icons/react";

interface MenuItem {
  icon: ReactNode;
  label: string;
  sub?: string;
  action: () => void;
  danger?: boolean;
}

export function ProfileDrawer() {
  const { user, logout, profileDrawerOpen, closeProfileDrawer } = useAuth();
  const navigate = useNavigate();

  if (!profileDrawerOpen || !user) return null;

  const goTo = (path: string) => {
    closeProfileDrawer();
    navigate(path);
  };

  const menuItems: MenuItem[] = [
    {
      icon: <User weight="duotone" size={20} />,
      label: "My Profile",
      sub: "View and edit your details",
      action: () => goTo("/profile"),
    },
    {
      icon: <Star weight="duotone" size={20} />,
      label: "My Ratings",
      sub: "12 pubs rated",
      action: () => goTo("/profile"),
    },
    {
      icon: <Bookmark weight="duotone" size={20} />,
      label: "Saved Places",
      sub: "8 pubs bookmarked",
      action: () => goTo("/profile"),
    },
    {
      icon: <MapPin weight="duotone" size={20} />,
      label: "Cities Visited",
      sub: "Budapest, Berlin, Lisbon",
      action: () => goTo("/profile"),
    },
    {
      icon: <GearSix weight="duotone" size={20} />,
      label: "Settings",
      action: () => goTo("/profile"),
    },
    {
      icon: <ChatCircle weight="duotone" size={20} />,
      label: "Help & Feedback",
      action: () => {},
    },
  ];

  return (
    <div className="absolute inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30 backdrop-blur-[1px]"
        onClick={closeProfileDrawer}
      />

      {/* Drawer panel */}
      <div
        className="w-72 h-full bg-[#fbf8f3] shadow-2xl flex flex-col"
        style={{
          animation: "slideInRight 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Avatar + user info header */}
        <div className="px-5 pt-10 pb-5 border-b border-gray-100">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-md mb-3 overflow-hidden"
            style={
              user.profilePhoto
                ? undefined
                : { background: `linear-gradient(135deg, ${user.gradientFrom}, ${user.gradientTo})` }
            }
          >
            {user.profilePhoto ? (
              <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">{user.emoji}</span>
            )}
          </div>
          <div className="text-gray-900">{user.name}</div>
          <div className="text-[12px] text-gray-500 mt-0.5">{user.email}</div>
          <div className="flex gap-3 mt-3">
            <div className="text-center">
              <div className="text-gray-900 text-[13px]">12</div>
              <div className="text-[10px] text-gray-500">Rated</div>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <div className="text-gray-900 text-[13px]">8</div>
              <div className="text-[10px] text-gray-500">Saved</div>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <div className="text-gray-900 text-[13px]">3</div>
              <div className="text-[10px] text-gray-500">Cities</div>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div className="flex-1 overflow-y-auto py-3">
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/70 transition-colors text-left"
            >
              <span className={item.danger ? "text-red-500" : "text-gray-500"}>
                {item.icon}
              </span>
              <div>
                <div className={`text-[14px] ${item.danger ? "text-red-500" : "text-gray-800"}`}>
                  {item.label}
                </div>
                {item.sub && (
                  <div className="text-[11px] text-gray-400 mt-0.5">{item.sub}</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Log out */}
        <div className="flex-none px-5 py-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
          >
            <SignOut size={18} weight="duotone" />
            <span className="text-[14px]">Log out</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}