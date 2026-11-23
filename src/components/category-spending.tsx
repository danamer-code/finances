import Link from "next/link";

import { getMessages } from "@/i18n/server";
import type { CategorySpend } from "@/lib/data";
import { change, gt, percent, ratio } from "@/lib/decimal";

import { CategoryBadge } from "./category-badge";
import { Icon } from "./icon";
import { Money } from "./money";

/**
 * Despesa per categoria amb la comparativa amb el període anterior.
 * Si la categoria té pressupost (vista mensual), la barra és la part gastada del pressupost i
 * avisa quan se supera; si no, la barra és relativa a la categoria amb més despesa.
 */
export async function CategorySpending({
  items,
  previousLabel,
  useBudget,
  limit,
  month,
}: {
  items: CategorySpend[];
  previousLabel: string;
  useBudget: boolean;
  limit?: number;
  /** Mes ("2026-11"): cada categoria porta als seus moviments d'aquell mes. */
  month?: string;
}) {
  const m = await getMessages();
  const t = m.avui.spending;
  // Amb pressupost, una categoria que el supera surt sempre, encara que no sigui de les que més gasten.
  const overBudget = (c: CategorySpend) => useBudget && c.budget !== null && gt(c.current, c.budget);
  const shown = limit ? [...items.slice(0, limit), ...items.slice(limit).filter(overBudget)] : items;
  const maxCurrent = items.reduce((m, c) => (gt(c.current, m) ? c.current : m), "0");

  if (shown.length === 0) {
    return <p className="rounded-3xl bg-surface p-5 text-ink-2">{t.empty}</p>;
  }

  return (
    <div className="flex flex-col rounded-3xl bg-surface px-4 py-2">
      {shown.map((c, i) => {
        const budget = useBudget ? c.budget : null;
        const used = budget ? percent(c.current, budget) : null;
        const over = used !== null && used > 100;
        const delta = change(c.current, c.previous);
        const width = budget ? Math.min(1, ratio(c.current, budget)) : ratio(c.current, maxCurrent);
        return (
          <Row key={c.id} href={month ? `/moviments?mes=${month}&categoria=${c.id}` : undefined} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
            <CategoryBadge category={c} size={36} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[15px]">{c.name}</span>
                <Money amount={c.current} className="shrink-0 text-[15px] font-semibold" centsClassName="text-ink-3" />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 flex-1 rounded-full bg-surface-2" aria-hidden="true">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${Math.max(width * 100, c.current === "0.00" ? 0 : 2)}%`, background: over ? "var(--negative)" : "var(--ink)" }}
                  />
                </div>
                {over ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-negative">
                    <Icon name="alert" size={13} />
                    {t.over}
                  </span>
                ) : budget && used !== null ? (
                  <span className="shrink-0 text-xs text-ink-2">{t.ofBudget(used)}</span>
                ) : delta !== null ? (
                  <span className="shrink-0 text-xs text-ink-2" title={t.comparedTo(previousLabel)}>
                    {delta > 0 ? "↑" : delta < 0 ? "↓" : "="} {m.avui.percent(Math.abs(delta))}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-ink-3">{t.isNew}</span>
                )}
              </div>
            </div>
          </Row>
        );
      })}
    </div>
  );
}

function Row({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={`${className} transition active:opacity-70`}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
