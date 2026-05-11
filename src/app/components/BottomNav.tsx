import { useNavigate, useLocation } from "react-router";
import { MapTrifold, NavigationArrow, BookmarkSimple, User } from "@phosphor-icons/react";

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const tabs = [
    { label: "Explore", icon: MapTrifold,      path: "/" },
    { label: "Nearby",  icon: NavigationArrow, path: "/nearby" },
    { label: "Saved",   icon: BookmarkSimple,  path: "/saved" },
    { label: "Profile", icon: User,            path: "/profile" },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[60px] z-[60] bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center">
      {tabs.map(({ label, icon: Icon, path }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
          >
            <Icon
              weight={active ? "fill" : "regular"}
              size={22}
              style={{ color: active ? "#111827" : "#9ca3af" }}
            />
            <span
              className="text-[10px] leading-none"
              style={{ color: active ? "#111827" : "#9ca3af" }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
