import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { CircleNotch } from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { BottomNav } from "../BottomNav";
import { getLatestAllowedBirthDateIso, isAtLeastAge, MINIMUM_REGISTER_AGE } from "@/lib/auth/ageGate";

interface AuthScreenProps {
  profileMode?: boolean;
}

export function AuthScreen({ profileMode = false }: AuthScreenProps) {
  const navigate = useNavigate();
  const { signInWithPassword, signUpWithPassword, rememberMe, rememberedEmail, setRememberMe } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [loginEmail, setLoginEmail] = useState(rememberedEmail);
  const [loginPass, setLoginPass] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState(rememberedEmail);
  const [regPass, setRegPass] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regBirthDate, setRegBirthDate] = useState("");

  const [error, setError] = useState("");
  const latestAllowedBirthDate = getLatestAllowedBirthDateIso();

  useEffect(() => {
    if (rememberedEmail) {
      setLoginEmail((current) => (current ? current : rememberedEmail));
      setRegEmail((current) => (current ? current : rememberedEmail));
    }
  }, [rememberedEmail]);

  const handleLogin = async () => {
    if (!loginEmail || !loginPass) { setError("Please fill in all fields."); return; }
    if (!loginEmail.includes("@")) { setError("Enter a valid email."); return; }
    setError("");
    setSubmitting(true);
    try {
      const result = await signInWithPassword(loginEmail.trim(), loginPass);
      if (result.error) {
        setError(result.error);
        return;
      }
      navigate("/");
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
        setError("Account created. Please verify your email, then log in.");
        setTab("login");
        return;
      }
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-up failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      {!profileMode ? (
        <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 bg-white/70 backdrop-blur">
          <button
            onClick={() => navigate(-1 as any)}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-gray-900 text-[16px]">
            {tab === "login" ? "Log in" : "Create account"}
          </div>
        </div>
      ) : null}

      <div className={`flex-1 px-5 pb-[84px] ${profileMode ? "overflow-hidden py-4" : "overflow-y-auto py-6"}`}>
        {/* Logo */}
        <div className={`flex flex-col items-center ${profileMode ? "mb-5 mt-1" : "mb-8"}`}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md"
            style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
          >
            <div className="flex gap-[3px] items-end h-7">
              {[
                { color: "#F59E0B", h: "55%" },
                { color: "#EF4444", h: "75%" },
                { color: "#10B981", h: "100%" },
                { color: "#3B82F6", h: "65%" },
                { color: "#8B5CF6", h: "80%" },
              ].map((b, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full"
                  style={{ height: b.h, background: b.color }}
                />
              ))}
            </div>
          </div>
          <div className="text-gray-900 text-[18px] tracking-tight">Grapevine</div>
          <div className="text-[13px] text-gray-500 mt-1 text-center">
            Discover pubs by atmosphere, not just ratings.
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-[13px] transition-all ${
                tab === t ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              {t === "login" ? "Log in" : "Register"}
            </button>
          ))}
        </div>

        {/* Login form */}
        {tab === "login" && (
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
            />
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
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
            <button className="text-[12px] text-gray-500 hover:text-gray-700 w-full text-right">
              Forgot password?
            </button>
            {error && <div className="text-[12px] text-red-500 px-1">{error}</div>}
            <button
              onClick={handleLogin}
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white shadow-md disabled:opacity-80 disabled:cursor-not-allowed"
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
          </div>
        )}

        {/* Register form */}
        {tab === "register" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
            />
            <input
              type="email"
              placeholder="Email address"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
            />
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Password (min. 6 characters)"
                value={regPass}
                onChange={(e) => setRegPass(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
              />
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type="date"
              value={regBirthDate}
              onChange={(e) => setRegBirthDate(e.target.value)}
              max={latestAllowedBirthDate}
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
            />
            <div className="text-[11px] text-gray-500 px-1">
              You must be at least {MINIMUM_REGISTER_AGE} years old.
            </div>
            {error && <div className="text-[12px] text-red-500 px-1">{error}</div>}
            <button
              onClick={handleRegister}
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white shadow-md"
            >
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </div>
        )}

        <div className="mt-5 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-[12px] text-gray-400 hover:text-gray-600 underline underline-offset-2 decoration-dotted"
          >
            Continue as guest
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
