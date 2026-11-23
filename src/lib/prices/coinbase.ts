import { toDecimal, USER_AGENT, type PriceProvider } from "./quotes";

/**
 * Cripto: preu spot de l'API pública de Coinbase (documentada, sense clau). És el mateix preu que mostra
 * l'app de Coinbase. El ticker de la posició és el parell, p. ex. "ETH-EUR" (o "ETH", que s'entén en euros).
 */
export const coinbaseProvider: PriceProvider = {
  name: "coinbase",
  covers: (h) => h.kind === "crypto",
  async fetch(holdings) {
    const quotes = [];
    const skipped = [];
    for (const h of holdings) {
      const pair = coinbasePair(h.key);
      try {
        const res = await fetch(`https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/spot`, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        const parsed = res.ok ? parseCoinbaseSpot(await res.json()) : null;
        if (parsed) quotes.push({ key: h.key, ...parsed });
        else skipped.push(h.key);
      } catch {
        skipped.push(h.key);
      }
    }
    return { quotes, skipped };
  },
};

export function coinbasePair(key: string): string {
  const k = key.trim().toUpperCase();
  return k.includes("-") ? k : `${k}-EUR`;
}

export function parseCoinbaseSpot(body: unknown): { price: string; currency: string } | null {
  const data = (body as { data?: { amount?: unknown; currency?: unknown } } | null)?.data;
  const price = toDecimal(data?.amount);
  const currency = typeof data?.currency === "string" ? data.currency.toUpperCase() : null;
  return price && currency && /^[A-Z]{3}$/.test(currency) ? { price, currency } : null;
}
