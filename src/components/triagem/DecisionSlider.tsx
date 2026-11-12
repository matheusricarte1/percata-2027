"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

export function DecisionSlider({ value, disabled, label, labels, className, onCommit, onStart, onEnd }: {
  value: number; disabled: boolean; label: string; labels: readonly string[]; className: string;
  onCommit: (value: number) => void; onStart: () => void; onEnd: () => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const active = useRef(false);
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; }, [onEnd]);
  useEffect(() => () => { if (active.current) endRef.current(); }, []);
  const position = preview ?? value;
  const finish = (next: number, cancelled = false) => {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    setPreview(null);
    if (!cancelled) onCommit(Math.round(next));
    onEnd();
  };
  return <div className={`aw-butter-slider ${dragging ? "aw-dragging" : ""}`} style={{ "--position": `${position * 25}%`, "--fill": position / 4 } as CSSProperties}>
    <div className="aw-butter-track" aria-hidden="true"><span className="aw-butter-fill" /><span className="aw-butter-thumb-carrier"><i /></span></div>
    <input type="range" min={0} max={4} step={0.01} value={position} disabled={disabled}
      className={className} aria-label={label} aria-valuetext={labels[Math.round(position)]}
      onPointerDown={() => { if (!disabled) { active.current = true; setDragging(true); onStart(); } }}
      onChange={(event) => { const next = Number(event.target.value); if (active.current) setPreview(next); else onCommit(Math.round(next)); }}
      onPointerUp={(event) => finish(Number(event.currentTarget.value))}
      onPointerCancel={() => finish(value, true)}
      onBlur={(event) => finish(Number(event.currentTarget.value))}
      onKeyDown={(event) => {
        if (event.key === "Escape") { finish(value, true); return; }
        const delta = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 0;
        if (delta || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          onCommit(event.key === "Home" ? 0 : event.key === "End" ? 4 : Math.max(0, Math.min(4, value + delta)));
        }
      }} />
  </div>;
}
