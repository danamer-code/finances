"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db";
import { recurringRules, transactions } from "@/db/schema";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { tidyConcept } from "@/lib/concepts";
import { parseAmountInput, todayIso } from "@/lib/format";
import { generateRecurring } from "@/lib/recurring";

export type RecurringResult = { ok: true; created: number } | { ok: false; error: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const ruleInput = z.object({
  id: z.uuid().optional(),
  concept: z.string().trim().min(1).max(80),
  categoryId: z.uuid(),
  variable: z.boolean(),
  amount: z.string().optional(),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  startDate: isoDate,
});

function refresh() {
  revalidatePath("/ajustos/recurrents");
  revalidatePath("/");
  revalidatePath("/moviments");
}

export async function saveRecurring(input: z.input<typeof ruleInput>): Promise<RecurringResult> {
  const user = await requireUser();
  const m = await getMessages();
  const errors = m.ajustos.recurring.errors;
  const parsed = ruleInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const byField: Record<string, string> = {
      concept: issue?.code === "too_big" ? errors.conceptTooLong : errors.conceptRequired,
      categoryId: errors.chooseCategory,
      dayOfMonth: errors.dayRange,
      startDate: errors.invalidDate,
    };
    return { ok: false, error: byField[String(issue?.path[0])] ?? m.common.errors.invalid };
  }
  const data = parsed.data;

  let amount: string | null = null;
  if (!data.variable) {
    amount = parseAmountInput(data.amount ?? "");
    if (!amount || amount === "0.00") return { ok: false, error: errors.amountRequired };
  }

  const values = {
    concept: tidyConcept(data.concept),
    categoryId: data.categoryId,
    amount,
    frequency: data.frequency,
    dayOfMonth: data.dayOfMonth,
    startDate: data.startDate,
  };

  try {
    const created = await withRls(user, async (tx) => {
      if (data.id) {
        const updated = await tx.update(recurringRules).set(values).where(eq(recurringRules.id, data.id)).returning({ id: recurringRules.id });
        if (updated.length === 0) throw new Error("not-found");
      } else {
        await tx.insert(recurringRules).values(values);
      }
      // Si la data d'inici ja ha passat, els moviments que toquen apareixen de seguida.
      const result = await generateRecurring(tx, todayIso());
      return result.created;
    });
    refresh();
    return { ok: true, created };
  } catch (e) {
    if (e instanceof Error && e.message === "not-found") return { ok: false, error: errors.notFound };
    return { ok: false, error: m.common.errors.generic };
  }
}

export async function setRecurringActive(id: string, isActive: boolean): Promise<RecurringResult> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: (await getMessages()).ajustos.recurring.errors.invalidRule };
  await withRls(user, (tx) => tx.update(recurringRules).set({ isActive }).where(eq(recurringRules.id, id)));
  refresh();
  return { ok: true, created: 0 };
}

/** Esborra la regla. Els moviments que ja va generar es queden (només perden el vincle). */
export async function deleteRecurring(id: string): Promise<RecurringResult> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: (await getMessages()).ajustos.recurring.errors.invalidRule };
  await withRls(user, async (tx) => {
    await tx.update(transactions).set({ recurringId: null }).where(and(eq(transactions.recurringId, id)));
    await tx.delete(recurringRules).where(eq(recurringRules.id, id));
  });
  refresh();
  return { ok: true, created: 0 };
}
