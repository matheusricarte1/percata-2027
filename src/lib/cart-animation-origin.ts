export type CartAnimationOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type BoundingClientRectProvider = {
  getBoundingClientRect(): Pick<DOMRect, "left" | "top" | "width" | "height">;
};

export function captureCartAnimationOrigin(
  element: BoundingClientRectProvider | null | undefined,
): CartAnimationOrigin | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}
