/**
 * Importació de moviments des d'un CSV (p. ex. una pestanya d'un Google Sheet baixada com a .csv).
 * Tot és pur i s'executa al navegador: el fitxer no surt del dispositiu fins que l'usuari confirma, i llavors només
 * s'envien els moviments ja interpretats a la seva pròpia base de dades.
 *
 * Dues formes de full:
 * - `rows`: una fila per moviment (data, import o ingressos/despeses, concepte i categoria opcionals);
 * - `columns`: una columna per categoria (totals per mes, p. ex.): cada xifra és un moviment d'aquella categoria.
 */
import Big from "big.js";

import { CATEGORY_ROLE_NAMES, type CategoryRole } from "./category-roles";
import { conceptKey } from "./concepts";

// ---------------------------------------------------------------------------------------------------------------
// CSV

/** Separador més probable (coma, punt i coma o tabulador), comptat fora de cometes a les primeres línies. */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  const count = (d: string) =>
    sample.reduce((n, line) => {
      let inQuotes = false;
      let c = 0;
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === d && !inQuotes) c++;
      }
      return n + c;
    }, 0);
  const counts = { ",": count(","), ";": count(";"), "\t": count("\t") };
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as "," | ";" | "\t") ?? ",";
}

/** CSV (RFC 4180): cometes, cometes dobles escapades, salts de línia dins de cometes, CRLF i BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const d = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") inQuotes = true;
    else if (ch === d) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  while (rows.length > 0 && rows[rows.length - 1].every((c) => !c.trim())) rows.pop();
  return rows;
}

/** Fila de títols probable: la primera (de les deu primeres) amb almenys dues cel·les plenes. */
export function guessHeaderRow(rows: string[][]): number {
  const i = rows.slice(0, 10).findIndex((r) => r.filter((c) => c.trim()).length >= 2);
  return i < 0 ? 0 : i;
}

// ---------------------------------------------------------------------------------------------------------------
// Dates

export type DateOrder = "dmy" | "mdy";

