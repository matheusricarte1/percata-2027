import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number | string; absoluteStrokeWidth?: boolean };
export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
