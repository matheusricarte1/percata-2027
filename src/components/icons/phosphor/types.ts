import type { ComponentPropsWithoutRef, ForwardRefExoticComponent, RefAttributes } from "react";
export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
export type IconProps = ComponentPropsWithoutRef<"svg"> & RefAttributes<SVGSVGElement> & { alt?: string; color?: string; size?: string | number; weight?: IconWeight; mirrored?: boolean };
export type Icon = ForwardRefExoticComponent<IconProps>;
