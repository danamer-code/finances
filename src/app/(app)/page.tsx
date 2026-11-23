import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppBadge } from "@/components/app-badge";
import { CategorySpending } from "@/components/category-spending";
import { BudgetMeter, CumulativeLines, SparkBars } from "@/components/charts/mini";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { ThemeToggle } from "@/components/theme-toggle";
import { TransactionCard } from "@/components/transaction-list";
import { getMessages, getPrefs } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { countStaleBalances } from "@/lib/balances";
import {
  getCategories,
  getCategorySpending,
  getDailyExpenses,
  getMonthlySeries,
  getPendingTransactions,
  getProfile,
  getRecentTransactions,
} from "@/lib/data";
import { abs, add, change, div, isNegative, percent } from "@/lib/decimal";
import { longToday, monthName, shiftMonth, todayIso } from "@/lib/format";

export default function TodayPage() {
  return (
    <main className="flex flex-col gap-6 px-5 pt-5">
      <Suspense fallback={<TodaySkeleton />}>
        <Today />
      </Suspense>
    </main>
  );
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="h-11 w-40 rounded-full bg-surface" />
      <div className="h-24 rounded-3xl bg-surface" />
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[148px] rounded-3xl bg-surface" />
        ))}
      </div>
    </div>
  );
}

const tile = "flex h-[148px] flex-col justify-between rounded-3xl bg-surface p-4";

