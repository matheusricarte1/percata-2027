export const ACCESS_DENIED_CONTACT_EMAIL = "petrolina.administracao@upe.br";

export const ACCESS_DENIED_MESSAGE =
  `Acesso restrito. Seu e-mail não consta no cadastro ativo ou legado do PERCATA. ` +
  `Solicite regularização pelo e-mail ${ACCESS_DENIED_CONTACT_EMAIL}.`;

export type LoginAccessReason =
  | "active_profile"
  | "legacy_user"
  | "inactive_profile"
  | "not_registered_active_or_legacy"
  | "profile_lookup_error";

export type LoginAccessDecision = {
  allowed: boolean;
  reason: LoginAccessReason;
};

type LookupResult<T> = {
  data?: T[] | null;
  error?: unknown;
};

export type LoginAccessLookup = {
  profiles: LookupResult<{ is_active?: boolean | null }>;
  legacyUsers: LookupResult<Record<string, unknown>>;
  legacyLinks: LookupResult<Record<string, unknown>>;
};

export function normalizeLoginEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function hasRows(result: LookupResult<unknown>): boolean {
  return Array.isArray(result.data) && result.data.length > 0;
}

export function decideLoginAccess(lookup: LoginAccessLookup): LoginAccessDecision {
  if (lookup.profiles.error || lookup.legacyUsers.error || lookup.legacyLinks.error) {
    return { allowed: false, reason: "profile_lookup_error" };
  }

  const hasActiveProfile = (lookup.profiles.data || []).some(
    (row) => row.is_active !== false,
  );
  if (hasActiveProfile) {
    return { allowed: true, reason: "active_profile" };
  }

  if (hasRows(lookup.legacyUsers) || hasRows(lookup.legacyLinks)) {
    return { allowed: true, reason: "legacy_user" };
  }

  if (hasRows(lookup.profiles)) {
    return { allowed: false, reason: "inactive_profile" };
  }

  return { allowed: false, reason: "not_registered_active_or_legacy" };
}

export async function getLoginAccessDecision(
  supabase: {
    from: (table: string) => any;
  },
  email: string | null | undefined,
): Promise<LoginAccessDecision> {
  const normalized = normalizeLoginEmail(email);
  if (!normalized) {
    return { allowed: false, reason: "not_registered_active_or_legacy" };
  }

  const [profiles, legacyUsers, legacyLinks] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,is_active")
      .ilike("email", normalized)
      .limit(1),
    supabase
      .from("legacy_user_directory")
      .select("id")
      .ilike("email", normalized)
      .limit(1),
    supabase
      .from("legacy_user_profile_links")
      .select("id")
      .eq("legacy_email", normalized)
      .limit(1),
  ]);

  return decideLoginAccess({ profiles, legacyUsers, legacyLinks });
}
