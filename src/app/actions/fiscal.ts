"use server";

import Big from "big.js";
import { z } from "zod";

import { LOCALE_TAGS } from "@/i18n/config";
import { getMessages, getPrefs } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { simulateSale, type SaleSimulation } from "@/lib/fiscal";
import { todayIso } from "@/lib/format";

/** Decimals amb coma o punt (participacions i preus fins a 8 decimals). */
const decimalInput = z
  .string()
  .trim()
  .transform((s) => s.replace(",", "."))
  .refine((s) => /^\d{1,12}(\.\d{1,8})?$/.test(s) && Number(s) > 0);

const simulationInput = z.object({ holdingId: z.uuid(), quantity: decimalInput, price: decimalInput });

export type SimulationResult = ({ ok: true } & SaleSimulation) | { ok: false; error: string };

export async function simulateSaleAction(input: z.input<typeof simulationInput>): Promise<SimulationResult> {
  const user = await requireUser();
  const [m, { locale }] = await Promise.all([getMessages(), getPrefs()]);
  const t = m.fiscal.errors;
  const parsed = simulationInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: t.invalidInput };
  const { holdingId, quantity, price } = parsed.data;
  const proceedsEur = new Big(quantity).times(price).round(2).toFixed(2);
  const result = await simulateSale(user, { holdingId, quantity, proceedsEur, today: todayIso() });
  if (!("error" in result)) return { ok: true, ...result };
  if (result.error === "notEnough") {
    const available = Number(result.available).toLocaleString(LOCALE_TAGS[locale], { maximumFractionDigits: 8 });
    return { ok: false, error: t.notEnough(available) };
  }
  return { ok: false, error: t.failed };
}
