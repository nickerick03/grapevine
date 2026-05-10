import { useEffect, useRef, useState } from "react";
import { X, Eye, EyeOff, CalendarDays } from "lucide-react";
import { CircleNotch } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import {
  formatIsoToBirthDateInput,
  getLatestAllowedBirthDateIso,
  isAtLeastAge,
  MINIMUM_REGISTER_AGE,
  normalizeBirthDateInput,
  parseBirthDateInputToIso,
} from "@/lib/auth/ageGate";
import { normalizeUsernameInput, validateUsername } from "@/lib/auth/username";

export function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordResetEmail,
    rememberMe,
    rememberedEmail,
    setRememberMe,
  } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState(rememberedEmail);
  const [loginPass, setLoginPass] = useState("");

  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState(rememberedEmail);
  const [regPass, setRegPass] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regBirthDateIso, setRegBirthDateIso] = useState("");
  const [regBirthDateInput, setRegBirthDateInput] = useState("");
  const birthDatePickerRef = useRef<HTMLInputElement | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
    setNotice("");
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

  const handleForgotPassword = async () => {
    if (!loginEmail || !loginEmail.includes("@")) {
      setError("Enter the email address for your account first.");
      return;
    }

    setError("");
    setNotice("");
    setSendingReset(true);
    try {
      const result = await sendPasswordResetEmail(loginEmail.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice("If an account exists for this email, we sent a password reset link.");
      setForgotMode(false);
    } finally {
      setSendingReset(false);
    }
  };

  const handleRegister = async () => {
    if (!regUsername || !regEmail || !regPass || !regConfirm || !regBirthDateInput) { setError("Please fill in all fields."); return; }
    if (!regEmail.includes("@")) { setError("Enter a valid email."); return; }
    if (!regBirthDateIso) { setError("Please use yyyy/mm/dd for your date of birth."); return; }
    const normalizedUsername = normalizeUsernameInput(regUsername);
    const usernameError = validateUsername(normalizedUsername);
    if (usernameError) { setError(usernameError); return; }
    if (regPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (regPass !== regConfirm) { setError("Passwords don't match."); return; }
    if (!isAtLeastAge(regBirthDateIso, MINIMUM_REGISTER_AGE)) {
      setError(`You must be at least ${MINIMUM_REGISTER_AGE} years old to register.`);
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const result = await signUpWithPassword(normalizedUsername, regEmail.trim(), regPass, regBirthDateIso);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.requiresEmailConfirmation) {
        setNotice("Your account is ready. Please verify your email to activate it, then come back and log in.");
        setLoginEmail(regEmail.trim());
        setLoginPass("");
        setRegPass("");
        setRegConfirm("");
        setRegBirthDateInput("");
        setRegBirthDateIso("");
        setTab("login");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-up failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBirthDateInputChange = (nextValue: string) => {
    const normalizedInput = normalizeBirthDateInput(nextValue);
    setRegBirthDateInput(normalizedInput);
    setError("");

    const parsedIso = parseBirthDateInputToIso(normalizedInput);
    setRegBirthDateIso(parsedIso ?? "");
  };

  const handleBirthDateCalendarChange = (nextIsoValue: string) => {
    setRegBirthDateIso(nextIsoValue);
    setRegBirthDateInput(formatIsoToBirthDateInput(nextIsoValue));
    setError("");
  };

  const openBirthDatePicker = () => {
    const pickerInput = birthDatePickerRef.current;
    if (!pickerInput) {
      return;
    }

    const maybeShowPicker = pickerInput as HTMLInputElement & { showPicker?: () => void };
    if (typeof maybeShowPicker.showPicker === "function") {
      maybeShowPicker.showPicker();
      return;
    }

    pickerInput.click();
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
              onClick={() => { setTab(t); setError(""); setNotice(""); setForgotMode(false); }}
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
              <button
                onClick={() => {
                  setForgotMode((current) => !current);
                  setError("");
                  setNotice("");
                }}
                className="text-[12px] text-gray-500 hover:text-gray-700 text-right w-full"
              >
                Forgot password?
              </button>
              {forgotMode ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <div className="text-[12px] text-amber-900 leading-5">
                    We will send a reset link to <span className="font-medium">{loginEmail || "your email address"}</span>.
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleForgotPassword}
                      disabled={sendingReset}
                      className="flex-1 rounded-xl bg-gray-900 px-3 py-2 text-[12px] text-white disabled:opacity-70"
                    >
                      {sendingReset ? "Sending..." : "Send reset email"}
                    </button>
                    <button
                      onClick={() => setForgotMode(false)}
                      className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-[12px] text-amber-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                  {error}
                </div>
              ) : null}
              {notice ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-800">
                  {notice}
                </div>
              ) : null}
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
                type="email"
                placeholder="Email address"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <input
                type="text"
                placeholder="Username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Date of birth (yyyy/mm/dd)"
                  value={regBirthDateInput}
                  onChange={(e) => handleBirthDateInputChange(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={openBirthDatePicker}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label="Pick birth date from calendar"
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
                <input
                  ref={birthDatePickerRef}
                  type="date"
                  value={regBirthDateIso}
                  max={latestAllowedBirthDate}
                  onChange={(e) => handleBirthDateCalendarChange(e.target.value)}
                  tabIndex={-1}
                  className="absolute h-0 w-0 opacity-0 pointer-events-none"
                  aria-hidden="true"
                />
              </div>
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
                type="password"
                placeholder="Re-enter password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                  {error}
                </div>
              ) : null}
              {notice ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-800">
                  {notice}
                </div>
              ) : null}
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
