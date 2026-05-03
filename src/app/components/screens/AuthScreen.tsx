import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuth, buildUser } from "../../context/AuthContext";

export function AuthScreen() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPass, setShowPass] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!loginEmail || !loginPass) { setError("Please fill in all fields."); return; }
    if (!loginEmail.includes("@")) { setError("Enter a valid email."); return; }
    const name = loginEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    login(buildUser(name, loginEmail));
    navigate("/");
  };

  const handleRegister = () => {
    if (!regName || !regEmail || !regPass || !regConfirm) { setError("Please fill in all fields."); return; }
    if (!regEmail.includes("@")) { setError("Enter a valid email."); return; }
    if (regPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (regPass !== regConfirm) { setError("Passwords don't match."); return; }
    login(buildUser(regName, regEmail));
    navigate("/");
  };

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white/70 backdrop-blur">
        <button
          onClick={() => navigate(-1 as any)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-gray-900">
          {tab === "login" ? "Log in" : "Create account"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
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
          <div className="text-gray-900 text-[18px] tracking-tight">VibeMap</div>
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
            <button className="text-[12px] text-gray-500 hover:text-gray-700 w-full text-right">
              Forgot password?
            </button>
            {error && <div className="text-[12px] text-red-500 px-1">{error}</div>}
            <button
              onClick={handleLogin}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white shadow-md"
            >
              Log in
            </button>
          </div>
        )}

        {/* Register form */}
        {tab === "register" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Display name"
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
              type="password"
              placeholder="Confirm password"
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
            />
            {error && <div className="text-[12px] text-red-500 px-1">{error}</div>}
            <button
              onClick={handleRegister}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white shadow-md"
            >
              Create account
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
    </div>
  );
}
