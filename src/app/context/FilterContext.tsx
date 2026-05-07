import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { SliderKey, VibeProfile } from "../components/vibe";

export type VenueType = "bar" | "cafe" | "restaurant";
export const VENUE_TYPES: VenueType[] = ["bar", "cafe", "restaurant"];
export const PRICE_OPTIONS = [
  { label: "$", value: 1 as const },
  { label: "$$", value: 2 as const },
  { label: "$$$", value: 3 as const },
  { label: "$$$$", value: 4 as const },
];

const FILTER_STATE_KEY = "grapevine.filters.v1";

export interface CustomPreset {
  id: string;
  name: string;
  iconName: string;
  values: VibeProfile;
  enabled: Record<SliderKey, boolean>;
  margin: number;
  venueTypes?: VenueType[];
  price?: 1 | 2 | 3 | 4 | null;
}

interface FilterContextType {
  values: VibeProfile;
  setValues: (v: VibeProfile) => void;
  enabled: Record<SliderKey, boolean>;
  setEnabled: (e: Record<SliderKey, boolean>) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedArea: string;
  setSelectedArea: (area: string) => void;
  margin: number;
  setMargin: (m: number) => void;
  marginEnabled: boolean;
  setMarginEnabled: (b: boolean) => void;
  searchRadius: number;
  setSearchRadius: (r: number) => void;
  venueTypes: VenueType[];
  setVenueTypes: (types: VenueType[]) => void;
  price: 1 | 2 | 3 | 4 | null;
  setPrice: (price: 1 | 2 | 3 | 4 | null) => void;
  customPresets: CustomPreset[];
  addCustomPreset: (p: CustomPreset) => void;
  removeCustomPreset: (id: string) => void;
}

const defaultValues: VibeProfile = { modern: 50, lively: 50, premium: 50, touristy: 50, spacious: 50 };
const defaultEnabled: Record<SliderKey, boolean> = { modern: false, lively: true, premium: true, touristy: false, spacious: false };

type PersistedFilterState = {
  values?: VibeProfile;
  enabled?: Record<SliderKey, boolean>;
  selectedCity?: string;
  selectedArea?: string;
  margin?: number;
  marginEnabled?: boolean;
  searchRadius?: number;
  venueTypes?: VenueType[];
  price?: 1 | 2 | 3 | 4 | null;
};

function loadDefaultCity(): string {
  if (typeof window === "undefined") {
    return "Budapest";
  }

  try {
    const raw = localStorage.getItem("grapevine.settings.v1");
    if (!raw) {
      return "Budapest";
    }
    const parsed = JSON.parse(raw) as { defaultCity?: unknown };
    return typeof parsed.defaultCity === "string" && parsed.defaultCity.trim() ? parsed.defaultCity : "Budapest";
  } catch {
    return "Budapest";
  }
}

function loadPersistedFilterState(): PersistedFilterState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(FILTER_STATE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PersistedFilterState;
  } catch {
    return null;
  }
}

const FilterContext = createContext<FilterContextType>({
  values: defaultValues,
  setValues: () => {},
  enabled: defaultEnabled,
  setEnabled: () => {},
  selectedCity: "Budapest",
  setSelectedCity: () => {},
  selectedArea: "All areas",
  setSelectedArea: () => {},
  margin: 20,
  setMargin: () => {},
  marginEnabled: true,
  setMarginEnabled: () => {},
  searchRadius: 25,
  setSearchRadius: () => {},
  venueTypes: VENUE_TYPES,
  setVenueTypes: () => {},
  price: null,
  setPrice: () => {},
  customPresets: [],
  addCustomPreset: () => {},
  removeCustomPreset: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [persisted] = useState<PersistedFilterState | null>(() => loadPersistedFilterState());
  const [values, setValues] = useState<VibeProfile>(() => persisted?.values ?? defaultValues);
  const [enabled, setEnabled] = useState<Record<SliderKey, boolean>>(() => persisted?.enabled ?? defaultEnabled);
  const [selectedCity, setSelectedCity] = useState(() => persisted?.selectedCity ?? loadDefaultCity());
  const [selectedArea, setSelectedArea] = useState(() => persisted?.selectedArea ?? "All areas");
  const [margin, setMargin] = useState(() => (typeof persisted?.margin === "number" ? persisted.margin : 20));
  const [marginEnabled, setMarginEnabled] = useState(() => (typeof persisted?.marginEnabled === "boolean" ? persisted.marginEnabled : true));
  const [searchRadius, setSearchRadius] = useState(() => (typeof persisted?.searchRadius === "number" ? persisted.searchRadius : 25));
  const [venueTypes, setVenueTypes] = useState<VenueType[]>(() => {
    if (persisted?.venueTypes && persisted.venueTypes.length > 0) {
      return persisted.venueTypes.filter((type): type is VenueType => VENUE_TYPES.includes(type));
    }
    return VENUE_TYPES;
  });
  const [price, setPrice] = useState<1 | 2 | 3 | 4 | null>(() => persisted?.price ?? null);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stateToPersist: PersistedFilterState = {
      values,
      enabled,
      selectedCity,
      selectedArea,
      margin,
      marginEnabled,
      searchRadius,
      venueTypes,
      price,
    };
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(stateToPersist));
  }, [enabled, margin, marginEnabled, price, searchRadius, selectedArea, selectedCity, values, venueTypes]);

  const addCustomPreset = (p: CustomPreset) =>
    setCustomPresets((prev) => [...prev, p]);

  const removeCustomPreset = (id: string) =>
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));

  return (
    <FilterContext.Provider
      value={{
        values,
        setValues,
        enabled,
        setEnabled,
        selectedCity,
        setSelectedCity,
        selectedArea,
        setSelectedArea,
        margin,
        setMargin,
        marginEnabled,
        setMarginEnabled,
        searchRadius,
        setSearchRadius,
        venueTypes,
        setVenueTypes,
        price,
        setPrice,
        customPresets,
        addCustomPreset,
        removeCustomPreset,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
