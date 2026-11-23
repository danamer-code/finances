import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { CURRENCY_SYMBOLS, LOCALE_TAGS } from "@/i18n/config";
import { getMessages, getPrefs } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { add, change, sub } from "@/lib/decimal";
import { dayLabel, formatMoney, ltrIsolate, todayIso } from "@/lib/format";
import { getHoldingDetail, getPositions } from "@/lib/portfolio";

import { DeleteTradeButton, PriceForm } from "./holding-actions";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.cartera.holding.title} · ${m.common.appName}` };
}

export default function HoldingPage({ params }: PageProps<"/cartera/[id]">) {
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <Suspense fallback={<div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Holding params={params} />
      </Suspense>
    </main>
  );
}

async function Holding({ params }: Pick<PageProps<"/cartera/[id]">, "params">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, positions, m, prefs] = await Promise.all([
    getHoldingDetail(user, id),
    getPositions(user),
    getMessages(),
    getPrefs(),
  ]);
  if (!detail) notFound();
  const t = m.cartera.holding;
  const { locale } = prefs;
  const tag = LOCALE_TAGS[locale];
  const symbol = CURRENCY_SYMBOLS[prefs.currency];
  const qty = (q: string) => Number(q).toLocaleString(tag, { maximumFractionDigits: 8 });
  /** Cost unitari en la divisa base, amb fins a 4 decimals: «12,3456 €», «€12.3456». */
  const unitCost = (v: string) => {
    const n = Number(v).toLocaleString(tag, { maximumFractionDigits: 4 });
    return locale === "en" ? `${symbol}${n}` : `${n} ${symbol}`;
  };
  const today = todayIso();
  const position = positions.find((p) => p.id === id);
  const quantity = position?.quantity ?? "0";
  const cost = add(...detail.lots.map((l) => l.cost));
  const gain = position?.value ? sub(position.value, cost) : null;
  const pct = position?.value ? change(position.value, cost) : null;
  const code = [detail.holding.ticker, detail.holding.isin].filter(Boolean).join(" · ");

  return (
    <>
      <header className="flex items-center gap-3">
        <Link href="/cartera" aria-label={m.cartera.backToPortfolio} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface">
          <Icon name="chevronLeft" />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{detail.holding.name}</h1>
          <span className="truncate text-[13px] text-ink-2">
            {code ? `${code} · ` : ""}
            {detail.holding.accountName}
          </span>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <span className="text-[15px] text-ink-2">{t.currentValue}</span>
        {position?.value ? (
          <Money amount={position.value} className="text-[44px] leading-none font-semibold tracking-[-0.04em]" />
        ) : (
          <span className="text-2xl font-semibold text-ink-2">{t.noPrice}</span>
        )}
        {gain && (
          <span className={`text-sm font-semibold ${gain.startsWith("-") ? "text-negative" : "text-positive"}`}>
            {formatMoney(gain, { signed: true, ...prefs })}
            {pct !== null && ` (${ltrIsolate(`${pct >= 0 ? "+" : ""}${m.cartera.pct(pct)}`, prefs.locale)})`} <span className="font-normal text-ink-2">{t.overFifoCost}</span>
          </span>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1 rounded-[20px] bg-surface px-4 py-3.5">
          <span className="text-[13px] text-ink-2">{t.units}</span>
          <span className="text-xl font-semibold tracking-tight">{qty(quantity)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[20px] bg-surface px-4 py-3.5">
          <span className="text-[13px] text-ink-2">{t.fifoCost}</span>
          <Money amount={cost} className="text-xl font-semibold tracking-tight" />
        </div>
      </div>

      <PriceForm
        holdingId={detail.holding.id}
        currency={detail.holding.currency}
        today={today}
        current={detail.price ? `${Number(detail.price.price).toLocaleString(tag, { maximumFractionDigits: 6 })} ${detail.price.currency} · ${dayLabel(detail.price.date, today, locale).subtitle}` : null}
      />

      {detail.gainsByYear.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">{t.realizedGains}</h2>
          <div className="flex flex-col rounded-3xl bg-surface px-4 py-1">
            {detail.gainsByYear.map((g, i) => (
              <div key={g.year} className={`flex justify-between py-3 text-[15px] ${i > 0 ? "border-t border-line" : ""}`}>
                <span>{g.year}</span>
                <Money amount={g.gain} signed className={`font-semibold ${g.gain.startsWith("-") ? "text-negative" : "text-positive"}`} />
              </div>
            ))}
          </div>
          <p className="px-1 text-xs text-ink-2">{t.criteria}</p>
        </section>
      )}

      {detail.lots.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">{t.openLots}</h2>
          <div className="flex flex-col rounded-3xl bg-surface px-4 py-1">
            {detail.lots.map((l, i) => (
              <div key={l.id} className={`flex items-center justify-between gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
                <span className="flex flex-col">
                  <span className="text-[15px] font-medium">{dayLabel(l.buyDate, today, locale).subtitle}</span>
                  <span className="text-[13px] text-ink-2">
                    {qty(l.remainingQty)} × {unitCost(l.unitCost)}
                  </span>
                </span>
                <Money amount={l.cost} className="text-[15px] font-semibold" />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">{t.trades}</h2>
          <Link href={`/cartera/operacio?posicio=${detail.holding.id}`} className="text-sm">
            {t.newTrade}
          </Link>
        </div>
        <div className="flex flex-col rounded-3xl bg-surface px-4 py-1">
          {detail.trades.map((trade, i) => (
            <div key={trade.id} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium">
                  {t.sides[trade.side] ?? trade.side} · {qty(trade.quantity)}
                </span>
                <span className="truncate text-[13px] text-ink-2">
                  {dayLabel(trade.date, today, locale).subtitle}
                  {trade.isEstimated && ` · ${t.estimated}`}
                </span>
              </span>
              {trade.side !== "transfer_in" && trade.side !== "transfer_out" && trade.side !== "scrip" && (
                <Money amount={trade.amountEur} className="shrink-0 text-[15px] font-semibold" />
              )}
              {trade.source === "manual" && !trade.isEstimated && <DeleteTradeButton id={trade.id} />}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
