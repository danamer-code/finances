import Big from "big.js";

import { USER_AGENT, type FxProvider, type FxQuote } from "./quotes";

/**
 * Canvi de divisa: tipus de referència oficials del Banc Central Europeu (API pública, sense clau).
 * Es publiquen els dies laborables cap a les 16:00; cada tipus es desa amb la seva data oficial.
 */
export const ecbProvider: FxProvider = {
  name: "bce",
  async fetch(currencies) {
    const list = [...new Set(currencies.map((c) => c.toUpperCase()))].filter((c) => c !== "EUR" && /^[A-Z]{3}$/.test(c));
    if (list.length === 0) return [];
    const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${list.join("+")}.EUR.SP00.A?lastNObservations=1&format=csvdata`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/csv" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`El BCE ha respost ${res.status}`);
    return parseEcbCsv(await res.text());
  },
};

/** El BCE dona "1 EUR = x USD"; l'app desa "1 USD = 1/x EUR" (8 decimals, com la columna). */
export function parseEcbCsv(csv: string): FxQuote[] {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  if (!header) return [];
  const cols = header.split(",");
  const idx = (name: string) => cols.indexOf(name);
  const [cCur, cDenom, cDate, cValue] = [idx("CURRENCY"), idx("CURRENCY_DENOM"), idx("TIME_PERIOD"), idx("OBS_VALUE")];
  if ([cCur, cDenom, cDate, cValue].some((i) => i < 0)) return [];
  const out: FxQuote[] = [];
  for (const row of rows) {
    const f = row.split(",");
    const value = f[cValue];
    if (f[cDenom] !== "EUR" || !/^\d+(\.\d+)?$/.test(value ?? "") || new Big(value).lte(0)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f[cDate] ?? "")) continue;
    out.push({ date: f[cDate], base: f[cCur], quote: "EUR", rate: new Big(1).div(value).round(8).toString() });
  }
  return out;
}
