"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { importMovements, prepareImportCategories } from "@/app/actions/import";
import { Money } from "@/components/money";
import { useMessages, usePrefs } from "@/i18n/prefs";
import { add } from "@/lib/decimal";
import {
  buildMovements,
  categoryRef,
  detectDateOrder,
  guessMapping,
  guessSigns,
  isFinancesSheet,
  numericColumns,
  parseCsv,
  planCategories,
  signedAmount,
  type CategoryKind,
  type CategoryTarget,
  type ExistingCategory,
  type Mapping,
} from "@/lib/csv-import";
import { dayMonth } from "@/lib/format";

type Status =
  | { type: "idle" }
  | { type: "importing"; done: number; total: number }
  | { type: "done"; inserted: number; existing: number }
  | { type: "error"; message: string };

const BATCH = 500;
const NO_ROWS: string[][] = [];
const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);
const targetValue = (t: CategoryTarget) => (t.type === "existing" ? `existing:${t.id}` : t.type === "new" ? `new:${t.kind}` : "skip");
const parseTarget = (v: string): CategoryTarget =>
  v.startsWith("existing:") ? { type: "existing", id: v.slice(9) } : v.startsWith("new:") ? { type: "new", kind: v.slice(4) as CategoryKind } : { type: "skip" };

/** Ajustos › Importar: tria el CSV, revisa com s'interpreta i importa (en lots, sense duplicar). */
export function ImportFlow({ categories }: { categories: Array<ExistingCategory & { isActive: boolean }> }) {
  const m = useMessages();
  const t = m.importar;
  const { locale } = usePrefs();
  const router = useRouter();
  const [file, setFile] = useState<{ name: string; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [overrides, setOverrides] = useState<Record<string, CategoryTarget>>({});
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [readError, setReadError] = useState<string | null>(null);

  const rows = file?.rows ?? NO_ROWS;
  const header = mapping ? (rows[mapping.headerRow] ?? []) : [];
  const width = Math.max(0, ...rows.map((r) => r.length));
  const financesSheet = mapping ? isFinancesSheet(header) : false;

  const result = useMemo(() => (mapping ? buildMovements(rows, mapping, t.fallbackConcept) : null), [rows, mapping, t.fallbackConcept]);
  const plan = useMemo(
    () =>
      result
        ? planCategories(result.movements, categories, { financesSheet, fallbackNames: t.fallback }).map((p) => ({ ...p, target: overrides[p.ref] ?? p.target }))
        : [],
    [result, categories, financesSheet, t.fallback, overrides],
  );
  const kindOf = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c.kind]));
    return new Map(plan.map((p) => [p.ref, p.target.type === "existing" ? byId.get(p.target.id) : p.target.type === "new" ? p.target.kind : undefined]));
  }, [plan, categories]);
  const included = useMemo(() => (result ? result.movements.filter((mv) => kindOf.get(categoryRef(mv))) : []), [result, kindOf]);
  const summary = useMemo(() => {
    const totals: Record<CategoryKind, string> = { income: "0", expense: "0", investment: "0" };
    let from = "";
    let to = "";
    for (const mv of included) {
      const kind = kindOf.get(categoryRef(mv))!;
      totals[kind] = add(totals[kind], signedAmount(mv, kind));
      if (!from || mv.date < from) from = mv.date;
      if (!to || mv.date > to) to = mv.date;
    }
    return { totals, from, to };
  }, [included, kindOf]);

  async function choose(f: File) {
    setReadError(null);
    setStatus({ type: "idle" });
    setOverrides({});
    try {
      const text = await f.text();
      if (text.startsWith("PK") || text.includes("\u0000")) throw new Error("binary");
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setFile(null);
        setMapping(null);
        setReadError(t.errors.empty);
        return;
      }
      const headerRow = parsed.slice(0, 10).findIndex((r) => r.filter((c) => c.trim()).length >= 2);
      setFile({ name: f.name, rows: parsed });
      setMapping(guessMapping(parsed, Math.max(0, headerRow)));
    } catch {
      setFile(null);
      setMapping(null);
      setReadError(t.errors.read);
    }
  }

  function setFormat(format: Mapping["format"]) {
    if (!mapping || mapping.format === format) return;
    if (format === "rows") return setMapping(guessMapping(rows, mapping.headerRow));
    const columns = numericColumns(rows, mapping.headerRow).filter((c) => c !== mapping.date);
    setMapping({ format, headerRow: mapping.headerRow, date: mapping.date, columns, dateOrder: mapping.dateOrder, signs: guessSigns(rows, mapping.headerRow, columns) });
  }

  async function run() {
    if (!mapping || included.length === 0) return;
    setStatus({ type: "importing", done: 0, total: included.length });
    const wanted = plan.filter((p) => p.target.type !== "skip");
    const prepared = await prepareImportCategories(
      wanted.map((p) => ({ ref: p.ref, name: p.name.slice(0, 40), target: p.target as Exclude<CategoryTarget, { type: "skip" }> })),
    );
    if (!prepared.ok) return setStatus({ type: "error", message: prepared.error });
    let inserted = 0;
    let existing = 0;
    for (let i = 0; i < included.length; i += BATCH) {
      const batch = included.slice(i, i + BATCH).map((mv) => {
        const cat = prepared.categories[categoryRef(mv)];
        return { key: mv.key, date: mv.date, concept: mv.concept, amount: signedAmount(mv, cat.kind), categoryId: cat.id };
      });
      const res = await importMovements(batch);
      if (!res.ok) return setStatus({ type: "error", message: res.error });
      inserted += res.inserted;
      existing += res.existing;
      setStatus({ type: "importing", done: Math.min(i + BATCH, included.length), total: included.length });
    }
    setStatus({ type: "done", inserted, existing });
    router.refresh();
  }

  const select = "h-11 w-full min-w-0 rounded-2xl bg-surface-2 px-3 text-[15px] disabled:opacity-60";
  const busy = status.type === "importing";
  const columnOptions = (allowNone: boolean) => (
    <>
      {allowNone && <option value="">{t.none}</option>}
      {Array.from({ length: width }, (_, i) => (
        <option key={i} value={i}>
          {letter(i)} · {header[i]?.trim() || "…"}
        </option>
      ))}
    </>
  );
  const field = (label: string, value: number | null, onChange: (v: number | null) => void, allowNone = true) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-ink-2">{label}</span>
      <select className={select} disabled={busy} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
        {columnOptions(allowNone)}
      </select>
    </label>
  );
  const update = (patch: Partial<Extract<Mapping, { format: "rows" }>>) =>
    mapping?.format === "rows" && setMapping({ ...mapping, ...patch });

  if (status.type === "done") {
    return (
      <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
        <h2 className="text-xl font-semibold">{t.doneTitle}</h2>
        <p>{t.done(status.inserted)}</p>
        {status.existing > 0 && <p className="text-sm text-ink-2">{t.alreadyThere(status.existing)}</p>}
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/moviments" className="flex h-12 items-center justify-center rounded-full bg-accent font-semibold text-accent-ink">
            {t.seeMovements}
          </Link>
          <button type="button" onClick={() => (setFile(null), setMapping(null), setStatus({ type: "idle" }))} className="h-12 rounded-full bg-surface-2 font-semibold">
            {t.importAnother}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      {!file && (
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          <p>{t.intro}</p>
          <h2 className="pt-1 text-[15px] font-semibold">{t.howTitle}</h2>
          <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-[15px] text-ink-2">
            {t.how.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="text-[13px] text-ink-3">{t.privacy}</p>
        </section>
      )}

      <label className="flex h-12 cursor-pointer items-center justify-center rounded-full bg-accent font-semibold text-accent-ink has-[input:disabled]:opacity-60">
        {file ? t.otherFile : t.chooseFile}
        <input
          type="file"
          accept=".csv,text/csv,.tsv,.txt"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void choose(f);
            e.target.value = "";
          }}
        />
      </label>
      {readError && (
        <p role="alert" className="text-center text-sm text-negative">
          {readError}
        </p>
      )}

      {file && mapping && result && (
        <>
          <p className="truncate text-center text-sm text-ink-2">{file.name}</p>
          {financesSheet && <p className="rounded-2xl bg-accent/15 p-3 text-sm">{t.financesSheet}</p>}

          <Card title={t.setupTitle}>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-ink-2">{t.headerRow}</span>
              <select className={select} disabled={busy} value={mapping.headerRow} onChange={(e) => setMapping(guessMapping(rows, Number(e.target.value)))}>
                {rows.slice(0, 10).map((r, i) => (
                  <option key={i} value={i}>
                    {t.rowLabel(i + 1, r.filter((c) => c.trim()).slice(0, 3).join(", ").slice(0, 40))}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-ink-2">{t.format}</span>
              <select className={select} disabled={busy} value={mapping.format} onChange={(e) => setFormat(e.target.value as Mapping["format"])}>
                <option value="rows">{t.formats.rows}</option>
                <option value="columns">{t.formats.columns}</option>
              </select>
            </label>

            {mapping.format === "rows" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {field(mapping.year !== null ? t.fields.month : t.fields.date, mapping.date, (v) => update({ date: v ?? 0 }), false)}
                  {field(t.fields.year, mapping.year, (v) => update({ year: v }))}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-ink-2">{t.amountMode}</span>
                  <select
                    className={select}
                    disabled={busy}
                    value={mapping.amount !== null ? "single" : "split"}
                    onChange={(e) =>
                      e.target.value === "single"
                        ? update({ amount: mapping.income ?? mapping.expense ?? 0, income: null, expense: null })
                        : update({ amount: null, income: mapping.amount ?? 0, expense: null })
                    }
                  >
                    <option value="single">{t.amountModes.single}</option>
                    <option value="split">{t.amountModes.split}</option>
                  </select>
                </label>
                {mapping.amount !== null ? (
                  field(t.fields.amount, mapping.amount, (v) => update({ amount: v ?? 0 }), false)
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {field(t.fields.income, mapping.income, (v) => update({ income: v }))}
                    {field(t.fields.expense, mapping.expense, (v) => update({ expense: v }))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {field(t.fields.concept, mapping.concept, (v) => update({ concept: v }))}
                  {field(t.fields.category, mapping.category, (v) => update({ category: v }))}
                </div>
                {field(t.fields.type, mapping.type, (v) => update({ type: v }))}
              </>
            ) : (
              <>
                {field(t.fields.date, mapping.date, (v) => setMapping({ ...mapping, date: v ?? 0 }), false)}
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="pb-1 text-sm text-ink-2">{t.columnsLabel}</legend>
                  {Array.from({ length: width }, (_, i) => i)
                    .filter((i) => i !== mapping.date)
                    .map((i) => (
                      <label key={i} className="flex items-center gap-2 text-[15px]">
                        <input
                          type="checkbox"
                          className="size-5 accent-[var(--accent)]"
                          disabled={busy}
                          checked={mapping.columns.includes(i)}
                          onChange={(e) =>
                            setMapping({ ...mapping, columns: e.target.checked ? [...mapping.columns, i].sort((a, b) => a - b) : mapping.columns.filter((c) => c !== i) })
                          }
                        />
                        <span className="truncate">
                          {letter(i)} · {header[i]?.trim() || "…"}
                        </span>
                      </label>
                    ))}
                </fieldset>
              </>
            )}

            {(mapping.format === "columns" || mapping.amount !== null) && (
              <label className="flex flex-col gap-1">
                <span className="text-sm text-ink-2">{t.signs}</span>
                <select className={select} disabled={busy} value={mapping.signs} onChange={(e) => setMapping({ ...mapping, signs: e.target.value as Mapping["signs"] })}>
                  <option value="positive">{t.signModes.positive}</option>
                  <option value="negativeExpenses">{t.signModes.negativeExpenses}</option>
                </select>
              </label>
            )}
            {detectDateOrder(rows.slice(mapping.headerRow + 1).map((r) => r[mapping.date] ?? "")).ambiguous && (
              <label className="flex flex-col gap-1">
                <span className="text-sm text-ink-2">{t.dateOrder}</span>
                <select className={select} disabled={busy} value={mapping.dateOrder} onChange={(e) => setMapping({ ...mapping, dateOrder: e.target.value as Mapping["dateOrder"] })}>
                  <option value="dmy">{t.dateOrders.dmy}</option>
                  <option value="mdy">{t.dateOrders.mdy}</option>
                </select>
              </label>
            )}
          </Card>

          <Card title={t.summaryTitle}>
            {included.length === 0 ? (
              <p className="text-ink-2">{t.nothing}</p>
            ) : (
              <>
                <p className="text-lg font-semibold">
                  {t.count(included.length)}
                  {summary.from && <span className="block text-sm font-normal text-ink-2">{t.range(dayMonthYear(summary.from, locale), dayMonthYear(summary.to, locale))}</span>}
                </p>
                <dl className="flex flex-col gap-1 text-[15px]">
                  {(["income", "expense", "investment"] as const)
                    .filter((k) => summary.totals[k] !== "0")
                    .map((k) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-ink-2">{t.totals[k]}</dt>
                        <dd className="font-semibold">
                          <Money amount={summary.totals[k]} signed />
                        </dd>
                      </div>
                    ))}
                </dl>
              </>
            )}
            {result.skipped.length > 0 && (
              <details className="text-sm text-ink-2">
                <summary className="cursor-pointer">{t.skippedTitle(result.skipped.length)}</summary>
                <ul className="flex flex-col gap-0.5 pt-1.5">
                  {result.skipped.slice(0, 8).map((s) => (
                    <li key={s.line}>{t.line(s.line, t.skipReason[s.reason])}</li>
                  ))}
                  {result.skipped.length > 8 && <li>{t.more(result.skipped.length - 8)}</li>}
                </ul>
              </details>
            )}
          </Card>

          {plan.length > 0 && (
            <Card title={t.categoriesTitle}>
              <p className="text-sm text-ink-2">{t.categoriesHint}</p>
              <ul className="flex flex-col divide-y divide-line">
                {plan.map((p) => (
                  <li key={p.ref} className="flex flex-col gap-1.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-semibold">{p.name}</span>
                      <span className="shrink-0 text-sm text-ink-2">{t.movementsIn(p.count)}</span>
                    </div>
                    <select
                      className={select}
                      disabled={busy}
                      aria-label={p.name}
                      value={targetValue(p.target)}
                      onChange={(e) => setOverrides((o) => ({ ...o, [p.ref]: parseTarget(e.target.value) }))}
                    >
                      <optgroup label={t.targets.existingGroup}>
                        {categories
                          .filter((c) => c.isActive || (p.target.type === "existing" && p.target.id === c.id))
                          .map((c) => (
                            <option key={c.id} value={`existing:${c.id}`}>
                              {c.name} · {m.ajustos.kinds[c.kind].label}
                            </option>
                          ))}
                      </optgroup>
                      <option value="new:expense">{t.targets.newExpense}</option>
                      <option value="new:income">{t.targets.newIncome}</option>
                      <option value="new:investment">{t.targets.newInvestment}</option>
                      <option value="skip">{t.targets.skip}</option>
                    </select>
                    {p.note === "snapshot" && <span className="text-[13px] text-ink-3">{t.snapshotNote}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {included.length > 0 && (
            <Card title={t.previewTitle}>
              <ul className="flex flex-col divide-y divide-line">
                {included.slice(0, 5).map((mv) => {
                  const kind = kindOf.get(categoryRef(mv))!;
                  return (
                    <li key={mv.key} className="flex items-center gap-3 py-2.5">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold">{mv.concept}</span>
                        <span className="truncate text-[13px] text-ink-2">
                          {dayMonthYear(mv.date, locale)} · {plan.find((p) => p.ref === categoryRef(mv))?.name}
                        </span>
                      </span>
                      <Money amount={signedAmount(mv, kind)} signed className={`shrink-0 font-semibold ${kind === "income" ? "text-positive" : ""}`} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {status.type === "error" && (
            <p role="alert" className="text-center text-sm text-negative">
              {status.message}
            </p>
          )}
          <button
            type="button"
            disabled={busy || included.length === 0}
            onClick={() => void run()}
            className="h-12 rounded-full bg-accent font-semibold text-accent-ink disabled:opacity-60"
          >
            {status.type === "importing" ? t.progress(status.done, status.total) : t.importButton(included.length)}
          </button>
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const dayMonthYear = (iso: string, locale: Parameters<typeof dayMonth>[1]) =>
  `${dayMonth(iso, locale)}${locale === "ca" ? " de" : ""} ${iso.slice(0, 4)}`;
