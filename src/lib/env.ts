/**
 * Noms de variables: els nostres (README) o els que crea la integració de Supabase a Vercel.
 * Així l'app funciona tant amb `.env.local` com connectant Supabase des del Marketplace de Vercel.
 */
export const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";

export const supabasePublishableKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

/** Només al servidor: salta la RLS. */
export const supabaseSecretKey = () => process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Cadena de connexió a Postgres, a punt per a postgres-js:
 * - treu el paràmetre `supa=` de la de Vercel (POSTGRES_URL), que Postgres no reconeix;
 * - fora de la base de dades local, exigeix connexió xifrada (Supabase la demana).
 */
export function normalizeDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  url.searchParams.delete("supa");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (!local && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

export function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  return raw ? normalizeDatabaseUrl(raw) : undefined;
}
