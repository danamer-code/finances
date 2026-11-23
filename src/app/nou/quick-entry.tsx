"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { createTransaction } from "@/app/actions/transactions";
import { CategoryBadge } from "@/components/category-badge";
import { Icon } from "@/components/icon";
import type { Prefs } from "@/i18n/config";
import { useMessages, usePrefs } from "@/i18n/prefs";
import { conceptKey } from "@/lib/concepts";
import type { ConceptStat } from "@/lib/data";
import { addDays, dayLabel, formatMoney, moneyParts, parseAmountInput } from "@/lib/format";
import { categoryTree } from "@/lib/category-tree";
import { enqueueTransaction, isNetworkError } from "@/lib/offline-queue";

type Kind = "expense" | "income";
type EntryCategory = { id: string; name: string; kind: Kind; icon: string | null; color: string | null; parentId: string | null };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"] as const;

/**
 * Seccions del full de categories: cada categoria amb subcategories té el seu bloc (la mateixa categoria hi surt
 * com a «General»); les que no en tenen van juntes en un bloc sense títol.
 */
function categorySections(list: EntryCategory[]) {
  const sections: Array<{ key: string; title: string | null; parentId: string | null; items: EntryCategory[] }> = [];
  let loose: EntryCategory[] = [];
  const flush = () => {
    if (loose.length) sections.push({ key: `loose-${sections.length}`, title: null, parentId: null, items: loose });
    loose = [];
  };
  for (const node of categoryTree(list)) {
    if (node.children.length === 0) {
      loose.push(node.category);
      continue;
    }
    flush();
    sections.push({ key: node.category.id, title: node.category.name, parentId: node.category.id, items: [...node.children, node.category] });
  }
  flush();
  return sections;
}

/**
 * Import escrit amb el teclat ("2,5": la coma és sempre el decimal intern) → part escrita + part gris que falta,
 * amb els separadors i el símbol de l'idioma i la divisa: «2,5» + «0 €», «€2.5» + «0», «2.5» + «0 ₪».
 */
function amountDisplay(input: string, prefs: Prefs) {
  const [i, d] = input.split(",");
  const p = moneyParts(`${i || "0"}.${d ?? ""}`, prefs);
  const typed = d === undefined ? 0 : 1 + d.length;
  return { main: `${p.prefix}${p.integer}${p.decimals.slice(0, typed)}`, rest: p.decimals.slice(typed) };
}

