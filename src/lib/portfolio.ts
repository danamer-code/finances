import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { adminDb, withRls, type JwtClaims } from "@/db";
import { holdings, trades } from "@/db/schema";

import { computeFifo } from "./fifo";
import { regenerateTaxLots } from "./tax-lots";

export type Position = {
  id: string;
  name: string;
  kind: "fund" | "stock" | "crypto" | "cash";
  ticker: string | null;
  isin: string | null;
  currency: string;
  accountName: string;
  quantity: string;
  cost: string;
  price: string | null;
  priceDate: string | null;
  value: string | null;
};

type Row = Record<string, unknown>;

/**
 * Posicions obertes: participacions i cost FIFO (de tax_lots) i valor amb l'últim preu i tipus de canvi.
 * Tota l'aritmètica es fa a Postgres (numeric).
 */
export async function getPositions(user: JwtClaims): Promise<Position[]> {
  const rows = await withRls(user, (tx) =>
    tx.execute(sql`
      with lots as (
        select holding_id, sum(remaining_qty) as qty, sum(round(remaining_qty * unit_cost_eur, 2)) as cost
        from tax_lots group by holding_id
      ),
      last_price as (
        select distinct on (holding_id) holding_id, price, currency, date
        from prices order by holding_id, date desc
      ),
      last_fx as (
        select distinct on (base) base, rate from fx_rates where quote = 'EUR' order by base, date desc
      ),
      -- Divisa de l'usuari (la RLS deixa veure només el seu perfil) i el seu tipus respecte a l'euro.
      base as (
        select coalesce((select currency::text from profiles limit 1), 'EUR') as cur
      ),
      base_fx as (
        select base.cur, case when base.cur = 'EUR' then 1 else (select rate from last_fx where last_fx.base = base.cur) end as rate
        from base
      )
      select h.id::text, h.name, h.kind::text, h.ticker, h.isin, h.currency, a.name as account_name,
             coalesce(l.qty, 0)::text as quantity,
             coalesce(l.cost, 0)::text as cost,
             p.price::text as price, p.date::text as price_date,
             -- Preu en la divisa de l'usuari: igual si coincideix; si no, creuant amb l'euro (tipus del BCE).
             case when p.price is null then null
                  else round(coalesce(l.qty, 0) * p.price * coalesce(
                    case when p.currency = bf.cur then 1 end,
                    coalesce(case when p.currency = 'EUR' then 1 end, fx.rate) / nullif(bf.rate, 0)
                  ), 2)::text
             end as value
      from holdings h
      join accounts a on a.id = h.account_id
      cross join base_fx bf
      left join lots l on l.holding_id = h.id
      left join last_price p on p.holding_id = h.id
      left join last_fx fx on fx.base = p.currency
      where h.is_active
    `),
  );
  return (rows as unknown as Row[])
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      kind: r.kind as Position["kind"],
      ticker: (r.ticker as string | null) ?? null,
      isin: (r.isin as string | null) ?? null,
      currency: String(r.currency),
      accountName: String(r.account_name),
      quantity: String(r.quantity),
      cost: String(r.cost),
      price: (r.price as string | null) ?? null,
      priceDate: (r.price_date as string | null) ?? null,
      value: (r.value as string | null) ?? null,
    }))
    .filter((p) => Number(p.quantity) > 0);
}

export type Balances = { cash: string; loans: string };

/** Últim saldo de cada compte: efectiu (bancs, efectiu i brokers) i préstecs concedits. */
export async function getBalances(user: JwtClaims): Promise<Balances> {
  const rows = await withRls(user, (tx) =>
    tx.execute(sql`
      with last as (
        select distinct on (b.account_id) b.account_id, b.balance
        from account_balances b order by b.account_id, b.date desc
      )
      select coalesce(sum(last.balance) filter (where a.kind <> 'loan'), 0)::text as cash,
             coalesce(sum(last.balance) filter (where a.kind = 'loan'), 0)::text as loans
      from last join accounts a on a.id = last.account_id
    `),
  );
  const r = (rows as unknown as Row[])[0];
  return { cash: String(r.cash), loans: String(r.loans) };
}

export type EvolutionPoint = { date: string; value: string; cost: string | null };

/**
 * Evolució del valor invertit (snapshots mensuals + el valor d'avui) contra el cost FIFO de les posicions
 * obertes a cada data, recalculat amb el mateix motor FIFO.
 */
export async function getEvolution(user: JwtClaims, currentValue: string, today: string): Promise<EvolutionPoint[]> {
  const [snapshots, allTrades] = await withRls(user, async (tx) => [
    (await tx.execute(sql`select date::text, market_value::text from net_worth_snapshots order by date`)) as unknown as Row[],
    await tx
      .select({
        id: trades.id,
        holdingId: trades.holdingId,
        date: trades.date,
        side: trades.side,
        quantity: trades.quantity,
        amountEur: trades.amountEur,
        transferGroupId: trades.transferGroupId,
        createdAt: trades.createdAt,
      })
      .from(trades)
      .orderBy(asc(trades.date)),
  ]);

  const costAt = (date: string) => {
    const result = computeFifo(
      allTrades.filter((t) => t.date <= date).map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    );
    const cents = result.lots.reduce((acc, l) => acc + BigInt(l.remainingCostEur.replace(".", "")), BigInt(0));
    const s = cents.toString().padStart(3, "0");
    return `${s.slice(0, -2)}.${s.slice(-2)}`;
  };

  const points: EvolutionPoint[] = snapshots.map((s) => ({
    date: String(s.date),
    value: String(s.market_value),
    cost: costAt(String(s.date)),
  }));
  points.push({ date: today, value: currentValue, cost: costAt(today) });
  return points;
}

