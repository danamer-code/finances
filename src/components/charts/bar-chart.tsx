"use client";

import { useState } from "react";

import { usePrefs } from "@/i18n/prefs";
import { formatMoney } from "@/lib/format";

export type BarPoint = { key: string; label: string; longLabel: string; value: string };

/**
 * Barres d'una sola sèrie, amb valors negatius per sota de la línia base.
 * Tocar o passar per sobre d'una barra en mostra el valor (capa d'interacció per defecte).
 * Els imports arriben com a text: només es converteixen a número per calcular l'alçada.
 */
export function BarChart({
  points,
  highlightKey,
  height = 160,
  ariaLabel,
}: {
  points: BarPoint[];
  highlightKey?: string;
  height?: number;
  ariaLabel: string;
}) {
  const prefs = usePrefs();
  const [selected, setSelected] = useState<string | null>(null);
  const values = points.map((p) => Number(p.value));
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const width = 320;
  const pad = 2;
  const slot = width / points.length;
  const barWidth = Math.max(4, slot - 6);
  const y = (v: number) => pad + ((max - v) / span) * (height - pad * 2);
  const zeroY = y(0);
  const active = points.find((p) => p.key === (selected ?? highlightKey)) ?? points.at(-1);

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex min-h-10 flex-col" aria-live="polite">
        <span className="text-[13px] text-ink-2">{active?.longLabel}</span>
        <span className="text-lg font-semibold tracking-tight">{active ? formatMoney(active.value, prefs) : "—"}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setSelected(null)}
      >
        <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => {
          const v = Number(p.value);
          const top = Math.min(y(v), zeroY);
          const h = Math.max(Math.abs(y(v) - zeroY), v === 0 ? 0 : 2);
          const x = i * slot + (slot - barWidth) / 2;
          const isActive = p.key === active?.key;
          const r = Math.min(4, barWidth / 2, h);
          // Cantonades arrodonides només a l'extrem del valor; la base queda recta sobre la línia.
          const d =
            v >= 0
              ? `M${x},${zeroY} V${top + r} Q${x},${top} ${x + r},${top} H${x + barWidth - r} Q${x + barWidth},${top} ${x + barWidth},${top + r} V${zeroY} Z`
              : `M${x},${zeroY} V${zeroY + h - r} Q${x},${zeroY + h} ${x + r},${zeroY + h} H${x + barWidth - r} Q${x + barWidth},${zeroY + h} ${x + barWidth},${zeroY + h - r} V${zeroY} Z`;
          return (
            <g key={p.key}>
              <path d={d} fill={isActive ? "var(--accent)" : p.key === highlightKey ? "var(--ink-2)" : "var(--ink)"} opacity={isActive ? 1 : 0.85} />
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onMouseEnter={() => setSelected(p.key)}
                onClick={() => setSelected(p.key)}
              >
                <title>{`${p.longLabel}: ${formatMoney(p.value, prefs)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div dir="ltr" className="flex text-[11px] text-ink-2" aria-hidden="true">
        {points.map((p) => (
          <span key={p.key} className="flex-1 text-center">
            {p.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
