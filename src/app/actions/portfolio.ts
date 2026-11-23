"use server";

import { randomUUID } from "node:crypto";

import Big from "big.js";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls, type Tx } from "@/db";
import { categories, holdings, prices, trades, transactions } from "@/db/schema";
import { LOCALE_TAGS, LOCALES, type Locale } from "@/i18n/config";
import { MESSAGES, type Messages } from "@/i18n/messages";
import { getMessages, getPrefs } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { CATEGORY_ROLE_NAMES, roleNamesArray } from "@/lib/category-roles";
import { parseAmountInput } from "@/lib/format";
import { refreshTaxLots } from "@/lib/portfolio";

export type PortfolioResult = { ok: true; holdingId: string } | { ok: false; error: string };

/** Els missatges de validació de zod són claus de `cartera.errors`: el text es tradueix en respondre. */
const VALIDATION_KEYS = ["invalidDate", "invalidQuantity", "nameRequired", "chooseAccount"] as const;
type ValidationKey = (typeof VALIDATION_KEYS)[number];
const isValidationKey = (key: string | undefined): key is ValidationKey =>
  key !== undefined && (VALIDATION_KEYS as readonly string[]).includes(key);
const validationMessage = (m: Messages, key: string | undefined) =>
  isValidationKey(key) ? m.cartera.errors[key] : m.common.errors.invalid;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate" satisfies ValidationKey);
/** Participacions: fins a 8 decimals, amb coma o punt. */
const quantityInput = z
  .string()
  .trim()
  .transform((s) => s.replace(",", "."))
  .refine((s) => /^\d{1,12}(\.\d{1,8})?$/.test(s) && Number(s) > 0, "invalidQuantity" satisfies ValidationKey);

const newHoldingInput = z.object({
  name: z.string().trim().min(1, "nameRequired" satisfies ValidationKey).max(60),
  kind: z.enum(["fund", "stock", "crypto"]),
  code: z.string().trim().max(30).optional(),
  currency: z.enum(["EUR", "USD", "CAD", "GBP", "CHF"]),
  accountId: z.uuid({ message: "chooseAccount" satisfies ValidationKey }),
});

const tradeInput = z.object({
  side: z.enum(["buy", "sell", "reward", "transfer"]),
  holdingId: z.uuid().optional(),
  newHolding: newHoldingInput.optional(),
  date: isoDate,
  quantity: quantityInput,
  amountEur: z.string().optional(),
  fees: z.string().optional(),
  destinationId: z.uuid().optional(),
  destinationQuantity: quantityInput.optional(),
  notes: z.string().trim().max(500).optional(),
});

/** Nom de la categoria d'inversió que es crea si encara no n'hi ha cap (en l'idioma de l'usuari). */
function investmentCategoryName(role: "fund" | "stock" | "crypto", locale: Locale): string {
  if (role === "crypto") return CATEGORY_ROLE_NAMES.crypto[LOCALES.indexOf(locale)];
  const starter = MESSAGES[locale].benvinguda.starter;
  return role === "fund" ? starter.funds : starter.stocks;
}

async function heldQuantity(tx: Tx, holdingId: string) {
  const [row] = (await tx.execute(
    sql`select coalesce(sum(remaining_qty), 0)::text as q from tax_lots where holding_id = ${holdingId}`,
  )) as unknown as Array<{ q: string }>;
  return row.q;
}

/** Categoria d'inversió per a la posició: la que ja existeix (amb el nom en qualsevol idioma) o una de nova. */
async function investmentCategoryId(tx: Tx, kind: string, locale: Locale) {
  const role = kind === "fund" ? "fund" : kind === "crypto" ? "crypto" : "stock";
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.kind, "investment"), sql`lower(${categories.name}) = any(${roleNamesArray(role)}::text[])`))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(categories)
    .values({ name: investmentCategoryName(role, locale), kind: "investment", icon: "trend", color: "lime" })
    .returning({ id: categories.id });
  return created.id;
}

