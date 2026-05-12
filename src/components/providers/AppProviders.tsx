"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationFeedback } from "@/components/feedback/NavigationFeedback";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import { useEffect, type ReactNode } from "react";
import { materialYouTheme } from "@/theme/materialYouTheme";
import "@material/web/all.js";

interface AppProvidersProps {
  children: ReactNode;
}

type StoredSettings = {
  themeMode?: "system" | "light" | "dark";
  densityMode?: "compact" | "comfortable";
  accentColor?: "upe" | "teal" | "gold" | "slate";
  reducedMotion?: boolean;
};

const SETTINGS_KEY = "percata:user-settings:v1";

function applyStoredSettings(settings: StoredSettings | null) {
  if (!settings || typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.themeMode = settings.themeMode || "system";
  root.dataset.densityMode = settings.densityMode || "comfortable";
  root.dataset.accentColor = settings.accentColor || "upe";
  root.dataset.reducedMotion = settings.reducedMotion ? "1" : "0";
}

function loadStoredSettings(): StoredSettings | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as StoredSettings) : null;
  } catch {
    return null;
  }
}

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    applyStoredSettings(loadStoredSettings());
    const onSettingsChanged = (event: Event) => {
      applyStoredSettings((event as CustomEvent<StoredSettings>).detail || loadStoredSettings());
    };
    const onStorageChanged = () => applyStoredSettings(loadStoredSettings());
    window.addEventListener("percata:user-settings-changed", onSettingsChanged);
    window.addEventListener("storage", onStorageChanged);
    return () => {
      window.removeEventListener("percata:user-settings-changed", onSettingsChanged);
      window.removeEventListener("storage", onStorageChanged);
    };
  }, []);

  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider
        theme={materialYouTheme}
        defaultMode="light"
        modeStorageKey="percata-mode"
        colorSchemeStorageKey="percata-color-scheme"
      >
        <CssBaseline enableColorScheme />
        <TooltipProvider>
          {children}
          <NavigationFeedback />
          <Toaster richColors position="top-right" closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
