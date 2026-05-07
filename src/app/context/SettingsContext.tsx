import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DistanceUnit = "km" | "mi";

interface AppSettings {
  pushNotifications: boolean;
  savedPlaceUpdates: boolean;
  darkMode: boolean;
  distanceUnit: DistanceUnit;
  defaultCity: string;
  showTouristHeavyBars: boolean;
}

interface SettingsContextType extends AppSettings {
  setPushNotifications: (value: boolean) => void;
  setSavedPlaceUpdates: (value: boolean) => void;
  setDarkMode: (value: boolean) => void;
  setDistanceUnit: (value: DistanceUnit) => void;
  setDefaultCity: (value: string) => void;
  setShowTouristHeavyBars: (value: boolean) => void;
}

const STORAGE_KEY = "grapevine.settings.v1";

const defaultSettings: AppSettings = {
  pushNotifications: false,
  savedPlaceUpdates: false,
  darkMode: false,
  distanceUnit: "km",
  defaultCity: "Budapest",
  showTouristHeavyBars: true,
};

const SettingsContext = createContext<SettingsContextType>({
  ...defaultSettings,
  setPushNotifications: () => {},
  setSavedPlaceUpdates: () => {},
  setDarkMode: () => {},
  setDistanceUnit: () => {},
  setDefaultCity: () => {},
  setShowTouristHeavyBars: () => {},
});

function loadSettings(): AppSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      pushNotifications: typeof parsed.pushNotifications === "boolean" ? parsed.pushNotifications : defaultSettings.pushNotifications,
      savedPlaceUpdates: typeof parsed.savedPlaceUpdates === "boolean" ? parsed.savedPlaceUpdates : defaultSettings.savedPlaceUpdates,
      // Dark mode is temporarily disabled.
      darkMode: false,
      distanceUnit: parsed.distanceUnit === "mi" ? "mi" : "km",
      defaultCity: typeof parsed.defaultCity === "string" && parsed.defaultCity.trim() ? parsed.defaultCity : defaultSettings.defaultCity,
      showTouristHeavyBars:
        typeof parsed.showTouristHeavyBars === "boolean" ? parsed.showTouristHeavyBars : defaultSettings.showTouristHeavyBars,
    };
  } catch {
    return defaultSettings;
  }
}

export function formatDistance(km: number, unit: DistanceUnit, fractionDigits = 1): string {
  if (!Number.isFinite(km)) {
    return unit === "mi" ? "∞ mi" : "∞ km";
  }

  if (unit === "mi") {
    const miles = km * 0.621371;
    return `${miles.toFixed(fractionDigits)} mi`;
  }

  return `${km.toFixed(fractionDigits)} km`;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    // Dark mode is temporarily disabled.
    document.documentElement.classList.remove("dark");
  }, []);

  const value = useMemo<SettingsContextType>(
    () => ({
      ...settings,
      setPushNotifications: (next) => setSettings((prev) => ({ ...prev, pushNotifications: next })),
      setSavedPlaceUpdates: (next) => setSettings((prev) => ({ ...prev, savedPlaceUpdates: next })),
      // Dark mode is temporarily disabled.
      setDarkMode: () => setSettings((prev) => ({ ...prev, darkMode: false })),
      setDistanceUnit: (next) => setSettings((prev) => ({ ...prev, distanceUnit: next })),
      setDefaultCity: (next) => setSettings((prev) => ({ ...prev, defaultCity: next })),
      setShowTouristHeavyBars: (next) => setSettings((prev) => ({ ...prev, showTouristHeavyBars: next })),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
