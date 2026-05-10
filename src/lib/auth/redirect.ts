const AUTH_CALLBACK_PATH = "/auth/callback";

function trimTrailingSlash(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const envUrl = import.meta.env.VITE_SITE_URL?.trim();
  const fallback = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  return trimTrailingSlash(envUrl || fallback);
}

export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}${AUTH_CALLBACK_PATH}`;
}

export function getPasswordResetCallbackUrl(): string {
  return `${getSiteUrl()}${AUTH_CALLBACK_PATH}?mode=reset`;
}
