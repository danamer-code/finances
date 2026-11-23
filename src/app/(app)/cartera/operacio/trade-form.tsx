"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createTrade } from "@/app/actions/portfolio";
import { CURRENCY_SYMBOLS, LOCALE_TAGS } from "@/i18n/config";
import { useMessages, usePrefs } from "@/i18n/prefs";

type Side = "buy" | "sell" | "transfer" | "reward";
type Currency = "EUR" | "USD" | "CAD" | "GBP" | "CHF";
const CURRENCIES: Currency[] = ["EUR", "USD", "CAD", "GBP", "CHF"];
type HoldingOption = { id: string; name: string; kind: string; currency: string; quantity: string };

const SIDES: Side[] = ["buy", "sell", "transfer", "reward"];

const NEW = "__nova__";

export function TradeForm({
  holdings,
  accounts,
  today,
  preselected,
}: {
  holdings: HoldingOption[];
  accounts: Array<{ id: string; name: string; kind: string }>;
  today: string;
  preselected?: string;
}) {
  const router = useRouter();
  const m = useMessages();
  const t = m.cartera.form;
  const prefs = usePrefs();
  const symbol = CURRENCY_SYMBOLS[prefs.currency];
  const tag = LOCALE_TAGS[prefs.locale];
  const amountLabel = { buy: t.paidTotal(symbol), sell: t.receivedTotal(symbol), reward: t.rewardValue(symbol) };
  const amountHint = { buy: t.hintBuy, sell: t.hintSell, reward: t.hintReward(m.cartera.currencyNames[prefs.currency]) };
  const [side, setSide] = useState<Side>("buy");
  const [holdingId, setHoldingId] = useState(preselected && holdings.some((h) => h.id === preselected) ? preselected : (holdings[0]?.id ?? NEW));
  const [newHolding, setNewHolding] = useState({ name: "", kind: "stock" as "fund" | "stock" | "crypto", code: "", currency: "EUR" as Currency, accountId: accounts[0]?.id ?? "" });
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [fees, setFees] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [destinationQuantity, setDestinationQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isNew = holdingId === NEW;
  const selected = holdings.find((h) => h.id === holdingId);
  const funds = holdings.filter((h) => h.kind === "fund" && h.id !== holdingId);
  const canSell = side === "sell" || side === "transfer";
  const sellable = holdings.filter((h) => Number(h.quantity) > 0);
  const options = canSell ? sellable : holdings;

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await createTrade({
        side,
        holdingId: isNew ? undefined : holdingId,
        newHolding: isNew ? newHolding : undefined,
        date,
        quantity,
        amountEur: side === "transfer" ? undefined : amount,
        fees: fees || undefined,
        destinationId: side === "transfer" ? destinationId : undefined,
        destinationQuantity: side === "transfer" ? destinationQuantity : undefined,
        notes: notes || undefined,
      });
      if (!result.ok) return setError(result.error);
      navigator.vibrate?.(12);
      router.push(`/cartera/${result.holdingId}`);
    });

  const input = "h-14 rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent";
  const field = "flex flex-col gap-1.5";
  const labelCls = "text-sm text-ink-2";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div role="group" aria-label={t.tradeType} className="grid grid-cols-4 gap-1 rounded-full bg-surface p-1">
        {SIDES.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={side === key}
            onClick={() => {
              setSide(key);
              if ((key === "sell" || key === "transfer") && isNew) setHoldingId(sellable[0]?.id ?? NEW);
            }}
            className={`h-10 rounded-full text-[13px] font-semibold ${side === key ? "bg-ink text-ground" : "text-ink-2"}`}
          >
            {t.sides[key]}
          </button>
        ))}
      </div>

      <label className={field}>
        <span className={labelCls}>{side === "transfer" ? t.sourceFund : t.holding}</span>
        <select value={holdingId} onChange={(e) => setHoldingId(e.target.value)} className={input}>
          {options.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
              {Number(h.quantity) > 0 ? ` · ${Number(h.quantity).toLocaleString(tag, { maximumFractionDigits: 6 })}` : ""}
            </option>
          ))}
          {!canSell && <option value={NEW}>{t.newHoldingOption}</option>}
        </select>
      </label>

      {isNew && !canSell && (
        <fieldset className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
          <legend className="sr-only">{t.newHolding}</legend>
          <label className={field}>
            <span className={labelCls}>{t.name}</span>
            <input value={newHolding.name} onChange={(e) => setNewHolding({ ...newHolding, name: e.target.value })} placeholder={t.namePlaceholder} className={`${input} bg-surface-2`} />
          </label>
          <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
            {(["stock", "fund", "crypto"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={newHolding.kind === k}
                onClick={() => setNewHolding({ ...newHolding, kind: k })}
                className={`h-9 rounded-full text-[13px] font-semibold ${newHolding.kind === k ? "bg-ink text-ground" : "text-ink-2"}`}
              >
                {t.kinds[k]}
              </button>
            ))}
          </div>
          <label className={field}>
            <span className={labelCls}>{t.code}</span>
            <input value={newHolding.code} onChange={(e) => setNewHolding({ ...newHolding, code: e.target.value })} placeholder={t.codePlaceholder} className={`${input} bg-surface-2`} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={field}>
              <span className={labelCls}>{t.currency}</span>
              <select value={newHolding.currency} onChange={(e) => setNewHolding({ ...newHolding, currency: e.target.value as Currency })} className={`${input} bg-surface-2`}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={field}>
              <span className={labelCls}>{t.account}</span>
              <select value={newHolding.accountId} onChange={(e) => setNewHolding({ ...newHolding, accountId: e.target.value })} className={`${input} bg-surface-2`}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className={field}>
          <span className={labelCls}>{side === "transfer" ? t.unitsOut : t.units}</span>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" required placeholder="0" className={input} />
        </label>
        <label className={field}>
          <span className={labelCls}>{t.date}</span>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className={input} />
        </label>
      </div>
      {selected && canSell && (
        <span className="-mt-2 text-xs text-ink-2">
          {t.youHave(Number(selected.quantity).toLocaleString(tag, { maximumFractionDigits: 8 }))}
        </span>
      )}

      {side === "transfer" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className={field}>
            <span className={labelCls}>{t.destinationFund}</span>
            <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} required className={input}>
              <option value="">{t.choose}</option>
              {funds.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className={labelCls}>{t.unitsIn}</span>
            <input value={destinationQuantity} onChange={(e) => setDestinationQuantity(e.target.value)} inputMode="decimal" required placeholder="0" className={input} />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className={side === "reward" ? "grid grid-cols-1" : "grid grid-cols-2 gap-2"}>
            <label className={field}>
              <span className={labelCls}>{amountLabel[side]}</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required placeholder={t.decimalPlaceholder} className={`${input} min-w-0`} />
            </label>
            {side !== "reward" && (
              <label className={field}>
                <span className={labelCls}>{t.fees(symbol)}</span>
                <input value={fees} onChange={(e) => setFees(e.target.value)} inputMode="decimal" placeholder={t.decimalPlaceholder} className={`${input} min-w-0`} />
              </label>
            )}
          </div>
          <span className="text-xs text-ink-2">{amountHint[side]}</span>
        </div>
      )}
      {side === "transfer" && (
        <span className="-mt-2 text-xs text-ink-2">{t.transferNote}</span>
      )}

      <label className={field}>
        <span className={labelCls}>{t.notes}</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className={input} />
      </label>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="h-14 rounded-full bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50">
        {pending ? m.common.actions.saving : t.submit}
      </button>
    </form>
  );
}
