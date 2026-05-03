import { createContext, useContext, useState, ReactNode } from "react";
import { SliderKey, VibeProfile } from "../components/vibe";

interface FilterContextType {
  values: VibeProfile;
  setValues: (v: VibeProfile) => void;
  enabled: Record<SliderKey, boolean>;
  setEnabled: (e: Record<SliderKey, boolean>) => void;
  margin: number;
  setMargin: (m: number) => void;
  marginEnabled: boolean;
  setMarginEnabled: (b: boolean) => void;
  searchRadius: number;       // 0–100, maps to 0.5–20 km
  setSearchRadius: (r: number) => void;
}

const defaultValues: VibeProfile = { modern: 50, lively: 50, premium: 50, touristy: 50, spacious: 50 };
const defaultEnabled: Record<SliderKey, boolean> = { modern: false, lively: true, premium: true, touristy: false, spacious: false };

const FilterContext = createContext<FilterContextType>({
  values: defaultValues,
  setValues: () => {},
  enabled: defaultEnabled,
  setEnabled: () => {},
  margin: 20,
  setMargin: () => {},
  marginEnabled: true,
  setMarginEnabled: () => {},
  searchRadius: 25,
  setSearchRadius: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<VibeProfile>(defaultValues);
  const [enabled, setEnabled] = useState<Record<SliderKey, boolean>>(defaultEnabled);
  const [margin, setMargin] = useState(20);
  const [marginEnabled, setMarginEnabled] = useState(true);
  const [searchRadius, setSearchRadius] = useState(25); // ~5.4 km

  return (
    <FilterContext.Provider value={{ values, setValues, enabled, setEnabled, margin, setMargin, marginEnabled, setMarginEnabled, searchRadius, setSearchRadius }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);