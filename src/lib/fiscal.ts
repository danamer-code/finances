import "server-only";

import Big from "big.js";
import { sql } from "drizzle-orm";

import { withRls, type JwtClaims, type Tx } from "@/db";

import { roleNamesArray } from "./category-roles";
import { computeFifo, type FifoTrade, type TradeSide } from "./fifo";
import { compensate, type YearInput, type YearResult } from "./tax";

type Row = Record<string, unknown>;

export type Regime = { regime: "irpf" | "irnr"; country: string; notes: string | null; explicit: boolean };

export type Sale = {
  tradeId: string;
  date: string;
  side: "sell" | "rights_sale";
  quantity: string;
  holdingId: string;
  name: string;
  kind: string;
  ticker: string | null;
  proceeds: string;
  cost: string;
  gain: string;
  lots: number;
  firstBuy: string;
  lastBuy: string;
};

export type FiscalOverview = {
  year: number;
  years: number[];
  regime: Regime;
  sales: Sale[];
  gains: string;
  losses: string;
  net: string;
  interest: string;
  result: YearResult;
};

/**
 * Interessos i dividends: moviments d'ingrés d'una categoria que en porti el nom
 * (a les dades migrades, "Interessos/dividends").
 */
const INTEREST_CATEGORY = sql`c.kind = 'income' and (c.name ilike '%interes%' or c.name ilike '%dividend%'
  or lower(c.name) = any(${roleNamesArray("interest")}::text[]))`;

/** Guany net, interessos i règim de cada any amb dades: l'entrada de la compensació de pèrdues. */
async function loadYears(
  tx: Tx,
  currentYear: number,
): Promise<{ inputs: YearInput[]; regimes: Map<number, Regime>; firstYear: number }> {
  const nets = (await tx.execute(sql`
    select fiscal_year as year, sum(gain_eur)::text as net from tax_disposals group by 1
  `)) as unknown as Row[];
  const interest = (await tx.execute(sql`
    select extract(year from t.date)::int as year, sum(t.amount)::text as total
    from transactions t join categories c on c.id = t.category_id
    where t.status = 'confirmed' and t.amount is not null and ${INTEREST_CATEGORY}
    group by 1
  `)) as unknown as Row[];
  const regimeRows = (await tx.execute(sql`
    select year, regime::text, country, notes from fiscal_years
  `)) as unknown as Row[];
  const [first] = (await tx.execute(sql`
    select extract(year from min(date))::int as year from transactions
  `)) as unknown as Row[];

  const regimes = new Map<number, Regime>(
    regimeRows.map((r) => [
      Number(r.year),
      { regime: r.regime as Regime["regime"], country: String(r.country), notes: (r.notes as string | null) ?? null, explicit: true },
    ]),
  );
  const netByYear = new Map(nets.map((r) => [Number(r.year), String(r.net)]));
  const interestByYear = new Map(interest.map((r) => [Number(r.year), String(r.total)]));
  const years = new Set<number>([...netByYear.keys(), ...regimes.keys(), currentYear]);
  const inputs = [...years].map<YearInput>((year) => ({
    year,
    regime: regimes.get(year)?.regime ?? "irpf",
    net: netByYear.get(year) ?? "0",
    interest: interestByYear.get(year) ?? "0",
  }));
  return { inputs, regimes, firstYear: first?.year ? Number(first.year) : currentYear };
}

const DEFAULT_REGIME: Regime = { regime: "irpf", country: "ES", notes: null, explicit: false };

export async function getFiscalOverview(user: JwtClaims, requestedYear: number | null, currentYear: number): Promise<FiscalOverview> {
  return withRls(user, async (tx) => {
    const { inputs, regimes, firstYear } = await loadYears(tx, currentYear);
    // Només els anys des que hi ha dades a l'app (o amb règim indicat): les vendes de drets de fa anys
    // compten per a la compensació, però no cal mostrar-les com a exercicis.
    const years = inputs
      .map((i) => i.year)
      .filter((y) => y >= firstYear || regimes.has(y))
      .sort((a, b) => b - a);
    const year = requestedYear && years.includes(requestedYear) ? requestedYear : currentYear;
    const results = compensate(inputs);
    const result = results.find((r) => r.year === year)!;

    const rows = (await tx.execute(sql`
      select t.id::text as trade_id, t.date::text, t.side::text, t.quantity::text,
             h.id::text as holding_id, h.name, h.kind::text, h.ticker,
             sum(d.proceeds_eur)::text as proceeds, sum(d.cost_basis_eur)::text as cost, sum(d.gain_eur)::text as gain,
             count(*)::int as lots, min(l.buy_date)::text as first_buy, max(l.buy_date)::text as last_buy
      from tax_disposals d
      join trades t on t.id = d.sell_trade_id
      join holdings h on h.id = t.holding_id
      join tax_lots l on l.id = d.tax_lot_id
      where d.fiscal_year = ${year}
      group by t.id, t.date, t.side, t.quantity, h.id, h.name, h.kind, h.ticker
      order by t.date desc, t.id
    `)) as unknown as Row[];

    const sales = rows.map<Sale>((r) => ({
      tradeId: String(r.trade_id),
      date: String(r.date),
      side: r.side === "rights_sale" ? "rights_sale" : "sell",
      quantity: String(r.quantity),
      holdingId: String(r.holding_id),
      name: String(r.name),
      kind: String(r.kind),
      ticker: (r.ticker as string | null) ?? null,
      proceeds: String(r.proceeds),
      cost: String(r.cost),
      gain: String(r.gain),
      lots: Number(r.lots),
      firstBuy: String(r.first_buy),
      lastBuy: String(r.last_buy),
    }));
    const gains = sales.reduce((s, x) => (new Big(x.gain).gt(0) ? s.plus(x.gain) : s), new Big(0));
    const losses = sales.reduce((s, x) => (new Big(x.gain).lt(0) ? s.plus(x.gain) : s), new Big(0));

    return {
      year,
      years,
      regime: regimes.get(year) ?? DEFAULT_REGIME,
      sales,
      gains: gains.toFixed(2),
      losses: losses.toFixed(2),
      net: result.net,
      interest: result.interest,
      result,
    };
  });
}

