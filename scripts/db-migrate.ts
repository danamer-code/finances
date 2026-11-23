/**
 * Aplica les migracions pendents de `supabase/migrations` a la base de dades.
 *
 * - A Vercel s'executa sol abans de cada build de producció (`npm run build`): qui actualitza la seva còpia de
 *   l'app (GitHub › Sync fork) rep també els canvis de la base de dades, sense cap ordre. En un build local
 *   (`--vercel-only` fora de Vercel) no fa res.
 * - En local, expressament: `npm run db:migrate` (fa servir `DATABASE_URL` de `.env.local`).
 *
 * Fa servir la mateixa taula de control que el CLI de Supabase (`supabase_migrations.schema_migrations`), així que
 * conviu amb `supabase db push` i `supabase db reset`. Cada migració va en una transacció: si en falla una, no
 * queda a mitges, el build s'atura i la versió anterior de l'app continua publicada.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

import { normalizeDatabaseUrl } from "../src/lib/env";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "supabase", "migrations");
const FILE = /^(\d{14})_(.+)\.sql$/;

/**
 * Connexió per als canvis d'esquema. A Supabase, el pooler en mode transacció (port 6543) no manté la sessió:
 * es fa servir el mode sessió (5432) del mateix pooler.
 */
export function migrationUrl(env: Partial<Record<string, string>>): string | null {
  // POSTGRES_URL (pooler, IPv4) abans que POSTGRES_URL_NON_POOLING, que pot ser la connexió directa (només IPv6).
  const raw = env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_URL_NON_POOLING;
  if (!raw) return null;
  const url = new URL(normalizeDatabaseUrl(raw));
  if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") url.port = "5432";
  url.searchParams.delete("pgbouncer");
  return url.toString();
}

/** Migracions del directori, en ordre: `20261122213218_init.sql` → { version, name }. */
export async function migrationFiles(dir = MIGRATIONS_DIR) {
  return (await readdir(dir))
    .map((file) => ({ file, match: FILE.exec(file) }))
    .filter((f): f is { file: string; match: RegExpExecArray } => f.match !== null)
    .map(({ file, match }) => ({ file, version: match[1], name: match[2] }))
    .sort((a, b) => a.version.localeCompare(b.version));
}

async function main() {
  const onVercel = Boolean(process.env.VERCEL);
  if (!onVercel && process.argv.includes("--vercel-only")) return;
  if (onVercel && process.env.VERCEL_ENV !== "production") {
    console.log("db-migrate: desplegament de prova, no es toca la base de dades.");
    return;
  }
  if (!onVercel) {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // Sense .env.local: només les variables de l'entorn.
    }
  }
  const url = migrationUrl(process.env);
  if (!url && onVercel) {
    // Primer desplegament d'una instal·lació nova: Supabase encara no està connectat. Quan ho estigui, el
    // següent desplegament ho crea tot.
    console.warn("db-migrate: encara no hi ha cap base de dades connectada (POSTGRES_URL); no es toca res.");
    return;
  }
  if (!url) throw new Error("db-migrate: falta DATABASE_URL (o POSTGRES_URL de la integració de Supabase).");

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, connect_timeout: 30 });
  try {
    // Un sol build alhora: si se'n solapen dos, el segon espera i ja no troba res pendent.
    await sql`select pg_advisory_lock(hashtext('finances:migrations'))`;
    await sql`create schema if not exists supabase_migrations`;
    await sql`create table if not exists supabase_migrations.schema_migrations (version text not null primary key)`;
    await sql`alter table supabase_migrations.schema_migrations add column if not exists statements text[]`;
    await sql`alter table supabase_migrations.schema_migrations add column if not exists name text`;

    const applied = new Set((await sql<{ version: string }[]>`select version from supabase_migrations.schema_migrations`).map((r) => r.version));
    const pending = (await migrationFiles()).filter((m) => !applied.has(m.version));
    if (pending.length === 0) {
      console.log("db-migrate: la base de dades ja està al dia.");
      return;
    }
    for (const m of pending) {
      const body = await readFile(path.join(MIGRATIONS_DIR, m.file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body).simple();
        await tx`insert into supabase_migrations.schema_migrations (version, name, statements) values (${m.version}, ${m.name}, ${[body]})`;
      });
      console.log(`db-migrate: ✓ ${m.file}`);
    }
  } finally {
    await sql.end();
  }
}

if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith("db-migrate.ts")) {
  main().catch((error: unknown) => {
    console.error(`db-migrate: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
