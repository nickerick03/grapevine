import { createContext, useContext, useState, ReactNode } from "react";

interface UIContextType {
  rateOpen: boolean;
  ratePubId: string | null;
  openRate: (pubId?: string) => void;
  closeRate: () => void;
}

const UIContext = createContext<UIContextType>({
  rateOpen: false,
  ratePubId: null,
  openRate: () => {},
  closeRate: () => {},
});

export function UIProvider({ children }: { children: ReactNode }) {
  const [rateOpen, setRateOpen] = useState(false);
  const [ratePubId, setRatePubId] = useState<string | null>(null);

  const openRate = (pubId?: string) => {
    setRatePubId(pubId ?? null);
    setRateOpen(true);
  };

  const closeRate = () => setRateOpen(false);

  return (
    <UIContext.Provider value={{ rateOpen, ratePubId, openRate, closeRate }}>
      {children}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
