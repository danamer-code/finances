import "server-only";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseUrl } from "@/lib/env";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.pgClient ??
  postgres(databaseUrl() ?? "", {
    // Necessari amb el pooler de Supabase en mode transacció.
    prepare: false,
    max: 5,
  });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

/**
 * Connexió amb privilegis de propietari: **salta la RLS**.
 * Només per a crons, l'script de migració i la regeneració del FIFO, sempre filtrant per usuari.
 * Per a qualsevol dada que vingui d'una petició d'usuari, fes servir `withRls`.
 */
export const adminDb = drizzle({ client, schema, casing: "snake_case" });

export type Db = typeof adminDb;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type JwtClaims = { sub: string; role?: string; email?: string; [key: string]: unknown };

/**
 * Executa `fn` dins d'una transacció amb el rol `authenticated` i les claims del JWT de l'usuari,
 * de manera que Postgres aplica les polítiques RLS igual que si la consulta vingués de l'API.
 */
export function withRls<T>(claims: JwtClaims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return adminDb.transaction(async (tx) => {
    await tx.execute(sql`
      select
        set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
        set_config('request.jwt.claim.sub', ${claims.sub}, true)
    `);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}
