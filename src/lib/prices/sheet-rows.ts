import { toDecimal, type PriceQuote } from "./quotes";

/**
 * Files del full de preus: [clau, preu, divisa]. La clau és el ticker de la posició (NASDAQ:MSFT) o l'ISIN.
 * Les files que no es poden llegir (#N/A, buides, divisa estranya) es retornen a `skipped`.
 */
export function parseSheetRows(rows: unknown[][]): { quotes: PriceQuote[]; skipped: string[] } {
  const quotes: PriceQuote[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const key = String(row[0] ?? "").trim();
    if (!key) continue;
    const price = toDecimal(row[1]);
    const currency = String(row[2] ?? "EUR").trim().toUpperCase() || "EUR";
    if (!price || !/^[A-Z]{3}$/.test(currency)) {
      skipped.push(key);
      continue;
    }
    quotes.push({ key: key.toUpperCase(), price, currency });
  }
  return { quotes, skipped };
}
