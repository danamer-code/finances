/**
 * Tests d'integració de seguretat contra el Supabase local (`supabase start`).
 * Comproven que la RLS i les claus foranes compostes aïllen de veritat les dades de cada usuari,
 * tant pel camí de Drizzle (`withRls`) com per l'API pública de Supabase (PostgREST).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { adminDb, withRls } from "@/db";
import { accounts, categories, fxRates, holdings, taxLots, trades, transactions } from "@/db/schema";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

const PASSWORD = "contrasenya-de-test-local";
const run = Date.now();
let userA = "";
let userB = "";

async function createUser(label: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `rls-${label}-${run}@test.local`,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

const as = (sub: string) => <T>(fn: Parameters<typeof withRls<T>>[1]) =>
  withRls({ sub, role: "authenticated" }, fn);

async function apiClientFor(label: string): Promise<SupabaseClient> {
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: `rls-${label}-${run}@test.local`,
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

/** Comprova que la consulta falla amb el codi d'error de Postgres esperat (i no per un altre motiu). */
async function expectPgError(query: Promise<unknown>, code: string) {
  const error = await query.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, "s'esperava que la consulta fallés").not.toBeNull();
  const e = error as { code?: string; cause?: { code?: string } };
  expect(e.cause?.code ?? e.code).toBe(code);
}

const RLS_VIOLATION = "42501";
const FK_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

beforeAll(async () => {
  userA = await createUser("a");
  userB = await createUser("b");
});

afterAll(async () => {
  await adminDb.delete(fxRates).where(eq(fxRates.base, "TST"));
  for (const id of [userA, userB]) if (id) await admin.auth.admin.deleteUser(id);
  await adminDb.$client.end();
});

describe("RLS amb Drizzle (withRls)", () => {
  let categoryA = "";

  test("user_id pren l'usuari autenticat per defecte", async () => {
    const [row] = await as(userA)((tx) =>
      tx.insert(categories).values({ name: "Birra/Cafè/Refresc", kind: "expense" }).returning(),
    );
    categoryA = row.id;
    expect(row.userId).toBe(userA);
  });

  test("cada usuari només veu les seves files", async () => {
    const seenByA = await as(userA)((tx) => tx.select().from(categories));
    const seenByB = await as(userB)((tx) => tx.select().from(categories));
    expect(seenByA.map((c) => c.id)).toContain(categoryA);
    expect(seenByB).toHaveLength(0);
  });

  test("ningú no pot inserir files a nom d'un altre usuari", async () => {
    await expectPgError(
      as(userB)((tx) => tx.insert(categories).values({ userId: userA, name: "Intrusa", kind: "expense" })),
      RLS_VIOLATION,
    );
  });

  test("ningú no pot modificar ni esborrar files d'un altre", async () => {
    const updated = await as(userB)((tx) =>
      tx.update(categories).set({ name: "Canviada" }).where(eq(categories.id, categoryA)).returning(),
    );
    const deleted = await as(userB)((tx) => tx.delete(categories).where(eq(categories.id, categoryA)).returning());
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  test("un usuari no pot apuntar a la categoria d'un altre (FK composta)", async () => {
    await expectPgError(
      as(userB)((tx) =>
        tx.insert(transactions).values({ date: "2026-11-22", concept: "Cafè", amount: "-2.20", categoryId: categoryA }),
      ),
      FK_VIOLATION,
    );
  });

  test("un moviment confirmat necessita import; un de pendent no", async () => {
    await expectPgError(
      as(userA)((tx) =>
        tx.insert(transactions).values({ date: "2026-11-22", concept: "Interessos Banc A", categoryId: categoryA }),
      ),
      CHECK_VIOLATION,
    );

    const [pending] = await as(userA)((tx) =>
      tx
        .insert(transactions)
        .values({ date: "2026-11-22", concept: "Interessos Banc A", categoryId: categoryA, status: "pending" })
        .returning(),
    );
    expect(pending.amount).toBeNull();
  });

  test("les taules fiscals derivades són només de lectura per a l'usuari", async () => {
    const ids = await as(userA)(async (tx) => {
      const [account] = await tx.insert(accounts).values({ name: "Broker", kind: "broker" }).returning();
      const [holding] = await tx
        .insert(holdings)
        .values({ name: "Microsoft", kind: "stock", ticker: "NASDAQ:MSFT", currency: "USD", accountId: account.id })
        .returning();
      const [trade] = await tx
        .insert(trades)
        .values({ holdingId: holding.id, date: "2025-01-28", side: "buy", quantity: "2", amountEur: "836.26" })
        .returning();
      return { trade: trade.id, holding: holding.id };
    });

    await expectPgError(
      as(userA)((tx) =>
        tx.insert(taxLots).values({
          holdingId: ids.holding,
          buyTradeId: ids.trade,
          buyDate: "2025-01-28",
          quantity: "2",
          remainingQty: "2",
          unitCostEur: "418.13",
        }),
      ),
      RLS_VIOLATION,
    );
  });

  test("els tipus de canvi es poden llegir però no escriure", async () => {
    await adminDb.insert(fxRates).values({ date: "2026-11-20", base: "TST", quote: "EUR", rate: "0.9" });
    const rates = await as(userA)((tx) => tx.select().from(fxRates).where(eq(fxRates.base, "TST")));
    expect(rates).toHaveLength(1);
    await expectPgError(
      as(userA)((tx) => tx.insert(fxRates).values({ date: "2026-11-21", base: "TST", quote: "EUR", rate: "1" })),
      RLS_VIOLATION,
    );
  });
});

describe("RLS per l'API pública (clau publicable)", () => {
  test("sense sessió no es veu res", async () => {
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await anon.from("categories").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  test("amb sessió, cada usuari veu només el que és seu", async () => {
    const apiA = await apiClientFor("a");
    const apiB = await apiClientFor("b");
    const { data: dataA, error } = await apiA.from("categories").select("id, name");
    const { data: dataB } = await apiB.from("categories").select("id, name");
    expect(error).toBeNull();
    expect(dataA?.length).toBeGreaterThan(0);
    expect(dataB).toHaveLength(0);
  });
});
