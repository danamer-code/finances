"use server";

import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { withRls } from "@/db";
import { accounts, categories, profiles } from "@/db/schema";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { COLOR_NAMES, ICON_NAMES } from "@/lib/category-style";
import { parseAmountInput } from "@/lib/format";

const categoryInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(["income", "expense", "investment"]),
  icon: z.enum(ICON_NAMES),
  color: z.enum(COLOR_NAMES as [string, ...string[]]),
  monthlyBudget: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  /** Categoria pare (subcategories d'un sol nivell). Null o absent = categoria principal. */
  parentId: z.uuid().nullable().optional(),
});

export type CategoryResult = { ok: true } | { ok: false; error: string };

export async function saveCategory(input: z.input<typeof categoryInput>): Promise<CategoryResult> {
  const user = await requireUser();
  const m = await getMessages();
  const e = m.ajustos.categories.errors;
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "name") return { ok: false, error: issue.code === "too_big" ? e.nameTooLong : e.nameRequired };
    return { ok: false, error: m.common.errors.invalid };
  }
  const data = parsed.data;

  let monthlyBudget: string | null = null;
  if (data.monthlyBudget) {
    monthlyBudget = parseAmountInput(data.monthlyBudget);
    if (!monthlyBudget) return { ok: false, error: e.invalidBudget };
  }

  const result = await withRls(user, async (tx) => {
    const [duplicate] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.name, data.name), data.id ? ne(categories.id, data.id) : undefined));
    if (duplicate) return { ok: false as const, error: e.duplicate };

    const parentId = data.parentId ?? null;
    if (parentId) {
      const [parent] = await tx
        .select({ id: categories.id, kind: categories.kind, parentId: categories.parentId })
        .from(categories)
        .where(eq(categories.id, parentId));
      let kind = data.kind;
      if (data.id) {
        const [current] = await tx.select({ kind: categories.kind }).from(categories).where(eq(categories.id, data.id));
        kind = current?.kind ?? kind;
      }
      if (!parent || parent.id === data.id) return { ok: false as const, error: e.invalidParent };
      if (parent.parentId) return { ok: false as const, error: e.nestedParent };
      if (parent.kind !== kind) return { ok: false as const, error: e.kindMismatch };
      if (data.id) {
        const [child] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.parentId, data.id)).limit(1);
        if (child) return { ok: false as const, error: e.hasChildren };
      }
    }

    if (data.id) {
      // El tipus no es canvia: els imports ja desats tenen el signe del tipus original.
      const updated = await tx
        .update(categories)
        .set({
          name: data.name,
          icon: data.icon,
          color: data.color,
          monthlyBudget: data.kind === "expense" ? monthlyBudget : null,
          isActive: data.isActive ?? true,
          parentId,
        })
        .where(eq(categories.id, data.id))
        .returning({ id: categories.id });
      if (updated.length === 0) return { ok: false as const, error: e.notFound };
    } else {
      const [last] = await tx
        .select({ sortOrder: categories.sortOrder })
        .from(categories)
        .orderBy(desc(categories.sortOrder))
        .limit(1);
      await tx.insert(categories).values({
        name: data.name,
        kind: data.kind,
        icon: data.icon,
        color: data.color,
        monthlyBudget: data.kind === "expense" ? monthlyBudget : null,
        parentId,
        sortOrder: (last?.sortOrder ?? 0) + 1000,
      });
    }
    return { ok: true as const };
  });

  if (result.ok) {
    revalidatePath("/ajustos/categories");
    revalidatePath("/nou");
    revalidatePath("/");
  }
  return result;
}

const onboardingInput = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        kind: z.enum(["income", "expense", "investment"]),
        icon: z.enum(ICON_NAMES),
        color: z.enum(COLOR_NAMES as [string, ...string[]]),
      }),
    )
    .min(1),
  accountName: z.string().trim().min(1).max(40),
});

/** Primer accés: crea les categories triades de la plantilla i el compte principal. */
export async function completeOnboarding(input: z.input<typeof onboardingInput>): Promise<CategoryResult> {
  const user = await requireUser();
  const parsed = onboardingInput.safeParse(input);
  if (!parsed.success) {
    const m = await getMessages();
    const issue = parsed.error.issues[0];
    if (issue?.code === "too_small" && issue.path.length === 1) {
      if (issue.path[0] === "categories") return { ok: false, error: m.benvinguda.errors.noCategories };
      if (issue.path[0] === "accountName") return { ok: false, error: m.benvinguda.errors.noAccountName };
    }
    return { ok: false, error: m.common.errors.invalid };
  }
  const data = parsed.data;

  await withRls(user, async (tx) => {
    const existing = await tx.select({ id: categories.id }).from(categories).limit(1);
    if (existing.length === 0) {
      await tx
        .insert(categories)
        .values(data.categories.map((c, i) => ({ ...c, sortOrder: (i + 1) * 10 })))
        .onConflictDoNothing();
      await tx.insert(accounts).values({ name: data.accountName, kind: "bank" }).onConflictDoNothing();
    }
    await tx
      .insert(profiles)
      .values({ onboardedAt: new Date() })
      .onConflictDoUpdate({ target: profiles.userId, set: { onboardedAt: new Date() } });
  });

  revalidatePath("/");
  redirect("/");
}
