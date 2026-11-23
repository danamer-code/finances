/** Text curt per a la insígnia d'una posició: el ticker (AAPL, ITX) o les inicials del fons. */
export function badgeText(p: { ticker: string | null; name: string }): string {
  if (p.ticker) return p.ticker.split(":").pop()!.replace("-EUR", "").slice(0, 4);
  return p.name
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ÿ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
