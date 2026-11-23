"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import { CategoryBadge } from "@/components/category-badge";
import { Icon } from "@/components/icon";
import { useMessages, usePrefs } from "@/i18n/prefs";
import type { CategoryKind } from "@/lib/data";
import { categoryTree } from "@/lib/category-tree";
import { moneyParts } from "@/lib/format";

type FormCategory = { id: string; name: string; kind: CategoryKind; icon: string | null; color: string | null; parentId: string | null };

export function EditTransactionForm({
  tx,
  categories,
}: {
  tx: { id: string; date: string; concept: string; amount: string; categoryId: string; notes: string; isGenerated: boolean };
  categories: FormCategory[];
}) {
  const router = useRouter();
  const prefs = usePrefs();
  const m = useMessages();
  const t = m.moviments.detail;
  // L'import es mostra amb el separador decimal de l'idioma («12,50» / «12.50»); parseAmountInput accepta tots dos.
  const decimalSeparator = moneyParts("0", prefs).decimals.charAt(0);
  const [concept, setConcept] = useState(tx.concept);
  const [amount, setAmount] = useState(tx.amount.replace(".", decimalSeparator));
  const [categoryId, setCategoryId] = useState(tx.categoryId);
  const [date, setDate] = useState(tx.date);
  const [notes, setNotes] = useState(tx.notes);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const back = `/moviments?mes=${date.slice(0, 7)}`;

  const save = () =>
    startTransition(async () => {
      const result = await updateTransaction({ id: tx.id, concept, amount, categoryId, date, notes });
      if (!result.ok) return setError(result.error);
      navigator.vibrate?.(10);
      router.push(back);
    });

  const remove = () => {
    if (!confirmDelete) return setConfirmDelete(true);
    startTransition(async () => {
      const result = await deleteTransaction(tx.id);
      if (!result.ok) return setError(result.error ?? t.deleteFailed);
      router.push(back);
    });
  };

  if (tx.isGenerated) {
    return (
      <p className="rounded-3xl bg-surface p-5 text-ink-2">{t.generatedNotice}</p>
    );
  }

  const field = "flex flex-col gap-1.5";
  const input = "h-14 rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none focus:ring-2 focus:ring-accent";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className={field}>
        <span className="text-sm text-ink-2">{t.amount}</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required className={`${input} text-2xl font-semibold`} />
      </label>
      <label className={field}>
        <span className="text-sm text-ink-2">{t.concept}</span>
        <input value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={80} required className={input} />
      </label>
      <label className={field}>
        <span className="text-sm text-ink-2">{t.date}</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} required className={input} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm text-ink-2">{t.category}</legend>
        {(["expense", "income", "investment"] as const).map((kind) => {
          // Cada categoria seguida de les seves subcategories; l'actual, la primera perquè es vegi sense lliscar.
          const list = categoryTree(categories.filter((c) => c.kind === kind))
            .flatMap((n) => [n.category, ...n.children])
            .sort((a, b) => Number(b.id === tx.categoryId) - Number(a.id === tx.categoryId));
          if (list.length === 0) return null;
          return (
            <div key={kind} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium tracking-wide text-ink-3 uppercase">{t.kinds[kind]}</span>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={c.id === categoryId}
                    onClick={() => setCategoryId(c.id)}
                    className={`flex h-11 shrink-0 items-center gap-2 rounded-full pe-3.5 ps-1.5 text-sm font-medium ${c.id === categoryId ? "bg-surface-2 ring-2 ring-accent" : "bg-surface"}`}
                  >
                    <CategoryBadge category={c} size={30} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </fieldset>

      <label className={field}>
        <span className="text-sm text-ink-2">{t.notes}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          className="rounded-2xl bg-surface p-4 text-[15px] text-ink outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="h-14 rounded-full bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50">
        {pending ? m.common.actions.saving : m.common.actions.saveChanges}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className={`flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold ${confirmDelete ? "bg-negative text-[#121212]" : "text-negative"}`}
      >
        <Icon name="trash" size={18} />
        {confirmDelete ? t.tapAgainToDelete : t.deleteMovement}
      </button>
    </form>
  );
}
