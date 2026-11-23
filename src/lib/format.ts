/**
 * Format de moneda i dates segons l'idioma i la divisa de l'usuari (per defecte, català i euros).
 * Els imports arriben com a text de Postgres (`numeric`): es formaten amb operacions de text, sense passar
 * per `number`, perquè mai hi hagi errors de coma flotant.
 */
import { CURRENCY_SYMBOLS, type Currency, type Locale } from "@/i18n/config";

export type FormatPrefs = { locale?: Locale; currency?: Currency };

/** Separadors i posició del símbol: català «1.234,56 €», anglès «€1,234.56», hebreu «1,234.56 ₪». */
const NUMBER_STYLE: Record<Locale, { group: string; decimal: string; symbolFirst: boolean }> = {
  ca: { group: ".", decimal: ",", symbolFirst: false },
  en: { group: ",", decimal: ".", symbolFirst: true },
  he: { group: ",", decimal: ".", symbolFirst: false },
};

export type MoneyParts = {
  /** «−», «+» o res. En hebreu porta davant una marca LRM perquè el signe quedi enganxat a l'esquerra del número. */
  sign: string;
  /** Símbol abans del número (anglès): «€». */
  prefix: string;
  integer: string;
  /** Decimals amb el separador i, si va darrere, el símbol: «,50 €». */
  decimals: string;
};

/** "−1234.5" → { sign: "−", prefix: "", integer: "1.234", decimals: ",50 €" } */
export function moneyParts(amount: string | null | undefined, opts: { signed?: boolean } & FormatPrefs = {}): MoneyParts {
  const style = NUMBER_STYLE[opts.locale ?? "ca"];
  const symbol = CURRENCY_SYMBOLS[opts.currency ?? "EUR"];
  const raw = (amount ?? "0").trim();
  const negative = raw.startsWith("-");
  const [intPart, decPart = ""] = raw.replace(/^[-+]/, "").split(".");
  const integer = (intPart.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, style.group);
  const digits = (decPart + "00").slice(0, 2);
  const isZero = /^0*(\.0*)?$/.test(raw.replace(/^[-+]/, ""));
  const bare = negative && !isZero ? "−" : opts.signed && !isZero ? "+" : "";
  // Com fa Intl en hebreu: amb la marca LRM, el signe i les xifres formen un sol tros d'esquerra a dreta.
  const sign = bare && opts.locale === "he" ? `\u200e${bare}` : bare;
  return style.symbolFirst
    ? { sign, prefix: symbol, integer, decimals: `${style.decimal}${digits}` }
    : { sign, prefix: "", integer, decimals: `${style.decimal}${digits} ${symbol}` };
}

/**
 * Aïlla un tros que s'ha de llegir d'esquerra a dreta («+27 %») dins d'un text en hebreu, perquè el signe quedi
 * enganxat a l'esquerra de la xifra i no salti a l'altra banda. En català i anglès no hi fa res.
 */
export function ltrIsolate(text: string, locale?: Locale): string {
  return locale === "he" ? `\u2066${text}\u2069` : text;
}

export function formatMoney(amount: string | null | undefined, opts: { signed?: boolean } & FormatPrefs = {}): string {
  const p = moneyParts(amount, opts);
  return `${p.sign}${p.prefix}${p.integer}${p.decimals}`;
}

/** Import sense cèntims (arrodonit a la unitat): «1.235 €», «€1,235». */
export function formatWhole(amount: string | null | undefined, opts: { signed?: boolean } & FormatPrefs = {}): string {
  const raw = (amount ?? "0").trim();
  const negative = raw.startsWith("-");
  const [i, d = "0"] = raw.replace(/^[-+]/, "").split(".");
  const rounded = Number(d.charAt(0) || "0") >= 5 ? (BigInt(i || "0") + BigInt(1)).toString() : i || "0";
  const p = moneyParts(`${negative ? "-" : ""}${rounded}`, opts);
  const style = NUMBER_STYLE[opts.locale ?? "ca"];
  return style.symbolFirst ? `${p.sign}${p.prefix}${p.integer}` : `${p.sign}${p.integer} ${CURRENCY_SYMBOLS[opts.currency ?? "EUR"]}`;
}

