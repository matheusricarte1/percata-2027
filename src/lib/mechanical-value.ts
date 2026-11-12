const MECHANICAL_CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$%.,+- ";

export function isMechanicalSpace(target: string) {
  return target === " " || target === "\u00A0";
}

export function getMechanicalCharacterWidth(target: string) {
  if (isMechanicalSpace(target)) return "0.34em";
  if (/[.,]/.test(target)) return "0.24em";
  if (/[-+]/.test(target)) return "0.42em";
  if (/[$%]/.test(target)) return "0.68em";
  if (target === "R") return "0.72em";
  if (/[ilI]/.test(target)) return "0.34em";
  if (/[mwMW]/.test(target)) return "0.84em";
  if (/[a-zA-Z]/.test(target)) return "0.64em";
  return "0.58em";
}

export function buildMechanicalCharacterSequence(
  target: string,
  position: number,
  turns = 7,
) {
  if (isMechanicalSpace(target)) return [" "];

  const normalizedTurns = Math.max(4, Math.min(12, Math.trunc(turns)));
  const targetCode = target.charCodeAt(0);
  const sequence = Array.from({ length: normalizedTurns }, (_, index) => {
    const offset = targetCode + position * 13 + index * 7;
    return MECHANICAL_CHARACTERS[offset % MECHANICAL_CHARACTERS.length];
  });

  sequence.push(target);
  return sequence;
}
