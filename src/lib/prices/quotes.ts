/**
 * Format comú de les cotitzacions, sigui quina sigui la font. Cada proveïdor diu quines posicions cobreix
 * (per tipus) i retorna preus amb la mateixa forma; canviar de font vol dir escriure un altre proveïdor
 * en aquesta carpeta, i res més de l'app canvia.
 */
import Big from "big.js";

export type HoldingKind = "fund" | "stock" | "crypto";
/** Posició a cotitzar: `key` és el ticker (NASDAQ:MSFT, ETH-EUR) o l'ISIN del fons. */
export type HoldingRef = { key: string; kind: HoldingKind; currency: string };
/** `date`: data del preu segons la font (tancament, valor liquidatiu); si no n'hi ha, el dia del cron. */
export type PriceQuote = { key: string; price: string; currency: string; date?: string };
/** 1 `base` = `rate` `quote` (p. ex. 1 USD = 0,91 EUR), amb la data oficial del tipus. */
export type FxQuote = { date: string; base: string; quote: string; rate: string };

export type PriceProvider = {
  name: string;
  covers: (holding: HoldingRef) => boolean;
  /** `error`: problema que ha aturat la font a mitges (els `quotes` obtinguts fins llavors es desen igualment). */
  fetch: (holdings: HoldingRef[]) => Promise<{ quotes: PriceQuote[]; skipped: string[]; error?: string }>;
};
export type FxProvider = { name: string; fetch: (currencies: string[]) => Promise<FxQuote[]> };

/** Identificador genèric per a les APIs públiques: no porta cap dada de l'usuari. */
export const USER_AGENT = "finances-app/1.0";

/** Accepta números tal com arriben (184.52, "184,52", "1.234,5") i retorna text decimal positiu o null. */
export function toDecimal(value: unknown): string | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? new Big(String(value)).toString() : null;
  if (typeof value !== "string") return null;
  const s = value.trim().replace(/\s|€|\$/g, "");
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const b = new Big(normalized);
  return b.gt(0) ? b.toString() : null;
}

/** Un preu nou que es desvia més d'un 50 % de l'últim desat és sospitós (error de la font o d'unitats). */
export function isSuspicious(previous: string | null, next: string): boolean {
  if (!previous) return false;
  const prev = new Big(previous);
  if (prev.lte(0)) return false;
  return new Big(next).minus(prev).abs().div(prev).gt(0.5);
}
