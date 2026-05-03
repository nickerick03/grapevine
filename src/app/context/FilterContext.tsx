import { createContext, useContext, useState, ReactNode } from "react";
import { SliderKey, VibeProfile } from "../components/vibe";

export interface CustomPreset {
  id: string;
  name: string;
  iconName: string;
  values: VibeProfile;
  enabled: Record<SliderKey, boolean>;
  margin: number;
}

interface FilterContextType {
  values: VibeProfile;
  setValues: (v: VibeProfile) => void;
  enabled: Record<SliderKey, boolean>;
  setEnabled: (e: Record<SliderKey, boolean>) => void;
  margin: number;
  setMargin: (m: number) => void;
  marginEnabled: boolean;
  setMarginEnabled: (b: boolean) => void;
  searchRadius: number;
  setSearchRadius: (r: number) => void;
  customPresets: CustomPreset[];
  addCustomPreset: (p: CustomPreset) => void;
  removeCustomPreset: (id: string) => void;
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
  customPresets: [],
  addCustomPreset: () => {},
  removeCustomPreset: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<VibeProfile>(defaultValues);
  const [enabled, setEnabled] = useState<Record<SliderKey, boolean>>(defaultEnabled);
  const [margin, setMargin] = useState(20);
  const [marginEnabled, setMarginEnabled] = useState(true);
  const [searchRadius, setSearchRadius] = useState(25);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);

  const addCustomPreset = (p: CustomPreset) =>
    setCustomPresets((prev) => [...prev, p]);

  const removeCustomPreset = (id: string) =>
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));

  return (
    <FilterContext.Provider value={{
      values, setValues, enabled, setEnabled,
      margin, setMargin, marginEnabled, setMarginEnabled,
      searchRadius, setSearchRadius,
      customPresets, addCustomPreset, removeCustomPreset,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);