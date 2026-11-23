"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveBalances } from "@/app/actions/balances";
import { Money } from "@/components/money";
import { useMessages, usePrefs } from "@/i18n/prefs";
import type { AccountBalance } from "@/lib/balances";
import { dayMonth } from "@/lib/format";

const toInput = (amount: string | null) => (amount ? amount.replace("-", "−").replace(".", ",").replace(/,00$/, "") : "");

export function BalancesForm({ accounts, today }: { accounts: AccountBalance[]; today: string }) {
  const router = useRouter();
  const m = useMessages();
  const t = m.ajustos.balances;
  const { locale } = usePrefs();
  const kindLabels: Record<string, string> = t.kinds;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map((a) => [a.id, toInput(a.balance)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveBalances({ entries: accounts.map((a) => ({ accountId: a.id, balance: values[a.id] ?? "" })) });
      if (!result.ok) return setError(result.error);
      navigator.vibrate?.(10);
      setSaved(result.saved);
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="px-1 text-sm text-ink-2">{t.intro}</p>

      <ul className="flex flex-col divide-y divide-line rounded-3xl bg-surface">
        {accounts.map((a) => {
          const fresh = a.date !== null && a.date.slice(0, 7) === today.slice(0, 7);
          return (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <label htmlFor={`balance-${a.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold">{a.name}</span>
                <span className="text-[13px] text-ink-2">
                  {kindLabels[a.kind] ?? a.kind}
                  {a.date && a.balance !== null && (
                    <>
                      {" · "}
                      <span className={fresh ? "" : "font-medium text-ink"}>
                        {dayMonth(a.date, locale)}: <Money amount={a.balance} centsClassName="" />
                      </span>
                    </>
                  )}
                </span>
              </label>
              <input
                id={`balance-${a.id}`}
                value={values[a.id] ?? ""}
                onChange={(e) => {
                  setSaved(null);
                  setValues({ ...values, [a.id]: e.target.value });
                }}
                inputMode="decimal"
                placeholder="—"
                className="h-12 w-32 shrink-0 rounded-2xl bg-surface-2 px-3 text-end text-[17px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent"
              />
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      {saved !== null && (
        <p role="status" className="text-sm text-ink-2">
          {t.saved(saved)}
        </p>
      )}

      <button type="submit" disabled={pending} className="h-14 rounded-full bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50">
        {pending ? m.common.actions.saving : t.submit}
      </button>
    </form>
  );
}
