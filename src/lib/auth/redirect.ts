const AUTH_CALLBACK_PATH = "/auth/callback";

function trimTrailingSlash(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(/\/+$/, "");
}

function withProtocolIfMissing(value: string): string {
  if (!value) {
    return value;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function shouldForceHttps(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  if (lowerHost === "localhost" || lowerHost === "127.0.0.1" || lowerHost === "[::1]") {
    return false;
  }
  return true;
}

export function getSiteUrl(): string {
  const envUrl = import.meta.env.VITE_SITE_URL?.trim();
  const fallback = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const candidate = trimTrailingSlash(withProtocolIfMissing(envUrl || fallback));

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" && shouldForceHttps(parsed.hostname)) {
      parsed.protocol = "https:";
    }
    return trimTrailingSlash(parsed.toString());
  } catch {
    return trimTrailingSlash(candidate);
  }
}

export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}${AUTH_CALLBACK_PATH}`;
}

export function getPasswordResetCallbackUrl(): string {
  return `${getSiteUrl()}${AUTH_CALLBACK_PATH}?mode=reset`;
}
