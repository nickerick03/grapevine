import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

const TABS = [
  { path: "/admin", label: "Overview" },
  { path: "/admin/venues", label: "Venues" },
  { path: "/admin/users", label: "Users" },
  { path: "/admin/flags", label: "Flags" },
  { path: "/admin/legal", label: "Legal" },
  { path: "/admin/bugs", label: "Bugs" },
] as const;

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

  return (
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
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`px-3 py-1.5 rounded-full border text-[12px] whitespace-nowrap transition-colors ${
                  active
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-10">{children}</div>
    </div>
  );
}
