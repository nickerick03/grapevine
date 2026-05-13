import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { AdminBadgeMap, AdminBadgeSection } from "./adminBadges";
import { useAdminBadges } from "./adminBadges";

const TABS = [
  { path: "/admin", label: "Overview", section: null },
  { path: "/admin/cups", label: "Cups", section: "cups" },
  { path: "/admin/venues", label: "Venues", section: "venues" },
  { path: "/admin/users", label: "Users", section: "users" },
  { path: "/admin/flags", label: "Flags", section: "flags" },
  { path: "/admin/legal", label: "Legal", section: "legal" },
  { path: "/admin/bugs", label: "Bugs", section: "bugs" },
] as const;

function RedDot() {
  return <span className="inline-block h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />;
}

type AdminBadgeContextValue = {
  badges: AdminBadgeMap;
  hasAnyNew: boolean;
  markSeen: (section: AdminBadgeSection) => void;
  refreshBadges: () => Promise<void>;
};

const AdminBadgeContext = createContext<AdminBadgeContextValue | null>(null);

export function useAdminBadgeContext() {
  const context = useContext(AdminBadgeContext);
  if (!context) {
    throw new Error("useAdminBadgeContext must be used inside AdminLayout.");
  }
  return context;
}

function sectionForPath(pathname: string): AdminBadgeSection | null {
  if (pathname === "/admin/cups") return "cups";
  if (pathname === "/admin/venues") return "venues";
  if (pathname === "/admin/users") return "users";
  if (pathname === "/admin/flags") return "flags";
  if (pathname === "/admin/legal") return "legal";
  if (pathname === "/admin/bugs") return "bugs";
  return null;
}

export function AdminLayout({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { badges, hasAnyNew, markSeen, refreshBadges } = useAdminBadges();

  useEffect(() => {
    let cancelled = false;
    void refreshBadges().catch(() => {
      if (!cancelled) {
        // Keep page usable even if badge refresh fails.
      }
    });

    const timer = window.setInterval(() => {
      void refreshBadges().catch(() => {
        // Ignore intermittent refresh failures.
      });
    }, 45000);

    const onFocus = () => {
      void refreshBadges().catch(() => {
        // Ignore intermittent refresh failures.
      });
    };

    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshBadges]);

  useEffect(() => {
    const section = sectionForPath(location.pathname);
    if (section) {
      markSeen(section);
    }
  }, [location.pathname, markSeen]);

  const contextValue = useMemo(
    () => ({ badges, hasAnyNew, markSeen, refreshBadges }),
    [badges, hasAnyNew, markSeen, refreshBadges],
  );

  return (
    <AdminBadgeContext.Provider value={contextValue}>
      <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
        <div className="flex-none bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-20">
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <button
              onClick={() => navigate("/settings")}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="text-gray-900 text-[16px] flex-1">{title}</div>
            {actions}
          </div>
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
            {TABS.map((tab) => {
              const active = location.pathname === tab.path;
              const hasDot = tab.section ? badges[tab.section] : hasAnyNew;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`px-3 py-1.5 rounded-full border text-[12px] whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
                    active
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {tab.label}
                  {hasDot ? <RedDot /> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-10">{children}</div>
      </div>
    </AdminBadgeContext.Provider>
  );
}
