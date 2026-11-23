import "server-only";

import Big from "big.js";
import { sql } from "drizzle-orm";

import { withRls, type JwtClaims } from "@/db";

import { roleNamesArray } from "./category-roles";
import { getCategorySpending, getMonthlySeries } from "./data";
import { change } from "./decimal";
import { getFiscalOverview } from "./fiscal";
import { addDays } from "./format";
import { getPositions } from "./portfolio";
import { personaFor, type Persona } from "./wrapped-persona";

type Row = Record<string, unknown>;

type Style = { name: string; icon: string | null; color: string | null };

export type WrappedData = {
  year: number;
  /** L'any ja s'ha acabat; si no, és un avançament «fins avui». */
  final: boolean;
  /** Fins a quin dia arriba l'avançament (null si l'any ja s'ha acabat). El text el posa cada idioma. */
  through: { day: number; month: number } | null;
  movements: number;
  concepts: number;
  income: string;
  expense: string;
  saved: string;
  savingsRate: number | null;
  /** El mateix període de l'any anterior (null si aleshores no hi havia dades). */
  prev: { year: number; income: string; expense: string; saved: string; savingsRate: number | null } | null;
  topCategories: Array<Style & { id: string; total: string; share: number; change: number | null }>;
  /** La categoria que més ha baixat en diners respecte al mateix període de l'any anterior. */
  win: (Style & { drop: string }) | null;
  topConcepts: Array<{ concept: string; count: number; total: string; category: Style }>;
  months: Array<{ month: number; expense: string }>;
  priciestMonth: { month: number; expense: string } | null;
  cheapestMonth: { month: number; expense: string } | null;
  monthlyAverage: string;
  subscriptions: { total: string; monthly: string; count: number; days: number } | null;
  investments: {
    /** Mes de la primera foto de la cartera (null si és l'1 de gener: «a l'inici de l'any»). */
    startMonth: number | null;
    start: string;
    end: string;
    /** Variació del valor (inclou el que s'hi ha afegit o tret durant l'any). */
    change: number | null;
    /** Guany o pèrdua de les vendes de l'any. */
    realized: string | null;
    /** Guany latent d'avui sobre el cost (només l'any en curs). */
    latent: string | null;
    best: { name: string; pct: number } | null;
  } | null;
  tax: { net: string; tax: string | null; regime: "irpf" | "irnr"; sales: number } | null;
  persona: Persona;
};

const rate = (saved: Big, income: Big) => (income.gt(0) ? Math.round(saved.div(income).times(100).toNumber()) : null);
const positive = (s: string) => new Big(s).abs().toFixed(2);

