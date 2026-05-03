import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import {
  Bell,
  Moon,
  Ruler,
  Globe,
  ShieldCheck,
  HeartStraight,
  Info,
  TrashSimple,
  SignOut,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";

function ToggleRow({
  icon,
  label,
  sublabel,
  color = "#374151",
  defaultOn = false,
}: {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  color?: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-none"
        style={{ background: `${color}18` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-gray-900">{label}</div>
        {sublabel && <div className="text-[11px] text-gray-400 mt-0.5">{sublabel}</div>}
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className="w-11 h-6 rounded-full transition-colors relative flex-none"
        style={{ background: on ? "#111827" : "#E5E7EB" }}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function LinkRow({
  icon,
  label,
  sublabel,
  color = "#374151",
  danger = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  color?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 py-3 w-full text-left"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-none"
        style={{ background: danger ? "#FEF2F2" : `${color}18` }}
      >
        <span style={{ color: danger ? "#EF4444" : color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] ${danger ? "text-red-600" : "text-gray-900"}`}>{label}</div>
        {sublabel && <div className="text-[11px] text-gray-400 mt-0.5">{sublabel}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 flex-none" />
    </button>
  );
}

function SelectRow({
  icon,
  label,
  options,
  color = "#374151",
}: {
  icon: ReactNode;
  label: string;
  options: string[];
  color?: string;
}) {
  const [selected, setSelected] = useState(options[0]);
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-none"
        style={{ background: `${color}18` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 text-[14px] text-gray-900">{label}</div>
      <div className="flex gap-1 flex-none">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => setSelected(opt)}
            className={`px-3 py-1 rounded-full text-[12px] transition-colors border ${
              selected === opt
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] text-gray-400 uppercase tracking-wider px-4 mb-1">{title}</div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 divide-y divide-gray-50">
        {children}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-3 bg-white/70 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1 as never)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-gray-900">Settings</div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 pb-10">
        <Section title="Notifications">
          <ToggleRow
            icon={<Bell weight="duotone" size={18} />}
            label="Push notifications"
            sublabel="New ratings, recommendations"
            color="#F59E0B"
            defaultOn
          />
          <ToggleRow
            icon={<HeartStraight weight="duotone" size={18} />}
            label="Saved place updates"
            sublabel="When a saved bar changes vibe"
            color="#EF4444"
          />
        </Section>

        <Section title="Appearance">
          <ToggleRow
            icon={<Moon weight="duotone" size={18} />}
            label="Dark mode"
            sublabel="Coming soon"
            color="#8B5CF6"
          />
          <SelectRow
            icon={<Ruler weight="duotone" size={18} />}
            label="Distance units"
            options={["km", "mi"]}
            color="#10B981"
          />
        </Section>

        <Section title="Discovery">
          <SelectRow
            icon={<Globe weight="duotone" size={18} />}
            label="Default city"
            options={["Budapest", "Berlin"]}
            color="#3B82F6"
          />
          <ToggleRow
            icon={<ShieldCheck weight="duotone" size={18} />}
            label="Show tourist-heavy bars"
            sublabel="Hide bars with high tourist score"
            color="#10B981"
            defaultOn
          />
        </Section>

        <Section title="Account">
          <LinkRow
            icon={<ShieldCheck weight="duotone" size={18} />}
            label="Privacy & data"
            sublabel="Manage your data"
            color="#374151"
          />
          <LinkRow
            icon={<TrashSimple weight="duotone" size={18} />}
            label="Delete account"
            sublabel="Permanently remove your data"
            danger
          />
          <LinkRow
            icon={<SignOut weight="duotone" size={18} />}
            label="Sign out"
            danger
            onClick={() => {
              logout();
              navigate("/");
            }}
          />
        </Section>

        <Section title="About">
          <LinkRow
            icon={<HeartStraight weight="duotone" size={18} />}
            label="Support VibeMap"
            sublabel="Buy us a coffee ☕"
            color="#EF4444"
          />
          <LinkRow
            icon={<Info weight="duotone" size={18} />}
            label="Version 1.0.0 (beta)"
            sublabel="Made with love for pub explorers"
            color="#6B7280"
          />
        </Section>
      </div>
    </div>
  );
}
