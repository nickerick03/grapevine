export function getConfidenceLevel(ratingCount: number):
  | "No ratings yet"
  | "Low confidence"
  | "Medium confidence"
  | "High confidence" {
  if (ratingCount <= 0) {
    return "No ratings yet";
  }

  if (ratingCount < 10) {
    return "Low confidence";
  }

  if (ratingCount < 50) {
    return "Medium confidence";
  }

  return "High confidence";
}
