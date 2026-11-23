"use client";

import { useState } from "react";

import { useMessages, usePrefs } from "@/i18n/prefs";
import { formatMoney } from "@/lib/format";

/**
 * Valor de la cartera (línia contínua) contra el cost FIFO (discontínua). Dues sèries en una sola escala;
 * es distingeixen pel traç i porten llegenda. Tocar el gràfic mostra els valors d'aquell mes.
 */
export function ValueChart({ points, height = 150 }: { points: Array<{ date: string; value: string; cost: string | null }>; height?: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const t = useMessages().cartera.chart;
  const prefs = usePrefs();
  const label = (iso: string) => `${t.months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
  const width = 320;
  const values = points.flatMap((p) => [Number(p.value), p.cost ? Number(p.cost) : NaN]).filter(Number.isFinite);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i: number) => (points.length <= 1 ? width / 2 : (i / (points.length - 1)) * (width - 8) + 4);
  const y = (v: number) => 6 + ((max - v) / (max - min || 1)) * (height - 12);
  const path = (get: (p: (typeof points)[number]) => string | null) =>
    points
      .map((p, i) => [i, get(p)] as const)
      .filter(([, v]) => v !== null)
      .map(([i, v], k) => `${k === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(Number(v)).toFixed(1)}`)
      .join(" ");
  const active = selected ?? points.length - 1;
  const point = points[active];

  const pick = (clientX: number, rect: DOMRect) => {
    const ratio = (clientX - rect.left) / rect.width;
    setSelected(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-end justify-between gap-3" aria-live="polite">
        <span className="flex flex-col">
          <span className="text-[13px] text-ink-2">{point ? label(point.date) : ""}</span>
          <span className="text-lg font-semibold tracking-tight">{point ? formatMoney(point.value, prefs) : "—"}</span>
        </span>
        <span className="flex flex-col items-end gap-0.5 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden="true"><line x1="0" y1="2" x2="14" y2="2" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" /></svg>
            {t.value}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden="true"><line x1="0" y1="2" x2="14" y2="2" stroke="var(--ink-2)" strokeWidth="1.8" strokeDasharray="3 3" /></svg>
            {t.cost} {point?.cost ? formatMoney(point.cost, prefs) : ""}
          </span>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={t.aria}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerMove={(e) => e.buttons === 0 && e.pointerType === "mouse" && pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        className="touch-pan-y"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={path((p) => p.cost)} fill="none" stroke="var(--ink-2)" strokeWidth="1.8" strokeDasharray="4 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={path((p) => p.value)} fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {point && (
          <>
            <line x1={x(active)} x2={x(active)} y1="0" y2={height} stroke="var(--ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={x(active)} cy={y(Number(point.value))} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </>
        )}
      </svg>
      <div dir="ltr" className="flex justify-between text-xs text-ink-2" aria-hidden="true">
        <span>{points[0] ? label(points[0].date) : ""}</span>
        <span>{points[Math.floor(points.length / 2)] ? label(points[Math.floor(points.length / 2)].date) : ""}</span>
        <span>{t.today}</span>
      </div>
    </figure>
  );
}
