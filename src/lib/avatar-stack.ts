export type AvatarStackInputMember = {
  id?: string | number | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export type AvatarStackPreparedMember = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  initials: string;
};

export function getAvatarInitials(value: unknown) {
  const normalized = String(value || "")
    .replace(/@.*/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  if (!normalized) return "US";

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("pt-BR");

  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toLocaleUpperCase("pt-BR");
}

function normalizeMember(member: AvatarStackInputMember, index: number): AvatarStackPreparedMember {
  const email = String(member.email || "").trim() || null;
  const name =
    String(member.name || "").replace(/\s+/g, " ").trim() ||
    email ||
    `Usuário ${index + 1}`;
  const avatarUrl = String(member.avatarUrl || "").trim() || null;
  const id = String(member.id || email || name || `avatar-${index}`).trim();

  return {
    id,
    name,
    email,
    avatarUrl,
    initials: getAvatarInitials(name || email),
  };
}

export function prepareAvatarStackMembers(
  members: AvatarStackInputMember[],
  options: { maxVisible?: number; total?: number } = {},
) {
  const maxVisible = Math.max(0, Number(options.maxVisible || 5));
  const byId = new Map<string, AvatarStackPreparedMember>();

  members.forEach((member, index) => {
    const normalized = normalizeMember(member, index);
    const existing = byId.get(normalized.id);
    if (!existing) {
      byId.set(normalized.id, normalized);
      return;
    }
    if (!existing.avatarUrl && normalized.avatarUrl) {
      byId.set(normalized.id, { ...existing, avatarUrl: normalized.avatarUrl });
    }
  });

  const unique = Array.from(byId.values());
  const total = Math.max(Number(options.total || 0), unique.length);
  const visible = unique.slice(0, maxVisible);

  return {
    visible,
    total,
    overflow: Math.max(0, total - visible.length),
  };
}