export async function getWrapped(user: JwtClaims, year: number, today: string): Promise<WrappedData | null> {
  const currentYear = Number(today.slice(0, 4));
  if (year > currentYear) return null;
  const final = year < currentYear;
  const start = `${year}-01-01`;
  const end = final ? `${year + 1}-01-01` : addDays(today, 1);
  const prevStart = `${year - 1}-01-01`;
  const prevEnd = final ? start : `${year - 1}${end.slice(4)}`;
  const throughMonth = final ? 12 : Number(today.slice(5, 7));

  const totalsSql = (from: string, to: string) => sql`
    select coalesce(sum(t.amount) filter (where c.kind = 'income'), 0)::text as income,
           coalesce(-sum(t.amount) filter (where c.kind = 'expense'), 0)::text as expense,
           count(*)::int as movements,
           count(distinct lower(t.concept))::int as concepts,
           min(t.date)::text as first_date
    from transactions t join categories c on c.id = t.category_id
    where t.status = 'confirmed' and t.amount is not null and t.date >= ${from}::date and t.date < ${to}::date`;

  const { current, previous, concepts, subs, snapshots, invested } = await withRls(user, async (tx) => {
    const [current] = (await tx.execute(totalsSql(start, end))) as unknown as Row[];
    const [previous] = (await tx.execute(totalsSql(prevStart, prevEnd))) as unknown as Row[];
    const concepts = (await tx.execute(sql`
      select min(t.concept) as concept, count(*)::int as n, (-sum(t.amount))::text as total,
             (array_agg(c.name order by t.date desc))[1] as cname,
             (array_agg(c.icon order by t.date desc))[1] as icon,
             (array_agg(c.color order by t.date desc))[1] as color
      from transactions t join categories c on c.id = t.category_id
      where t.status = 'confirmed' and c.kind = 'expense' and t.amount is not null
        and t.date >= ${start}::date and t.date < ${end}::date
      group by lower(t.concept)
      order by count(*) desc, -sum(t.amount) desc
      limit 5
    `)) as unknown as Row[];
    // Subscripcions: la categoria que se'n diu així, amb les seves subcategories.
    const [subs] = (await tx.execute(sql`
      select coalesce(-sum(t.amount), 0)::text as total, count(distinct lower(t.concept))::int as count
      from transactions t join categories c on c.id = t.category_id
      left join categories p on p.id = c.parent_id
      where t.status = 'confirmed' and t.amount is not null and c.kind = 'expense'
        and (c.name ilike '%subscrip%' or p.name ilike '%subscrip%'
          or lower(c.name) = any(${roleNamesArray("subscriptions")}::text[])
          or lower(p.name) = any(${roleNamesArray("subscriptions")}::text[]))
        and t.date >= ${start}::date and t.date < ${end}::date
    `)) as unknown as Row[];
    const snapshots = (await tx.execute(sql`
      select date::text, market_value::text from net_worth_snapshots
      where date >= ${start}::date and date <= ${end}::date order by date
    `)) as unknown as Row[];
    // Diners posats a inversions segons els moviments (només per al perfil de l'any).
    const [invested] = (await tx.execute(sql`
      select coalesce(-sum(t.amount), 0)::text as total
      from transactions t join categories c on c.id = t.category_id
      where t.status = 'confirmed' and t.amount is not null and c.kind = 'investment' and c.name not ilike '%comissi%'
        and not (lower(c.name) = any(${roleNamesArray("fees")}::text[]))
        and t.date >= ${start}::date and t.date < ${end}::date
    `)) as unknown as Row[];
    return { current, previous, concepts, subs, snapshots, invested };
  });

  const movements = Number(current?.movements ?? 0);
  if (movements === 0) return null;

  const income = new Big(String(current.income));
  const expense = new Big(String(current.expense));
  const saved = income.minus(expense);
  const prevIncome = new Big(String(previous?.income ?? "0"));
  const prevExpense = new Big(String(previous?.expense ?? "0"));
  const hasPrev = Number(previous?.movements ?? 0) > 0;

  // Categories (sumant les subcategories a la principal) amb el mateix període de l'any anterior.
  const spending = await getCategorySpending(user, { start, end, prevStart, prevEnd });
  const byTotal = [...spending].sort((a, b) => new Big(b.current).cmp(a.current));
  const share = (v: string) => (expense.gt(0) ? Math.round(new Big(v).div(expense).times(100).toNumber()) : 0);
  const topCategories = byTotal
    .filter((c) => new Big(c.current).gt(0))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      total: c.current,
      share: share(c.current),
      change: hasPrev && new Big(c.previous).gt(0) ? change(c.current, c.previous) : null,
    }));
  const drops = hasPrev
    ? spending
        .map((c) => ({ c, drop: new Big(c.previous).minus(c.current) }))
        .filter((d) => d.drop.gt(20) && new Big(d.c.previous).gt(0))
        .sort((a, b) => b.drop.cmp(a.drop))
    : [];
  const win = drops[0] ? { name: drops[0].c.name, icon: drops[0].c.icon, color: drops[0].c.color, drop: drops[0].drop.toFixed(2) } : null;

  // Mesos (els imports importats del full antic van per mes: aquí és la unitat fiable).
  const series = await getMonthlySeries(user, `${year}-01`, `${year}-${String(throughMonth).padStart(2, "0")}`);
  const months = series.map((m) => ({ month: Number(m.month.slice(5)), expense: positive(m.expense), count: m.count }));
  const withData = months.filter((m) => m.count > 0);
  // Amb l'any en marxa, el mes actual encara no s'ha acabat: no compta per al més tranquil ni per a la mitjana.
  const complete = final ? withData : withData.filter((m) => m.month < throughMonth);
  const settled = complete.length > 0 ? complete : withData;
  const priciest = withData.reduce<(typeof withData)[number] | null>((a, m) => (!a || new Big(m.expense).gt(a.expense) ? m : a), null);
  const cheapest = settled.reduce<(typeof withData)[number] | null>((a, m) => (!a || new Big(m.expense).lt(a.expense) ? m : a), null);
  const settledExpense = settled.reduce((acc, m) => acc.plus(m.expense), new Big(0));
  const monthlyAverage = settled.length ? settledExpense.div(settled.length).toFixed(2) : "0.00";

  // Subscripcions: total, mitjana mensual i a quants dies de despesa equivalen.
  const subsTotal = new Big(String(subs?.total ?? "0"));
  const firstDate = String(current.first_date ?? start);
  const dayCount = Math.max(1, Math.round((Date.parse(end) - Date.parse(firstDate > start ? firstDate : start)) / 86_400_000));
  const subscriptions = subsTotal.gt(0)
    ? {
        total: subsTotal.toFixed(2),
        monthly: subsTotal.div(Math.max(1, withData.length)).toFixed(2),
        count: Number(subs.count),
        days: expense.gt(0) ? Math.round(subsTotal.div(expense.div(dayCount)).toNumber()) : 0,
      }
    : null;

  // Hisenda (abans, perquè les inversions en fan servir els guanys realitzats): només si hi ha hagut vendes.
  const fiscal = await getFiscalOverview(user, year, currentYear);
  const tax =
    fiscal.year === year && fiscal.sales.length > 0
      ? { net: fiscal.net, tax: fiscal.result.tax, regime: fiscal.regime.regime, sales: fiscal.sales.length }
      : null;

  // Inversions: valor a l'inici (primera foto mensual de l'any) i al final (foto de l'1 de gener següent o avui).
  const positions = await getPositions(user);
  let investments: WrappedData["investments"] = null;
  const first = snapshots[0];
  if (first) {
    const nextYear = snapshots.find((s) => s.date === `${year + 1}-01-01`);
    const priced = positions.filter((p) => p.value !== null);
    const endValue = final
      ? new Big(String((nextYear ?? snapshots[snapshots.length - 1]).market_value))
      : priced.reduce((acc, p) => acc.plus(p.value!), new Big(0));
    const startValue = new Big(String(first.market_value));
    const best = priced
      .filter((p) => new Big(p.cost).gt(0))
      .map((p) => ({ name: p.name, pct: Math.round(new Big(p.value!).div(p.cost).minus(1).times(100).toNumber()) }))
      .sort((a, b) => b.pct - a.pct)[0];
    const firstDay = String(first.date);
    investments = {
      startMonth: firstDay === start ? null : Number(firstDay.slice(5, 7)),
      start: startValue.toFixed(2),
      end: endValue.toFixed(2),
      change: change(endValue.toFixed(2), startValue.toFixed(2)),
      realized: tax ? tax.net : null,
      latent: final ? null : priced.reduce((acc, p) => acc.plus(p.value!).minus(p.cost), new Big(0)).toFixed(2),
      best: best ?? null,
    };
  }

  const savingsRate = rate(saved, income);
  const topCat = topCategories[0];
  const persona = personaFor({
    savingsRate,
    contributions: Number(String(invested?.total ?? "0")),
    saved: Number(saved.toFixed(2)),
    topCategory: topCat ? { name: topCat.name, share: topCat.share } : null,
  });

  return {
    year,
    final,
    through: final ? null : { day: Number(today.slice(8, 10)), month: throughMonth },
    movements,
    concepts: Number(current.concepts ?? 0),
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    saved: saved.toFixed(2),
    savingsRate,
    prev: hasPrev
      ? {
          year: year - 1,
          income: prevIncome.toFixed(2),
          expense: prevExpense.toFixed(2),
          saved: prevIncome.minus(prevExpense).toFixed(2),
          savingsRate: rate(prevIncome.minus(prevExpense), prevIncome),
        }
      : null,
    topCategories,
    win,
    topConcepts: concepts.map((c) => ({
      concept: String(c.concept),
      count: Number(c.n),
      total: String(c.total),
      category: { name: String(c.cname), icon: (c.icon as string | null) ?? null, color: (c.color as string | null) ?? null },
    })),
    months: months.map(({ month, expense }) => ({ month, expense })),
    priciestMonth: priciest ? { month: priciest.month, expense: priciest.expense } : null,
    cheapestMonth: cheapest ? { month: cheapest.month, expense: cheapest.expense } : null,
    monthlyAverage,
    subscriptions,
    investments,
    tax,
    persona,
  };
}
