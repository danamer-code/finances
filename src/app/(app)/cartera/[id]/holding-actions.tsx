"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteTrade, setPrice } from "@/app/actions/portfolio";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/prefs";

/** Preu a mà: útil fins que el cron de preus estigui configurat, o per a productes sense cotització. */
export function PriceForm({ holdingId, currency, today, current }: { holdingId: string; currency: string; today: string; current: string | null }) {
  const router = useRouter();
  const m = useMessages();
  const t = m.cartera.holding;
  const [price, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2 rounded-3xl bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await setPrice({ holdingId, price, date: today });
          if (!result.ok) return setMessage(result.error ?? t.saveFailed);
          setValue("");
          setMessage(t.priceUpdated);
          router.refresh();
        });
      }}
    >
      <span className="text-sm text-ink-2">{t.lastPrice(current)}</span>
      <div className="flex gap-2">
        <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl bg-surface-2 px-3">
          <span className="sr-only">{t.newPrice}</span>
          <input
            value={price}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder={t.todaysPrice}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
          />
          <span className="text-sm text-ink-2">{currency}</span>
        </label>
        <button type="submit" disabled={!price || pending} className="h-12 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40">
          {m.common.actions.save}
        </button>
      </div>
      {message && (
        <span role="status" className="text-xs text-ink-2">
          {message}
        </span>
      )}
    </form>
  );
}

export function DeleteTradeButton({ id }: { id: string }) {
  const router = useRouter();
  const m = useMessages();
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={confirm ? m.cartera.holding.confirmDeleteTrade : m.cartera.holding.deleteTrade}
      onClick={() => {
        if (!confirm) return setConfirm(true);
        startTransition(async () => {
          const result = await deleteTrade(id);
          if (result.ok) router.refresh();
          setConfirm(false);
        });
      }}
      className={`flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold ${confirm ? "bg-negative text-[#121212]" : "text-ink-2"}`}
    >
      <Icon name="trash" size={16} />
      {confirm && m.common.actions.confirmDelete}
    </button>
  );
}
