"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteRecurring, saveRecurring, setRecurringActive } from "@/app/actions/recurring";
import { CategoryBadge } from "@/components/category-badge";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { useMessages, usePrefs } from "@/i18n/prefs";
import type { Category } from "@/lib/data";
import { dayMonth, formatMoney } from "@/lib/format";
import { defaultStart, describeRule, type Frequency } from "@/lib/recurrence";
import type { RecurringRule, RecurringSuggestion } from "@/lib/recurring";

const FREQUENCIES: Frequency[] = ["monthly", "quarterly", "yearly"];

type Draft = {
  id?: string;
  concept: string;
  categoryId: string;
  variable: boolean;
  amount: string;
  frequency: Frequency;
  dayOfMonth: string;
  startDate: string;
  isActive: boolean;
};

const input = "h-14 rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent";
const toInput = (amount: string | null) => (amount ? amount.replace(".", ",").replace(/,00$/, "") : "");
const signed = (amount: string, kind: string) => (kind === "income" ? amount : `-${amount}`);

export function RecurringManager({
  rules,
  suggestions,
  categories,
  today,
}: {
  rules: RecurringRule[];
  suggestions: RecurringSuggestion[];
  categories: Category[];
  today: string;
}) {
  const router = useRouter();
  const m = useMessages();
  const t = m.ajustos.recurring;
  const prefs = usePrefs();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(categories.map((c) => [c.id, c]));

  const open = (d: Partial<Draft>) => {
    setError(null);
    setConfirmDelete(false);
    const day = d.dayOfMonth ?? String(Number(today.slice(8, 10)));
    setDraft({
      concept: "",
      categoryId: categories.find((c) => c.kind === "expense")?.id ?? categories[0]?.id ?? "",
      variable: false,
      amount: "",
      frequency: "monthly",
      startDate: defaultStart(Number(day), today),
      isActive: true,
      ...d,
      dayOfMonth: day,
    });
  };

  const run = (action: () => Promise<{ ok: true; created: number } | { ok: false; error: string }>, message?: (n: number) => string | null) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setError(result.error);
      navigator.vibrate?.(10);
      setNotice(message?.(result.created) ?? null);
      setDraft(null);
      router.refresh();
    });

  const save = () => {
    if (!draft) return;
    run(
      () =>
        saveRecurring({
          id: draft.id,
          concept: draft.concept,
          categoryId: draft.categoryId,
          variable: draft.variable,
          amount: draft.amount,
          frequency: draft.frequency,
          dayOfMonth: draft.dayOfMonth,
          startDate: draft.startDate,
        }),
      (n) => (n === 0 ? null : t.created(n)),
    );
  };

  const active = rules.filter((r) => r.isActive);
  const paused = rules.filter((r) => !r.isActive);

  return (
    <>
      <p className="px-1 text-sm text-ink-2">{t.intro}</p>

      <button
        type="button"
        onClick={() => open({})}
        className="flex h-14 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-accent-ink"
      >
        <Icon name="plus" size={20} strokeWidth={2.2} />
        {t.newRule}
      </button>

      {notice && (
        <p role="status" className="rounded-2xl bg-surface px-4 py-3 text-sm">
          {notice}
        </p>
      )}

      {active.length > 0 && <RuleList title={t.active} rules={active} onOpen={(r) => open(fromRule(r))} />}

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] font-semibold">{t.suggestions}</h2>
            <span className="text-[13px] text-ink-2">{t.suggestionsRange}</span>
          </div>
          <ul className="flex flex-col divide-y divide-line rounded-3xl bg-surface">
            {suggestions.map((s) => {
              const category = byId.get(s.categoryId);
              return (
                <li key={`${s.concept}-${s.categoryId}`} className="flex items-center gap-3 px-4 py-3">
                  {category && <CategoryBadge category={category} size={40} />}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{s.concept}</span>
                    <span className="text-[13px] text-ink-2">
                      {t.suggestionDetail(s.months, s.dayOfMonth)}
                      {s.amount ? <Money amount={s.amount} centsClassName="" /> : t.variableAmount}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      open({
                        concept: s.concept,
                        categoryId: category ? s.categoryId : undefined,
                        variable: s.amount === null,
                        amount: toInput(s.amount),
                        dayOfMonth: String(s.dayOfMonth),
                      })
                    }
                    className="h-10 shrink-0 rounded-full bg-surface-2 px-4 text-sm font-semibold"
                  >
                    {m.common.actions.add}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {paused.length > 0 && <RuleList title={t.paused} rules={paused} onOpen={(r) => open(fromRule(r))} dim />}

      {rules.length === 0 && suggestions.length === 0 && (
        <p className="rounded-3xl bg-surface p-4 text-sm text-ink-2">
          {t.empty}
        </p>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setDraft(null)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label={draft.id ? t.editRule : t.newRule}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="mx-auto flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-ground p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{draft.id ? t.editRule : t.newRule}</h2>
              <button type="button" aria-label={m.common.actions.close} onClick={() => setDraft(null)} className="flex size-10 items-center justify-center rounded-full bg-surface">
                <Icon name="x" size={18} />
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-2">{t.concept}</span>
              <input
                value={draft.concept}
                onChange={(e) => setDraft({ ...draft, concept: e.target.value })}
                maxLength={80}
                required
                placeholder={t.conceptPlaceholder}
                className={input}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-2">{t.category}</span>
              <select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })} className={input}>
                <optgroup label={m.ajustos.kinds.expense.plural}>
                  {categories.filter((c) => c.kind === "expense").map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
                <optgroup label={m.ajustos.kinds.income.plural}>
                  {categories.filter((c) => c.kind === "income").map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-2">{t.amount}</span>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={draft.variable}
                    onChange={(e) => setDraft({ ...draft, variable: e.target.checked })}
                    className="size-5 accent-[var(--accent)]"
                  />
                  {t.varies}
                </label>
              </div>
              {draft.variable ? (
                <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-ink-2">
                  {t.variableHint}
                </p>
              ) : (
                <input
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  inputMode="decimal"
                  placeholder={formatMoney("0", prefs)}
                  aria-label={t.amount}
                  className={input}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-2">{t.frequency}</span>
              <div role="group" className="flex rounded-full bg-surface p-1">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={draft.frequency === f}
                    onClick={() => setDraft({ ...draft, frequency: f })}
                    className={`h-10 flex-1 rounded-full text-sm font-semibold ${draft.frequency === f ? "bg-ink text-ground" : "text-ink-2"}`}
                  >
                    {t.frequencies[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-2">{t.dayOfMonth}</span>
                <input
                  value={draft.dayOfMonth}
                  onChange={(e) => {
                    const day = e.target.value.replace(/\D/g, "").slice(0, 2);
                    const n = Number(day);
                    setDraft({ ...draft, dayOfMonth: day, startDate: !draft.id && n >= 1 && n <= 31 ? defaultStart(n, today) : draft.startDate });
                  }}
                  inputMode="numeric"
                  required
                  className={`${input} min-w-0`}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-2">{t.starts}</span>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => e.target.value && setDraft({ ...draft, startDate: e.target.value })}
                  className={`${input} min-w-0`}
                />
              </label>
            </div>
            {draft.startDate <= today && (
              <p className="-mt-2 text-xs text-ink-2">
                {t.pastStart}
              </p>
            )}

            {error && (
              <p role="alert" className="text-sm text-negative">
                {error}
              </p>
            )}

            <button type="submit" disabled={pending} className="h-14 rounded-full bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50">
              {pending ? m.common.actions.saving : draft.id ? m.common.actions.saveChanges : t.create}
            </button>
            {draft.id && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setRecurringActive(draft.id!, !draft.isActive))}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-surface text-sm font-semibold"
                >
                  <Icon name={draft.isActive ? "archive" : "repeat"} size={18} />
                  {draft.isActive ? t.pause : t.resume}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => (confirmDelete ? run(() => deleteRecurring(draft.id!)) : setConfirmDelete(true))}
                  className={`flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold ${confirmDelete ? "bg-negative text-ground" : "bg-surface text-negative"}`}
                >
                  <Icon name="trash" size={18} />
                  {confirmDelete ? m.common.actions.confirmDelete : m.common.actions.delete}
                </button>
              </div>
            )}
            {draft.id && confirmDelete && (
              <p className="-mt-2 text-xs text-ink-2">{t.deleteNote}</p>
            )}
          </form>
        </div>
      )}
    </>
  );
}

