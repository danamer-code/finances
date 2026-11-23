import { addDays } from "@/lib/format";

import { toDecimal, USER_AGENT, type HoldingRef, type PriceProvider, type PriceQuote } from "./quotes";

/**
 * Accions i fons: preus de tancament i valors liquidatius d'EODHD (API documentada, clau personal).
 * Pla gratuït: 20 consultes al dia, una per posició; el cron en fa una al dia per a cadascuna.
 * Cada preu es desa amb la seva data (els fons publiquen el valor liquidatiu amb un o dos dies de retard).
 */
export function eodhdProvider(apiKey = process.env.EODHD_API_KEY, today = new Date().toISOString().slice(0, 10)): PriceProvider | null {
  if (!apiKey) return null;
  return {
    name: "eodhd",
    covers: (h) => h.kind !== "crypto" && eodhdSymbol(h) !== null,
    async fetch(holdings) {
      const quotes: PriceQuote[] = [];
      const skipped: string[] = [];
      for (const [i, h] of holdings.entries()) {
        const symbol = eodhdSymbol(h)!;
        const url = `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?fmt=json&from=${addDays(today, -10)}&api_token=${encodeURIComponent(apiKey)}`;
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
          });
          if (res.status === 401 || res.status === 402 || res.status === 429) {
            // Clau incorrecta o consultes del dia esgotades: no té sentit continuar gastant-ne.
            skipped.push(...holdings.slice(i).map((x) => x.key));
            const reason = res.status === 401 ? "clau no vàlida" : "límit de consultes del dia";
            return { quotes, skipped, error: `EODHD ha respost ${res.status} (${reason})` };
          }
          const latest = res.ok ? latestClose(await res.json()) : null;
          if (latest) quotes.push({ key: h.key, price: latest.price, currency: h.currency, date: latest.date });
          else skipped.push(`${h.key} → ${symbol}`);
        } catch {
          skipped.push(`${h.key} → ${symbol}`);
        }
      }
      return { quotes, skipped };
    },
  };
}

/** Prefix de borsa (el dels tickers de l'app, com a Google Finance) → sufix d'EODHD. */
const EXCHANGES: Record<string, string> = {
  BME: "MC",
  AMS: "AS",
  ETR: "XETRA",
  FRA: "F",
  EPA: "PA",
  BIT: "MI",
  LON: "LSE",
  SWX: "SW",
  NASDAQ: "US",
  NYSE: "US",
  NYSEAMERICAN: "US",
  NYSEARCA: "US",
  CVE: "V",
  TSE: "TO",
  TSX: "TO",
};

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

/**
 * Símbol d'EODHD d'una posició: els fons per ISIN (`IE00….EUFUND`), les accions amb el sufix de la borsa
 * (`BME:ITX` → `ITX.MC`). Un ticker que ja porta punt (`ABC.TO`) es fa servir tal qual. Null si no se sap.
 */
export function eodhdSymbol(h: Pick<HoldingRef, "key" | "kind">): string | null {
  const key = h.key.trim().toUpperCase();
  if (h.kind === "fund" && ISIN.test(key)) return `${key}.EUFUND`;
  if (/^[A-Z0-9-]+\.[A-Z]+$/.test(key)) return key;
  const m = key.match(/^([A-Z]+):([A-Z0-9.-]+)$/);
  if (!m || !EXCHANGES[m[1]]) return null;
  return `${m[2].replace(/\./g, "-")}.${EXCHANGES[m[1]]}`;
}

/** Últim tancament de la resposta de /api/eod (llista de dies), o null si no n'hi ha cap de vàlid. */
export function latestClose(body: unknown): { date: string; price: string } | null {
  if (!Array.isArray(body)) return null;
  let best: { date: string; price: string } | null = null;
  for (const row of body as Array<{ date?: unknown; close?: unknown }>) {
    const date = typeof row?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : null;
    const price = toDecimal(row?.close);
    if (date && price && (!best || date > best.date)) best = { date, price };
  }
  return best;
}
