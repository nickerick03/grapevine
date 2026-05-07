import { useEffect, useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { CircleNotch } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { getLatestAllowedBirthDateIso, isAtLeastAge, MINIMUM_REGISTER_AGE } from "@/lib/auth/ageGate";

export function AuthModal() {
  const { authModalOpen, closeAuthModal, signInWithPassword, signUpWithPassword, rememberMe, rememberedEmail, setRememberMe } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState(rememberedEmail);
  const [loginPass, setLoginPass] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState(rememberedEmail);
  const [regPass, setRegPass] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regBirthDate, setRegBirthDate] = useState("");

  const [error, setError] = useState("");
  const latestAllowedBirthDate = getLatestAllowedBirthDateIso();

  useEffect(() => {
    if (!authModalOpen) {
      return;
    }
    if (rememberedEmail) {
      setLoginEmail((current) => (current ? current : rememberedEmail));
      setRegEmail((current) => (current ? current : rememberedEmail));
    }
  }, [authModalOpen, rememberedEmail]);

  const handleLogin = async () => {
    if (!loginEmail || !loginPass) { setError("Please fill in all fields."); return; }
    if (!loginEmail.includes("@")) { setError("Enter a valid email."); return; }
    setError("");
    setSubmitting(true);
    try {
      const result = await signInWithPassword(loginEmail.trim(), loginPass);
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!regName || !regEmail || !regPass || !regConfirm || !regBirthDate) { setError("Please fill in all fields."); return; }
    if (!regEmail.includes("@")) { setError("Enter a valid email."); return; }
    if (regPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (regPass !== regConfirm) { setError("Passwords don't match."); return; }
    if (!isAtLeastAge(regBirthDate, MINIMUM_REGISTER_AGE)) {
      setError(`You must be at least ${MINIMUM_REGISTER_AGE} years old to register.`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await signUpWithPassword(regName.trim(), regEmail.trim(), regPass, regBirthDate);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.requiresEmailConfirmation) {
        setError("Account created. Please verify your email, then sign in.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-up failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!authModalOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={closeAuthModal}
      />

      {/* Card */}
      <div className="relative z-10 w-full bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl mx-0 sm:mx-4 max-h-[90%] overflow-y-auto">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          {/* Mini logo */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
            >
              <div className="flex gap-[2px] items-end h-4">
                {[
                  { color: "#F59E0B", h: "60%" },
                  { color: "#EF4444", h: "80%" },
                  { color: "#10B981", h: "100%" },
                  { color: "#3B82F6", h: "70%" },
                  { color: "#8B5CF6", h: "85%" },
                ].map((b, i) => (
                  <div
                    key={i}
                    className="w-[2.5px] rounded-full"
                    style={{ height: b.h, background: b.color }}
                  />
                ))}
              </div>
            </div>
            <span className="text-gray-900 tracking-tight">Grapevine</span>
          </div>
          <button
            onClick={closeAuthModal}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex mx-5 mt-2 bg-gray-100 rounded-xl p-1">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-[13px] transition-all ${
                tab === t
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500"
              }`}
            >
              {t === "login" ? "Log in" : "Register"}
            </button>
          ))}
        </div>

        {/* Forms */}
        <div className="px-5 pt-4 pb-6 space-y-3">
          {tab === "login" ? (
            <>
              <div className="text-[13px] text-gray-600 mb-1">
                Welcome back — find your place.
              </div>
              <input
                type="email"
                placeholder="Email address"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] text-gray-600">Remember me on this device</span>
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  aria-pressed={rememberMe}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    rememberMe ? "bg-gray-900" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      rememberMe ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              <button className="text-[12px] text-gray-500 hover:text-gray-700 text-right w-full">
                Forgot password?
              </button>
              {error && <div className="text-[12px] text-red-500 px-1">{error}</div>}
              <button
                onClick={handleLogin}
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-gray-900 text-white shadow-md mt-1 disabled:opacity-80 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <CircleNotch size={16} weight="bold" className="animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Log in"
                )}
              </button>
            </>
          ) : (
            <>
              <div className="text-[13px] text-gray-600 mb-1">
                Join to rate pubs and save your favorites.
              </div>
              <input
                type="text"
                placeholder="Username"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <input
                type="email"
                placeholder="Email address"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Password (min. 6 characters)"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <input
                type="date"
                value={regBirthDate}
                onChange={(e) => setRegBirthDate(e.target.value)}
                max={latestAllowedBirthDate}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <div className="text-[11px] text-gray-500 px-1">
                You must be at least {MINIMUM_REGISTER_AGE} years old.
              </div>
              {error && <div className="text-[12px] text-red-500 px-1">{error}</div>}
              <button
                onClick={handleRegister}
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-gray-900 text-white shadow-md mt-1"
              >
                {submitting ? "Creating account..." : "Create account"}
              </button>
            </>
          )}

          <div className="pt-1 text-center">
            <button
              onClick={closeAuthModal}
              className="text-[12px] text-gray-400 hover:text-gray-600 underline underline-offset-2 decoration-dotted"
            >
              Continue as guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
