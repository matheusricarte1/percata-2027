"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavigationFeedback } from "@/components/feedback/NavigationFeedback";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import { useEffect, type ReactNode } from "react";
import { materialYouTheme } from "@/theme/materialYouTheme";
import { getSafeUser, supabase } from "@/lib/supabase";
import {
  mapUserSettingsRow,
  normalizeUserSettings,
  type UserSettings,
} from "@/lib/user-settings";
import "@material/web/all.js";

interface AppProvidersProps {
  children: ReactNode;
}

const SETTINGS_KEY = "percata:user-settings:v1";

function applyStoredSettings(settings: Partial<UserSettings> | null) {
  if (!settings || typeof document === "undefined") return;
  const normalized = normalizeUserSettings(settings);
  const root = document.documentElement;
  root.dataset.themeMode = normalized.themeMode;
  root.dataset.densityMode = normalized.densityMode;
  root.dataset.accentColor = normalized.accentColor;
  root.dataset.reducedMotion = normalized.reducedMotion ? "1" : "0";
}

function loadStoredSettings(): Partial<UserSettings> | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Partial<UserSettings>) : null;
  } catch {
    return null;
  }
}

function storeGlobalSettings(settings: UserSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // noop
  }
}

export function AppProviders({ children }: AppProvidersProps) {
  useEffect(() => {
    applyStoredSettings(loadStoredSettings());

    let alive = true;
    async function syncAccountSettings() {
      try {
        const user = await getSafeUser();
        if (!user?.id || !alive) return;
        const { data, error } = await supabase
          .from("user_settings")
          .select(
            "theme_mode,density_mode,accent_color,reduced_motion,show_animations,notify_aprovacao,notify_devolucao,notify_homologacao,notify_email,profile_visibility,show_email,show_avatar",
          )
          .eq("user_id", user.id)
          .maybeSingle();
        if (error || !alive || !data) return;
        const accountSettings = mapUserSettingsRow(data, loadStoredSettings() || {});
        storeGlobalSettings(accountSettings);
        applyStoredSettings(accountSettings);
      } catch {
        // Prefer the last local settings when account sync is unavailable.
      }
    }

    void syncAccountSettings();

    const onSettingsChanged = (event: Event) => {
      applyStoredSettings((event as CustomEvent<Partial<UserSettings>>).detail || loadStoredSettings());
    };
    const onStorageChanged = () => applyStoredSettings(loadStoredSettings());
    window.addEventListener("percata:user-settings-changed", onSettingsChanged);
    window.addEventListener("storage", onStorageChanged);
    return () => {
      alive = false;
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
