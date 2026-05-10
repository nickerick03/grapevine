import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { EmailOtpType } from "@supabase/supabase-js";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { CircleNotch } from "@phosphor-icons/react";

import { supabase } from "@/lib/supabase/client";

type ResetViewState = "loading" | "ready" | "success" | "invalid";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function readHashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

function parseRecoveryError(search: URLSearchParams, hash: URLSearchParams): string | null {
  const errorCode = (search.get("error_code") ?? hash.get("error_code") ?? "").toLowerCase();
  const errorDescription = (search.get("error_description") ?? hash.get("error_description") ?? "").toLowerCase();
  const combined = `${errorCode} ${errorDescription}`.trim();

  if (!combined) {
    return null;
  }

  if (combined.includes("otp_expired") || combined.includes("expired")) {
    return "This reset link expired. Please request a new password reset email.";
  }

  if (combined.includes("invalid") || combined.includes("access_denied")) {
    return "This reset link is invalid or already used. Please request a new one.";
  }

  return "We could not verify this reset link. Please request a new one.";
}

function parseUpdatePasswordError(message: string): string {
  const value = message.toLowerCase();
  if (value.includes("same_password")) {
    return "Your new password must be different from your current password.";
  }
  if (value.includes("weak_password")) {
    return "This password is too weak. Please choose a stronger one.";
  }
  if (value.includes("auth session missing") || value.includes("session")) {
    return "Your reset session expired. Please request a new reset email.";
  }
  return message;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const initRef = useRef(false);

  const [viewState, setViewState] = useState<ResetViewState>("loading");
  const [statusMessage, setStatusMessage] = useState("Verifying your reset link...");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;

    let active = true;

    const run = async () => {
      const search = new URLSearchParams(location.search);
      const hash = readHashParams(location.hash);

      const parsedError = parseRecoveryError(search, hash);
      if (parsedError) {
        if (!active) return;
        setStatusMessage(parsedError);
        setViewState("invalid");
        return;
      }

      try {
        const code = search.get("code");
        const tokenHash = search.get("token_hash");
        const type = search.get("type");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            const message = exchangeError.message.toLowerCase();
            const maybeAlreadyHandled =
              message.includes("code verifier")
              || message.includes("flow state not found")
              || message.includes("flow state expired");
            if (!maybeAlreadyHandled) {
              throw exchangeError;
            }
          }
        } else if (tokenHash && type && EMAIL_OTP_TYPES.has(type as EmailOtpType)) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          });
          if (verifyError) {
            throw verifyError;
          }
        }

        let hasSession = false;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            throw sessionError;
          }
          if (data.session?.user) {
            hasSession = true;
            break;
          }
          await wait(250);
        }

        if (!hasSession) {
          throw new Error("Reset session is missing.");
        }

        if (!active) return;
        setViewState("ready");
        setStatusMessage("");
      } catch (resetError) {
        if (!active) return;
        const message = resetError instanceof Error ? parseUpdatePasswordError(resetError.message) : "Could not validate reset link.";
        setStatusMessage(message);
        setViewState("invalid");
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [location.hash, location.search]);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(parseUpdatePasswordError(updateError.message));
        return;
      }

      setViewState("success");
      setStatusMessage("Your password has been updated successfully.");
      await supabase.auth.signOut({ scope: "local" });
    } catch (updateError) {
      const message = updateError instanceof Error ? parseUpdatePasswordError(updateError.message) : "Password reset failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 bg-white/70 backdrop-blur">
        <button
          onClick={() => navigate("/auth")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-gray-900 text-[16px]">Reset password</div>
      </div>

      <div className="flex-1 px-5 py-6 overflow-y-auto">
        <div className="rounded-3xl border border-gray-200 bg-white shadow-[0_10px_32px_rgba(0,0,0,0.06)] p-5">
          {viewState === "loading" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CircleNotch size={24} weight="bold" className="animate-spin text-[#f45d01]" />
              <div className="mt-3 text-[14px] text-gray-700">{statusMessage}</div>
            </div>
          ) : null}

          {viewState === "invalid" ? (
            <div className="flex flex-col items-center py-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="mt-3 text-[14px] text-gray-900">Reset link is not usable</div>
              <div className="mt-1 text-[12px] text-gray-600 leading-5">{statusMessage}</div>
              <button
                onClick={() => navigate("/auth", { replace: true })}
                className="mt-4 w-full py-3 rounded-2xl bg-gray-900 text-white text-[13px]"
              >
                Back to login
              </button>
            </div>
          ) : null}

          {viewState === "ready" ? (
            <div>
              <div className="text-[14px] text-gray-900">Set your new password</div>
              <div className="text-[12px] text-gray-600 mt-1 mb-4">
                Choose a new password for your account.
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="New password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full px-4 py-3.5 pr-12 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
                  />
                  <button
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-white border border-gray-200 text-[14px] outline-none focus:border-gray-400 transition-colors"
                />
              </div>

              {error ? <div className="mt-3 text-[12px] text-red-500">{error}</div> : null}

              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="mt-4 w-full py-3.5 rounded-2xl bg-gray-900 text-white text-[13px] disabled:opacity-70"
              >
                {submitting ? "Updating password..." : "Update password"}
              </button>
            </div>
          ) : null}

          {viewState === "success" ? (
            <div className="flex flex-col items-center py-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="mt-3 text-[14px] text-gray-900">Password updated</div>
              <div className="mt-1 text-[12px] text-gray-600">{statusMessage}</div>
              <button
                onClick={() => navigate("/auth?reset=success", { replace: true })}
                className="mt-4 w-full py-3 rounded-2xl bg-gray-900 text-white text-[13px]"
              >
                Back to login
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
