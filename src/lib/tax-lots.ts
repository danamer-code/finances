/**
 * Regenera tax_lots i tax_disposals d'un usuari a partir de les seves operacions (spec §2: mai s'editen a mà).
 * Rep la connexió com a paràmetre perquè la puguin fer servir tant l'app (adminDb) com l'script de migració.
 * La connexió salta la RLS: tot es filtra explícitament per `userId`.
 */
import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema";
import { computeFifo, type FifoTrade } from "./fifo";

type Database = PostgresJsDatabase<typeof schema>;

export async function regenerateTaxLots(db: Database, userId: string): Promise<{ errors: string[]; lots: number; disposals: number }> {
  return db.transaction(async (tx) => {
    const trades = await tx
      .select({
        id: schema.trades.id,
        holdingId: schema.trades.holdingId,
        date: schema.trades.date,
        side: schema.trades.side,
        quantity: schema.trades.quantity,
        amountEur: schema.trades.amountEur,
        transferGroupId: schema.trades.transferGroupId,
        createdAt: schema.trades.createdAt,
      })
      .from(schema.trades)
      .where(eq(schema.trades.userId, userId))
      .orderBy(asc(schema.trades.date));

    const result = computeFifo(
      trades.map<FifoTrade>((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    );

    await tx.delete(schema.taxDisposals).where(eq(schema.taxDisposals.userId, userId));
    await tx.delete(schema.taxLots).where(eq(schema.taxLots.userId, userId));

    const idByKey = new Map(result.lots.map((l) => [l.key, randomUUID()]));
    const lotRows = result.lots.map((l) => ({
      id: idByKey.get(l.key)!,
      userId,
      holdingId: l.holdingId,
      buyTradeId: l.buyTradeId,
      buyDate: l.buyDate,
      quantity: l.quantity,
      remainingQty: l.remainingQty,
      unitCostEur: l.unitCostEur,
    }));
    for (let i = 0; i < lotRows.length; i += 500) await tx.insert(schema.taxLots).values(lotRows.slice(i, i + 500));

    const disposalRows = result.disposals.map((d) => ({
      userId,
      sellTradeId: d.sellTradeId,
      taxLotId: idByKey.get(d.lotKey)!,
      quantity: d.quantity,
      proceedsEur: d.proceedsEur,
      costBasisEur: d.costBasisEur,
      fiscalYear: d.fiscalYear,
    }));
    for (let i = 0; i < disposalRows.length; i += 500) {
      await tx.insert(schema.taxDisposals).values(disposalRows.slice(i, i + 500));
    }

    return { errors: result.errors, lots: lotRows.length, disposals: disposalRows.length };
  });
}
