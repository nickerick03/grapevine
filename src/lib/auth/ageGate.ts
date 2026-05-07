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

function parseIsoDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const [yearText, monthText, dayText] = trimmed.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

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

export function isAtLeastAge(birthDateIso: string, minAge = MINIMUM_REGISTER_AGE, today = new Date()): boolean {
  const parsedBirthDate = parseIsoDate(birthDateIso);
  if (!parsedBirthDate) {
    return false;
  }

  const cutoff = new Date(Date.UTC(today.getFullYear() - minAge, today.getMonth(), today.getDate()));
  return parsedBirthDate.getTime() <= cutoff.getTime();
}
