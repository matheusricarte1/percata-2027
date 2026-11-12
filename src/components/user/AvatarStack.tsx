"use client";

import { UsersThree } from "@/components/icons/phosphor/exports/UsersThree";
import { cn } from "@/lib/utils";
import {
  prepareAvatarStackMembers,
  type AvatarStackInputMember,
} from "@/lib/avatar-stack";

type AvatarStackSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<AvatarStackSize, string> = {
  sm: "h-8 w-8 type-kicker",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

const ICON_SIZE: Record<AvatarStackSize, number> = {
  sm: 15,
  md: 18,
  lg: 20,
};

export type AvatarStackMember = AvatarStackInputMember;

export function AvatarStack({
  members,
  total,
  label,
  size = "md",
  maxVisible,
  className,
  labelClassName,
}: {
  members: AvatarStackMember[];
  total?: number;
  label?: string;
  size?: AvatarStackSize;
  maxVisible?: number;
  className?: string;
  labelClassName?: string;
}) {
  const stack = prepareAvatarStackMembers(members, {
    maxVisible: maxVisible ?? (size === "sm" ? 4 : 5),
    total,
  });
  const avatarSize = SIZE_CLASS[size];

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-3", className)}>
      <div className="flex -space-x-2">
        {stack.visible.length > 0 ? (
          stack.visible.map((member, index) => (
            <span
              key={member.id}
              className={cn(
                "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[var(--p-color-info-bg)] font-semibold text-[var(--p-color-brand-500)] shadow-sm ring-1 ring-[var(--p-color-border)]",
                avatarSize,
              )}
              style={{ zIndex: stack.visible.length - index }}
              title={member.name}
            >
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
              ) : (
                member.initials
              )}
            </span>
          ))
        ) : (
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-[var(--p-color-surface-muted)] text-[var(--p-color-fg-subtle)] shadow-sm ring-1 ring-[var(--p-color-border)]",
              avatarSize,
            )}
            aria-hidden="true"
          >
            <UsersThree size={ICON_SIZE[size]} weight="duotone" />
          </span>
        )}
        {stack.overflow > 0 ? (
          <span
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-[var(--p-color-brand-500)] font-semibold text-white shadow-sm",
              avatarSize,
            )}
            title={`${stack.overflow} participante(s) adicional(is)`}
          >
            +{stack.overflow}
          </span>
        ) : null}
      </div>
      {label ? (
        <span
          className={cn(
            "min-w-0 font-semibold leading-5 text-[var(--p-color-fg-muted)]",
            size === "sm" ? "text-xs" : "text-sm",
            labelClassName,
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
