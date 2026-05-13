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

const RESET_MODE = "reset";
const AUTH_STEP_TIMEOUT_MS = 9000;
const CALLBACK_WATCHDOG_MS = 18000;
const SESSION_VERIFICATION_ATTEMPTS = 20;
const SESSION_VERIFICATION_INTERVAL_MS = 250;
const AUTH_CALLBACK_FLOW_HINT_KEY = "grapevine.auth.callbackFlow";
const EXPLORE_ONBOARDING_DONE_KEY = "grapevine.explore.onboardingDone.v1";
const GOOGLE_PROVIDER = "google";

type SuccessAction = {
  label: string;
  path: string;
};

type CallbackFlow = "email" | "recovery" | "google";

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

function buildFriendlyAuthError(errorCode: string | null, errorDescription: string | null, flow: CallbackFlow): string {
  const normalizedCode = (errorCode ?? "").toLowerCase();
  let decodedDescription = errorDescription?.trim() ?? "";
  try {
    decodedDescription = decodeURIComponent(errorDescription ?? "").trim();
  } catch {
    decodedDescription = (errorDescription ?? "").trim();
  }
  const normalizedDescription = decodedDescription.toLowerCase();

  if (flow === "google") {
    if (
      normalizedCode.includes("access_denied")
      || normalizedDescription.includes("access_denied")
      || normalizedDescription.includes("denied")
      || normalizedDescription.includes("cancel")
    ) {
      return "Google sign-in was canceled. Please try again.";
    }

    if (normalizedCode.includes("provider_disabled") || normalizedDescription.includes("provider_disabled")) {
      return "Google sign-in is currently unavailable. Please try another sign-in method.";
    }

    if (normalizedCode.includes("provider_email_needs_verification") || normalizedDescription.includes("needs_verification")) {
      return "Google did not return a verified email address. Please verify your Google account email and try again.";
    }

    if (decodedDescription) {
      const first = decodedDescription.charAt(0).toUpperCase();
      return `${first}${decodedDescription.slice(1)}`;
    }

    return "We could not complete Google sign-in. Please try again.";
  }

  if (
    normalizedCode.includes("expired")
    || normalizedDescription.includes("expired")
    || normalizedDescription.includes("otp_expired")
  ) {
    return flow === "recovery"
      ? "This reset link expired. Please request a new password reset email."
      : "This confirmation link expired. Please request a new verification email and try again.";
  }

  if (
    normalizedCode.includes("invalid")
    || normalizedCode.includes("access_denied")
    || normalizedDescription.includes("invalid")
    || normalizedDescription.includes("denied")
  ) {
    return flow === "recovery"
      ? "This reset link is invalid or already used. Please request a new one."
      : "This confirmation link is invalid or already used. Please request a new verification email.";
  }

  if (decodedDescription) {
    const first = decodedDescription.charAt(0).toUpperCase();
    return `${first}${decodedDescription.slice(1)}`;
  }

  return flow === "recovery"
    ? "We could not verify this reset link. Please request a new one."
    : "We could not verify this link. Please request a new confirmation email.";
}

function readAuthErrors(search: URLSearchParams, hash: URLSearchParams): { code: string | null; description: string | null } {
  const code = search.get("error_code") ?? hash.get("error_code") ?? search.get("error");
  const description = search.get("error_description") ?? hash.get("error_description");
  return { code, description };
}

function readAuthType(search: URLSearchParams, hash: URLSearchParams): string | null {
  return search.get("type") ?? hash.get("type");
}

function readStoredCallbackFlowHint(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.sessionStorage.getItem(AUTH_CALLBACK_FLOW_HINT_KEY)?.trim().toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function clearStoredCallbackFlowHint() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(AUTH_CALLBACK_FLOW_HINT_KEY);
  } catch {
    // no-op
  }
}

