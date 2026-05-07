import type { Pub } from "./vibe";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

export function formatPubAddress(pub: Pick<Pub, "city" | "address" | "area">): string {
  const city = (pub.city ?? "").trim();
  const address = (pub.address ?? pub.area ?? "").trim();

  if (!city) {
    return address;
  }
  if (!address) {
    return city;
  }

  const normalizedCity = normalize(city);
  const normalizedAddress = normalize(address);

  if (normalizedAddress.startsWith(normalizedCity)) {
    return address;
  }

  return `${city}, ${address}`;
}
