import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { Icon } from "@/components/icon";
import { PeriodSelect, type PeriodOption } from "@/components/period-select";
import { Money } from "@/components/money";
import { TransactionCard } from "@/components/transaction-list";
import { getMessages, getPrefs } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import {
  getCategories,
  getFirstMovementMonth,
  getMonthTotals,
  getMonthTransactions,
  type MovementFilter,
  type TransactionRow,
} from "@/lib/data";
import { dayLabel, monthLabel, shiftMonth, todayIso } from "@/lib/format";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.moviments.title} · ${m.common.appName}` };
}

const FILTERS: MovementFilter[] = ["tots", "despeses", "ingressos", "inversions"];

export default async function MovementsPage({ searchParams }: PageProps<"/moviments">) {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-4 px-5 pt-5">
      <h1 className="text-[30px] font-semibold tracking-tight">{m.moviments.title}</h1>
      <Suspense fallback={<div className="h-64 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Movements searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Movements({ searchParams }: Pick<PageProps<"/moviments">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const { locale } = await getPrefs();
  const t = (await getMessages()).moviments;
  const today = todayIso();
  const month = typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : today.slice(0, 7);
  const filter = FILTERS.some((f) => f === params.tipus) ? (params.tipus as MovementFilter) : "tots";

  // Filtre per categoria (amb les seves subcategories), p. ex. des de «Per categoria» d'Avui.
  const allCategories = await getCategories(user);
  const selected = typeof params.categoria === "string" ? allCategories.find((c) => c.id === params.categoria) : undefined;
  const subcategories = selected ? allCategories.filter((c) => c.parentId === selected.id) : [];
  const categoryIds = selected ? [selected.id, ...subcategories.map((c) => c.id)] : undefined;

  const [rows, totals, firstMonth] = await Promise.all([
    getMonthTransactions(user, month, selected ? "tots" : filter, categoryIds),
    getMonthTotals(user, month),
    getFirstMovementMonth(user),
  ]);

  const groups = new Map<string, TransactionRow[]>();
  for (const row of rows) groups.set(row.date, [...(groups.get(row.date) ?? []), row]);

  const href = (m: string, f: MovementFilter) =>
    `/moviments?mes=${m}${selected ? `&categoria=${selected.id}` : f === "tots" ? "" : `&tipus=${f}`}`;

  // Total del mes de la categoria i desglossament per subcategoria (en cèntims, sense coma flotant acumulada).
  const cents = (amount: string | null) => Math.round(Number(amount ?? 0) * 100);
  const categoryTotal = rows.reduce((acc, r) => acc + cents(r.amount), 0);
  const breakdown = selected
    ? [selected, ...subcategories]
        .map((c) => ({ category: c, total: rows.filter((r) => r.categoryId === c.id).reduce((acc, r) => acc + cents(r.amount), 0) }))
        .filter((b) => b.total !== 0)
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    : [];
  const euros = (c: number) => (c / 100).toFixed(2);
  const monthOptions: PeriodOption[] = [];
  for (let m = today.slice(0, 7); m >= (firstMonth ?? m); m = shiftMonth(m, -1)) {
    monthOptions.push({ value: m, label: capitalize(monthLabel(m, locale)), href: href(m, filter) });
  }
  if (!monthOptions.some((o) => o.value === month)) monthOptions.push({ value: month, label: capitalize(monthLabel(month, locale)), href: href(month, filter) });

  return (
    <>
      <PeriodSelect label={t.month} value={month} options={monthOptions} />

      {selected ? (
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4" aria-label={t.categoryMovements(selected.name)}>
          <div className="flex items-center gap-3">
            <CategoryBadge category={selected} size={40} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[17px] font-semibold">{selected.name}</span>
              <span className="text-[13px] text-ink-2">
                {t.countInMonth(rows.length, Number(month.slice(5)))}
              </span>
            </span>
            <Money amount={euros(Math.abs(categoryTotal))} className="text-[17px] font-semibold" />
            <Link href={`/moviments?mes=${month}`} aria-label={t.clearCategory} className="flex size-10 items-center justify-center rounded-full bg-surface-2">
              <Icon name="x" size={18} />
            </Link>
          </div>
          {breakdown.length > 1 && (
            <ul className="flex flex-col gap-2 border-t border-line pt-3">
              {breakdown.map((b) => (
                <li key={b.category.id} className="flex items-center gap-2.5 text-sm">
                  <CategoryBadge category={b.category} size={26} />
                  <span className="flex-1 truncate">{b.category.id === selected.id ? t.general(selected.name) : b.category.name}</span>
                  <span className="text-ink-2">{t.percent(Math.round((Math.abs(b.total) / Math.max(1, Math.abs(categoryTotal))) * 100))}</span>
                  <Money amount={euros(Math.abs(b.total))} className="w-24 text-end font-semibold" centsClassName="text-ink-3" />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-[20px] bg-surface px-4 py-3.5">
            <span className="text-[13px] text-ink-2">{t.moneyIn}</span>
            <Money amount={totals.income} signed className="text-xl font-semibold tracking-tight text-positive" />
          </div>
          <div className="flex flex-col gap-1 rounded-[20px] bg-surface px-4 py-3.5">
            <span className="text-[13px] text-ink-2">{t.moneyOut}</span>
            <Money amount={totals.expense} className="text-xl font-semibold tracking-tight" />
          </div>
        </div>

        <nav aria-label={t.filter} className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={href(month, f)}
              aria-current={f === filter ? "page" : undefined}
              className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium ${f === filter ? "bg-ink text-ground" : "bg-surface text-ink"}`}
            >
              {t.filters[f]}
            </Link>
          ))}
        </nav>
        </>
      )}

      {groups.size === 0 ? (
        <p className="rounded-3xl bg-surface p-5 text-ink-2">{t.empty}</p>
      ) : (
        [...groups.entries()].map(([date, items]) => {
          const label = dayLabel(date, today, locale);
          const total = items.reduce((acc, t) => acc + Math.round(Number(t.amount ?? 0) * 100), 0);
          return (
            <section key={date} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between px-1 pt-1">
                <h2 className="text-[15px] font-semibold">
                  {label.title} <span className="font-normal text-ink-2">{label.subtitle}</span>
                </h2>
                <Money amount={(total / 100).toFixed(2)} signed className="text-[13px] text-ink-2" centsClassName="" />
              </div>
              <TransactionCard items={items} />
            </section>
          );
        })
      )}
    </>
  );
}