function hasCompletedOnboardingLocally(userId: string | null | undefined): boolean {
  if (!userId || typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(EXPLORE_ONBOARDING_DONE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    return parsed.some((value) => typeof value === "string" && value === userId);
  } catch {
    return false;
  }
}

function buildErrorTitle(flow: CallbackFlow): string {
  if (flow === "recovery") {
    return "Reset link failed";
  }
  if (flow === "google") {
    return "Google sign-in failed";
  }
  return "Verification link failed";
}

function buildWatchdogTitle(flow: CallbackFlow): string {
  if (flow === "recovery") {
    return "Reset verification took too long";
  }
  if (flow === "google") {
    return "Google sign-in took too long";
  }
  return "Verification took too long";
}

function buildWatchdogMessage(flow: CallbackFlow): string {
  if (flow === "recovery") {
    return "We could not finish reset verification in time. Please request a new reset email.";
  }
  if (flow === "google") {
    return "We could not finish Google sign-in in time. Please try signing in again.";
  }
  return "We could not finish verification in time. Please return to login and request a new link.";
}

function buildMissingSessionMessage(flow: CallbackFlow): string {
  if (flow === "recovery") {
    return "The reset link opened without a valid reset session. Please request a new reset email.";
  }
  if (flow === "google") {
    return "Google sign-in completed, but we could not create a session. Please try signing in with Google again.";
  }
  return "Your email is confirmed, but we couldn't create a login session from this link. Please return to the app and log in.";
}

function buildProcessingState(flow: CallbackFlow): CallbackState {
  if (flow === "recovery") {
    return {
      status: "processing",
      title: "Verifying your reset link...",
      message: "Please hold on while we securely verify your reset request.",
    };
  }
  if (flow === "google") {
    return {
      status: "processing",
      title: "Finishing Google sign-in...",
      message: "Please hold on while we securely sign you in.",
    };
  }
  return {
    status: "processing",
    title: "Confirming your account...",
    message: "Please hold on while we securely verify your email.",
  };
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
  const callbackPayloadRef = useRef({ search: location.search, hash: location.hash });
  const [state, setState] = useState<CallbackState>({
    status: "processing",
    title: "Confirming your account...",
    message: "Please hold on while we securely verify your email.",
  });
  const [successAction, setSuccessAction] = useState<SuccessAction | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(callbackPayloadRef.current.search);
    const hash = hashParams(callbackPayloadRef.current.hash);
    const authType = readAuthType(search, hash);
    const mode = search.get("mode");
    const code = search.get("code");
    const tokenHash = search.get("token_hash");
    const type = search.get("type");
    const hashAccessToken = hash.get("access_token");
    const hashRefreshToken = hash.get("refresh_token");
    const authFlowHint = readStoredCallbackFlowHint();
    const providerFromCallback = (search.get("provider") ?? hash.get("provider") ?? authFlowHint).trim().toLowerCase();
    const hasEmailOtpType = Boolean(authType && EMAIL_OTP_TYPES.has(authType as EmailOtpType));
    const isRecoveryFlow = mode === RESET_MODE || authType === "recovery";
    const looksLikeOAuthCodeFlow = Boolean(code) && !tokenHash && !hasEmailOtpType;
    const isGoogleFlow = providerFromCallback === GOOGLE_PROVIDER || (!isRecoveryFlow && looksLikeOAuthCodeFlow);
    const callbackFlow: CallbackFlow = isRecoveryFlow ? "recovery" : isGoogleFlow ? "google" : "email";
    const hasAuthPayload = Boolean(code || tokenHash || hashAccessToken || hashRefreshToken);

    setState(buildProcessingState(callbackFlow));

    let active = true;
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
          title: buildWatchdogTitle(callbackFlow),
          message: buildWatchdogMessage(callbackFlow),
        };
      });
    }, CALLBACK_WATCHDOG_MS);

    const run = async () => {
      const authError = readAuthErrors(search, hash);

      if (authError.code || authError.description) {
        if (!active) {
          return;
        }
        setSuccessAction(null);
        setState({
          status: "error",
          title: buildErrorTitle(callbackFlow),
          message: buildFriendlyAuthError(authError.code, authError.description, callbackFlow),
        });
        return;
      }

      try {
        if (code) {
          const { error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            callbackFlow === "google" ? "Google sign-in timed out." : "The verification link timed out.",
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
            callbackFlow === "recovery" ? "Reset link verification timed out." : "The verification link timed out.",
          );
          if (error) {
            throw error;
          }
        }

        // detectSessionInUrl can resolve asynchronously in the browser, so retry before showing an error.
        let sessionUserFound = false;
        for (let attempt = 0; attempt < SESSION_VERIFICATION_ATTEMPTS; attempt += 1) {
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
          await wait(SESSION_VERIFICATION_INTERVAL_MS);
        }

        if (!sessionUserFound) {
          throw new Error(
            hasAuthPayload
              ? "No active session found after callback verification."
              : buildMissingSessionMessage(callbackFlow),
          );
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
          setSuccessAction({
            label: "Continue to reset password",
            path: "/auth/reset",
          });
          setState({
            status: "success",
            title: "Reset link verified",
            message: "You can now set a new password.",
          });
          return;
        }

        const needsOnboarding = callbackFlow === "google"
          ? !hasCompletedOnboardingLocally(currentUser?.id)
          : !hasRequiredOnboarding(currentUser, profile);

        const successPath = callbackFlow === "google"
          ? (needsOnboarding ? "/?onboarding=1" : "/")
          : (needsOnboarding ? "/edit-profile?onboarding=1" : "/");

        setSuccessAction({
          label: needsOnboarding ? "Continue to onboarding" : "Continue to Explore",
          path: successPath,
        });
        setState({
          status: "success",
          title: callbackFlow === "google" ? "Google sign-in complete" : "Verification complete",
          message: callbackFlow === "google"
            ? "You're signed in with Google and your account is ready."
            : "Your account is ready and you're signed in.",
        });
      } catch (error) {
        if (!active) {
          return;
        }
        const message = error instanceof Error ? error.message : "Verification failed.";
        setSuccessAction(null);
        setState({
          status: "error",
          title: buildErrorTitle(callbackFlow),
          message: buildFriendlyAuthError(null, message, callbackFlow),
        });
      } finally {
        clearStoredCallbackFlowHint();
      }
    };

    void run();

    return () => {
      active = false;
      clearTimeout(watchdogTimeout);
    };
  }, []);

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

        {state.status === "success" && successAction ? (
          <button
            onClick={() => navigate(successAction.path, { replace: true })}
            className="mt-5 w-full rounded-2xl bg-gray-900 px-4 py-3 text-[13px] text-white"
          >
            {successAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