async function Today() {
  const user = await requireUser();
  const { locale } = await getPrefs();
  const m = await getMessages();
  const t = m.avui;
  const today = todayIso();
  const month = today.slice(0, 7);
  const prevMonth = shiftMonth(month, -1);
  const monthNumber = Number(month.slice(5));
  const prevMonthNumber = Number(prevMonth.slice(5));
  const prevName = monthName(prevMonthNumber, locale);

  const [categories, series, days, prevDays, spending, recent, pending, profile, staleBalances] = await Promise.all([
    getCategories(user),
    getMonthlySeries(user, shiftMonth(month, -5), month),
    getDailyExpenses(user, month),
    getDailyExpenses(user, prevMonth),
    getCategorySpending(user, {
      start: `${month}-01`,
      end: `${shiftMonth(month, 1)}-01`,
      prevStart: `${prevMonth}-01`,
      prevEnd: `${month}-01`,
    }),
    getRecentTransactions(user, 5),
    getPendingTransactions(user),
    getProfile(user),
    countStaleBalances(user, today),
  ]);
  if (categories.length === 0) redirect("/benvinguda");

  const current = series.at(-1)!;
  const previous = series.at(-2);
  const savedRate = percent(current.saved, current.income);
  const savedChange = previous ? change(current.saved, previous.saved) : null;
  const overspent = isNegative(current.saved);

  // Despesa acumulada dia a dia (geometria del minigràfic).
  const dayOfMonth = Number(today.slice(8));
  const cumulative = (points: { expense: string }[]) => {
    let acc = 0;
    return points.map((p) => (acc += Number(p.expense)));
  };
  const currentCum = cumulative(days.slice(0, dayOfMonth));
  const previousCum = cumulative(prevDays);

  // Pressupost: només les categories que en tenen.
  const budgeted = spending.filter((c) => c.budget);
  const budgetTotal = add(...budgeted.map((c) => c.budget!));
  const budgetSpent = add(...budgeted.map((c) => c.current));
  const budgetUsed = budgeted.length ? percent(budgetSpent, budgetTotal) : null;

  const dailyAverage = div(abs(current.expense), dayOfMonth);
  // Year Wrapped: de l'1 de desembre (avançament de l'any en curs) al 31 de gener (l'any que s'acaba de tancar).
  const wrappedYear = monthNumber === 12 ? Number(month.slice(0, 4)) : monthNumber === 1 ? Number(month.slice(0, 4)) - 1 : null;
  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ajustos"
            aria-label={t.settings}
            className="flex size-11 items-center justify-center rounded-full bg-nav text-[17px] font-semibold text-accent"
          >
            {initial}
          </Link>
          <div className="flex flex-col">
            <span className="text-[13px] text-ink-2">{longToday(today, locale)}</span>
            <span className="text-base font-semibold">{t.hello}</span>
          </div>
        </div>
        <ThemeToggle serverTheme={profile?.theme} />
      </header>

      <section className="flex flex-col gap-2.5">
        <span className="text-[15px] text-ink-2">
          {overspent ? t.overspent(monthNumber) : t.saved(monthNumber)}
        </span>
        <div className="flex items-center gap-3">
          <Money amount={abs(current.saved)} className="text-[56px] leading-none font-semibold tracking-[-0.045em]" />
          {savedRate !== null && !overspent && (
            <span className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold">{t.percent(savedRate)}</span>
          )}
        </div>
        <span className="text-sm text-ink-2">
          {savedRate !== null && !overspent ? t.rateOfIncome(savedRate) : t.movementsThisMonth(current.count)}
          {savedChange !== null && ` · ${t.comparedTo(savedChange >= 0, prevMonthNumber)}`}
        </span>
      </section>

      {wrappedYear && (
        <Link href={`/wrapped/${wrappedYear}`} className="flex items-center gap-3 rounded-3xl bg-accent p-4 text-accent-ink transition active:scale-[0.99]">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-black/10">
            <Icon name="party" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-[15px] font-semibold">{t.wrapped.title(wrappedYear)}</span>
            <span className="text-[13px] opacity-75">{t.wrapped.subtitle}</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">{t.glance.title}</h2>
          <Link href={`/any?any=${month.slice(0, 4)}`} className="text-sm text-ink">
            {t.glance.seeYear}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href={`/any?any=${month.slice(0, 4)}`} className={tile}>
            <Money amount={current.income} className="text-2xl font-semibold tracking-tight" />
            <SparkBars values={series.map((s) => Number(s.income))} highlightIndex={series.length - 1} />
            <span className="text-[13px] text-ink-2">{t.glance.income}</span>
          </Link>

          <Link href={`/moviments?mes=${month}&tipus=despeses`} className={tile}>
            <Money amount={abs(current.expense)} className="text-2xl font-semibold tracking-tight" />
            <CumulativeLines current={currentCum} previous={previousCum} daysInMonth={days.length} />
            <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
              {t.glance.expenses}
              <svg width="14" height="4" aria-hidden="true"><line x1="0" y1="2" x2="14" y2="2" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" /></svg>
              {t.glance.now}
              <svg width="14" height="4" aria-hidden="true"><line x1="0" y1="2" x2="14" y2="2" stroke="var(--ink-3)" strokeWidth="1.6" strokeDasharray="3 3" /></svg>
              {t.glance.previous(prevMonthNumber)}
            </span>
          </Link>

          {budgetUsed !== null ? (
            <Link href="/ajustos/categories" className={tile}>
              <span className="text-2xl font-semibold tracking-tight">
                {budgetUsed}
                <span className="text-ink-3">{t.percentSign}</span>
              </span>
              <div className="flex flex-col gap-2">
                <BudgetMeter percent={budgetUsed} />
                <span className="text-xs text-ink-2">
                  <Money amount={budgetSpent} centsClassName="" /> {t.glance.budgetOf} <Money amount={budgetTotal} centsClassName="" />
                </span>
              </div>
              <span className="text-[13px] text-ink-2">{t.glance.budgetSpent}</span>
            </Link>
          ) : (
            <Link href="/ajustos/categories" className={tile}>
              <Icon name="piggy" size={26} />
              <span className="text-sm font-medium">{t.glance.budgetEmpty}</span>
              <span className="text-[13px] text-ink-2">{t.glance.budget}</span>
            </Link>
          )}

          <Link href={`/moviments?mes=${month}&tipus=despeses`} className={tile}>
            <Money amount={dailyAverage} className="text-2xl font-semibold tracking-tight" />
            <SparkBars values={days.slice(Math.max(0, dayOfMonth - 12), dayOfMonth).map((d) => Number(d.expense))} highlightIndex={Math.min(dayOfMonth, 12) - 1} />
            <span className="text-[13px] text-ink-2">{t.glance.perDay}</span>
          </Link>
        </div>
      </section>

      <AppBadge count={pending.length} />
      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">{t.pending}</h2>
          <TransactionCard items={pending} />
        </section>
      )}

      {staleBalances > 0 && (
        <Link
          href="/ajustos/saldos"
          className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 ring-[1.5px] ring-accent ring-inset"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
            <Icon name="wallet" />
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t.balances.title(monthNumber)}</span>
            <span className="text-[13px] text-ink-2">{t.balances.missing(staleBalances)}</span>
          </span>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">{t.byCategory}</h2>
          <span className="text-[13px] text-ink-2">{t.vs(prevName)}</span>
        </div>
        <CategorySpending items={spending} previousLabel={prevName} useBudget limit={6} month={month} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">{t.latest}</h2>
          <Link href="/moviments" className="text-sm text-ink">
            {m.common.actions.seeAll}
          </Link>
        </div>
        {recent.length > 0 ? (
          <TransactionCard items={recent} />
        ) : (
          <Link href="/nou" className="flex items-center gap-3 rounded-3xl bg-surface p-4 text-ink-2">
            <Icon name="plus" /> {t.firstMovement}
          </Link>
        )}
      </section>
    </>
  );
}