export async function getConcentrationThreshold(user: JwtClaims): Promise<string> {
  const rows = await withRls(user, (tx) => tx.execute(sql`select concentration_threshold::text as t from profiles limit 1`));
  return String((rows as unknown as Row[])[0]?.t ?? "0.1000");
}

export async function getHolding(user: JwtClaims, id: string) {
  const [row] = await withRls(user, (tx) => tx.select().from(holdings).where(eq(holdings.id, id)));
  return row ?? null;
}

/** Regenera els lots fiscals de l'usuari (després de crear, editar o esborrar operacions). */
export async function refreshTaxLots(user: JwtClaims) {
  return regenerateTaxLots(adminDb, user.sub);
}

export type HoldingDetail = {
  holding: { id: string; name: string; kind: string; ticker: string | null; isin: string | null; currency: string; accountName: string };
  lots: Array<{ id: string; buyDate: string; remainingQty: string; unitCost: string; cost: string }>;
  trades: Array<{ id: string; date: string; side: string; quantity: string; amountEur: string; source: string; isEstimated: boolean; notes: string | null }>;
  gainsByYear: Array<{ year: number; gain: string }>;
  price: { price: string; currency: string; date: string } | null;
};

export async function getHoldingDetail(user: JwtClaims, id: string): Promise<HoldingDetail | null> {
  return withRls(user, async (tx) => {
    const [holding] = (await tx.execute(sql`
      select h.id::text, h.name, h.kind::text, h.ticker, h.isin, h.currency, a.name as account_name
      from holdings h join accounts a on a.id = h.account_id where h.id = ${id}
    `)) as unknown as Row[];
    if (!holding) return null;
    const lots = (await tx.execute(sql`
      select id::text, buy_date::text, remaining_qty::text, unit_cost_eur::text,
             round(remaining_qty * unit_cost_eur, 2)::text as cost
      from tax_lots where holding_id = ${id} and remaining_qty > 0 order by buy_date
    `)) as unknown as Row[];
    const tradeRows = (await tx.execute(sql`
      select id::text, date::text, side::text, quantity::text, amount_eur::text, source::text, is_estimated, notes
      from trades where holding_id = ${id} order by date desc, created_at desc
    `)) as unknown as Row[];
    const gains = (await tx.execute(sql`
      select d.fiscal_year, sum(d.gain_eur)::text as gain
      from tax_disposals d join tax_lots l on l.id = d.tax_lot_id
      where l.holding_id = ${id} group by 1 order by 1 desc
    `)) as unknown as Row[];
    const [price] = (await tx.execute(sql`
      select price::text, currency, date::text from prices where holding_id = ${id} order by date desc limit 1
    `)) as unknown as Row[];
    return {
      holding: {
        id: String(holding.id),
        name: String(holding.name),
        kind: String(holding.kind),
        ticker: (holding.ticker as string | null) ?? null,
        isin: (holding.isin as string | null) ?? null,
        currency: String(holding.currency),
        accountName: String(holding.account_name),
      },
      lots: lots.map((l) => ({
        id: String(l.id),
        buyDate: String(l.buy_date),
        remainingQty: String(l.remaining_qty),
        unitCost: String(l.unit_cost_eur),
        cost: String(l.cost),
      })),
      trades: tradeRows.map((t) => ({
        id: String(t.id),
        date: String(t.date),
        side: String(t.side),
        quantity: String(t.quantity),
        amountEur: String(t.amount_eur),
        source: String(t.source),
        isEstimated: Boolean(t.is_estimated),
        notes: (t.notes as string | null) ?? null,
      })),
      gainsByYear: gains.map((g) => ({ year: Number(g.fiscal_year), gain: String(g.gain) })),
      price: price ? { price: String(price.price), currency: String(price.currency), date: String(price.date) } : null,
    };
  });
}

export async function getTradeFormData(user: JwtClaims) {
  return withRls(user, async (tx) => {
    const holdingRows = (await tx.execute(sql`
      select h.id::text, h.name, h.kind::text, h.currency,
             coalesce((select sum(remaining_qty) from tax_lots l where l.holding_id = h.id), 0)::text as quantity
      from holdings h where h.is_active order by h.name
    `)) as unknown as Row[];
    const accountRows = (await tx.execute(sql`
      select id::text, name, kind::text from accounts where is_active and kind <> 'loan' order by sort_order, name
    `)) as unknown as Row[];
    return {
      holdings: holdingRows.map((h) => ({ id: String(h.id), name: String(h.name), kind: String(h.kind), currency: String(h.currency), quantity: String(h.quantity) })),
      accounts: accountRows.map((a) => ({ id: String(a.id), name: String(a.name), kind: String(a.kind) })),
    };
  });
}
