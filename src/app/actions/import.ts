"use server";

import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db";
import { categories, conceptAliases, transactions } from "@/db/schema";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { conceptKey, tidyConcept } from "@/lib/concepts";

const kind = z.enum(["income", "expense", "investment"]);

const categoriesInput = z
  .array(
    z.object({
      ref: z.string().min(1).max(200),
      name: z.string().trim().min(1).max(40),
      target: z.discriminatedUnion("type", [
        z.object({ type: z.literal("existing"), id: z.uuid() }),
        z.object({ type: z.literal("new"), kind }),
      ]),
    }),
  )
  .max(300);

export type ImportCategories = { ok: true; categories: Record<string, { id: string; kind: z.infer<typeof kind> }> } | { ok: false; error: string };

/**
 * Primer pas de la importació: comprova les categories existents triades i crea les noves (si ja n'hi ha una amb el
 * mateix nom, es fa servir aquella). Torna, per a cada categoria del full, l'id i el tipus.
 */
export async function prepareImportCategories(input: z.input<typeof categoriesInput>): Promise<ImportCategories> {
  const user = await requireUser();
  const m = await getMessages();
  const parsed = categoriesInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: m.common.errors.invalid };
  try {
    const result = await withRls(user, async (tx) => {
      const toCreate = parsed.data.filter((c) => c.target.type === "new");
      if (toCreate.length > 0) {
        const [last] = await tx
          .select({ sort: sql<number>`coalesce(max(${categories.sortOrder}), 0)` })
          .from(categories);
        await tx
          .insert(categories)
          .values(
            toCreate.map((c, i) => ({
              name: c.name,
              kind: c.target.type === "new" ? c.target.kind : "expense",
              sortOrder: Number(last?.sort ?? 0) + (i + 1) * 10,
            })),
          )
          .onConflictDoNothing();
      }
      // Poques files i només les de l'usuari (RLS): es llegeixen totes.
      const rows = await tx.select({ id: categories.id, name: categories.name, kind: categories.kind }).from(categories);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const byName = new Map(rows.map((r) => [r.name, r]));
      const out: Record<string, { id: string; kind: z.infer<typeof kind> }> = {};
      for (const c of parsed.data) {
        const row = c.target.type === "existing" ? byId.get(c.target.id) : byName.get(c.name);
        if (!row) throw new Error("category-not-found");
        out[c.ref] = { id: row.id, kind: row.kind };
      }
      return out;
    });
    revalidatePath("/ajustos/categories");
    return { ok: true, categories: result };
  } catch {
    return { ok: false, error: m.importar.errors.categories };
  }
}

const rowsInput = z
  .array(
    z.object({
      key: z.string().min(1).max(400),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      concept: z.string().trim().min(1),
      amount: z.string().regex(/^-?\d{1,12}\.\d{2}$/),
      categoryId: z.uuid(),
    }),
  )
  .min(1)
  .max(500);

/** UUID estable a partir de l'usuari i la clau de la fila: el mateix moviment importat dues vegades no es duplica. */
function stableId(userId: string, key: string): string {
  const h = createHash("sha256").update(`${userId}:${key}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export type ImportMovements = { ok: true; inserted: number; existing: number } | { ok: false; error: string };

/** Segon pas: desa un lot de moviments (fins a 500). Els que ja hi eren (mateixa clau) no es tornen a afegir. */
export async function importMovements(input: z.input<typeof rowsInput>): Promise<ImportMovements> {
  const user = await requireUser();
  const m = await getMessages();
  const parsed = rowsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: m.common.errors.invalid };
  try {
    const inserted = await withRls(user, async (tx) => {
      // Mateixa escriptura que els conceptes que ja hi ha (o els seus àlies), perquè l'historial no es fragmenti.
      const aliases = await tx.select({ alias: conceptAliases.alias, canonical: conceptAliases.canonical }).from(conceptAliases);
      const existing = await tx.selectDistinct({ concept: transactions.concept }).from(transactions);
      const canonical = new Map<string, string>(existing.map((e) => [conceptKey(e.concept), e.concept]));
      for (const a of aliases) canonical.set(a.alias, a.canonical);
      const values = parsed.data.map((r) => {
        const concept = tidyConcept(r.concept).slice(0, 80);
        return {
          id: stableId(user.sub, r.key),
          date: r.date,
          concept: canonical.get(conceptKey(concept)) ?? concept,
          amount: r.amount,
          categoryId: r.categoryId,
        };
      });
      const rows = await tx.insert(transactions).values(values).onConflictDoNothing({ target: transactions.id }).returning({ id: transactions.id });
      return rows.length;
    });
    revalidatePath("/");
    revalidatePath("/moviments");
    revalidatePath("/any");
    return { ok: true, inserted, existing: parsed.data.length - inserted };
  } catch {
    return { ok: false, error: m.importar.errors.save };
  }
}
