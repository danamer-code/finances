"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls, type Tx } from "@/db";
import { categories, conceptAliases, transactions } from "@/db/schema";
import type { Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { conceptKey, tidyConcept } from "@/lib/concepts";
import { parseAmountInput } from "@/lib/format";

export type ActionResult = { ok: true; id: string; concept: string } | { ok: false; error: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Els missatges d'error no surten de zod: `invalid` els tradueix segons el camp que falla.
const transactionInput = z.object({
  id: z.uuid(),
  amount: z.string(),
  concept: z.string().trim().min(1).max(80),
  categoryId: z.uuid(),
  date: isoDate,
  notes: z.string().trim().max(500).optional(),
});

/**
 * Si ja existeix un concepte equivalent (mateixa clau sense accents ni majúscules, o un àlies),
 * es fa servir l'escriptura existent perquè l'historial no es fragmenti.
 */
async function canonicalConcept(tx: Tx, raw: string): Promise<string> {
  const key = conceptKey(raw);
  const [alias] = await tx
    .select({ canonical: conceptAliases.canonical })
    .from(conceptAliases)
    .where(eq(conceptAliases.alias, key))
    .limit(1);
  if (alias) return alias.canonical;
  const existing = await tx.selectDistinct({ concept: transactions.concept }).from(transactions);
  const match = existing.find((e) => conceptKey(e.concept) === key);
  return match?.concept ?? tidyConcept(raw);
}

/** Import amb signe segons el tipus de categoria: els ingressos sumen, la resta resta. */
async function signedAmount(tx: Tx, categoryId: string, amountInput: string, m: Messages) {
  const amount = parseAmountInput(amountInput);
  if (!amount || amount === "0.00") return { error: m.moviments.errors.amountPositive } as const;
  const [category] = await tx
    .select({ kind: categories.kind })
    .from(categories)
    .where(eq(categories.id, categoryId));
  if (!category) return { error: m.moviments.errors.categoryNotFound } as const;
  return { value: category.kind === "income" ? amount : `-${amount}` } as const;
}

/** Primer error de validació, traduït segons el camp. */
function invalid(error: z.ZodError, m: Messages): ActionResult {
  const issue = error.issues[0];
  const e = m.moviments.errors;
  const byField: Record<string, string> = {
    concept: issue?.code === "too_big" ? e.conceptTooLong : e.conceptRequired,
    categoryId: e.pickCategory,
    date: e.invalidDate,
    notes: e.notesTooLong,
  };
  return { ok: false, error: byField[String(issue?.path[0])] ?? m.common.errors.invalid };
}

export async function createTransaction(input: z.input<typeof transactionInput>): Promise<ActionResult> {
  const user = await requireUser();
  const m = await getMessages();
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, m);
  const data = parsed.data;

  try {
    const result = await withRls(user, async (tx) => {
      const amount = await signedAmount(tx, data.categoryId, data.amount, m);
      if ("error" in amount) return { ok: false as const, error: amount.error! };
      const concept = await canonicalConcept(tx, data.concept);
      // L'id el genera el client: si la petició es repeteix (xarxa lenta, reintent), no es duplica.
      await tx
        .insert(transactions)
        .values({
          id: data.id,
          date: data.date,
          concept,
          amount: amount.value,
          categoryId: data.categoryId,
          notes: data.notes || null,
        })
        .onConflictDoNothing({ target: transactions.id });
      return { ok: true as const, id: data.id, concept };
    });
    if (result.ok) {
      revalidatePath("/");
      revalidatePath("/moviments");
    }
    return result;
  } catch {
    return { ok: false, error: m.common.errors.generic };
  }
}

export async function updateTransaction(input: z.input<typeof transactionInput>): Promise<ActionResult> {
  const user = await requireUser();
  const m = await getMessages();
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, m);
  const data = parsed.data;

  try {
    const result = await withRls(user, async (tx) => {
      const [current] = await tx
        .select({ tradeId: transactions.tradeId })
        .from(transactions)
        .where(eq(transactions.id, data.id));
      if (!current) return { ok: false as const, error: m.moviments.errors.notFound };
      if (current.tradeId) {
        return { ok: false as const, error: m.moviments.errors.fromTradeEdit };
      }
      const amount = await signedAmount(tx, data.categoryId, data.amount, m);
      if ("error" in amount) return { ok: false as const, error: amount.error! };
      const concept = await canonicalConcept(tx, data.concept);
      await tx
        .update(transactions)
        .set({
          date: data.date,
          concept,
          amount: amount.value,
          status: "confirmed",
          categoryId: data.categoryId,
          notes: data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, data.id));
      return { ok: true as const, id: data.id, concept };
    });
    if (result.ok) {
      revalidatePath("/");
      revalidatePath("/moviments");
    }
    return result;
  } catch {
    return { ok: false, error: m.common.errors.generic };
  }
}

export async function deleteTransaction(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const m = await getMessages();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: m.moviments.errors.invalidMovement };
  const result = await withRls(user, async (tx) => {
    const [current] = await tx
      .select({ tradeId: transactions.tradeId })
      .from(transactions)
      .where(eq(transactions.id, id));
    if (!current) return { ok: false, error: m.moviments.errors.notFound };
    if (current.tradeId) {
      return { ok: false, error: m.moviments.errors.fromTradeDelete };
    }
    await tx.delete(transactions).where(and(eq(transactions.id, id), isNull(transactions.tradeId)));
    return { ok: true };
  });
  if (!result.ok) return result;
  revalidatePath("/");
  revalidatePath("/moviments");
  return { ok: true };
}
