import { createContext, useContext, useState, ReactNode } from "react";

export interface ExternalRatePlacePayload {
  sourceProvider: "osm";
  sourcePlaceId: string;
  name: string;
  category: string;
  venueType: "bar" | "cafe" | "restaurant";
  priceRange?: 1 | 2 | 3 | 4 | null;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
  openingHours?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface UIContextType {
  rateOpen: boolean;
  ratePubId: string | null;
  rateExternalPlace: ExternalRatePlacePayload | null;
  openRate: (pubId?: string, externalPlace?: ExternalRatePlacePayload) => void;
  closeRate: () => void;
}

const UIContext = createContext<UIContextType>({
  rateOpen: false,
  ratePubId: null,
  rateExternalPlace: null,
  openRate: () => {},
  closeRate: () => {},
});

export function UIProvider({ children }: { children: ReactNode }) {
  const [rateOpen, setRateOpen] = useState(false);
  const [ratePubId, setRatePubId] = useState<string | null>(null);
  const [rateExternalPlace, setRateExternalPlace] = useState<ExternalRatePlacePayload | null>(null);

  const openRate = (pubId?: string, externalPlace?: ExternalRatePlacePayload) => {
    setRatePubId(pubId ?? null);
    setRateExternalPlace(externalPlace ?? null);
    setRateOpen(true);
  };

  const closeRate = () => {
    setRateOpen(false);
    setRateExternalPlace(null);
  };

  return (
    <UIContext.Provider value={{ rateOpen, ratePubId, rateExternalPlace, openRate, closeRate }}>
      {children}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
