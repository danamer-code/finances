import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CategorySpending } from "@/components/category-spending";
import { Icon } from "@/components/icon";
import { PeriodSelect } from "@/components/period-select";
import { Money } from "@/components/money";
import { getMessages, getPrefs } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getCategorySpending, getMonthlySeries, getYearSummaries } from "@/lib/data";
import { abs, isNegative, percent, sub } from "@/lib/decimal";
import { formatMoney, todayIso } from "@/lib/format";

import { MonthlyChart } from "./monthly-chart";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.any.title} · ${m.common.appName}` };
}

export default function YearPage({ searchParams }: PageProps<"/any">) {
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <Suspense fallback={<div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Year searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Year({ searchParams }: Pick<PageProps<"/any">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const prefs = await getPrefs();
  const t = (await getMessages()).any;
  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  const summaries = await getYearSummaries(user);
  const years = summaries.map((s) => s.year);
  const requested = Number(params.any);
  const year = years.includes(requested) ? requested : years.includes(currentYear) ? currentYear : (years.at(-1) ?? currentYear);

  const [series, spending] = await Promise.all([
    getMonthlySeries(user, `${year}-01`, `${year}-12`),
    getCategorySpending(user, {
      start: `${year}-01-01`,
      end: `${year + 1}-01-01`,
      prevStart: `${year - 1}-01-01`,
      prevEnd: `${year}-01-01`,
    }),
  ]);
  const summary = summaries.find((s) => s.year === year);
  const prevSummary = summaries.find((s) => s.year === year - 1);
  const isPartial = (s: (typeof summaries)[number]) => s.firstMonth > 1 || (s.year === currentYear ? false : s.lastMonth < 12);

  return (
    <>
      <header className="flex items-center justify-between">
        <Link href="/" aria-label={t.backToToday} className="flex size-11 items-center justify-center rounded-full bg-surface">
          <Icon name="chevronLeft" />
        </Link>
        <PeriodSelect
          label={t.year}
          size="lg"
          value={String(year)}
          options={[...years].reverse().map((y) => ({ value: String(y), label: String(y), href: `/any?any=${y}` }))}
        />
        <span className="size-11" />
      </header>

      {summary && (
        <Link href={`/wrapped/${year}`} className="flex items-center gap-3 rounded-3xl bg-accent p-4 text-accent-ink transition active:scale-[0.99]">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-black/10">
            <Icon name="party" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-[15px] font-semibold">{t.wrapped.title(year)}</span>
            <span className="text-[13px] opacity-75">{t.wrapped.subtitle(year === currentYear)}</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
      )}

      {summary ? (
        <>
          <section className="flex flex-col gap-2">
            <span className="text-[15px] text-ink-2">
              {isNegative(summary.saved) ? t.overspent(year) : t.saved(year)}
              {isPartial(summary) && ` (${t.since(summary.firstMonth)})`}
            </span>
            <Money amount={abs(summary.saved)} className="text-[52px] leading-none font-semibold tracking-[-0.045em]" />
            <span className="text-sm text-ink-2">
              {percent(summary.saved, summary.income) !== null && t.rateOfIncome(percent(summary.saved, summary.income)!)}
              {prevSummary && ` · ${formatMoney(sub(summary.saved, prevSummary.saved), { signed: true, ...prefs })} ${t.vs(year - 1)}`}
            </span>
          </section>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1 rounded-[20px] bg-surface px-4 py-3.5">
              <span className="text-[13px] text-ink-2">{t.income}</span>
              <Money amount={summary.income} className="text-xl font-semibold tracking-tight text-positive" />
            </div>
            <div className="flex flex-col gap-1 rounded-[20px] bg-surface px-4 py-3.5">
              <span className="text-[13px] text-ink-2">{t.expenses}</span>
              <Money amount={abs(summary.expense)} className="text-xl font-semibold tracking-tight" />
            </div>
          </div>

          <MonthlyChart points={series} currentMonth={year === currentYear ? today.slice(0, 7) : undefined} />

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{t.byCategory}</h2>
              <span className="text-[13px] text-ink-2">{t.vs(year - 1)}</span>
            </div>
            <CategorySpending items={spending} previousLabel={String(year - 1)} useBudget={false} limit={10} />
          </section>
        </>
      ) : (
        <p className="rounded-3xl bg-surface p-5 text-ink-2">{t.empty(year)}</p>
      )}

      {summaries.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">{t.comparison}</h2>
          <div className="overflow-x-auto rounded-3xl bg-surface">
            <table className="w-full text-[13px]">
              <caption className="sr-only">{t.tableCaption}</caption>
              <thead>
                <tr className="text-start text-xs text-ink-2">
                  <th scope="col" className="px-4 pt-4 pb-2 font-medium">{t.year}</th>
                  <th scope="col" className="px-2 pt-4 pb-2 text-end font-medium">{t.income}</th>
                  <th scope="col" className="px-2 pt-4 pb-2 text-end font-medium">{t.expenses}</th>
                  <th scope="col" className="px-4 pt-4 pb-2 text-end font-medium">{t.savings}</th>
                </tr>
              </thead>
              <tbody>
                {[...summaries].reverse().map((s) => {
                  const rate = percent(s.saved, s.income);
                  return (
                    <tr key={s.year} className={`border-t border-line ${s.year === year ? "bg-surface-2" : ""}`}>
                      <th scope="row" className="px-4 py-3 text-start font-semibold">
                        <Link href={`/any?any=${s.year}`} className="underline-offset-4 hover:underline">
                          {s.year}
                        </Link>
                        {isPartial(s) && <span className="block text-[11px] font-normal text-ink-2">{t.sinceShort(s.firstMonth)}</span>}
                        {s.year === currentYear && <span className="block text-[11px] font-normal text-ink-2">{t.inProgress}</span>}
                      </th>
                      <td className="px-2 py-3 text-end whitespace-nowrap">
                        <Money amount={s.income} noCents />
                      </td>
                      <td className="px-2 py-3 text-end whitespace-nowrap">
                        <Money amount={abs(s.expense)} noCents />
                      </td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <Money amount={s.saved} noCents className="font-semibold" />
                        {rate !== null && <span className="block text-[11px] text-ink-2">{t.percent(rate)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
