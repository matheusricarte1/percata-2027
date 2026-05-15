export type ThemeMode = "system" | "light" | "dark";
export type DensityMode = "compact" | "comfortable";
export type ProfileVisibility = "campus" | "papel" | "privado";
export type AccentColor = "upe" | "teal" | "gold" | "slate";

export type UserSettings = {
  themeMode: ThemeMode;
  densityMode: DensityMode;
  accentColor: AccentColor;
  reducedMotion: boolean;
  showAnimations: boolean;
  notifyAprovacao: boolean;
  notifyDevolucao: boolean;
  notifyHomologacao: boolean;
  notifyEmail: boolean;
  profileVisibility: ProfileVisibility;
  showEmail: boolean;
  showAvatar: boolean;
};

export type UserSettingsRow = {
  theme_mode?: string | null;
  density_mode?: string | null;
  accent_color?: string | null;
  reduced_motion?: boolean | null;
  show_animations?: boolean | null;
  notify_aprovacao?: boolean | null;
  notify_devolucao?: boolean | null;
  notify_homologacao?: boolean | null;
  notify_email?: boolean | null;
  profile_visibility?: string | null;
  show_email?: boolean | null;
  show_avatar?: boolean | null;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  themeMode: "system",
  densityMode: "comfortable",
  accentColor: "upe",
  reducedMotion: false,
  showAnimations: true,
  notifyAprovacao: true,
  notifyDevolucao: true,
  notifyHomologacao: true,
  notifyEmail: true,
  profileVisibility: "campus",
  showEmail: true,
  showAvatar: true,
};

export function normalizeUserSettings(
  input: Partial<UserSettings> | null | undefined,
): UserSettings {
  const themeMode: ThemeMode =
    input?.themeMode === "light" || input?.themeMode === "dark" || input?.themeMode === "system"
      ? input.themeMode
      : DEFAULT_USER_SETTINGS.themeMode;
  const densityMode: DensityMode =
    input?.densityMode === "compact" || input?.densityMode === "comfortable"
      ? input.densityMode
      : DEFAULT_USER_SETTINGS.densityMode;
  const profileVisibility: ProfileVisibility =
    input?.profileVisibility === "campus" ||
    input?.profileVisibility === "papel" ||
    input?.profileVisibility === "privado"
      ? input.profileVisibility
      : DEFAULT_USER_SETTINGS.profileVisibility;
  const accentColor: AccentColor =
    input?.accentColor === "teal" ||
    input?.accentColor === "gold" ||
    input?.accentColor === "slate" ||
    input?.accentColor === "upe"
      ? input.accentColor
      : DEFAULT_USER_SETTINGS.accentColor;

  return {
    themeMode,
    densityMode,
    accentColor,
    reducedMotion: Boolean(input?.reducedMotion ?? DEFAULT_USER_SETTINGS.reducedMotion),
    showAnimations: Boolean(input?.showAnimations ?? DEFAULT_USER_SETTINGS.showAnimations),
    notifyAprovacao: Boolean(input?.notifyAprovacao ?? DEFAULT_USER_SETTINGS.notifyAprovacao),
    notifyDevolucao: Boolean(input?.notifyDevolucao ?? DEFAULT_USER_SETTINGS.notifyDevolucao),
    notifyHomologacao: Boolean(
      input?.notifyHomologacao ?? DEFAULT_USER_SETTINGS.notifyHomologacao,
    ),
    notifyEmail: Boolean(input?.notifyEmail ?? DEFAULT_USER_SETTINGS.notifyEmail),
    profileVisibility,
    showEmail: Boolean(input?.showEmail ?? DEFAULT_USER_SETTINGS.showEmail),
    showAvatar: Boolean(input?.showAvatar ?? DEFAULT_USER_SETTINGS.showAvatar),
  };
}

export function mapUserSettingsRow(
  row: UserSettingsRow | null | undefined,
  fallback: Partial<UserSettings> = {},
): UserSettings {
  return normalizeUserSettings({
    ...fallback,
    themeMode: (row?.theme_mode as ThemeMode) || fallback.themeMode,
    densityMode: (row?.density_mode as DensityMode) || fallback.densityMode,
    accentColor: (row?.accent_color as AccentColor) || fallback.accentColor,
    reducedMotion: row?.reduced_motion ?? fallback.reducedMotion,
    showAnimations: row?.show_animations ?? fallback.showAnimations,
    notifyAprovacao: row?.notify_aprovacao ?? fallback.notifyAprovacao,
    notifyDevolucao: row?.notify_devolucao ?? fallback.notifyDevolucao,
    notifyHomologacao: row?.notify_homologacao ?? fallback.notifyHomologacao,
    notifyEmail: row?.notify_email ?? fallback.notifyEmail,
    profileVisibility: (row?.profile_visibility as ProfileVisibility) || fallback.profileVisibility,
    showEmail: row?.show_email ?? fallback.showEmail,
    showAvatar: row?.show_avatar ?? fallback.showAvatar,
  });
}

export function toUserSettingsUpsert(userId: string, settings: UserSettings) {
  const sanitized = normalizeUserSettings(settings);
  return {
    user_id: userId,
    theme_mode: sanitized.themeMode,
    density_mode: sanitized.densityMode,
    accent_color: sanitized.accentColor,
    reduced_motion: sanitized.reducedMotion,
    show_animations: sanitized.showAnimations,
    notify_aprovacao: sanitized.notifyAprovacao,
    notify_devolucao: sanitized.notifyDevolucao,
    notify_homologacao: sanitized.notifyHomologacao,
    notify_email: sanitized.notifyEmail,
    profile_visibility: sanitized.profileVisibility,
    show_email: sanitized.showEmail,
    show_avatar: sanitized.showAvatar,
  };
}
