/**
 * Minigràfics de les targetes del resum (estàtics: la targeta enllaça a la vista amb detall).
 * Geometria amb números; els imports es mostren sempre a partir del text original.
 */

/** Barres petites d'una sola sèrie; la marcada (mes o dia actual) en llima. */
export function SparkBars({ values, highlightIndex, height = 44 }: { values: number[]; highlightIndex?: number; height?: number }) {
  const max = Math.max(...values, 0) || 1;
  return (
    <div dir="ltr" aria-hidden="true" className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: `${Math.max((v / max) * 100, v > 0 ? 6 : 2)}%`,
            background: i === highlightIndex ? "var(--accent)" : "var(--ink)",
            opacity: i === highlightIndex ? 1 : 0.8,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Despesa acumulada d'aquest mes (línia contínua) contra el mes anterior (discontínua).
 * Dues sèries: la llegenda va al peu de la targeta i es distingeixen pel traç, no només pel color.
 */
export function CumulativeLines({
  current,
  previous,
  daysInMonth,
  height = 44,
}: {
  current: number[];
  previous: number[];
  daysInMonth: number;
  height?: number;
}) {
  const max = Math.max(...current, ...previous, 0) || 1;
  const w = 140;
  const x = (i: number, n: number) => (n <= 1 ? 0 : (i / (Math.max(n, daysInMonth) - 1)) * w);
  const y = (v: number) => height - 2 - (v / max) * (height - 4);
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i, vals.length).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = current.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      {previous.length > 0 && (
        <path d={path(previous)} fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeDasharray="3 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      )}
      {current.length > 0 && (
        <>
          <path d={path(current)} fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={x(last, current.length)} cy={y(current[last])} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

/** Pressupost gastat en 10 segments: plens fins al percentatge, l'últim tocat en llima; si se supera, tots en color d'avís. */
export function BudgetMeter({ percent }: { percent: number }) {
  const filled = Math.min(10, Math.round(percent / 10));
  const over = percent > 100;
  return (
    <div dir="ltr" aria-hidden="true" className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="h-[18px] rounded-[4px]"
          style={{
            background: over
              ? "var(--negative)"
              : i < filled - 1
                ? "var(--ink)"
                : i === filled - 1
                  ? "var(--accent)"
                  : "var(--surface-2)",
          }}
        />
      ))}
    </div>
  );
}
