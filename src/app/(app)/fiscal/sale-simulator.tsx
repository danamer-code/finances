"use client";

import Big from "big.js";
import { useEffect, useRef, useState, useTransition } from "react";

import { simulateSaleAction, type SimulationResult } from "@/app/actions/fiscal";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { CURRENCY_SYMBOLS, LOCALE_TAGS, type Locale } from "@/i18n/config";
import { useMessages, usePrefs } from "@/i18n/prefs";
import { monthName } from "@/lib/format";

type PositionOption = { id: string; name: string; quantity: string; value: string | null };

const monthYear = (iso: string, locale: Locale) => `${monthName(Number(iso.slice(5, 7)), locale)} ${iso.slice(0, 4)}`;

/** Separador decimal per als camps: coma en català, punt en anglès i hebreu (el servidor accepta tots dos). */
const decimalText = (n: Big, locale: Locale) => (locale === "ca" ? n.toString().replace(".", ",") : n.toString());

/** Preu per participació en la divisa base a partir del valor de la posició. */
function unitPrice(p: PositionOption | undefined, locale: Locale): string {
  if (!p?.value || new Big(p.quantity).lte(0)) return "";
  return decimalText(new Big(p.value).div(p.quantity).round(4), locale);
}

const field = "h-14 rounded-2xl bg-surface-2 px-4 text-[17px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent";

export function SaleSimulator({ positions, taxable }: { positions: PositionOption[]; taxable: boolean }) {
  const t = useMessages().fiscal.simulator;
  const { locale, currency } = usePrefs();
  const [holdingId, setHoldingId] = useState(positions[0]?.id ?? "");
  const selected = positions.find((p) => p.id === holdingId);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(unitPrice(positions[0], locale));
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [pending, startTransition] = useTransition();
  const request = useRef(0);

  useEffect(() => {
    if (!holdingId || !quantity.trim() || !price.trim()) return;
    const id = ++request.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const r = await simulateSaleAction({ holdingId, quantity, price });
        if (id === request.current) setResult(r);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [holdingId, quantity, price]);

  if (positions.length === 0) return null;
  const shown = quantity.trim() && price.trim() ? result : null;

  const fieldLabel = "text-sm text-ink-2";

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-4" aria-label={t.title}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink" aria-hidden="true">
          <Icon name="sliders" size={18} />
        </span>
        <span className="flex flex-col">
          <h2 className="text-[17px] font-semibold">{t.title}</h2>
          <span className="text-[13px] text-ink-2">{t.subtitle}</span>
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{t.holding}</span>
        <select
          value={holdingId}
          onChange={(e) => {
            setHoldingId(e.target.value);
            setQuantity("");
            setResult(null);
            setPrice(unitPrice(positions.find((p) => p.id === e.target.value), locale));
          }}
          className={field}
        >
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={fieldLabel}>{t.units}</span>
          <span className="relative flex">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={`${field} w-full min-w-0 pe-[68px]`}
            />
            {selected && (
              <button
                type="button"
                onClick={() => setQuantity(decimalText(new Big(selected.quantity), locale))}
                className="absolute inset-y-2 end-2 rounded-xl bg-surface px-2.5 text-[13px] font-semibold text-ink"
              >
                {t.all}
              </button>
            )}
          </span>
          {selected && (
            <span className="text-xs text-ink-2">
              {t.youHave(Number(selected.quantity).toLocaleString(LOCALE_TAGS[locale], { maximumFractionDigits: 4 }))}
            </span>
          )}
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={fieldLabel}>{t.unitPrice}</span>
          <span className="relative flex">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder={t.decimalPlaceholder}
              className={`${field} w-full min-w-0 pe-9`}
            />
            <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-[17px] text-ink-2">{CURRENCY_SYMBOLS[currency]}</span>
          </span>
          <span className="text-xs text-ink-2">{t.lastKnownPrice}</span>
        </label>
      </div>

      <div aria-live="polite" className={`flex flex-col gap-2 transition-opacity ${pending ? "opacity-60" : ""}`}>
        {shown && !shown.ok && <p className="text-sm font-medium text-negative">{shown.error}</p>}
        {shown?.ok && (
          <div className="flex flex-col gap-2 rounded-2xl bg-accent p-4 text-accent-ink">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] opacity-75">{shown.gain.startsWith("-") ? t.estimatedLoss : t.estimatedGain}</span>
                <Money amount={shown.gain} signed className="text-[30px] font-semibold tracking-tight" centsClassName="opacity-60" />
              </div>
              <span className="text-end text-xs opacity-75">
                {t.fromLots(shown.lots)}
                <br />
                {shown.firstBuy === shown.lastBuy
                  ? monthYear(shown.firstBuy, locale)
                  : t.range(monthYear(shown.firstBuy, locale), monthYear(shown.lastBuy, locale))}
              </span>
            </div>
            <dl className="flex flex-col gap-0.5 border-t border-black/15 pt-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="opacity-75">{t.proceeds}</dt>
                <dd><Money amount={shown.proceeds} centsClassName="opacity-60" /></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="opacity-75">{t.fiscalCost}</dt>
                <dd><Money amount={shown.cost} centsClassName="opacity-60" /></dd>
              </div>
              {taxable && shown.taxDelta !== null && (
                <div className="flex justify-between gap-3 font-semibold">
                  <dt>{shown.taxDelta.startsWith("-") ? t.taxSaved : t.taxExtra}</dt>
                  <dd className="whitespace-nowrap"><Money amount={shown.taxDelta.replace(/^-/, "")} centsClassName="opacity-60" /></dd>
                </div>
              )}
            </dl>
          </div>
        )}
        {!shown && <p className="text-sm text-ink-2">{t.prompt}</p>}
      </div>
    </section>
  );
}
