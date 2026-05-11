import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { EmailOtpType, User as SupabaseUser } from "@supabase/supabase-js";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { CircleNotch } from "@phosphor-icons/react";

import { supabase } from "@/lib/supabase/client";
import { normalizeUsernameInput } from "@/lib/auth/username";

type CallbackStatus = "processing" | "success" | "error";

type CallbackState = {
  status: CallbackStatus;
  title: string;
  message: string;
};

const AUTO_REDIRECT_MS = 1600;
const RESET_MODE = "reset";
const AUTH_STEP_TIMEOUT_MS = 9000;
const CALLBACK_WATCHDOG_MS = 18000;

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function hashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

function buildFriendlyAuthError(errorCode: string | null, errorDescription: string | null): string {
  const normalizedCode = (errorCode ?? "").toLowerCase();
  let normalizedDescription = "";
  try {
    normalizedDescription = decodeURIComponent(errorDescription ?? "").toLowerCase();
  } catch {
    normalizedDescription = (errorDescription ?? "").toLowerCase();
  }

  if (
    normalizedCode.includes("expired")
    || normalizedDescription.includes("expired")
    || normalizedDescription.includes("otp_expired")
  ) {
    return "This confirmation link expired. Please request a new verification email and try again.";
  }

  if (
    normalizedCode.includes("invalid")
    || normalizedCode.includes("access_denied")
    || normalizedDescription.includes("invalid")
    || normalizedDescription.includes("denied")
  ) {
    return "This confirmation link is invalid or already used. Please request a new verification email.";
  }

  if (normalizedDescription) {
    const first = normalizedDescription.charAt(0).toUpperCase();
    return `${first}${normalizedDescription.slice(1)}`;
  }

  return "We could not verify this link. Please request a new confirmation email.";
}

function readAuthErrors(search: URLSearchParams, hash: URLSearchParams): { code: string | null; description: string | null } {
  const code = search.get("error_code") ?? hash.get("error_code") ?? search.get("error");
  const description = search.get("error_description") ?? hash.get("error_description");
  return { code, description };
}