function fromRule(r: RecurringRule): Partial<Draft> {
  return {
    id: r.id,
    concept: r.concept,
    categoryId: r.categoryId,
    variable: r.amount === null,
    amount: toInput(r.amount),
    frequency: r.frequency,
    dayOfMonth: String(r.dayOfMonth),
    startDate: r.startDate,
    isActive: r.isActive,
  };
}

function RuleList({ title, rules, onOpen, dim = false }: { title: string; rules: RecurringRule[]; onOpen: (r: RecurringRule) => void; dim?: boolean }) {
  const t = useMessages().ajustos.recurring;
  const { locale } = usePrefs();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[15px] font-semibold">{title}</h2>
      <ul className={`flex flex-col divide-y divide-line rounded-3xl bg-surface ${dim ? "opacity-60" : ""}`}>
        {rules.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
              <CategoryBadge category={{ name: r.categoryName, icon: r.categoryIcon, color: r.categoryColor, kind: r.categoryKind }} size={40} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold">{r.concept}</span>
                <span className="text-[13px] text-ink-2">
                  {describeRule(r, locale)}
                  {r.nextDate && t.next(dayMonth(r.nextDate, locale))}
                </span>
              </span>
              {r.amount ? (
                <Money amount={signed(r.amount, r.categoryKind)} signed={r.categoryKind === "income"} className="shrink-0 text-[15px] font-semibold" />
              ) : (
                <span className="shrink-0 text-[13px] font-medium text-ink-2">{t.variable}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
