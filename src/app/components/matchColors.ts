import type { CSSProperties } from "react";

export type MatchBand = "vivid-green" | "green" | "yellow" | "orange";

export function getMatchBand(match: number): MatchBand {
  if (match >= 95) {
    return "vivid-green";
  }
  if (match >= 80) {
    return "green";
  }
  if (match >= 65) {
    return "yellow";
  }
  return "orange";
}

export function getMatchPinColor(match: number): string {
  const band = getMatchBand(match);
  if (band === "vivid-green") return "#22C55E";
  if (band === "green") return "#16A34A";
  if (band === "yellow") return "#D4BC2A";
  return "#F59E0B";
}

export function isPerfectMatch(match: number, perfectMatch?: boolean): boolean {
  return Boolean(perfectMatch) && match === 100;
}

export function getMatchPillStyle(match: number, perfectMatch = false): CSSProperties {
  if (isPerfectMatch(match, perfectMatch)) {
    return {};
  }

  const band = getMatchBand(match);

  if (band === "vivid-green") {
    return {
      backgroundColor: "#DCFCE7",
      color: "#15803D",
      borderColor: "#86EFAC",
    };
  }

  if (band === "green") {
    return {
      backgroundColor: "#EAF7EE",
      color: "#166534",
      borderColor: "#A7E1B5",
    };
  }

  if (band === "yellow") {
    return {
      backgroundColor: "#FFF9DB",
      color: "#9A7B00",
      borderColor: "#F5E28A",
    };
  }

  return {
    backgroundColor: "#FFF1E5",
    color: "#B45309",
    borderColor: "#FBD7AE",
  };
}

export function getMatchPillLabel(match: number, perfectMatch = false): string {
  if (isPerfectMatch(match, perfectMatch)) {
    return "PERFECT MATCH";
  }
  return `${match}% match`;
}
