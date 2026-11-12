"use client";

import type { CSSProperties } from "react";
import {
  buildMechanicalCharacterSequence,
  getMechanicalCharacterWidth,
  isMechanicalSpace,
} from "@/lib/mechanical-value";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

type MechanicalStyle = CSSProperties & {
  "--mechanical-offset": string;
  "--mechanical-delay": string;
  "--mechanical-width": string;
  "--mechanical-step": string;
};

const MECHANICAL_STEP_EM = 1.38;

export function MechanicalValue({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const text = String(value);

  return (
    <span
      className={cn("mechanical-value", className)}
      aria-label={text}
      role="text"
    >
      {Array.from(text).map((character, index) => {
        if (isMechanicalSpace(character)) {
          return <span key={`${text}-${index}-space`} className="mechanical-space" aria-hidden="true" />;
        }

        const sequence = reducedMotion
          ? [character]
          : buildMechanicalCharacterSequence(character, index);
        const style: MechanicalStyle = {
          "--mechanical-offset": `${-(sequence.length - 1) * MECHANICAL_STEP_EM}em`,
          "--mechanical-delay": `${index * 34}ms`,
          "--mechanical-width": getMechanicalCharacterWidth(character),
          "--mechanical-step": `${MECHANICAL_STEP_EM}em`,
        };

        return (
          <span key={`${text}-${index}-${character}`} className="mechanical-cell" style={style} aria-hidden="true">
            <span className="mechanical-track">
              {sequence.map((item, sequenceIndex) => (
                <span key={`${item}-${sequenceIndex}`} className="mechanical-glyph">
                  {item}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
