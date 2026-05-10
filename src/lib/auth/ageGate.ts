export const MINIMUM_REGISTER_AGE = 16;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getLatestAllowedBirthDateIso(today = new Date(), minAge = MINIMUM_REGISTER_AGE): string {
  const cutoff = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  return formatDateToIso(cutoff);
}

function parseDateParts(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function parseIsoDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const [yearText, monthText, dayText] = trimmed.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return parseDateParts(year, month, day);
}

export function normalizeBirthDateInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 8);

  if (digitsOnly.length <= 4) {
    return digitsOnly;
  }
  if (digitsOnly.length <= 6) {
    return `${digitsOnly.slice(0, 4)}/${digitsOnly.slice(4)}`;
  }

  return `${digitsOnly.slice(0, 4)}/${digitsOnly.slice(4, 6)}/${digitsOnly.slice(6, 8)}`;
}

export function parseBirthDateInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/[.\-]/g, "/");
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(normalized)) {
    return null;
  }

  const [yearText, monthText, dayText] = normalized.split("/");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = parseDateParts(year, month, day);

  if (!parsed) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

export function formatIsoToBirthDateInput(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return "";
  }
  return value.replace(/-/g, "/");
}

export function isAtLeastAge(birthDateIso: string, minAge = MINIMUM_REGISTER_AGE, today = new Date()): boolean {
  const parsedBirthDate = parseIsoDate(birthDateIso);
  if (!parsedBirthDate) {
    return false;
  }

  const cutoff = new Date(Date.UTC(today.getFullYear() - minAge, today.getMonth(), today.getDate()));
  return parsedBirthDate.getTime() <= cutoff.getTime();
}
