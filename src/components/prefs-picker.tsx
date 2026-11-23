"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updatePrefs } from "@/app/actions/profile";
import { CURRENCIES, CURRENCY_SYMBOLS, isRtl, LOCALE_NAMES, LOCALES, type Currency, type Locale } from "@/i18n/config";
import { useMessages, usePrefs } from "@/i18n/prefs";

/**
 * Selectors d'idioma i de divisa i la pestanya Fiscal (Ajustos i benvinguda). L'hebreu canvia la direcció del text a
 * l'instant. A la benvinguda encara no hi ha imports desats: la divisa es canvia sense l'avís de conversió.
 */
export function PrefsPicker({ confirmCurrency: askBeforeCurrency = true }: { confirmCurrency?: boolean }) {
  const router = useRouter();
  const prefs = usePrefs();
  const m = useMessages();
  const [pending, startTransition] = useTransition();
  const [confirmCurrency, setConfirmCurrency] = useState<Currency | null>(null);

  const apply = (next: { locale?: Locale; currency?: Currency; fiscal?: boolean }) =>
    startTransition(async () => {
      const result = await updatePrefs(next);
      if (!result.ok) return;
      if (next.locale) {
        document.documentElement.lang = next.locale;
        document.documentElement.dir = isRtl(next.locale) ? "rtl" : "ltr";
      }
      setConfirmCurrency(null);
      router.refresh();
    });

  const segment = (active: boolean) =>
    `h-10 flex-1 rounded-full text-sm font-semibold ${active ? "bg-ink text-ground" : "text-ink-2"} disabled:opacity-60`;

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-2">{m.common.prefs.language}</span>
        <div role="group" aria-label={m.common.prefs.language} className="flex rounded-full bg-surface-2 p-1">
          {LOCALES.map((l) => (
            <button key={l} type="button" lang={l} disabled={pending} aria-pressed={prefs.locale === l} onClick={() => apply({ locale: l })} className={segment(prefs.locale === l)}>
              {LOCALE_NAMES[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-2">{m.common.prefs.currency}</span>
        <div role="group" aria-label={m.common.prefs.currency} className="flex rounded-full bg-surface-2 p-1">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={pending}
              aria-pressed={prefs.currency === c}
              onClick={() => c !== prefs.currency && (askBeforeCurrency ? setConfirmCurrency(c) : apply({ currency: c }))}
              className={segment(prefs.currency === c)}
            >
              {CURRENCY_SYMBOLS[c]} {c}
            </button>
          ))}
        </div>
        {confirmCurrency && (
          <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
            <span>{m.common.prefs.currencyWarning}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => apply({ currency: confirmCurrency })} disabled={pending} className="h-10 flex-1 rounded-full bg-accent font-semibold text-accent-ink">
                {CURRENCY_SYMBOLS[confirmCurrency]} {confirmCurrency}
              </button>
              <button type="button" onClick={() => setConfirmCurrency(null)} className="h-10 flex-1 rounded-full bg-surface font-semibold">
                {m.common.actions.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={prefs.fiscal}
        disabled={pending}
        onClick={() => apply({ fiscal: !prefs.fiscal })}
        className="flex items-center gap-3 text-start disabled:opacity-60"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold">{m.common.prefs.fiscal}</span>
          <span className="text-[13px] text-ink-2">{m.common.prefs.fiscalHint}</span>
        </span>
        <span aria-hidden="true" className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${prefs.fiscal ? "bg-accent" : "bg-surface-2"}`}>
          <span className={`size-6 rounded-full shadow transition-transform ${prefs.fiscal ? "bg-accent-ink translate-x-5 rtl:-translate-x-5" : "bg-ink-3"}`} />
        </span>
      </button>
    </div>
  );
}
