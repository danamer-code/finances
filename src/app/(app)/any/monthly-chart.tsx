"use client";

import { useState } from "react";

import { BarChart } from "@/components/charts/bar-chart";
import { useMessages, usePrefs } from "@/i18n/prefs";
import { monthLabel, monthName } from "@/lib/format";

type Series = "income" | "expense" | "saved";
type Point = { month: string; income: string; expense: string; saved: string };

const TABS: Array<{ key: Series; label: "savings" | "income" | "expenses" }> = [
  { key: "saved", label: "savings" },
  { key: "income", label: "income" },
  { key: "expense", label: "expenses" },
];

/** Evolució mensual de l'any: una sola sèrie cada vegada (es tria amb les pestanyes). */
export function MonthlyChart({ points, currentMonth }: { points: Point[]; currentMonth?: string }) {
  const { locale } = usePrefs();
  const t = useMessages().any;
  const [series, setSeries] = useState<Series>("saved");
  const data = points.map((p) => {
    const raw = p[series];
    return {
      key: p.month,
      label: monthName(Number(p.month.slice(5)), locale).charAt(0).toUpperCase(),
      longLabel: monthLabel(p.month, locale),
      // Les despeses es dibuixen cap amunt (en positiu); l'estalvi conserva el signe.
      value: series === "expense" ? raw.replace(/^-/, "") : raw,
    };
  });
  const label = t[TABS.find((tab) => tab.key === series)!.label];

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
      <div role="group" aria-label={t.chart.series} className="flex rounded-full bg-surface-2 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={series === tab.key}
            onClick={() => setSeries(tab.key)}
            className={`h-9 flex-1 rounded-full text-sm font-semibold ${series === tab.key ? "bg-ink text-ground" : "text-ink-2"}`}
          >
            {t[tab.label]}
          </button>
        ))}
      </div>
      <BarChart
        points={data}
        highlightKey={currentMonth}
        ariaLabel={t.chart.ariaLabel(label)}
      />
    </section>
  );
}
