/**
 * Càlculs orientatius de la base de l'estalvi de l'IRPF (estatal + autonòmic). No substitueixen la
 * declaració: serveixen per veure l'ordre de magnitud i simular vendes. Tot amb big.js (mai float).
 */
import Big from "big.js";

type Bracket = { upTo: number | null; rate: number };

/** Trams de la base de l'estalvi (tipus total, estatal + autonòmic) per any. */
export function savingsBrackets(year: number): Bracket[] {
  if (year >= 2025)
    return [
      { upTo: 6_000, rate: 19 },
      { upTo: 50_000, rate: 21 },
      { upTo: 200_000, rate: 23 },
      { upTo: 300_000, rate: 27 },
      { upTo: null, rate: 30 },
    ];
  if (year >= 2023)
    return [
      { upTo: 6_000, rate: 19 },
      { upTo: 50_000, rate: 21 },
      { upTo: 200_000, rate: 23 },
      { upTo: 300_000, rate: 27 },
      { upTo: null, rate: 28 },
    ];
  if (year >= 2021)
    return [
      { upTo: 6_000, rate: 19 },
      { upTo: 50_000, rate: 21 },
      { upTo: 200_000, rate: 23 },
      { upTo: null, rate: 26 },
    ];
  return [
    { upTo: 6_000, rate: 19 },
    { upTo: 50_000, rate: 21 },
    { upTo: null, rate: 23 },
  ];
}

/** Impost sobre una base de l'estalvi positiva, aplicant els trams progressivament. */
export function savingsTax(base: string, year: number): string {
  let remaining = new Big(base);
  if (remaining.lte(0)) return "0.00";
  let tax = new Big(0);
  let floor = new Big(0);
  for (const b of savingsBrackets(year)) {
    const width = b.upTo === null ? remaining : new Big(b.upTo).minus(floor);
    const taxed = remaining.lt(width) ? remaining : width;
    tax = tax.plus(taxed.times(b.rate).div(100));
    remaining = remaining.minus(taxed);
    if (b.upTo !== null) floor = new Big(b.upTo);
    if (remaining.lte(0)) break;
  }
  return tax.round(2).toFixed(2);
}

/** Quant impost afegeix `extra` de guany a una base que ja és `base` (negatiu: quant en treu). */
export function marginalTax(base: string, extra: string, year: number): string {
  const before = savingsTax(Big(base).lt(0) ? "0" : base, year);
  const afterBase = new Big(base).plus(extra);
  const after = savingsTax(afterBase.lt(0) ? "0" : afterBase.toString(), year);
  return new Big(after).minus(before).toFixed(2);
}

export type YearInput = {
  year: number;
  regime: "irpf" | "irnr";
  /** Saldo net de guanys i pèrdues de l'any (vendes). */
  net: string;
  /** Interessos i dividends de l'any (rendiments del capital mobiliari, positius). */
  interest: string;
};

export type YearResult = {
  year: number;
  regime: "irpf" | "irnr";
  net: string;
  interest: string;
  /** Pèrdues d'anys anteriors compensades amb els guanys d'aquest any. */
  carriedApplied: string;
  /** Part de la pèrdua de l'any compensada amb interessos (fins al 25 % dels interessos). */
  offsetAgainstInterest: string;
  /** Base de l'estalvi estimada i impost estimat (només IRPF). */
  base: string | null;
  tax: string | null;
  /** Pèrdues pendents després d'aquest any, amb l'últim any en què es poden compensar. */
  pending: Array<{ year: number; amount: string; expires: number }>;
};

/**
 * Compensació simplificada de la base de l'estalvi (art. 49 LIRPF):
 * - El saldo negatiu de l'any es compensa amb fins al 25 % dels interessos de l'any; la resta passa als
 *   4 anys següents i es compensa amb saldos positius, primer les pèrdues més antigues.
 * - Els anys d'IRNR (no resident) queden fora: ni generen pèrdues compensables ni en consumeixen.
 */
export function compensate(years: YearInput[]): YearResult[] {
  const sorted = [...years].sort((a, b) => a.year - b.year);
  let pending: Array<{ year: number; amount: Big }> = [];
  const out: YearResult[] = [];
  for (const y of sorted) {
    const net = new Big(y.net);
    const interest = new Big(y.interest).lt(0) ? new Big(0) : new Big(y.interest);
    if (y.regime !== "irpf") {
      out.push({ ...y, carriedApplied: "0.00", offsetAgainstInterest: "0.00", base: null, tax: null, pending: snapshot(pending) });
      continue;
    }
    pending = pending.filter((p) => p.year >= y.year - 4 && p.amount.gt(0));
    let gains = net.gt(0) ? net : new Big(0);
    let carriedApplied = new Big(0);
    for (const p of pending) {
      if (gains.lte(0)) break;
      const used = p.amount.lt(gains) ? p.amount : gains;
      p.amount = p.amount.minus(used);
      gains = gains.minus(used);
      carriedApplied = carriedApplied.plus(used);
    }
    let offset = new Big(0);
    if (net.lt(0)) {
      const loss = net.abs();
      const cap = interest.times(0.25);
      offset = loss.lt(cap) ? loss : cap;
      const rest = loss.minus(offset);
      if (rest.gt(0)) pending.push({ year: y.year, amount: rest });
    }
    pending = pending.filter((p) => p.amount.gt(0));
    const base = gains.plus(interest.minus(offset));
    out.push({
      ...y,
      carriedApplied: carriedApplied.toFixed(2),
      offsetAgainstInterest: offset.toFixed(2),
      base: base.toFixed(2),
      tax: savingsTax(base.toString(), y.year),
      pending: snapshot(pending),
    });
  }
  return out;
}

function snapshot(pending: Array<{ year: number; amount: Big }>) {
  return pending.map((p) => ({ year: p.year, amount: p.amount.toFixed(2), expires: p.year + 4 }));
}