/**
 * Converteix el que escriu l'usuari al format de Postgres ("2.50"), en qualsevol idioma: «2,5», «2.5», «1.234,56»,
 * «1,234.56», «12 €», «$12», «₪12». Si hi ha punt i coma, el decimal és l'últim; si només n'hi ha un i el segueixen
 * exactament tres xifres («1.234», «1,234»), és de milers. Null si no és vàlid.
 */
export function parseAmountInput(input: string): string | null {
  const cleaned = input.trim().replace(/[\s€$₪\u200e\u200f]/g, "");
  if (!cleaned) return null;
  let normalized: string;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const group = decimal === "," ? "." : ",";
    normalized = cleaned.split(group).join("").replace(decimal, ".");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const parts = cleaned.split(sep);
    const thousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0].length >= 1 && parts[0].length <= 3;
    normalized = thousands ? parts.join("") : parts.length === 2 ? `${parts[0]}.${parts[1]}` : cleaned;
  } else {
    normalized = cleaned;
  }
  if (!/^\d{1,9}(\.\d{0,2})?$/.test(normalized)) return null;
  const [i, d = ""] = normalized.split(".");
  return `${Number.parseInt(i, 10)}.${(d + "00").slice(0, 2)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Data local (no UTC) en format ISO "yyyy-mm-dd". */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

const MONTHS: Record<Locale, string[]> = {
  ca: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  he: ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"],
};
const WEEKDAYS: Record<Locale, string[]> = {
  ca: ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  he: ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"],
};
const TODAY: Record<Locale, [string, string]> = { ca: ["Avui", "Ahir"], en: ["Today", "Yesterday"], he: ["היום", "אתמול"] };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthName(month: number, locale: Locale = "ca"): string {
  return MONTHS[locale][month - 1];
}

export function weekdayName(weekday: number, locale: Locale = "ca"): string {
  return WEEKDAYS[locale][weekday];
}

/** "2026-11" → "novembre 2026" / "November 2026" */
export function monthLabel(ym: string, locale: Locale = "ca"): string {
  const [y, m] = ym.split("-").map(Number);
  return `${monthName(m, locale)} ${y}`;
}

/** Només català: preposició "de"/"d'" davant del mes ("de novembre", "d'octubre"). */
export function ofMonth(month: number): string {
  const name = monthName(month, "ca");
  return /^[aeiouàèéíòóú]/.test(name) ? `d'${name}` : `de ${name}`;
}

/** Només català: "a l'octubre", "al novembre". */
export function inMonth(month: number): string {
  const name = monthName(month, "ca");
  return /^[aeiouàèéíòóú]/.test(name) ? `a l'${name}` : `al ${name}`;
}

/** Data curta: «1 de novembre», «1 November», «1 בנובמבר». */
export function dayMonth(iso: string, locale: Locale = "ca"): string {
  const [, m, d] = iso.split("-").map(Number);
  if (locale === "ca") return `${d} ${ofMonth(m)}`;
  if (locale === "he") return `${d} ב${monthName(m, "he")}`;
  return `${d} ${monthName(m, "en")}`;
}

/** Etiqueta curta d'un dia per a llistes: "Avui", "Ahir", "Dijous 19", "1 de novembre". */
export function dayLabel(iso: string, today: string, locale: Locale = "ca"): { title: string; subtitle: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = WEEKDAYS[locale][date.getDay()];
  const short = locale === "ca" ? `${weekday.slice(0, 2)}.` : locale === "en" ? weekday.slice(0, 3) : weekday;
  const subtitle = `${short} ${dayMonth(iso, locale)}`;
  if (iso === today) return { title: TODAY[locale][0], subtitle };
  if (iso === addDays(today, -1)) return { title: TODAY[locale][1], subtitle };
  return { title: cap(weekday), subtitle: `${dayMonth(iso, locale)}${y !== Number(today.slice(0, 4)) ? ` ${y}` : ""}` };
}

/** "Diumenge, 22 nov" / "Sunday, 22 Nov" */
export function longToday(iso: string, locale: Locale = "ca"): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = WEEKDAYS[locale][new Date(y, m - 1, d).getDay()];
  if (locale === "he") return `${weekday}, ${d} ב${monthName(m, "he")}`;
  const month = monthName(m, locale).slice(0, 3);
  return `${cap(weekday)}, ${d} ${month}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}
