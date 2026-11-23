"use client";

import { useState, useTransition } from "react";

import { completeOnboarding } from "@/app/actions/categories";
import { CategoryBadge } from "@/components/category-badge";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/prefs";
import { CATEGORY_TEMPLATE, type StarterKey } from "@/lib/category-style";

const GROUPS = ["expense", "income", "investment"] as const;

export function Onboarding() {
  const m = useMessages();
  const t = m.benvinguda;
  // Per clau (no pel nom): si l'usuari canvia d'idioma, la selecció es manté.
  const [selected, setSelected] = useState(() => new Set<StarterKey>(CATEGORY_TEMPLATE.filter((c) => c.checked).map((c) => c.key)));
  // Null = el nom per defecte, que segueix l'idioma triat fins que l'usuari l'edita.
  const [accountName, setAccountName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (key: StarterKey) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const submit = () =>
    startTransition(async () => {
      const result = await completeOnboarding({
        categories: CATEGORY_TEMPLATE.filter((c) => selected.has(c.key)).map(({ key, kind, icon, color }) => ({
          name: t.starter[key],
          kind,
          icon,
          color,
        })),
        accountName: accountName ?? t.defaultAccount,
      });
      if (result && !result.ok) setError(result.error);
    });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {GROUPS.map((kind) => (
        <section key={kind} className="flex flex-col gap-2">
          <h2 className="px-1 text-[15px] font-semibold">{m.ajustos.kinds[kind].plural}</h2>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_TEMPLATE.filter((c) => c.kind === kind).map((c) => {
              const on = selected.has(c.key);
              const name = t.starter[c.key];
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(c.key)}
                  className={`relative flex flex-col items-center gap-2 rounded-[20px] px-2 pt-4 pb-3 text-center transition ${on ? "bg-surface ring-2 ring-accent" : "bg-surface opacity-55"}`}
                >
                  {on && (
                    <span className="absolute top-2 end-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink">
                      <Icon name="check" size={13} strokeWidth={2.6} />
                    </span>
                  )}
                  <CategoryBadge category={{ name, icon: c.icon, color: c.color }} size={44} />
                  <span className="line-clamp-2 [overflow-wrap:anywhere] hyphens-auto text-[13px] leading-tight font-medium">{name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold">{t.accountLabel}</span>
        <input
          value={accountName ?? t.defaultAccount}
          onChange={(e) => setAccountName(e.target.value)}
          maxLength={40}
          required
          className="h-14 rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || selected.size === 0}
        className="h-14 rounded-full bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50"
      >
        {pending ? t.preparing : t.start(selected.size)}
      </button>
    </form>
  );
}