export function QuickEntry({
  categories,
  concepts,
  today,
}: {
  categories: EntryCategory[];
  concepts: ConceptStat[];
  today: string;
}) {
  const router = useRouter();
  const prefs = usePrefs();
  const m = useMessages();
  const t = m.nou;
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState<null | "category" | "date">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ label: string; count: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const category = categoryId ? categoryById.get(categoryId) : undefined;

  // --- Conceptes: freqüents, coincidències i el concepte exacte ---------------------
  const key = conceptKey(concept);
  const exact = useMemo(() => (key ? concepts.find((c) => conceptKey(c.concept) === key) : undefined), [concepts, key]);
  const suggestions = useMemo(() => {
    const ofKind = (c: ConceptStat) => categoryById.get(c.lastCategoryId)?.kind === kind;
    if (!key) return concepts.filter(ofKind).slice(0, 8);
    const starts = concepts.filter((c) => conceptKey(c.concept).startsWith(key));
    const contains = concepts.filter((c) => !conceptKey(c.concept).startsWith(key) && conceptKey(c.concept).includes(key));
    return [...starts, ...contains].slice(0, 8);
  }, [concepts, key, kind, categoryById]);

  const pickConcept = (c: ConceptStat) => {
    setConcept(c.concept);
    const last = categoryById.get(c.lastCategoryId);
    if (last) {
      setCategoryId(last.id);
      setKind(last.kind);
    }
    setError(null);
  };

  // --- Teclat -----------------------------------------------------------------------
  const press = useCallback((k: (typeof KEYS)[number]) => {
    setError(null);
    setSaved(null);
    setAmount((current) => {
      if (k === "back") return current.slice(0, -1);
      if (k === ",") return current.includes(",") ? current : `${current || "0"},`;
      const [, decimals] = current.split(",");
      if (decimals !== undefined && decimals.length >= 2) return current;
      if (current.replace(",", "").length >= 8) return current;
      return current === "0" ? k : current + k;
    });
  }, []);

  // A l'ordinador també es pot escriure l'import amb el teclat físic.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === "," || e.key === ".") press(",");
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  // --- Desar ------------------------------------------------------------------------
  const parsedAmount = parseAmountInput(amount);
  const canSave = Boolean(parsedAmount && parsedAmount !== "0.00" && concept.trim() && category);

  const save = (another: boolean) => {
    if (!canSave || !category || !parsedAmount) return;
    setError(null);
    startTransition(async () => {
      const input = { id: crypto.randomUUID(), amount: parsedAmount, concept, categoryId: category.id, date };
      let savedConcept = concept.trim();
      let offline = false;
      try {
        if (!navigator.onLine) throw new TypeError("offline");
        const result = await createTransaction(input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        savedConcept = result.concept;
      } catch (e) {
        // Sense connexió: es desa al mòbil i s'envia sol quan torni (el mateix UUID evita duplicats).
        if (!isNetworkError(e)) {
          setError(m.common.errors.generic);
          return;
        }
        await enqueueTransaction(input);
        offline = true;
      }
      navigator.vibrate?.(12);
      if (another || offline) {
        const label = `${savedConcept} ${formatMoney(parsedAmount, prefs)}${offline ? ` · ${t.savedOnPhone}` : ""}`;
        setSaved((s) => ({ label, count: (s?.count ?? 0) + 1 }));
        setAmount("");
        setConcept("");
        setCategoryId(null);
      } else {
        router.push("/");
      }
    });
  };

  const display = amountDisplay(amount, prefs);
  const decimalSeparator = moneyParts("0", prefs).decimals.charAt(0);
  const visibleCategories = categories.filter((c) => c.kind === kind);
  const dateText = date === today ? t.today : date === addDays(today, -1) ? t.yesterday : dayLabel(date, today, prefs.locale).subtitle;
  const hint =
    key && !exact
      ? suggestions.length && conceptKey(suggestions[0].concept).startsWith(key)
        ? t.exists(suggestions[0].concept)
        : t.newConcept
      : null;

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col gap-3 overflow-hidden px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label={m.common.actions.close} className="flex size-11 items-center justify-center rounded-full bg-surface">
          <Icon name="x" />
        </Link>
        <div role="group" aria-label={t.kind} className="flex rounded-full bg-surface p-1">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                if (category && category.kind !== k) setCategoryId(null);
              }}
              className={`h-9 rounded-full px-4 text-sm font-semibold transition ${kind === k ? "bg-ink text-ground" : "text-ink-2"}`}
            >
              {k === "expense" ? t.expense : t.income}
            </button>
          ))}
        </div>
        <div className="size-11" aria-hidden="true" />
      </header>

      <section className="flex h-[96px] shrink-0 flex-col items-center justify-center gap-1.5">
        <output aria-live="polite" className="text-[60px] leading-none font-semibold tracking-[-0.045em]">
          <span className={amount ? "text-ink" : "text-ink-3"}>{display.main}</span>
          <span className="text-ink-3">{display.rest}</span>
        </output>
        {saved && (
          <span role="status" className="flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-medium text-accent-ink">
            <Icon name="check" size={14} strokeWidth={2.4} />
            {t.saved(saved.label)}
            {saved.count > 1 && ` · ${t.inARow(saved.count)}`}
          </span>
        )}
      </section>

      <label className="flex h-14 shrink-0 items-center gap-2.5 rounded-[18px] bg-surface px-4">
        <Icon name="tag" className="text-ink-2" />
        <span className="sr-only">{t.concept}</span>
        <input
          value={concept}
          onChange={(e) => {
            setConcept(e.target.value);
            setSaved(null);
          }}
          placeholder={t.conceptPlaceholder}
          autoComplete="off"
          enterKeyHint="done"
          maxLength={80}
          className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-3"
        />
        {concept && (
          <button type="button" aria-label={t.clearConcept} onClick={() => setConcept("")} className="text-ink-3">
            <Icon name="x" size={18} />
          </button>
        )}
      </label>

      <div className="flex shrink-0 flex-col gap-1.5">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {suggestions.map((c) => {
            const cat = categoryById.get(c.lastCategoryId);
            const selected = exact?.concept === c.concept;
            return (
              <button
                key={c.concept}
                type="button"
                onClick={() => pickConcept(c)}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full pe-3.5 ps-1.5 text-sm font-medium transition ${selected ? "bg-accent text-accent-ink" : "bg-surface text-ink"}`}
              >
                {cat && <CategoryBadge category={cat} size={28} />}
                {c.concept}
              </button>
            );
          })}
        </div>
        {hint && <span className="text-[13px] text-ink-2">{hint}</span>}
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setSheet("category")}
          className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-[18px] bg-surface pe-3.5 ps-2 text-start"
        >
          {category ? <CategoryBadge category={category} size={36} /> : <span className="flex size-9 items-center justify-center text-ink-2"><Icon name="tag" /></span>}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{category?.name ?? t.pickCategory}</span>
            <span className="text-xs text-ink-2">
              {category && exact && exact.lastCategoryId === category.id ? t.likeLastTime : t.category}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSheet("date")}
          className="flex h-[52px] shrink-0 items-center gap-2 rounded-[18px] bg-surface px-4 text-sm font-semibold"
        >
          <Icon name="calendar" size={18} />
          {dateText}
        </button>
      </div>

      <div className="no-scrollbar -mx-5 flex min-h-9 shrink-0 items-center gap-2 overflow-x-auto px-5">
        {exact && exact.lastAmounts.length > 0 ? (
          <>
            <span className="shrink-0 text-[13px] whitespace-nowrap text-ink-2">{t.lastTimes}</span>
            {exact.lastAmounts.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a.replace(".", ",").replace(/,00$/, ""))}
                className="h-9 shrink-0 rounded-full border-[1.5px] border-line px-3 text-sm font-medium whitespace-nowrap"
              >
                {formatMoney(a, prefs)}
              </button>
            ))}
          </>
        ) : (
          error && (
            <span role="alert" className="text-[13px] text-negative">
              {error}
            </span>
          )
        )}
      </div>

      {/* El teclat numèric sempre d'esquerra a dreta, també en hebreu (com el del mòbil). */}
      <div dir="ltr" className="mt-auto grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "back" ? t.backspace : k === "," ? decimalSeparator : k}
            className="flex h-[60px] items-center justify-center rounded-[20px] bg-surface text-[26px] font-medium transition active:scale-95 active:bg-surface-2"
          >
            {k === "back" ? <Icon name="backspace" size={26} strokeWidth={1.6} /> : k === "," ? decimalSeparator : k}
          </button>
        ))}
      </div>

      {exact && error && (
        <p role="alert" className="text-center text-[13px] text-negative">
          {error}
        </p>
      )}

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={!canSave || pending}
          onClick={() => save(true)}
          className="h-14 flex-1 rounded-full bg-surface-2 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-40"
        >
          {t.saveAndAnother}
        </button>
        <button
          type="button"
          disabled={!canSave || pending}
          onClick={() => save(false)}
          className="h-14 flex-1 rounded-full bg-accent text-[15px] font-semibold text-accent-ink transition active:scale-[0.98] disabled:opacity-40"
        >
          {pending ? m.common.actions.saving : m.common.actions.save}
        </button>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSheet(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={sheet === "category" ? t.pickCategory : t.pickDate}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex max-h-[75dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-ground p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{sheet === "category" ? t.category : t.date}</h2>
              <button type="button" aria-label={m.common.actions.close} onClick={() => setSheet(null)} className="flex size-10 items-center justify-center rounded-full bg-surface">
                <Icon name="x" size={18} />
              </button>
            </div>
            {sheet === "category" ? (
              <>
                {categorySections(visibleCategories).map((section) => (
                  <div key={section.key} className="flex flex-col gap-1.5">
                    {section.title && <span className="px-1 text-xs font-medium tracking-wide text-ink-3 uppercase">{section.title}</span>}
                    <div className="grid grid-cols-3 gap-2">
                      {section.items.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCategoryId(c.id);
                            setSheet(null);
                          }}
                          className={`flex flex-col items-center gap-2 rounded-[20px] p-3 text-center text-[13px] font-medium ${c.id === categoryId ? "bg-surface-2 ring-2 ring-accent" : "bg-surface"}`}
                        >
                          <CategoryBadge category={c} size={44} />
                          <span className="line-clamp-2 [overflow-wrap:anywhere] hyphens-auto">
                            {section.parentId === c.id ? t.general : c.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <Link href="/ajustos/categories" className="text-center text-sm text-ink-2 underline underline-offset-4">
                  {t.manageCategories}
                </Link>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                {[0, -1, -2].map((offset) => {
                  const d = addDays(today, offset);
                  const label = offset === 0 ? t.today : offset === -1 ? t.yesterday : t.dayBeforeYesterday;
                  return (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => {
                        setDate(d);
                        setSheet(null);
                      }}
                      className={`flex h-14 items-center justify-between rounded-[18px] px-4 text-[15px] font-semibold ${d === date ? "bg-surface-2 ring-2 ring-accent" : "bg-surface"}`}
                    >
                      {label}
                      <span className="text-sm font-normal text-ink-2">{dayLabel(d, today, prefs.locale).subtitle}</span>
                    </button>
                  );
                })}
                <label className="flex h-14 items-center justify-between gap-3 rounded-[18px] bg-surface px-4 text-[15px] font-semibold">
                  {t.otherDate}
                  <input
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    className="bg-transparent text-sm font-normal text-ink-2 outline-none"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
