import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, Eye, EyeSlash } from "@phosphor-icons/react";
import {
  User,
  Lock,
  MapPin,
  EyeClosed,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";

/* ── small reusable field wrapper ── */
function Field({
  label,
  hint,
  icon,
  children,
  error,
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">{icon}</span>
        <label className="text-[12px] text-gray-500 uppercase tracking-widest">
          {label}
        </label>
      </div>
      {children}
      {error && (
        <div className="flex items-center gap-1 text-[11px] text-red-500">
          <WarningCircle size={12} weight="fill" />
          {error}
        </div>
      )}
      {hint && !error && (
        <p className="text-[11px] text-gray-400">{hint}</p>
      )}
    </div>
  );
}

/* ── styled text input ── */
function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  prefix?: string;
}) {
  return (
    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-400 focus-within:bg-white transition-all">
      {prefix && (
        <span className="pl-3 pr-1 text-[13px] text-gray-400 select-none">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-3 bg-transparent text-[14px] text-gray-900 placeholder-gray-400 outline-none"
      />
    </div>
  );
}

/* ── password input with show/hide ── */
function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-400 focus-within:bg-white transition-all">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-3 bg-transparent text-[14px] text-gray-900 placeholder-gray-400 outline-none"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShow((s) => !s)}
        className="px-3 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeSlash size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

/* ── strength bar ── */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-400", "bg-amber-400", "bg-blue-400", "bg-emerald-500"];
  const textColors = ["text-red-500", "text-amber-500", "text-blue-500", "text-emerald-600"];

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i < score ? colors[score - 1] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-[11px] ${textColors[score - 1] ?? "text-gray-400"}`}>
        {labels[score - 1] ?? ""}
      </p>
    </div>
  );
}

/* ── POPULAR CITIES ── */
const POPULAR_CITIES = [
  "London", "Dublin", "Edinburgh", "Manchester", "Birmingham",
  "Amsterdam", "Berlin", "Paris", "Barcelona", "New York",
  "Sydney", "Melbourne", "Toronto", "Tokyo", "Copenhagen",
];

/* ═══════════════════════════════════════════════════════════ */
export function EditProfileScreen() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  /* ── local state ── */
  const [username, setUsername]       = useState(user?.username ?? "");
  const [city, setCity]               = useState(user?.city ?? "");
  const [cityQuery, setCityQuery]     = useState(user?.city ?? "");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [hideScore, setHideScore]     = useState(user?.hideScore ?? false);

  const [currentPw, setCurrentPw]     = useState("");
  const [newPw, setNewPw]             = useState("");
  const [confirmPw, setConfirmPw]     = useState("");

  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [saved, setSaved]             = useState(false);
  const [pwSaved, setPwSaved]         = useState(false);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  if (!user) return null;

  /* ── username validation ── */
  const usernameError = (() => {
    if (!username.trim()) return "Username is required";
    if (username.length < 3) return "At least 3 characters";
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) return "Only letters, numbers, _ and .";
    return "";
  })();

  /* ── password validation ── */
  const pwError = (() => {
    if (!currentPw && !newPw && !confirmPw) return "";   // untouched
    if (!currentPw) return "Enter your current password first";
    if (newPw.length < 8) return "New password must be at least 8 characters";
    if (newPw !== confirmPw) return "Passwords don't match";
    return "";
  })();

  /* ── city suggestions ── */
  const suggestions = POPULAR_CITIES.filter(
    (c) => cityQuery.length > 0 && c.toLowerCase().startsWith(cityQuery.toLowerCase()) && c !== cityQuery
  ).slice(0, 5);

  /* ── save profile ── */
  const handleSave = () => {
    if (usernameError) {
      setErrors({ username: usernameError });
      return;
    }
    updateUser({
      username: username.trim(),
      city: city.trim(),
      hideScore,
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); }, 2000);
  };

  /* ── save password ── */
  const handleSavePassword = () => {
    if (pwError) {
      setErrors((e) => ({ ...e, password: pwError }));
      return;
    }
    // In a real app: call API to change password
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 2500);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* ── Header ── */}
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-gray-100 z-10">
        <button
          onClick={() => navigate("/profile")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft size={17} className="text-gray-600" />
        </button>
        <span className="text-gray-900">Edit Profile</span>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition-all ${
            saved
              ? "bg-emerald-500 text-white"
              : "bg-gray-900 text-white active:scale-95"
          }`}
        >
          <Check size={13} weight="bold" />
          {saved ? "Saved!" : "Save"}
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto pb-10">

        {/* Avatar mini-preview */}
        <div className="flex flex-col items-center pt-7 pb-5">
          <button
            onClick={() => navigate("/photo-edit")}
            className="relative group"
          >
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg flex items-center justify-center"
              style={
                user.profilePhoto
                  ? undefined
                  : { background: `linear-gradient(135deg, ${user.gradientFrom}, ${user.gradientTo})` }
              }
            >
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">{user.emoji}</span>
              )}
            </div>
            <div className="absolute inset-0 rounded-2xl bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-[11px]">Change</span>
            </div>
          </button>
          <button
            onClick={() => navigate("/photo-edit")}
            className="mt-2 text-[12px] text-gray-500 underline underline-offset-2"
          >
            Edit photo &amp; avatar
          </button>
        </div>

        {/* ── Section: Account ── */}
        <div className="px-4 mb-3">
          <div className="text-[11px] text-gray-400 uppercase tracking-widest px-1 mb-2">
            Account
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 space-y-5">

            {/* Display name – read-only hint */}
            <Field
              label="Display name"
              icon={<User size={14} />}
              hint="Your name shown on ratings and reviews."
            >
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-[14px] text-gray-400">
                {user.name}
                <span className="ml-auto text-[11px] text-gray-300">read‑only</span>
              </div>
            </Field>

            {/* Username */}
            <Field
              label="Username"
              icon={<User size={14} weight="duotone" />}
              hint="Unique handle — letters, numbers, _ and . only."
              error={errors.username}
            >
              <TextInput
                value={username}
                onChange={(v) => {
                  setUsername(v);
                  setErrors((e) => ({ ...e, username: "" }));
                }}
                placeholder="your_handle"
                prefix="@"
              />
            </Field>

            {/* City */}
            <Field
              label="Your city"
              icon={<MapPin size={14} weight="duotone" />}
              hint="Used to personalise nearby pub suggestions."
            >
              <div className="relative">
                <TextInput
                  value={cityQuery}
                  onChange={(v) => {
                    setCityQuery(v);
                    setCity(v);
                    setShowCitySuggestions(true);
                    setErrors((e) => ({ ...e, city: "" }));
                  }}
                  placeholder="e.g. London"
                />
                {showCitySuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => {
                          setCity(s);
                          setCityQuery(s);
                          setShowCitySuggestions(false);
                        }}
                      >
                        <MapPin size={13} className="text-gray-400 flex-none" />
                        <span className="text-[13px] text-gray-700">{s}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>
        </div>

        {/* ── Section: Privacy ── */}
        <div className="px-4 mb-3">
          <div className="text-[11px] text-gray-400 uppercase tracking-widest px-1 mb-2">
            Privacy
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-none mt-0.5">
                  <ShieldCheck size={17} weight="duotone" className="text-purple-500" />
                </div>
                <div>
                  <div className="text-[14px] text-gray-900">Hide my score</div>
                  <div className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                    Your VibeScore won't appear on the leaderboard or your public profile.
                  </div>
                </div>
              </div>
              {/* Toggle */}
              <button
                onClick={() => setHideScore((h) => !h)}
                className={`flex-none w-12 h-7 rounded-full transition-colors relative ${
                  hideScore ? "bg-purple-500" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all ${
                    hideScore ? "left-[calc(100%-26px)]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            {hideScore && (
              <div className="mt-3 flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2.5">
                <EyeClosed size={14} className="text-purple-400 flex-none" />
                <p className="text-[11px] text-purple-600">
                  Your score is currently hidden from the community.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Section: Password ── */}
        <div className="px-4 mb-3">
          <div className="text-[11px] text-gray-400 uppercase tracking-widest px-1 mb-2">
            Password
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 space-y-4">

            <Field
              label="Current password"
              icon={<Lock size={14} />}
            >
              <PasswordInput
                value={currentPw}
                onChange={(v) => { setCurrentPw(v); setErrors((e) => ({ ...e, password: "" })); }}
                placeholder="••••••••"
              />
            </Field>

            <Field
              label="New password"
              icon={<Lock size={14} weight="duotone" />}
              error={errors.password}
            >
              <PasswordInput
                value={newPw}
                onChange={(v) => { setNewPw(v); setErrors((e) => ({ ...e, password: "" })); }}
                placeholder="Min. 8 characters"
              />
              <PasswordStrength password={newPw} />
            </Field>

            <Field
              label="Confirm new password"
              icon={<Lock size={14} weight="duotone" />}
            >
              <PasswordInput
                value={confirmPw}
                onChange={(v) => { setConfirmPw(v); setErrors((e) => ({ ...e, password: "" })); }}
                placeholder="Repeat new password"
              />
            </Field>

            <button
              onClick={handleSavePassword}
              className={`w-full py-3 rounded-xl text-[13px] transition-all ${
                pwSaved
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-[0.98]"
              }`}
            >
              {pwSaved ? "✓ Password updated" : "Update password"}
            </button>
          </div>
        </div>

        {/* ── Danger zone ── */}
        <div className="px-4">
          <div className="text-[11px] text-gray-400 uppercase tracking-widest px-1 mb-2">
            Danger zone
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5">
            <button className="w-full py-3 rounded-xl border border-red-100 bg-red-50 text-red-500 text-[13px] hover:bg-red-100 transition-colors">
              Delete account
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              This is permanent and cannot be undone.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
