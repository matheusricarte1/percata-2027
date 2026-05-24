"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  User,
  UsersThree,
  ShieldCheck,
  Crown,
  Buildings,
  Flask,
} from "@phosphor-icons/react";
import { useReducedMotion, motionProps } from "@/lib/use-reduced-motion";
import type { UserCategory } from "@/lib/user-category";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
};

const BADGE_SIZE: Record<AvatarSize, string> = {
  sm: "h-4 w-4",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const ICON_SIZE: Record<AvatarSize, number> = {
  sm: 9,
  md: 10,
  lg: 12,
};

const CATEGORY_STYLE: Record<UserCategory, { ring: string; badge: string; icon: React.ElementType }> = {
  solicitante: {
    ring: "border-[var(--semantic-action-border)] text-[var(--semantic-action)] bg-white",
    badge: "border-[var(--semantic-action-border)] bg-[var(--semantic-action-soft)] text-[var(--semantic-action)]",
    icon: User,
  },
  chefia: {
    ring: "border-[var(--semantic-collab-border)] text-[var(--semantic-collab)] bg-white",
    badge: "border-[var(--semantic-collab-border)] bg-[var(--semantic-collab-soft)] text-[var(--semantic-collab)]",
    icon: ShieldCheck,
  },
  admin: {
    ring: "border-[var(--semantic-warning-border)] text-[var(--semantic-warning)] bg-white",
    badge: "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] text-[var(--semantic-warning)]",
    icon: Crown,
  },
  superadmin: {
    ring: "border-[var(--semantic-insight-border)] text-[var(--semantic-insight)] bg-white",
    badge: "border-[var(--semantic-insight-border)] bg-[var(--semantic-insight-soft)] text-[var(--semantic-insight)]",
    icon: Crown,
  },
  collective: {
    ring: "border-[var(--semantic-collab-border)] text-[var(--semantic-collab)] bg-white",
    badge: "border-[var(--semantic-collab-border)] bg-[var(--semantic-collab-soft)] text-[var(--semantic-collab)]",
    icon: UsersThree,
  },
  departamento: {
    ring: "border-[var(--semantic-action-border)] text-[var(--semantic-action)] bg-white",
    badge: "border-[var(--semantic-action-border)] bg-[var(--semantic-action-soft)] text-[var(--semantic-action)]",
    icon: Buildings,
  },
  laboratorio: {
    ring: "border-[var(--semantic-insight-border)] text-[var(--semantic-insight)] bg-white",
    badge: "border-[var(--semantic-insight-border)] bg-[var(--semantic-insight-soft)] text-[var(--semantic-insight)]",
    icon: Flask,
  },
  campus: {
    ring: "border-[var(--semantic-action-border)] text-[var(--semantic-action)] bg-white",
    badge: "border-[var(--semantic-action-border)] bg-[var(--semantic-action-soft)] text-[var(--semantic-action)]",
    icon: Buildings,
  },
  usuario: {
    ring: "border-[var(--semantic-neutral-border)] text-[var(--semantic-text-muted)] bg-white",
    badge: "border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)] text-[var(--semantic-text-muted)]",
    icon: User,
  },
};

function getInitials(value: string) {
  const source = String(value || "").trim();
  if (!source) return "US";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function CategoryAvatar({
  name,
  avatarUrl,
  category = "usuario",
  size = "md",
  animate = true,
}: {
  name: string;
  avatarUrl: string | null;
  category?: UserCategory;
  size?: AvatarSize;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  const [broken, setBroken] = React.useState(false);
  const style = CATEGORY_STYLE[category] || CATEGORY_STYLE.usuario;
  const Icon = style.icon;

  return (
    <div className="relative inline-flex">
      <motion.div
        {...motionProps(reduced || !animate, {
          initial: { opacity: 0.85, scale: 0.92 },
          animate: { opacity: 1, scale: 1 },
          transition: { duration: 0.28 },
        })}
        className={`inline-flex items-center justify-center overflow-hidden rounded-full border-2 shadow-sm ${SIZE_CLASS[size]} ${style.ring}`}
      >
        {!avatarUrl || broken ? (
          <span className="font-semibold">{getInitials(name)}</span>
        ) : (
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        )}
      </motion.div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full border ${BADGE_SIZE[size]} ${style.badge}`}
      >
        <Icon size={ICON_SIZE[size]} weight="bold" />
      </span>
    </div>
  );
}
