import { useMemo, useState, type ReactNode } from "react";
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
  Bug,
  TrashSimple,
  SignOut,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { useFilters } from "../../context/FilterContext";
import { usePlaces } from "../../context/PlacesContext";
import { type DistanceUnit, useSettings } from "../../context/SettingsContext";

function ToggleRow({
  icon,
  label,
  sublabel,
  color = "#374151",
  value,
  onChange,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  color?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 py-3 ${disabled ? "opacity-60" : ""}`}>
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
        disabled={disabled}
        onClick={() => onChange(!value)}
        className="w-11 h-6 rounded-full transition-colors relative flex-none disabled:cursor-not-allowed"
        style={{ background: value ? "#111827" : "#E5E7EB" }}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
            value ? "left-[22px]" : "left-0.5"
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
      {onClick ? <ChevronRight className="w-4 h-4 text-gray-300 flex-none" /> : null}
    </button>
  );
}

function SelectRow({
  icon,
  label,
  selected,
  onChange,
  options,
  color = "#374151",
}: {
  icon: ReactNode;
  label: string;
  selected: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  color?: string;
}) {
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
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 rounded-full text-[12px] transition-colors border ${
              selected === opt.value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children, disabled = false }: { title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] text-gray-400 uppercase tracking-wider px-4 mb-1">{title}</div>
      <div
        className={`bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 divide-y divide-gray-50 ${
          disabled ? "opacity-50 pointer-events-none select-none grayscale-[0.15]" : ""
        }`}
        aria-disabled={disabled}
      >
        {children}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { user, logout, saveUserPreferences, setAccountFrozen } = useAuth();
  const { pubs, refresh } = usePlaces();
  const { setSelectedCity, setSelectedArea } = useFilters();
  const {
    pushNotifications,
    setPushNotifications,
    savedPlaceUpdates,
    setSavedPlaceUpdates,
    darkMode,
    setDarkMode,
    distanceUnit,
    setDistanceUnit,
    defaultCity,
    setDefaultCity,
    showTouristHeavyBars,
    setShowTouristHeavyBars,
  } = useSettings();
  const [signingOut, setSigningOut] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState<null | "score" | "notes">(null);
  const [updatingFrozen, setUpdatingFrozen] = useState(false);
  const supportEmail = "hello@grapevine.app";
  const hideTouristHeavyPlaces = !showTouristHeavyBars;

  const cityOptions = useMemo(() => {
    const unique = Array.from(new Set(pubs.map((pub) => pub.city.trim()).filter(Boolean)));
    const hasDefault = unique.includes(defaultCity);
    const list = hasDefault ? unique : [defaultCity, ...unique];
    return list.length > 0 ? list : ["Budapest"];
  }, [defaultCity, pubs]);

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    try {
      await logout();
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  };

  const handlePushNotifications = async (next: boolean) => {
    if (!next) {
      setPushNotifications(false);
      return;
    }

    if (!("Notification" in window)) {
      setPushNotifications(false);
      return;
    }

    if (Notification.permission === "granted") {
      setPushNotifications(true);
      return;
    }

    const permission = await Notification.requestPermission();
    setPushNotifications(permission === "granted");
  };

  const handleDefaultCityChange = (city: string) => {
    setDefaultCity(city);
    setSelectedCity(city);
    setSelectedArea("All areas");
  };

  const openMail = (subject: string, body: string) => {
    const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const fallbackUsername = ((user?.username ?? user?.email?.split("@")[0] ?? "grapevine_user").replace(/^@+/, "").trim() || "grapevine_user");
  const fallbackCity = user?.city ?? "";
  const hideScore = user?.hideScore ?? false;
  const showPublicNotes = user?.showPublicNotes ?? true;
  const isFrozen = user?.isFrozen ?? false;

  const handleHideScoreToggle = async (next: boolean) => {
    if (!user || savingPrivacy) {
      return;
    }

    setSavingPrivacy("score");
    const { error } = await saveUserPreferences({
      username: fallbackUsername,
      city: fallbackCity,
      hideScore: next,
      showPublicNotes,
    });
    if (error) {
      console.warn("Failed to update hide-score preference:", error);
    }
    setSavingPrivacy(null);
  };

  const handleShowPublicNotesToggle = async (next: boolean) => {
    if (!user || savingPrivacy) {
      return;
    }

    setSavingPrivacy("notes");
    const { error } = await saveUserPreferences({
      username: fallbackUsername,
      city: fallbackCity,
      hideScore,
      showPublicNotes: next,
    });
    if (error) {
      console.warn("Failed to update public-notes preference:", error);
    }
    setSavingPrivacy(null);
  };

  const handleFrozenToggle = async (next: boolean) => {
    if (!user || updatingFrozen) {
      return;
    }

    const confirmed = window.confirm(
      next
        ? "Freeze account? This hides your leaderboard presence and all your ratings/notes from the app until you unfreeze."
        : "Unfreeze account? Your leaderboard and review visibility will be restored.",
    );

    if (!confirmed) {
      return;
    }

    setUpdatingFrozen(true);
    const { error } = await setAccountFrozen(next);
    if (error) {
      window.alert(error);
      setUpdatingFrozen(false);
      return;
    }

    try {
      await refresh();
    } catch {
      // no-op: UI state is already updated; lists will refresh on next load
    } finally {
      setUpdatingFrozen(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <button
          onClick={() => navigate("/profile")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-gray-900 text-[16px]">Settings</div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 pb-10">
        <Section title="Notifications (coming soon)" disabled>
          <ToggleRow
            icon={<Bell weight="duotone" size={18} />}
            label="Push notifications"
            sublabel="Place updates and recommendations"
            color="#F59E0B"
            value={pushNotifications}
            onChange={(next) => void handlePushNotifications(next)}
            disabled
          />
          <ToggleRow
            icon={<HeartStraight weight="duotone" size={18} />}
            label="Saved place updates"
            sublabel="When a saved place profile changes"
            color="#EF4444"
            value={savedPlaceUpdates}
            onChange={setSavedPlaceUpdates}
            disabled
          />
        </Section>

        <Section title="Appearance">
          <ToggleRow
            icon={<Moon weight="duotone" size={18} />}
            label="Dark mode (coming soon)"
            sublabel="Temporarily disabled while we finalize the theme"
            color="#8B5CF6"
            value={darkMode}
            onChange={setDarkMode}
            disabled
          />
          <SelectRow
            icon={<Ruler weight="duotone" size={18} />}
            label="Distance units"
            selected={distanceUnit}
            onChange={(value) => setDistanceUnit(value as DistanceUnit)}
            options={[
              { label: "km", value: "km" },
              { label: "mi", value: "mi" },
            ]}
            color="#10B981"
          />
        </Section>

        <Section title="Discovery">
          <SelectRow
            icon={<Globe weight="duotone" size={18} />}
            label="Default city"
            selected={defaultCity}
            onChange={handleDefaultCityChange}
            options={cityOptions.map((city) => ({ label: city, value: city }))}
            color="#3B82F6"
          />
          <ToggleRow
            icon={<ShieldCheck weight="duotone" size={18} />}
            label="Hide tourist-heavy places"
            sublabel="When on, places with tourist score 85+ are hidden"
            color="#10B981"
            value={hideTouristHeavyPlaces}
            onChange={(next) => setShowTouristHeavyBars(!next)}
          />
          <LinkRow
            icon={<Info weight="duotone" size={18} />}
            label="Trait pill guide"
            sublabel="See what each place trait pill means"
            color="#D97706"
            onClick={() => navigate("/settings/pills")}
          />
        </Section>

        <Section title="Account">
          <ToggleRow
            icon={<ShieldCheck weight="duotone" size={18} />}
            label={savingPrivacy === "score" ? "Updating..." : "Hide my score"}
            sublabel="Hide your Grapevine Score and ranking from leaderboard and public profile"
            color="#7C3AED"
            value={hideScore}
            onChange={(next) => void handleHideScoreToggle(next)}
            disabled={!user || Boolean(savingPrivacy)}
          />
          <ToggleRow
            icon={<HeartStraight weight="duotone" size={18} />}
            label={savingPrivacy === "notes" ? "Updating..." : "Show my notes publicly"}
            sublabel="Allow your public profile to display notes you wrote"
            color="#2563EB"
            value={showPublicNotes}
            onChange={(next) => void handleShowPublicNotesToggle(next)}
            disabled={!user || Boolean(savingPrivacy)}
          />
          <LinkRow
            icon={<ShieldCheck weight="duotone" size={18} />}
            label="Privacy & data"
            sublabel="Policies, legal pages, and data requests"
            color="#374151"
            onClick={() => navigate("/settings/privacy-data")}
          />
          <LinkRow
            icon={<HeartStraight weight="duotone" size={18} />}
            label="Leaderboard"
            sublabel="See top community contributors"
            color="#F59E0B"
            onClick={() => navigate("/leaderboard")}
          />
          <LinkRow
            icon={<Bug weight="duotone" size={18} />}
            label="Report bug"
            sublabel="Send an issue report to the Grapevine team"
            color="#2563EB"
            onClick={() => navigate("/settings/report-bug")}
          />
          {user?.canAccessAdmin ? (
            <LinkRow
              icon={<ShieldCheck weight="duotone" size={18} />}
              label="Admin panel"
              sublabel="Super-admin tools and moderation"
              color="#111827"
              onClick={() => navigate("/admin")}
            />
          ) : null}
          <LinkRow
            icon={<SignOut weight="duotone" size={18} />}
            label={signingOut ? "Signing out..." : "Sign out"}
            danger
            onClick={() => void handleSignOut()}
          />
        </Section>

        <Section title="About">
          <LinkRow
            icon={<HeartStraight weight="duotone" size={18} />}
            label="Support Grapevine"
            sublabel={`Contact us at ${supportEmail}`}
            color="#EF4444"
            onClick={() =>
              openMail(
                "Grapevine support",
                "Hi Grapevine team,\n\nI would like to support the project.",
              )
            }
          />
          <LinkRow
            icon={<Info weight="duotone" size={18} />}
            label="Version 1.0.0 (beta)"
            sublabel="Made with love for pub explorers"
            color="#6B7280"
          />
        </Section>

        <Section title="Danger zone">
          <ToggleRow
            icon={<ShieldCheck weight="duotone" size={18} />}
            label={isFrozen ? "Freeze account is ON (temporarily locked)" : "Freeze account (coming soon)"}
            sublabel={
              isFrozen
                ? "Your account is currently frozen. In-app changes are temporarily disabled."
                : "This setting is temporarily disabled while we finalize account state handling."
            }
            color="#DC2626"
            value={isFrozen}
            onChange={(next) => void handleFrozenToggle(next)}
            disabled
          />
          <LinkRow
            icon={<TrashSimple weight="duotone" size={18} />}
            label="Delete account"
            sublabel="Permanently remove your data"
            danger
            onClick={() =>
              openMail(
                "Grapevine account deletion request",
                "Hi Grapevine team,\n\nPlease delete my Grapevine account and associated profile data.",
              )
            }
          />
        </Section>
      </div>
    </div>
  );
}
