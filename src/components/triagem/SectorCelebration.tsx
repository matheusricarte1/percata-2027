"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowRight } from "@/components/icons/lucide/exports/ArrowRight";
import { CheckCircle2 } from "@/components/icons/lucide/exports/CheckCircle2";
import { X } from "@/components/icons/lucide/exports/X";

export type SectorCelebrationData = { key: string; name: string; campus: string; homologated: boolean };

export function SectorCelebration({ sector, onClose, onContinue }: {
  sector: SectorCelebrationData;
  onClose: () => void;
  onContinue: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!sector.homologated || hovered || focused) return;
    const timer = window.setTimeout(onClose, 9000);
    return () => window.clearTimeout(timer);
  }, [onClose, hovered, focused, sector.homologated]);

  return (
    <aside className="aw-sector-celebration" aria-label="Conclusão do setor"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      {sector.homologated && <div className="aw-confetti" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => {
          const angle = ((index * 137.508) % 360) * Math.PI / 180;
          const radius = 105 + (index % 7) * 29;
          const x = Math.cos(angle) * radius;
          const y = -90 - Math.abs(Math.sin(angle)) * radius;
          const style = {
            "--cx": `${x}px`, "--cy": `${y}px`, "--fall": `${100 + (index % 5) * 35}px`,
            "--rotation": `${(index % 2 ? -1 : 1) * (240 + index * 17)}deg`,
            "--duration": `${1400 + (index % 8) * 100}ms`,
            "--delay": `${(index % 4) * 35}ms`,
            backgroundColor: ["#1674e8", "#eeb93e", "#42b88b", "#9b83eb", "#ee7794"][index % 5],
          } as CSSProperties;
          return <i key={index} className={index % 3 === 0 ? "aw-confetti-round" : ""} style={style} />;
        })}
      </div>}
      <div className="aw-celebration-icon" aria-hidden="true"><CheckCircle2 size={26} /></div>
      <div className="aw-celebration-copy" role="status" aria-live="polite" aria-atomic="true">
        <small>{sector.campus}</small>
        <strong>{sector.name}: {sector.homologated ? "priorização enviada!" : "avaliação preenchida"}</strong>
        <p>{sector.homologated ? "Envio das DFDs para consolidação confirmado." : "Avaliações salvas. Confira o aviso na caixa azul para encaminhar as DFDs prontas."}</p>
        <button type="button" onClick={onContinue}>{sector.homologated ? "Continuar na fila" : "Enviar avaliações prontas"} <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
      <button type="button" className="aw-celebration-close" onClick={onClose} aria-label="Fechar confirmação do setor"><X size={18} /></button>
    </aside>
  );
}
