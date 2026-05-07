import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Cookie, FileText, IdentificationCard, Lifebuoy, ShieldCheck, TrashSimple } from "@phosphor-icons/react";

type PrivacyLinkItem = {
  label: string;
  sublabel: string;
  path: string;
  icon: ReactNode;
  color: string;
};

const PRIVACY_LINKS: PrivacyLinkItem[] = [
  {
    label: "Privacy Policy",
    sublabel: "How personal data is collected and processed",
    path: "/settings/privacy-policy",
    icon: <ShieldCheck weight="duotone" size={18} />,
    color: "#2563EB",
  },
  {
    label: "Cookie Policy",
    sublabel: "Cookie categories and consent information",
    path: "/settings/cookie-policy",
    icon: <Cookie weight="duotone" size={18} />,
    color: "#D97706",
  },
  {
    label: "Terms of Service / ÁSZF",
    sublabel: "Platform rules and usage terms",
    path: "/settings/terms-of-service",
    icon: <FileText weight="duotone" size={18} />,
    color: "#7C3AED",
  },
  {
    label: "Impressum / Company Information",
    sublabel: "Operator and legal business details",
    path: "/settings/impressum",
    icon: <IdentificationCard weight="duotone" size={18} />,
    color: "#0F766E",
  },
  {
    label: "Data Deletion Request",
    sublabel: "How users can request account/data deletion",
    path: "/settings/data-deletion",
    icon: <TrashSimple weight="duotone" size={18} />,
    color: "#DC2626",
  },
  {
    label: "Contact",
    sublabel: "Support and legal contact channels",
    path: "/settings/contact",
    icon: <Lifebuoy weight="duotone" size={18} />,
    color: "#6B7280",
  },
];

export function PrivacyDataScreen() {
  const navigate = useNavigate();

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1 as never)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-gray-900 text-[16px]">Privacy & data</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className="mb-2 text-[11px] text-gray-400 uppercase tracking-wider px-1">Legal</div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 divide-y divide-gray-50">
          {PRIVACY_LINKS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full py-3 flex items-center gap-3 text-left"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-none"
                style={{ background: `${item.color}18` }}
              >
                <span style={{ color: item.color }}>{item.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-gray-900">{item.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{item.sublabel}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-none" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
