export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;

// Allow international letters + requested symbols like . * + £ # and underscore/hyphen.
const USERNAME_ALLOWED_PATTERN = /^[\p{L}\p{M}\p{N}._*+£#-]+$/u;

export function normalizeUsernameInput(value: string): string {
  return value.replace(/^@+/, "").trim();
}

export function validateUsername(value: string): string | null {
  const normalized = normalizeUsernameInput(value);
  if (!normalized) {
    return "Username is required";
  }
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return `At least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `At most ${USERNAME_MAX_LENGTH} characters`;
  }
  if (!USERNAME_ALLOWED_PATTERN.test(normalized)) {
    return "Use letters, numbers, and symbols like . _ * + # £";
  }
  return null;
}