function readAuthType(search: URLSearchParams, hash: URLSearchParams): string | null {
  return search.get("type") ?? hash.get("type");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hasRequiredOnboarding(user: SupabaseUser | null, profile: { username: string | null; birth_date: string | null } | null): boolean {
  const profileUsername = normalizeUsernameInput(profile?.username ?? "");
  const metadataUsername = normalizeUsernameInput(
    typeof user?.user_metadata?.username === "string" ? user.user_metadata.username : "",
  );
  const metadataBirthDate = typeof user?.user_metadata?.birth_date === "string"
    ? user.user_metadata.birth_date.trim()
    : "";
  const profileBirthDate = profile?.birth_date?.trim() ?? "";

  return Boolean(profileUsername || metadataUsername) && Boolean(profileBirthDate || metadataBirthDate);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMessage: string, timeoutMs = AUTH_STEP_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function AuthCallbackScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const handledRef = useRef(false);
  const [state, setState] = useState<CallbackState>({
    status: "processing",
    title: "Confirming your account...",
    message: "Please hold on while we securely verify your email.",
  });

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    let active = true;
    let redirectTimeout: ReturnType<typeof setTimeout> | null = null;
    const watchdogTimeout = setTimeout(() => {
      if (!active) {
        return;
      }
      setState((current) => {
        if (current.status !== "processing") {
          return current;
        }
        return {
          status: "error",
          title: "Verification took too long",
          message: "We could not finish verification in time. Please return to login and request a new link.",
        };
      });
    }, CALLBACK_WATCHDOG_MS);

    const run = async () => {
      const search = new URLSearchParams(location.search);
      const hash = hashParams(location.hash);
      const authError = readAuthErrors(search, hash);
      const authType = readAuthType(search, hash);
      const mode = search.get("mode");
      const isRecoveryFlow = mode === RESET_MODE || authType === "recovery";

      if (authError.code || authError.description) {
        if (!active) {
          return;
        }
        setState({
          status: "error",
          title: isRecoveryFlow ? "Reset link failed" : "Verification link failed",
          message: buildFriendlyAuthError(authError.code, authError.description),
        });
        return;
      }

      try {
        const code = search.get("code");
        const tokenHash = search.get("token_hash");
        const type = search.get("type");
        const hashAccessToken = hash.get("access_token");
        const hashRefreshToken = hash.get("refresh_token");
        const hasAuthPayload = Boolean(code || tokenHash || hashAccessToken || hashRefreshToken);

        if (!hasAuthPayload) {
          const { data: quickSession, error: quickSessionError } = await withTimeout(
            supabase.auth.getSession(),
            "We couldn't verify this link in time.",
          );

          if (quickSessionError) {
            throw quickSessionError;
          }

          if (!quickSession.session?.user) {
            if (!active) {
              return;
            }
            setState({
              status: "error",
              title: isRecoveryFlow ? "Reset link opened" : "Email verified",
              message: isRecoveryFlow
                ? "The reset link opened without a valid reset session. Please request a new reset email."
                : "Your email is confirmed, but we couldn't create a login session from this link. Please return to the app and log in.",
            });
            return;
          }
        }

        if (code) {
          const { error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            "The verification link timed out.",
          );
          if (error) {
            const message = error.message?.toLowerCase() ?? "";
            const maybeAlreadyHandled =
              message.includes("code verifier")
              || message.includes("flow state not found")
              || message.includes("flow state expired");
            if (!maybeAlreadyHandled) {
              throw error;
            }
          }
        } else if (tokenHash && type && EMAIL_OTP_TYPES.has(type as EmailOtpType)) {
          const { error } = await withTimeout(
            supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as EmailOtpType,
            }),
            "The verification link timed out.",
          );
          if (error) {
            throw error;
          }
        }

        // detectSessionInUrl can resolve asynchronously in the browser, so retry briefly.
        let sessionUserFound = false;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const { data, error } = await withTimeout(
            supabase.auth.getSession(),
            "Session verification timed out.",
          );
          if (error) {
            throw error;
          }
          if (data.session?.user) {
            sessionUserFound = true;
            break;
          }
          await wait(250);
        }

        if (!sessionUserFound) {
          throw new Error("No active session found after verification.");
        }

        if (!active) {
          return;
        }

        const { data: currentSessionData } = await supabase.auth.getSession();
        const currentUser = currentSessionData.session?.user ?? null;
        let profile: { username: string | null; birth_date: string | null } | null = null;
        if (currentUser?.id) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("username,birth_date")
            .eq("id", currentUser.id)
            .maybeSingle();
          profile = profileData ?? null;
        }

        if (isRecoveryFlow) {
          setState({
            status: "success",
            title: "Reset link verified",
            message: "You can now set a new password.",
          });

          redirectTimeout = setTimeout(() => {
            navigate("/auth/reset", { replace: true });
          }, 600);
          return;
        }

        setState({
          status: "success",
          title: "Registration verified",
          message: "Your account is confirmed and you are now signed in.",
        });

        redirectTimeout = setTimeout(() => {
          if (!hasRequiredOnboarding(currentUser, profile)) {
            navigate("/edit-profile?onboarding=1", { replace: true });
            return;
          }
          navigate("/", { replace: true });
        }, AUTO_REDIRECT_MS);
      } catch (error) {
        if (!active) {
          return;
        }
        const message = error instanceof Error ? error.message : "Verification failed.";
        setState({
          status: "error",
          title: isRecoveryFlow ? "Reset link failed" : "Verification link failed",
          message: buildFriendlyAuthError(null, message),
        });
      }
    };

    void run();

    return () => {
      active = false;
      clearTimeout(watchdogTimeout);
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [location.hash, location.search, navigate]);

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex items-center justify-center px-6">
      <div className="w-full max-w-[360px] rounded-3xl border border-gray-200 bg-white shadow-[0_12px_36px_rgba(0,0,0,0.08)] p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
          {state.status === "processing" ? (
            <CircleNotch className="h-7 w-7 animate-spin text-[#f45d01]" />
          ) : state.status === "success" ? (
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-7 w-7 text-amber-600" />
          )}
        </div>

        <h1 className="text-[20px] leading-tight text-gray-900">{state.title}</h1>
        <p className="mt-2 text-[13px] leading-5 text-gray-600">{state.message}</p>

        {state.status === "error" ? (
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => navigate("/auth", { replace: true })}
              className="flex-1 rounded-2xl bg-gray-900 px-4 py-3 text-[13px] text-white"
            >
              Back to login
            </button>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[13px] text-gray-700"
            >
              Continue as guest
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
