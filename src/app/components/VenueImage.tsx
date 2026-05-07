import { useEffect, useState, type CSSProperties } from "react";

import type { Pub } from "./vibe";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { resolveVenueImage } from "@/lib/services/venue-images";

type VenueImageProps = {
  pub: Pub;
  className?: string;
  style?: CSSProperties;
  alt?: string;
};

export function VenueImage({ pub, className, style, alt }: VenueImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(pub.image ?? "");

  useEffect(() => {
    let cancelled = false;
    const initial = pub.image ?? "";
    setResolvedSrc(initial);

    if (initial.trim()) {
      return () => {
        cancelled = true;
      };
    }

    resolveVenueImage({
      id: pub.id,
      name: pub.name,
      lat: pub.lat,
      lng: pub.lng,
      city: pub.city,
      country: pub.country,
      sourceProvider: pub.sourceProvider,
      sourcePlaceId: pub.sourcePlaceId,
      address: pub.address,
      category: pub.category,
      venueType: pub.venueType,
    }).then((imageUrl) => {
      if (!cancelled && imageUrl) {
        setResolvedSrc(imageUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pub.address, pub.category, pub.city, pub.country, pub.id, pub.image, pub.lat, pub.lng, pub.name, pub.sourcePlaceId, pub.sourceProvider, pub.venueType]);

  return (
    <ImageWithFallback
      src={resolvedSrc}
      alt={alt ?? pub.name}
      className={className}
      style={style}
    />
  );
}
