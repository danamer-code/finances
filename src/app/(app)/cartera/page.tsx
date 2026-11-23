import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ValueChart } from "@/components/charts/value-chart";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { getMessages, getPrefs } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getAccountBalances } from "@/lib/balances";
import { add, change, gt, percent, ratio, sub } from "@/lib/decimal";
import { formatMoney, ltrIsolate, todayIso } from "@/lib/format";
import { badgeText } from "@/lib/holding-label";
import { getBalances, getConcentrationThreshold, getEvolution, getPositions } from "@/lib/portfolio";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.cartera.title} · ${m.common.appName}` };
}

const KIND_COLOR: Record<string, string> = { fund: "var(--series-1)", stock: "var(--series-2)", crypto: "var(--series-3)" };

export default async function PortfolioPage() {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[30px] font-semibold tracking-tight">{m.cartera.title}</h1>
        <Link
          href="/cartera/operacio"
          className="flex h-11 items-center gap-1.5 rounded-full bg-surface pe-4 ps-3 text-sm font-semibold"
        >
          <Icon name="plus" size={18} strokeWidth={2.2} />
          {m.cartera.trade}
        </Link>
      </header>
      <Suspense fallback={<div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Portfolio />
      </Suspense>
    </main>
  );
}

async function Portfolio() {
  const user = await requireUser();
  const [m, prefs] = await Promise.all([getMessages(), getPrefs()]);
  const t = m.cartera.overview;
  const pct = m.cartera.pct;
  const today = todayIso();
  const [positions, balances, threshold, accounts] = await Promise.all([
    getPositions(user),
    getBalances(user),
    getConcentrationThreshold(user),
    getAccountBalances(user),
  ]);

  const priced = positions.filter((p) => p.value !== null);
  const missingPrice = positions.filter((p) => p.value === null);
  const total = add(...priced.map((p) => p.value!));
  const totalCost = add(...priced.map((p) => p.cost));
  const gain = sub(total, totalCost);
  const gainPct = change(total, totalCost);
  const evolution = await getEvolution(user, total, today);

  const sorted = [...priced].sort((a, b) => (gt(b.value!, a.value!) ? 1 : -1));
  const byKind = (["fund", "stock", "crypto"] as const)
    .map((kind) => ({ kind, value: add(...priced.filter((p) => p.kind === kind).map((p) => p.value!)) }))
    .filter((k) => gt(k.value, "0"));
  const thresholdPct = Math.round(Number(threshold) * 100);
  const concentrated = sorted.filter(
    (p) => (p.kind === "stock" || p.kind === "crypto") && ratio(p.value!, total) > Number(threshold),
  );
  const netWorth = add(total, balances.cash, balances.loans);

  // Fons agrupats per compte (p. ex. la cartera del roboadvisor, amb el seu efectiu); accions i cripto a part.
  type Group = { key: string; title: string; subtitle: string; items: typeof sorted; byAccount: boolean; cash?: string };
  const groups: Group[] = [];
  const funds = sorted.filter((p) => p.kind === "fund");
  for (const accountName of [...new Set(funds.map((p) => p.accountName))]) {
    const items = funds.filter((p) => p.accountName === accountName);
    const account = accounts.find((a) => a.name === accountName);
    groups.push({
      key: `fund-${accountName}`,
      title: accountName,
      subtitle: t.funds(items.length),
      items,
      byAccount: true,
      cash: account?.balance ?? undefined,
    });
  }
  for (const kind of ["stock", "crypto"] as const) {
    const items = sorted.filter((p) => p.kind === kind);
    if (items.length === 0) continue;
    const accountsUsed = new Set(items.map((p) => p.accountName)).size;
    groups.push({
      key: kind,
      title: m.cartera.kinds[kind],
      subtitle: `${kind === "stock" ? t.stocks(items.length) : t.coins(items.length)} · ${t.accounts(accountsUsed)}`,
      items,
      byAccount: false,
    });
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <span className="text-[15px] text-ink-2">{t.invested}</span>
        <Money amount={total} className="text-[52px] leading-none font-semibold tracking-[-0.045em]" />
        <span className="text-sm text-ink-2">
          <span className={`font-semibold ${gain.startsWith("-") ? "text-negative" : "text-positive"}`}>
            {formatMoney(gain, { signed: true, ...prefs })}
            {gainPct !== null && ` (${ltrIsolate(`${gainPct >= 0 ? "+" : ""}${pct(gainPct)}`, prefs.locale)})`}
          </span>{" "}
          {t.overCost}
        </span>
      </section>

      <section className="rounded-3xl bg-surface p-4">
        <ValueChart points={evolution} />
      </section>

      <section className="flex flex-col gap-3.5 rounded-3xl bg-surface p-4">
        <h2 className="text-[17px] font-semibold">{t.distribution}</h2>
        <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
          {byKind.map((k) => (
            <div key={k.kind} style={{ width: `${ratio(k.value, total) * 100}%`, background: KIND_COLOR[k.kind] }} />
          ))}
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {byKind.map((k) => (
            <li key={k.kind} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: KIND_COLOR[k.kind] }} />
              <span className="flex-1">{m.cartera.kinds[k.kind]}</span>
              <Money amount={k.value} noCents className="text-ink-2" />
              <span className="w-11 text-end font-medium">{pct(percent(k.value, total))}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-ink-2">
            <span>{t.cashInAccounts}</span>
            <Money amount={balances.cash} noCents />
          </div>
          <div className="flex justify-between text-ink-2">
            <span>{t.loans}</span>
            <Money amount={balances.loans} noCents />
          </div>
          <div className="flex justify-between font-semibold">
            <span>{t.netWorth}</span>
            <Money amount={netWorth} noCents />
          </div>
        </div>
      </section>

      {concentrated.map((p) => (
        <section
          key={p.id}
          aria-label={t.concentrationLabel}
          className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 ring-[1.5px] ring-accent ring-inset"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
            <Icon name="alert" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t.concentration(p.name, percent(p.value!, total))}</span>
            <span className="text-[13px] text-ink-2">{t.concentrationThreshold(thresholdPct)}</span>
          </span>
        </section>
      ))}

      {missingPrice.length > 0 && (
        <p className="rounded-3xl bg-surface p-4 text-sm text-ink-2">
          {t.missingPrice(missingPrice.map((p) => p.name).join(", "))}
        </p>
      )}

      {groups.map((g) => {
        const groupValue = add(...g.items.map((p) => p.value!));
        const groupPct = change(groupValue, add(...g.items.map((p) => p.cost)));
        return (
          <section key={g.key} className="flex flex-col rounded-3xl bg-surface px-4 py-1.5" aria-label={g.title}>
            <div className="flex items-start justify-between gap-3 pt-2.5 pb-1">
              <span className="flex min-w-0 flex-col">
                <h2 className="truncate text-[17px] font-semibold">{g.title}</h2>
                <span className="text-[13px] text-ink-2">{g.subtitle}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <Money amount={add(groupValue, g.cash ?? "0")} noCents className="text-[17px] font-semibold" />
                {groupPct !== null && (
                  <span className={`text-[13px] font-semibold ${groupPct >= 0 ? "text-positive" : "text-negative"}`}>
                    {groupPct >= 0 ? "↑" : "↓"} {pct(Math.abs(groupPct))}
                  </span>
                )}
              </span>
            </div>
            {g.items.map((p) => {
              const itemPct = change(p.value!, p.cost);
              return (
                <Link
                  key={p.id}
                  href={`/cartera/${p.id}`}
                  className="flex items-center gap-3 border-t border-line py-3 transition active:opacity-70"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-wide"
                    style={{ background: "var(--surface-2)", boxShadow: `inset 0 0 0 2px ${KIND_COLOR[p.kind]}` }}
                  >
                    {badgeText(p)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{p.name}</span>
                    <span className="truncate text-[13px] text-ink-2">
                      {t.weight(percent(p.value!, total))}
                      {g.byAccount ? "" : ` · ${p.accountName}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <Money amount={p.value} className="text-[15px] font-semibold" />
                    {itemPct !== null && (
                      <span className={`text-[13px] font-semibold ${itemPct >= 0 ? "text-positive" : "text-negative"}`}>
                        {itemPct >= 0 ? "↑" : "↓"} {pct(Math.abs(itemPct))}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
            {g.cash && g.cash !== "0.00" && (
              <div className="flex items-center gap-3 border-t border-line py-3 text-ink-2">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
                  <Icon name="wallet" size={18} />
                </span>
                <span className="flex-1 text-[15px]">{t.cashInPortfolio}</span>
                <Money amount={g.cash} className="text-[15px] font-semibold text-ink" />
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
