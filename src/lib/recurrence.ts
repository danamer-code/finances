/**
 * Dates dels moviments recurrents (funcions pures). Un dia 31 en un mes de 30 dies cau l'últim dia del mes.
 */
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";

export type Frequency = "monthly" | "quarterly" | "yearly";
export type RuleDates = { frequency: Frequency; dayOfMonth: number; startDate: string; endDate: string | null };

const STEP: Record<Frequency, number> = { monthly: 1, quarterly: 3, yearly: 12 };
const MAX_ITERATIONS = 1200;

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function dateIn(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}

/** Totes les dates de la regla des de la data d'inici, fins que `stop` digui prou. */
function* allDates(rule: RuleDates): Generator<string> {
  const startYear = Number(rule.startDate.slice(0, 4));
  const startMonth = Number(rule.startDate.slice(5, 7));
  for (let k = 0; k < MAX_ITERATIONS; k++) {
    const index = startMonth - 1 + k * STEP[rule.frequency];
    const date = dateIn(startYear + Math.floor(index / 12), (index % 12) + 1, rule.dayOfMonth);
    if (date < rule.startDate) continue;
    if (rule.endDate && date > rule.endDate) return;
    yield date;
  }
}

/** Dates de la regla a l'interval (after, until]. `after` null = des de l'inici. */
export function occurrences(rule: RuleDates, after: string | null, until: string): string[] {
  const out: string[] = [];
  for (const date of allDates(rule)) {
    if (date > until) break;
    if (after && date <= after) continue;
    out.push(date);
  }
  return out;
}

/** Primera data de la regla a partir de `from` (inclòs), o null si ja ha acabat. */
export function nextOccurrence(rule: RuleDates, from: string): string | null {
  for (const date of allDates(rule)) if (date >= from) return date;
  return null;
}

/**
 * Data d'inici per defecte d'una regla nova: la propera vegada que toca, a partir de demà
 * (si avui ja toca, segurament ja l'has apuntat a mà).
 */
export function defaultStart(dayOfMonth: number, today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const thisMonth = dateIn(year, month, dayOfMonth);
  if (thisMonth > today) return thisMonth;
  return month === 12 ? dateIn(year + 1, 1, dayOfMonth) : dateIn(year, month + 1, dayOfMonth);
}

/** Descripció curta en l'idioma de l'usuari: «Cada mes, el dia 1», «Every month, on day 1». */
export function describeRule(rule: Pick<RuleDates, "frequency" | "dayOfMonth">, locale: Locale = DEFAULT_LOCALE): string {
  return MESSAGES[locale].ajustos.recurring.rule[rule.frequency](rule.dayOfMonth);
}
