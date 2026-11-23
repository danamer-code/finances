import Big from "big.js";

/**
 * Càlculs amb imports en text (numeric de Postgres) sense passar per coma flotant.
 * Només per a xifres derivades que es mostren (percentatges, mitjanes, sumes de llistes).
 */
const big = (v: string | null | undefined) => new Big(v && v.trim() !== "" ? v : "0");

export const abs = (v: string) => big(v).abs().toFixed(2);
export const add = (...vs: string[]) => vs.reduce((acc, v) => acc.plus(big(v)), new Big(0)).toFixed(2);
export const sub = (a: string, b: string) => big(a).minus(big(b)).toFixed(2);
export const isZero = (v: string) => big(v).eq(0);
export const isNegative = (v: string) => big(v).lt(0);
export const gt = (a: string, b: string) => big(a).gt(big(b));
export const div = (a: string, n: number) => (n === 0 ? "0.00" : big(a).div(n).round(2, Big.roundHalfUp).toFixed(2));

/** Percentatge arrodonit a l'enter (part / total × 100). Null si el total és zero. */
export function percent(part: string, total: string): number | null {
  const t = big(total);
  if (t.eq(0)) return null;
  return Number(big(part).div(t).times(100).round(0, Big.roundHalfUp).toFixed(0));
}

/** Variació percentual respecte al valor anterior. Null si no hi ha valor anterior. */
export function change(current: string, previous: string): number | null {
  const p = big(previous);
  if (p.eq(0)) return null;
  return Number(big(current).minus(p).div(p.abs()).times(100).round(0, Big.roundHalfUp).toFixed(0));
}

/** Fracció 0–1 per dibuixar (geometria, no diners). */
export function ratio(part: string, total: string): number {
  const t = big(total);
  if (t.eq(0)) return 0;
  return Math.max(0, Number(big(part).div(t).toFixed(6)));
}