const MONTHS: Record<string, number> = {};
const addMonths = (names: string[]) => names.forEach((n, i) => (MONTHS[n] = i + 1));
// Anglès, català, castellà (sencers i abreujats) i hebreu; sense accents.
addMonths(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]);
addMonths(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]);
addMonths(["gener", "febrer", "marc", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"]);
addMonths(["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"]);
addMonths(["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]);
addMonths(["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]);
addMonths(["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]);
MONTHS.sept = 9;
MONTHS.setiembre = 9;

function monthFromName(raw: string): number | null {
  const n = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.'’]/g, "");
  if (MONTHS[n]) return MONTHS[n];
  // Hebreu: «בינואר» (al gener).
  if (n.startsWith("ב") && MONTHS[n.slice(1)]) return MONTHS[n.slice(1)];
  return null;
}

const fullYear = (y: string) => (y.length === 2 ? (Number(y) < 70 ? 2000 : 1900) + Number(y) : Number(y));

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > days) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Data d'una cel·la → «2026-11-23». Si només hi ha mes i any, el dia 1. Formats: 2026-11-23, 23/11/2026 (o 11/23/2026
 * segons `order`), 23.11.26, 11/2026, 2026-11, «23 de novembre de 2026», «November 2026», «Nov 23, 2026», «ינואר 2026».
 */
export function parseDateCell(raw: string, order: DateOrder = "dmy"): string | null {
  const s = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(de|del|d')\s*/gi, "")
    .replace(/\s*(?:[ T]\d{1,2}:\d{2}(?::\d{2})?.*)$/, "");
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return order === "dmy" ? isoDate(fullYear(m[3]), b, a) : isoDate(fullYear(m[3]), a, b);
  }
  m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), 1);
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return isoDate(Number(m[2]), Number(m[1]), 1);
  const word = "([^\\d\\s.,/-]+)\\.?";
  m = s.match(new RegExp(`^${word}[\\s\\-/.,]*'?(\\d{2}|\\d{4})$`, "u"));
  if (m) {
    const month = monthFromName(m[1]);
    return month ? isoDate(fullYear(m[2]), month, 1) : null;
  }
  m = s.match(new RegExp(`^(\\d{1,2})[\\s\\-/.]+${word}[\\s\\-/.,]+(\\d{2}|\\d{4})$`, "u"));
  if (m) {
    const month = monthFromName(m[2]);
    return month ? isoDate(fullYear(m[3]), month, Number(m[1])) : null;
  }
  m = s.match(new RegExp(`^${word}\\s+(\\d{1,2}),?\\s+(\\d{4})$`, "u"));
  if (m) {
    const month = monthFromName(m[1]);
    return month ? isoDate(Number(m[3]), month, Number(m[2])) : null;
  }
  return null;
}

/**
 * Ordre dia/mes de les dates amb barres. Si algun primer número passa de 12, és dia/mes; si ho fa algun segon, és
 * mes/dia. Si cap no ho aclareix, `ambiguous` (per defecte dia/mes, com a Europa i Israel).
 */
export function detectDateOrder(values: string[]): { order: DateOrder; ambiguous: boolean } {
  let dmy = false;
  let mdy = false;
  let slashed = false;
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
    if (!m) continue;
    slashed = true;
    if (Number(m[1]) > 12) dmy = true;
    if (Number(m[2]) > 12) mdy = true;
  }
  if (dmy && !mdy) return { order: "dmy", ambiguous: false };
  if (mdy && !dmy) return { order: "mdy", ambiguous: false };
  return { order: "dmy", ambiguous: slashed };
}

// ---------------------------------------------------------------------------------------------------------------
// Imports

export type ParsedAmount = { abs: string; negative: boolean };

/**
 * Import d'una cel·la: «-12,50 €», «(12.50)», «12.50-», «₪1,234.56», «1.234,56», «12 EUR». Null si és buida, zero o
 * no és un número. El valor absolut va arrodonit a cèntims.
 */
export function parseAmountCell(raw: string): ParsedAmount | null {
  let s = raw
    .trim()
    .replace(/[\s  ‎‏]/g, "")
    .replace(/(EUR|USD|ILS|NIS|GBP|ש["״]ח)/gi, "")
    .replace(/[€$₪£]/g, "");
  if (!s || s === "-") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/^[-−–]/.test(s)) {
    negative = !negative;
    s = s.slice(1);
  } else if (/[-−–]$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  s = s.replace(/^\+/, "");
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    normalized = s.split(decimal === "," ? "." : ",").join("").replace(decimal, ".");
  } else {
    const sep = lastComma >= 0 ? "," : lastDot >= 0 ? "." : null;
    if (!sep) normalized = s;
    else {
      const parts = s.split(sep);
      const thousands = parts.length > 2 || (parts[1].length === 3 && parts[0].length <= 3 && parts[0] !== "0");
      normalized = thousands ? parts.join("") : parts.join(".");
    }
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const abs = new Big(normalized).round(2, Big.roundHalfUp);
  if (abs.eq(0)) return null;
  return { abs: abs.toFixed(2), negative };
}

// ---------------------------------------------------------------------------------------------------------------
// Moviments

/**
 * Signes del full: `positive` = tot en positiu (el tipus el diu la categoria; un negatiu és una devolució);
 * `negativeExpenses` = despeses en negatiu i ingressos en positiu.
 */
export type SignConvention = "positive" | "negativeExpenses";

export type CategoryKind = "income" | "expense" | "investment";

export type Mapping =
  | {
      format: "rows";
      headerRow: number;
      /** Data sencera, o només el mes si la data va repartida en dues columnes (amb `year`). */
      date: number;
      year: number | null;
      /** Una sola columna d'import, o bé dues (ingressos i despeses). */
      amount: number | null;
      income: number | null;
      expense: number | null;
      concept: number | null;
      category: number | null;
      /** Columna amb el tipus (Ingressos / Despeses / Inversions…): decideix el tipus de les categories noves. */
      type: number | null;
      dateOrder: DateOrder;
      signs: SignConvention;
    }
  | { format: "columns"; headerRow: number; date: number; columns: number[]; dateOrder: DateOrder; signs: SignConvention };

export type DraftMovement = {
  /** Clau estable (data, concepte, import, categoria i ordre entre iguals): no es duplica si es torna a importar. */
  key: string;
  /** Número de fila al fitxer (1 = la primera), per als avisos. */
  line: number;
  date: string;
  concept: string;
  /** Nom de la categoria al full; null si el full no en té (va a la categoria per defecte del seu tipus). */
  category: string | null;
  abs: string;
  /** Tipus segons el signe o la columna: `null` quan el full és tot en positiu i el tipus el decideix la categoria. */
  implied: "income" | "expense" | null;
  /** El valor del full anava en sentit contrari a l'habitual (p. ex. una devolució). */
  reversed: boolean;
  /** Tipus segons la columna de tipus del full, si n'hi ha. */
  kindHint: CategoryKind | null;
};

export type SkipReason = "date" | "amount";
export type BuildResult = { movements: DraftMovement[]; skipped: Array<{ line: number; reason: SkipReason }> };

const cell = (row: string[], i: number | null) => (i === null ? "" : (row[i] ?? "").trim());

/** Converteix les files del full en moviments segons la configuració triada. */
export function buildMovements(rows: string[][], map: Mapping, fallbackConcept: string): BuildResult {
  const movements: DraftMovement[] = [];
  const skipped: BuildResult["skipped"] = [];
  const header = rows[map.headerRow] ?? [];
  const seen = new Map<string, number>();
  const push = (m: Omit<DraftMovement, "key">) => {
    const base = [m.date, conceptKey(m.concept), m.abs, m.category ? conceptKey(m.category) : "", m.implied ?? "", m.reversed ? "r" : ""].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    movements.push({ ...m, key: `${base}#${n}` });
  };

  rows.forEach((row, index) => {
    if (index <= map.headerRow || row.every((c) => !c.trim())) return;
    const line = index + 1;
    const rawDate = map.format === "rows" && map.year !== null ? `${cell(row, map.date)} ${cell(row, map.year)}` : cell(row, map.date);
    const date = parseDateCell(rawDate, map.dateOrder);
    if (!date) {
      skipped.push({ line, reason: "date" });
      return;
    }

    if (map.format === "columns") {
      for (const c of map.columns) {
        const amount = parseAmountCell(cell(row, c));
        const name = (header[c] ?? "").trim();
        if (!amount || !name) continue;
        push({ line, date, concept: name, category: name, abs: amount.abs, kindHint: null, ...direction(amount.negative, map.signs) });
      }
      return;
    }

    let amount: ParsedAmount | null = null;
    let fromColumn: "income" | "expense" | null = null;
    if (map.amount !== null) amount = parseAmountCell(cell(row, map.amount));
    else {
      const income = parseAmountCell(cell(row, map.income));
      const expense = parseAmountCell(cell(row, map.expense));
      if (income) [amount, fromColumn] = [income, "income"];
      else if (expense) [amount, fromColumn] = [expense, "expense"];
    }
    if (!amount) {
      skipped.push({ line, reason: "amount" });
      return;
    }
    const category = cell(row, map.category) || null;
    const concept = cell(row, map.concept) || category || fallbackConcept;
    // Amb dues columnes, la columna diu el tipus (i un negatiu hi va al revés).
    const dir = fromColumn
      ? { implied: fromColumn, reversed: amount.negative }
      : direction(amount.negative, map.signs);
    push({ line, date, concept, category, abs: amount.abs, kindHint: parseKindCell(cell(row, map.type)), ...dir });
  });
  return { movements, skipped };
}

function direction(negative: boolean, signs: SignConvention): Pick<DraftMovement, "implied" | "reversed"> {
  if (signs === "negativeExpenses") return { implied: negative ? "expense" : "income", reversed: false };
  return { implied: null, reversed: negative };
}

/**
 * Import amb signe tal com el desa l'app: els ingressos en positiu i la resta en negatiu. Si el moviment anava en
 * sentit contrari al tipus de la seva categoria (una devolució en una de despesa), el signe es gira.
 */
export function signedAmount(m: Pick<DraftMovement, "abs" | "implied" | "reversed">, kind: "income" | "expense" | "investment"): string {
  const type = kind === "income" ? "income" : "expense";
  const against = m.implied ? m.implied !== type : m.reversed;
  const positive = (type === "income") !== against;
  return positive ? m.abs : `-${m.abs}`;
}

/** Convenció de signes probable: si almenys un 20 % dels imports són negatius, les despeses van en negatiu. */
export function guessSigns(rows: string[][], headerRow: number, columns: number[]): SignConvention {
  let total = 0;
  let negatives = 0;
  rows.slice(headerRow + 1).forEach((row) =>
    columns.forEach((c) => {
      const a = parseAmountCell(row[c] ?? "");
      if (!a) return;
      total++;
      if (a.negative) negatives++;
    }),
  );
  return total > 0 && negatives / total >= 0.2 ? "negativeExpenses" : "positive";
}

/** Columnes que semblen d'imports: la majoria de cel·les plenes són números. */
export function numericColumns(rows: string[][], headerRow: number): number[] {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const data = rows.slice(headerRow + 1);
  const result: number[] = [];
  for (let c = 0; c < width; c++) {
    const filled = data.map((r) => (r[c] ?? "").trim()).filter(Boolean);
    if (filled.length === 0) continue;
    const numbers = filled.filter((v) => parseAmountCell(v) !== null || /^[-−–]?0+([.,]0+)?$/.test(v.replace(/[\s€$₪]/g, ""))).length;
    if (numbers / filled.length >= 0.8) result.push(c);
  }
  return result;
}

/** Columna que sembla de dates: la majoria de cel·les plenes s'entenen com a data. */
export function dateColumn(rows: string[][], headerRow: number): number | null {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const data = rows.slice(headerRow + 1);
  for (let c = 0; c < width; c++) {
    const filled = data.map((r) => (r[c] ?? "").trim()).filter(Boolean);
    if (filled.length === 0) continue;
    const order = detectDateOrder(filled).order;
    if (filled.filter((v) => parseDateCell(v, order)).length / filled.length >= 0.8) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Columnes endevinades pels títols, i el full de Finances (pestanya Data)

const HEADER_WORDS = {
  date: ["data", "fecha", "date", "dia", "day", "תאריך"],
  month: ["mes", "month", "חודש"],
  year: ["any", "ano", "year", "שנה"],
  amount: ["import", "valor", "amount", "importe", "cantidad", "quantitat", "total", "value", "סכום"],
  income: ["ingressos", "ingres", "ingresos", "income", "entrades", "הכנסות", "הכנסה"],
  expense: ["despeses", "despesa", "gastos", "gasto", "expenses", "expense", "sortides", "הוצאות", "הוצאה"],
  concept: ["concepte", "concepto", "concept", "descripcio", "descripcion", "description", "detall", "detalle", "nota", "תיאור", "פירוט"],
  category: ["categoria", "category", "קטגוריה"],
  type: ["tipus", "tipo", "type", "סוג"],
} as const;

const KIND_WORDS: Record<CategoryKind, string[]> = {
  income: ["ingressos", "ingres", "ingresos", "ingreso", "income", "הכנסות", "הכנסה"],
  expense: ["despeses", "despesa", "gastos", "gasto", "expenses", "expense", "הוצאות", "הוצאה"],
  investment: ["inversions", "inversio", "inversiones", "inversion", "investments", "investment", "השקעות", "השקעה"],
};

/** «Ingressos», «Gastos», «Investment», «הוצאה»… → tipus de categoria. */
export function parseKindCell(raw: string): CategoryKind | null {
  const k = conceptKey(raw);
  if (!k) return null;
  for (const kind of ["income", "expense", "investment"] as const) if (KIND_WORDS[kind].includes(k)) return kind;
  return null;
}

function findHeader(header: string[], words: readonly string[]): number | null {
  const i = header.findIndex((h) => (words as readonly string[]).includes(conceptKey(h)));
  return i < 0 ? null : i;
}

/** El full de Finances (pestanya Data): Concepte, Valor, Categoria, Mes, Any, Tipus. */
export function isFinancesSheet(header: string[]): boolean {
  const keys = header.map(conceptKey);
  return ["concepte", "valor", "categoria", "mes", "any", "tipus"].every((k) => keys.includes(k));
}

/** Configuració proposada a partir dels títols (i, si no n'hi ha, del contingut de les columnes). */
export function guessMapping(rows: string[][], headerRow: number): Mapping {
  const header = rows[headerRow] ?? [];
  const numeric = numericColumns(rows, headerRow);
  const fullDate = findHeader(header, HEADER_WORDS.date) ?? dateColumn(rows, headerRow);
  const month = findHeader(header, HEADER_WORDS.month);
  const year = findHeader(header, HEADER_WORDS.year);
  const splitDate = fullDate === null && month !== null && year !== null;
  const date = splitDate ? month : (fullDate ?? 0);
  const dateValues = rows.slice(headerRow + 1).map((r) => r[date] ?? "");
  const used = new Set([date, ...(splitDate ? [year] : [])]);
  let amount = findHeader(header, HEADER_WORDS.amount);
  const income = amount === null ? findHeader(header, HEADER_WORDS.income) : null;
  const expense = amount === null ? findHeader(header, HEADER_WORDS.expense) : null;
  if (amount === null && (income === null || expense === null)) amount = numeric.find((c) => !used.has(c)) ?? null;
  const pick = (words: readonly string[]) => {
    const i = findHeader(header, words);
    return i !== null && !used.has(i) ? i : null;
  };
  const amountCols = amount !== null ? [amount] : [income, expense].filter((c): c is number => c !== null);
  return {
    format: "rows",
    headerRow,
    date,
    year: splitDate ? year : null,
    amount,
    income: amount === null ? income : null,
    expense: amount === null ? expense : null,
    concept: pick(HEADER_WORDS.concept),
    category: pick(HEADER_WORDS.category),
    type: pick(HEADER_WORDS.type),
    dateOrder: detectDateOrder(dateValues).order,
    signs: guessSigns(rows, headerRow, amountCols),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Categories

export type ExistingCategory = { id: string; name: string; kind: CategoryKind };
export type CategoryTarget = { type: "existing"; id: string } | { type: "new"; kind: CategoryKind } | { type: "skip" };
export type CategoryPlanItem = {
  /** Clau de la categoria del full (o `__income__`, `__expense__`, `__investment__` per als moviments sense categoria). */
  ref: string;
  /** Nom que tindrà si es crea. */
  name: string;
  count: number;
  target: CategoryTarget;
  /** Per què es proposa no importar-la. */
  note: "snapshot" | null;
};

/** Al full de Finances, aquestes categories són fotos mensuals del valor de la cartera, no moviments. */
const FINANCES_SNAPSHOTS = ["fons", "accions", "coinbase", "cc"];

export const categoryRef = (m: Pick<DraftMovement, "category" | "implied" | "kindHint">) =>
  m.category ? conceptKey(m.category) : `__${m.kindHint ?? m.implied ?? "expense"}__`;

function investmentRole(name: string): CategoryRole | null {
  const k = conceptKey(name);
  if (/fons|fund|קרנ/.test(k)) return "fund";
  if (/accio|stock|share|acciones|מני/.test(k)) return "stock";
  if (/cripto|crypto|coinbase|bitcoin|ethereum|קריפטו/.test(k)) return "crypto";
  return null;
}

/**
 * Proposta de destí per a cada categoria del full: la que ja existeix amb el mateix nom; si no, una de nova del tipus
 * que indica la columna de tipus (o el signe). Al full de Finances, les fotos de la cartera no s'importen i les
 * aportacions a inversions van a la categoria d'inversió que toca.
 */
export function planCategories(
  movements: DraftMovement[],
  existing: ExistingCategory[],
  opts: { financesSheet: boolean; fallbackNames: Record<CategoryKind, string> },
): CategoryPlanItem[] {
  const groups = new Map<string, { name: string | null; count: number; kinds: Record<CategoryKind, number> }>();
  for (const m of movements) {
    const ref = categoryRef(m);
    const g = groups.get(ref) ?? { name: m.category, count: 0, kinds: { income: 0, expense: 0, investment: 0 } };
    g.count++;
    const k = m.kindHint ?? m.implied;
    if (k) g.kinds[k]++;
    groups.set(ref, g);
  }
  const byKey = new Map(existing.map((c) => [conceptKey(c.name), c]));
  const plan: CategoryPlanItem[] = [];
  for (const [ref, g] of groups) {
    const fallbackKind = ref.startsWith("__") ? (ref.slice(2, -2) as CategoryKind) : null;
    const name = g.name ?? opts.fallbackNames[fallbackKind ?? "expense"];
    const counted = (Object.entries(g.kinds) as Array<[CategoryKind, number]>).sort((a, b) => b[1] - a[1]);
    const kind: CategoryKind = fallbackKind ?? (counted[0][1] > 0 ? counted[0][0] : "expense");
    const same = byKey.get(conceptKey(name));
    let target: CategoryTarget;
    let note: CategoryPlanItem["note"] = null;
    if (same) target = { type: "existing", id: same.id };
    else if (opts.financesSheet && FINANCES_SNAPSHOTS.includes(ref)) {
      target = { type: "skip" };
      note = "snapshot";
    } else if (kind === "investment") {
      const role = investmentRole(name);
      const names = role ? CATEGORY_ROLE_NAMES[role].map((n) => n.toLowerCase()) : [];
      const match = existing.find((c) => c.kind === "investment" && names.includes(c.name.toLowerCase()));
      target = match ? { type: "existing", id: match.id } : { type: "new", kind };
    } else target = { type: "new", kind };
    plan.push({ ref, name, count: g.count, target, note });
  }
  return plan.sort((a, b) => b.count - a.count);
}