export type SaleSimulation = {
  proceeds: string;
  cost: string;
  gain: string;
  lots: number;
  firstBuy: string;
  lastBuy: string;
  /** Impost addicional estimat aquest any (null si l'any no és IRPF). */
  taxDelta: string | null;
};

/**
 * Per què no s'ha pogut simular; el text el posa qui crida, en l'idioma de l'usuari.
 * `notEnough` porta les participacions disponibles (text numèric).
 */
export type SaleSimulationError = { error: "notEnough"; available: string } | { error: "failed" };

const SIMULATED_ID = "simulacio";

/**
 * Simula una venda avui passant pel mateix motor FIFO que les vendes reals (scrip, traspassos, drets...),
 * afegint una operació fictícia al final. No escriu res.
 */
export async function simulateSale(
  user: JwtClaims,
  input: { holdingId: string; quantity: string; proceedsEur: string; today: string },
): Promise<SaleSimulation | SaleSimulationError> {
  return withRls(user, async (tx) => {
    const [available] = (await tx.execute(sql`
      select coalesce(sum(remaining_qty), 0)::text as qty from tax_lots where holding_id = ${input.holdingId}
    `)) as unknown as Row[];
    if (new Big(input.quantity).gt(String(available?.qty ?? "0"))) {
      return { error: "notEnough", available: String(available?.qty ?? "0") };
    }

    const trades = (await tx.execute(sql`
      select id::text, holding_id::text, date::text, side::text, quantity::text, amount_eur::text,
             transfer_group_id::text, created_at
      from trades order by date
    `)) as unknown as Row[];
    const fifoTrades = trades.map<FifoTrade>((t) => ({
      id: String(t.id),
      holdingId: String(t.holding_id),
      date: String(t.date),
      side: t.side as TradeSide,
      quantity: String(t.quantity),
      amountEur: String(t.amount_eur),
      transferGroupId: (t.transfer_group_id as string | null) ?? null,
      createdAt: new Date(String(t.created_at)).toISOString(),
    }));
    fifoTrades.push({
      id: SIMULATED_ID,
      holdingId: input.holdingId,
      date: input.today,
      side: "sell",
      quantity: input.quantity,
      amountEur: input.proceedsEur,
      createdAt: "9999-12-31T23:59:59.000Z",
    });
    const { disposals, lots } = computeFifo(fifoTrades);
    const mine = disposals.filter((d) => d.sellTradeId === SIMULATED_ID);
    if (mine.length === 0) return { error: "failed" };

    const buyDates = new Map(lots.map((l) => [l.key, l.buyDate]));
    const dates = mine.map((d) => buyDates.get(d.lotKey) ?? input.today).sort();
    const cost = mine.reduce((s, d) => s.plus(d.costBasisEur), new Big(0));
    const gain = mine.reduce((s, d) => s.plus(d.gainEur), new Big(0));

    // Impost: es torna a fer la compensació de l'any amb la venda afegida i es compara.
    const currentYear = Number(input.today.slice(0, 4));
    const { inputs } = await loadYears(tx, currentYear);
    const before = compensate(inputs).find((r) => r.year === currentYear)!;
    const after = compensate(
      inputs.map((i) => (i.year === currentYear ? { ...i, net: new Big(i.net).plus(gain).toFixed(2) } : i)),
    ).find((r) => r.year === currentYear)!;
    const taxDelta = before.tax !== null && after.tax !== null ? new Big(after.tax).minus(before.tax).toFixed(2) : null;

    return {
      proceeds: new Big(input.proceedsEur).toFixed(2),
      cost: cost.toFixed(2),
      gain: gain.toFixed(2),
      lots: new Set(mine.map((d) => d.lotKey)).size,
      firstBuy: dates[0],
      lastBuy: dates[dates.length - 1],
      taxDelta,
    };
  });
}