/** Alta d'una operació: compra, venda, recompensa o traspàs entre fons. Recalcula els lots FIFO. */
export async function createTrade(input: z.input<typeof tradeInput>): Promise<PortfolioResult> {
  const user = await requireUser();
  const [m, prefs] = await Promise.all([getMessages(), getPrefs()]);
  const t = m.cartera.errors;
  const parsed = tradeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: validationMessage(m, parsed.error.issues[0]?.message) };
  const data = parsed.data;

  const amount = data.side === "transfer" ? "0.00" : parseAmountInput(data.amountEur ?? "");
  if (!amount || (data.side !== "transfer" && amount === "0.00")) {
    return { ok: false, error: t.amountRequired(m.cartera.currencyNames[prefs.currency]) };
  }
  const fees = data.fees ? parseAmountInput(data.fees) : "0.00";
  if (fees === null) return { ok: false, error: t.invalidFees };

  let result: PortfolioResult;
  try {
    result = await withRls(user, async (tx) => {
      // Posició: existent o nova.
      let holdingId = data.holdingId;
      if (!holdingId) {
        if (!data.newHolding) return { ok: false as const, error: t.chooseHolding };
        const h = data.newHolding;
        const isIsin = h.code && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(h.code.toUpperCase());
        const [created] = await tx
          .insert(holdings)
          .values({
            name: h.name,
            kind: h.kind,
            ticker: h.code && !isIsin ? h.code.toUpperCase() : null,
            isin: isIsin ? h.code!.toUpperCase() : null,
            currency: h.currency,
            accountId: h.accountId,
          })
          .returning({ id: holdings.id });
        holdingId = created.id;
      }
      const [holding] = await tx.select().from(holdings).where(eq(holdings.id, holdingId));
      if (!holding) return { ok: false as const, error: t.holdingNotFound };

      if (data.side === "sell" || data.side === "transfer") {
        const held = Number(await heldQuantity(tx, holding.id));
        if (Number(data.quantity) > held + 1e-9) {
          return { ok: false as const, error: t.notEnough(held.toLocaleString(LOCALE_TAGS[prefs.locale])) };
        }
      }

      if (data.side === "transfer") {
        if (!data.destinationId || !data.destinationQuantity) {
          return { ok: false as const, error: t.chooseDestination };
        }
        if (data.destinationId === holding.id) return { ok: false as const, error: t.sameDestination };
        const group = randomUUID();
        await tx.insert(trades).values([
          { holdingId: holding.id, date: data.date, side: "transfer_out", quantity: data.quantity, amountEur: "0", transferGroupId: group, notes: data.notes || null },
          { holdingId: data.destinationId, date: data.date, side: "transfer_in", quantity: data.destinationQuantity, amountEur: "0", transferGroupId: group, notes: data.notes || null },
        ]);
        return { ok: true as const, holdingId: holding.id };
      }

      const side = data.side === "reward" ? "reward" : data.side;
      const [trade] = await tx
        .insert(trades)
        .values({
          holdingId: holding.id,
          date: data.date,
          side,
          quantity: data.quantity,
          price: new Big(amount).div(data.quantity).round(8, Big.roundHalfUp).toFixed(8),
          fees,
          amountEur: amount,
          notes: data.notes || null,
        })
        .returning({ id: trades.id });

      // Les compres i vendes mouen diners: generen el moviment d'inversió enllaçat (sense doble entrada).
      if (side === "buy" || side === "sell") {
        await tx.insert(transactions).values({
          date: data.date,
          concept: m.cartera.concept(side, holding.name),
          amount: side === "buy" ? `-${amount}` : amount,
          categoryId: await investmentCategoryId(tx, holding.kind, prefs.locale),
          accountId: holding.accountId,
          tradeId: trade.id,
        });
      }
      return { ok: true as const, holdingId: holding.id };
    });
  } catch {
    return { ok: false, error: t.saveFailed };
  }

  if (result.ok) {
    await refreshTaxLots(user);
    revalidatePath("/cartera");
    revalidatePath("/");
    revalidatePath("/moviments");
  }
  return result;
}

/** Esborra una operació creada des de l'app (les importades no es toquen) i recalcula els lots. */
export async function deleteTrade(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const t = (await getMessages()).cartera.errors;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: t.invalidTrade };
  const result = await withRls(user, async (tx) => {
    const [trade] = await tx.select().from(trades).where(eq(trades.id, id));
    if (!trade) return { ok: false, error: t.tradeNotFound };
    if (trade.source !== "manual" || trade.isEstimated) {
      return { ok: false, error: t.importedTrade };
    }
    // Un traspàs són dues operacions: s'esborren juntes.
    if (trade.transferGroupId) await tx.delete(trades).where(eq(trades.transferGroupId, trade.transferGroupId));
    else await tx.delete(trades).where(eq(trades.id, id));
    return { ok: true };
  });
  if (result.ok) {
    await refreshTaxLots(user);
    revalidatePath("/cartera");
    revalidatePath("/");
    revalidatePath("/moviments");
  }
  return result;
}

const priceInput = z.object({ holdingId: z.uuid(), price: z.string(), date: isoDate });

/** Preu a mà (fins que el cron de preus estigui configurat, o per a productes sense cotització). */
export async function setPrice(input: z.input<typeof priceInput>): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const [m, { locale }] = await Promise.all([getMessages(), getPrefs()]);
  const parsed = priceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: m.common.errors.invalid };
  // En català el punt separa milers i la coma és decimal; en anglès i hebreu, al revés.
  const raw = parsed.data.price.trim();
  const cleaned = locale === "ca" ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  if (!/^\d{1,9}(\.\d{1,8})?$/.test(cleaned) || Number(cleaned) <= 0) return { ok: false, error: m.cartera.errors.invalidPrice };

  const ok = await withRls(user, async (tx) => {
    const [holding] = await tx.select({ currency: holdings.currency }).from(holdings).where(eq(holdings.id, parsed.data.holdingId));
    if (!holding) return false;
    await tx
      .insert(prices)
      .values({ holdingId: parsed.data.holdingId, date: parsed.data.date, price: cleaned, currency: holding.currency })
      .onConflictDoUpdate({ target: [prices.holdingId, prices.date], set: { price: cleaned, currency: holding.currency } });
    return true;
  });
  if (!ok) return { ok: false, error: m.cartera.errors.holdingNotFound };
  revalidatePath("/cartera");
  return { ok: true };
}
