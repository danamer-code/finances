"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db";
import { accountBalances } from "@/db/schema";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { parseAmountInput, todayIso } from "@/lib/format";

const balancesInput = z.object({
  entries: z.array(z.object({ accountId: z.uuid(), balance: z.string() })).max(50),
});

/** Saldo amb signe opcional ("-120,50" per a un descobert). */
function parseBalance(raw: string): string | null {
  const s = raw.trim().replace(/^[−–]/, "-");
  const negative = s.startsWith("-");
  const amount = parseAmountInput(negative ? s.slice(1) : s);
  if (amount === null) return null;
  return negative && amount !== "0.00" ? `-${amount}` : amount;
}

export async function saveBalances(input: z.input<typeof balancesInput>): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const m = await getMessages();
  const parsed = balancesInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: m.common.errors.invalid };

  const rows: Array<{ accountId: string; balance: string }> = [];
  for (const e of parsed.data.entries) {
    if (!e.balance.trim()) continue;
    const balance = parseBalance(e.balance);
    if (balance === null) return { ok: false, error: m.ajustos.balances.errors.invalidAmount(e.balance) };
    rows.push({ accountId: e.accountId, balance });
  }
  if (rows.length === 0) return { ok: false, error: m.ajustos.balances.errors.empty };

  const date = todayIso();
  await withRls(user, async (tx) => {
    for (const r of rows) {
      await tx
        .insert(accountBalances)
        .values({ accountId: r.accountId, date, balance: r.balance })
        .onConflictDoUpdate({ target: [accountBalances.accountId, accountBalances.date], set: { balance: r.balance } });
    }
  });
  revalidatePath("/");
  revalidatePath("/cartera");
  revalidatePath("/ajustos/saldos");
  return { ok: true, saved: rows.length };
}
