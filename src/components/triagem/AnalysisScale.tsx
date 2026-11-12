"use client";

import React from "react";
import { AlertTriangle } from "@/components/icons/lucide/exports/AlertTriangle";
import { Flag } from "@/components/icons/lucide/exports/Flag";
import { RotateCcw } from "@/components/icons/lucide/exports/RotateCcw";

export interface AnalysisScaleProps {
  id: string;
  label: string;
  description: string;
  value: string | null;
  options: readonly (readonly [string, string])[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
  tone: "priority" | "impact";
}

export function AnalysisScale({
  id,
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
  tone,
}: AnalysisScaleProps) {
  const choices: readonly (readonly [string | null, string])[] = [
    [null, "Não definido"],
    ...options,
  ];
  const position = Math.max(0, choices.findIndex(([key]) => key === value));
  const selectedLabel = choices[position]?.[1] || "Não definido";
  const category =
    tone === "priority"
      ? { Icon: Flag, label: "Ordem de atendimento" }
      : { Icon: AlertTriangle, label: "Impacto se não atender" };

  return (
    <fieldset className={`aw-scale aw-scale--${tone}`} disabled={disabled}>
      <legend id={`${id}-label`}>
        <category.Icon aria-hidden="true" size={16} /> {label}
      </legend>
      <p id={`${id}-description`}>{description}</p>
      <div className="aw-scaleTrack">
        <input
          id={id}
          type="range"
          min={0}
          max={choices.length - 1}
          step={1}
          value={position}
          disabled={disabled}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-description ${id}-help`}
          aria-valuetext={selectedLabel}
          onChange={(event) => onChange(choices[Number(event.target.value)]?.[0] || null)}
        />
        <div className="aw-scaleTicks" aria-hidden="true">
          {choices.map(([key, name], index) => (
            <span className={position === index ? "is-selected" : ""} key={key ?? "undefined"}>
              <i />
              <b>{index === 0 ? "—" : index}</b>
              <em>{name}</em>
            </span>
          ))}
        </div>
      </div>
      <div className="aw-scaleFoot">
        <span id={`${id}-help`}>
          {position ? `Nível selecionado: ${selectedLabel}.` : "Escolha um nível no controle."}
        </span>
        <button
          type="button"
          disabled={disabled || position === 0}
          onClick={() => onChange(null)}
          aria-label={`Limpar ${label.toLocaleLowerCase("pt-BR")}`}
        >
          <RotateCcw aria-hidden="true" size={14} /> Limpar
        </button>
      </div>
    </fieldset>
  );
}
