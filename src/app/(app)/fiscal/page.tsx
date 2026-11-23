import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { PeriodSelect } from "@/components/period-select";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { getMessages, getPrefs } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getFiscalOverview, type Sale } from "@/lib/fiscal";
import { dayMonth, monthName, todayIso } from "@/lib/format";
import { badgeText } from "@/lib/holding-label";
import { getPositions } from "@/lib/portfolio";

import { SaleSimulator } from "./sale-simulator";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.fiscal.title} · ${m.common.appName}` };
}

export default async function TaxPage({ searchParams }: PageProps<"/fiscal">) {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-4 px-5 pt-5">
      <Suspense
        fallback={
          <>
            <h1 className="text-[30px] font-semibold tracking-tight">{m.fiscal.title}</h1>
            <div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />
          </>
        }
      >
        <Fiscal searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** «3 novembre» en català (sense «de»); en anglès i hebreu, el format curt habitual. */
const shortDate = (iso: string, locale: Locale) =>
  locale === "ca" ? `${Number(iso.slice(8, 10))} ${monthName(Number(iso.slice(5, 7)), locale)}` : dayMonth(iso, locale);
const monthYear = (iso: string, locale: Locale) => `${monthName(Number(iso.slice(5, 7)), locale)} ${iso.slice(0, 4)}`;
const qty = (q: string, locale: Locale) => Number(q).toLocaleString(LOCALE_TAGS[locale], { maximumFractionDigits: 6 });
const isNegative = (amount: string) => amount.startsWith("-");

function saleDetail(s: Sale, t: Messages["fiscal"], locale: Locale): string {
  const unit = s.side === "rights_sale" ? t.units.rights : s.kind === "stock" ? t.units.stock : s.kind === "fund" ? t.units.fund : t.units.other;
  const what = `${qty(s.quantity, locale)} ${unit}`;
  return `${what} · ${shortDate(s.date, locale)} · ${t.lots(s.lots)}`;
}

async function Fiscal({ searchParams }: Pick<PageProps<"/fiscal">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const [m, { locale }] = await Promise.all([getMessages(), getPrefs()]);
  const t = m.fiscal;
  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  const requested = typeof params.any === "string" && /^\d{4}$/.test(params.any) ? Number(params.any) : null;
  const [o, positions] = await Promise.all([getFiscalOverview(user, requested, currentYear), getPositions(user)]);
  const irpf = o.regime.regime === "irpf";
  const pending = o.result.pending;
  const pendingTotal = pending.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] font-semibold tracking-tight">{t.title}</h1>
        <PeriodSelect
          label={t.taxYear}
          value={String(o.year)}
          options={o.years.map((y) => ({ value: String(y), label: String(y), href: y === currentYear ? "/fiscal" : `/fiscal?any=${y}` }))}
        />
      </header>

      <section className="flex flex-col gap-2">
        <span className="text-[15px] text-ink-2">{t.netGain}</span>
        <Money amount={o.net} signed className="text-[52px] leading-none font-semibold tracking-[-0.045em]" />
        <span className="text-sm text-ink-2">
          {o.sales.length === 0 ? t.noSales : t.salesSummary(o.sales.length)}
          {" · "}
          {irpf ? t.irpf : t.irnr(o.regime.country !== "ES" ? o.regime.country : null)}
        </span>
      </section>

      {o.sales.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-[20px] bg-surface px-4 py-3.5">
            <span className="text-[13px] text-ink-2">{t.gains}</span>
            <Money amount={o.gains} signed className="text-xl font-semibold tracking-tight text-positive" />
          </div>
          <div className="flex flex-col gap-1 rounded-[20px] bg-surface px-4 py-3.5">
            <span className="text-[13px] text-ink-2">{t.losses}</span>
            <Money
              amount={o.losses}
              className={`text-xl font-semibold tracking-tight ${o.losses === "0.00" ? "" : "text-negative"}`}
            />
          </div>
        </div>
      )}

      {irpf && o.result.tax !== null && (
        <section className="flex flex-col gap-2 rounded-3xl bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-semibold">{t.estimatedTax}</h2>
            <Money amount={o.result.tax} className="text-[17px] font-semibold" />
          </div>
          <dl className="flex flex-col gap-1 text-sm text-ink-2">
            <div className="flex justify-between gap-3">
              <dt>{t.salesBalance}</dt>
              <dd><Money amount={o.net} signed /></dd>
            </div>
            {o.result.carriedApplied !== "0.00" && (
              <div className="flex justify-between gap-3">
                <dt>{t.carriedLosses}</dt>
                <dd><Money amount={`-${o.result.carriedApplied}`} /></dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt>{t.interestAndDividends}</dt>
              <dd><Money amount={o.interest} /></dd>
            </div>
            {o.result.offsetAgainstInterest !== "0.00" && (
              <div className="flex justify-between gap-3">
                <dt>{t.offsetAgainstInterest}</dt>
                <dd><Money amount={`-${o.result.offsetAgainstInterest}`} /></dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-medium text-ink">
              <dt>{t.savingsBase}</dt>
              <dd><Money amount={o.result.base} /></dd>
            </div>
          </dl>
          <p className="text-xs text-ink-2">{t.brackets(o.year)}</p>
        </section>
      )}

      {!irpf && (
        <section className="flex items-start gap-3 rounded-3xl bg-surface p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden="true">
            <Icon name="plane" size={18} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">{t.nonResident}</span>
            <span className="text-[13px] text-ink-2">{o.regime.notes ?? t.irnrDefault}</span>
          </span>
        </section>
      )}

      {o.year === currentYear && (
        <SaleSimulator
          positions={positions.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, value: p.value }))}
          taxable={irpf}
        />
      )}

      {irpf && pendingTotal > 0 && (
        <section className="flex flex-col gap-2 rounded-3xl bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden="true">
              <Icon name="repeat" size={18} />
            </span>
            <span className="flex-1 text-[15px] font-semibold">{t.pendingLosses}</span>
            <Money amount={`-${pendingTotal.toFixed(2)}`} className="text-[15px] font-semibold" />
          </div>
          <ul className="flex flex-col gap-1 ps-[52px] text-[13px] text-ink-2">
            {pending.map((p) => (
              <li key={p.year} className="flex justify-between gap-3">
                <span>{t.pendingItem(p.year, p.expires)}</span>
                <Money amount={`-${p.amount}`} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {o.sales.length > 0 && (
        <section className="flex flex-col rounded-3xl bg-surface px-4 py-1.5">
          <div className="flex items-center justify-between pt-2.5 pb-1">
            <h2 className="text-[17px] font-semibold">{t.realizedSales}</h2>
            <span className="text-[13px] text-ink-2">{t.gainOrLoss}</span>
          </div>
          <ul>
            {o.sales.map((s, i) => (
              <li key={s.tradeId} className={i > 0 ? "border-t border-line" : undefined}>
                <Link href={`/cartera/${s.holdingId}`} className="flex items-center gap-3 py-3">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold tracking-wide"
                  >
                    {badgeText(s)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">
                      {s.name}
                      {s.side === "rights_sale" && <span className="font-normal text-ink-2"> · {t.rights}</span>}
                    </span>
                    <span className="text-[13px] text-ink-2">{saleDetail(s, t, locale)}</span>
                    <span className="text-[13px] text-ink-2">
                      {t.lotsRange(monthYear(s.firstBuy, locale), s.firstBuy === s.lastBuy ? null : monthYear(s.lastBuy, locale))}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <Money
                      amount={s.gain}
                      signed
                      className={`text-[15px] font-semibold ${isNegative(s.gain) ? "text-negative" : "text-positive"}`}
                    />
                    <span className="text-[12px] text-ink-2">
                      {t.sold.before}
                      <Money amount={s.proceeds} noCents />
                      {t.sold.after}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex items-center gap-3 rounded-3xl bg-surface p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2" aria-hidden="true">
          <Icon name="percent" size={18} />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{t.interestAndDividends}</span>
          <span className="text-[13px] text-ink-2">{t.interestFrom(o.year)}</span>
        </span>
        <Money amount={o.interest} className="text-[15px] font-semibold" />
      </section>

      <p className="px-1 text-xs leading-relaxed text-ink-2">{t.costCriteria}</p>
    </>
  );
}
