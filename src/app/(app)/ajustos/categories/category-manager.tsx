"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveCategory } from "@/app/actions/categories";
import { CategoryBadge } from "@/components/category-badge";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { useMessages } from "@/i18n/prefs";
import { CATEGORY_COLORS, COLOR_NAMES, ICON_NAMES, categoryStyle, type ColorName, type IconName } from "@/lib/category-style";
import { categoryTree } from "@/lib/category-tree";
import type { Category, CategoryKind } from "@/lib/data";

const KINDS: CategoryKind[] = ["expense", "income", "investment"];

type Draft = {
  id?: string;
  name: string;
  kind: CategoryKind;
  icon: IconName;
  color: ColorName;
  monthlyBudget: string;
  isActive: boolean;
  parentId: string | null;
};

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const m = useMessages();
  const t = m.ajustos.categories;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasChildren = (id?: string) => Boolean(id && categories.some((c) => c.parentId === id));

  /** Nova categoria; amb `parent`, una subcategoria que n'hereta el tipus, la icona i el color. */
  const openNew = (parent?: Category) => {
    setError(null);
    const style = parent ? categoryStyle(parent) : null;
    setDraft({
      name: "",
      kind: parent?.kind ?? "expense",
      icon: style?.icon ?? "tag",
      color: style?.colorName ?? "lime",
      monthlyBudget: "",
      isActive: true,
      parentId: parent?.id ?? null,
    });
  };

  const open = (c?: Category) => {
    setError(null);
    if (!c) return openNew();
    const style = categoryStyle(c);
    setDraft({
      id: c.id,
      name: c.name,
      kind: c.kind,
      icon: style.icon,
      color: style.colorName,
      monthlyBudget: c.monthlyBudget ? c.monthlyBudget.replace(".", ",").replace(/,00$/, "") : "",
      isActive: c.isActive,
      parentId: c.parentId,
    });
  };

  const save = (patch: Partial<Draft> = {}) => {
    if (!draft) return;
    const next = { ...draft, ...patch };
    startTransition(async () => {
      const result = await saveCategory({
        id: next.id,
        name: next.name,
        kind: next.kind,
        icon: next.icon,
        color: next.color,
        monthlyBudget: next.monthlyBudget,
        isActive: next.isActive,
        parentId: next.parentId,
      });
      if (!result.ok) return setError(result.error);
      navigator.vibrate?.(10);
      setDraft(null);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => open()}
        className="flex h-14 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-accent-ink"
      >
        <Icon name="plus" size={20} strokeWidth={2.2} />
        {t.newCategory}
      </button>

      {KINDS.map((key) => {
        const tree = categoryTree(categories.filter((c) => c.kind === key));
        if (tree.length === 0) return null;
        return (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="px-1 text-[15px] font-semibold">{m.ajustos.kinds[key].plural}</h2>
            <ul className="flex flex-col gap-2">
              {tree.map(({ category: c, children }) => (
                <li key={c.id} className={`flex flex-col rounded-3xl bg-surface p-1.5 ${c.isActive ? "" : "opacity-45"}`}>
                  <button
                    type="button"
                    onClick={() => open(c)}
                    className="flex items-center gap-3 rounded-[20px] p-2 text-start transition active:bg-surface-2"
                  >
                    <CategoryBadge category={c} size={40} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{c.name}</span>
                      {(c.monthlyBudget || !c.isActive) && (
                        <span className="text-[12px] text-ink-2">
                          {!c.isActive ? t.archived : <>{t.budget} <Money amount={c.monthlyBudget} centsClassName="" /></>}
                        </span>
                      )}
                    </span>
                    <Icon name="chevronRight" className="text-ink-3" />
                  </button>
                  {c.parentId === null && (
                    <div className="flex flex-wrap gap-1.5 px-2 pt-0.5 pb-1.5">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => open(child)}
                          className={`flex h-9 items-center gap-1.5 rounded-full bg-surface-2 pe-3 ps-1 text-[13px] font-medium ${child.isActive ? "" : "opacity-45"}`}
                        >
                          <CategoryBadge category={child} size={28} />
                          {child.name}
                          {child.monthlyBudget && <Money amount={child.monthlyBudget} className="text-ink-2" centsClassName="" noCents />}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => openNew(c)}
                        className="flex h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] text-ink-2"
                      >
                        <Icon name="plus" size={14} />
                        {t.subcategory}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setDraft(null)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label={draft.id ? t.editCategory : t.newCategory}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="mx-auto flex max-h-[88dvh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-t-[28px] bg-ground p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{draft.id ? t.editCategory : t.newCategory}</h2>
              <button type="button" aria-label={m.common.actions.close} onClick={() => setDraft(null)} className="flex size-10 items-center justify-center rounded-full bg-surface">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              <CategoryBadge category={{ name: draft.name, icon: draft.icon, color: draft.color }} size={72} />
              <span className="text-lg font-semibold">{draft.name || t.namePreview}</span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-2">{t.name}</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={40}
                required
                placeholder={t.namePlaceholder}
                className="h-14 rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-2">{t.kind}{draft.id ? t.kindLocked : ""}</span>
              <div role="group" className="flex rounded-full bg-surface p-1">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={Boolean(draft.id)}
                    aria-pressed={draft.kind === k}
                    onClick={() => setDraft({ ...draft, kind: k, parentId: draft.kind === k ? draft.parentId : null })}
                    className={`h-10 flex-1 rounded-full text-sm font-semibold ${draft.kind === k ? "bg-ink text-ground" : "text-ink-2"} disabled:cursor-not-allowed`}
                  >
                    {m.ajustos.kinds[k].label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-2">{t.parent}</span>
              <select
                value={draft.parentId ?? ""}
                disabled={hasChildren(draft.id)}
                onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })}
                className="h-14 rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              >
                <option value="">{t.noParent}</option>
                {categories
                  .filter((c) => c.parentId === null && c.kind === draft.kind && c.id !== draft.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              {hasChildren(draft.id) && (
                <span className="text-xs text-ink-2">{t.hasChildren}</span>
              )}
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-2">{t.color}</span>
              <div className="flex flex-wrap gap-2.5">
                {COLOR_NAMES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={t.colors[color]}
                    aria-pressed={draft.color === color}
                    onClick={() => setDraft({ ...draft, color })}
                    className={`size-10 rounded-full ring-offset-2 ring-offset-ground ${draft.color === color ? "ring-2 ring-ink" : ""}`}
                    style={{ background: CATEGORY_COLORS[color].bg }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-2">{t.icon}</span>
              <div className="grid grid-cols-7 gap-2">
                {ICON_NAMES.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-label={t.icons[icon]}
                    aria-pressed={draft.icon === icon}
                    onClick={() => setDraft({ ...draft, icon })}
                    className={`flex aspect-square items-center justify-center rounded-2xl ${draft.icon === icon ? "bg-accent text-accent-ink" : "bg-surface text-ink"}`}
                  >
                    <Icon name={icon} />
                  </button>
                ))}
              </div>
            </div>

            {draft.kind === "expense" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-2">{t.monthlyBudget}</span>
                <input
                  value={draft.monthlyBudget}
                  onChange={(e) => setDraft({ ...draft, monthlyBudget: e.target.value })}
                  inputMode="decimal"
                  placeholder={t.budgetPlaceholder}
                  className="h-14 rounded-2xl bg-surface px-4 text-[17px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent"
                />
              </label>
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
              <button
                type="button"
                disabled={pending}
                onClick={() => save({ isActive: !draft.isActive })}
                className="flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-ink-2"
              >
                <Icon name="archive" size={18} />
                {draft.isActive ? t.archive : t.restore}
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
