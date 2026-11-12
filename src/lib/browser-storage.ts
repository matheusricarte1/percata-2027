"use client";

import type { UserSettings } from "@/lib/user-settings";

export const USER_SETTINGS_VISUAL_KEY = "percata:user-settings:v1";
export const USER_SETTINGS_SESSION_KEY = "percata:session:user-settings:v1";

const LEGACY_USER_SETTINGS_PREFIX = `${USER_SETTINGS_VISUAL_KEY}:`;
const LOCAL_AUTH_KEY_PATTERNS = [
  /^sb-.+-auth-token$/,
  /^supabase\.auth\.token$/,
  /^supabase\.auth\.refreshToken$/,
  /^supabase\.auth\.accessToken$/,
];

type VisualSettings = Pick<
  UserSettings,
  "themeMode" | "densityMode" | "accentColor" | "reducedMotion" | "showAnimations"
>;

function isBrowser() {
  return typeof window !== "undefined";
}

export function pickVisualSettings(settings: UserSettings): VisualSettings {
  return {
    themeMode: settings.themeMode,
    densityMode: settings.densityMode,
    accentColor: settings.accentColor,
    reducedMotion: settings.reducedMotion,
    showAnimations: settings.showAnimations,
  };
}

export function readLocalJson<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocalJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
}

export function removeLocalJson(key: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // noop
  }
}

export function readSessionJson<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSessionJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
}

export function cleanupUnsafeLocalStorage() {
  if (!isBrowser()) return;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      const isLegacyUserSettings = key.startsWith(LEGACY_USER_SETTINGS_PREFIX);
      const isAuthToken = LOCAL_AUTH_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isLegacyUserSettings || isAuthToken) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // noop
  }
}
