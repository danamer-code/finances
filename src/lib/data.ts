import "server-only";

import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { withRls, type JwtClaims } from "@/db";
import { categories, profiles, transactions } from "@/db/schema";

export type CategoryKind = "income" | "expense" | "investment";

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  monthlyBudget: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Categoria pare (null = categoria principal). */
  parentId: string | null;
};

export async function getCategories(user: JwtClaims): Promise<Category[]> {
  return withRls(user, (tx) =>
    tx
      .select({
        id: categories.id,
        name: categories.name,
        kind: categories.kind,
        icon: categories.icon,
        color: categories.color,
        monthlyBudget: categories.monthlyBudget,
        isActive: categories.isActive,
        sortOrder: categories.sortOrder,
        parentId: categories.parentId,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
  );
}

export type ConceptStat = {
  concept: string;
  count: number;
  recentCount: number;
  lastCategoryId: string;
  lastAmounts: string[];
};

/**
 * Estadístiques de cada concepte per a l'alta ràpida: quantes vegades s'ha fet servir (en total i en els
 * últims 120 dies), la categoria de l'última vegada i els darrers imports.
 */
export async function getConceptStats(user: JwtClaims): Promise<ConceptStat[]> {
  const rows = await withRls(user, (tx) =>
    tx.execute(sql`
      select t.concept,
             count(*)::int as count,
             count(*) filter (where t.date >= current_date - 120)::int as recent_count,
             (array_agg(t.category_id order by t.date desc, t.created_at desc))[1]::text as last_category_id,
             (array_agg(abs(t.amount)::text order by t.date desc, t.created_at desc))[1:6] as last_amounts
      from transactions t
      join categories c on c.id = t.category_id
      where t.status = 'confirmed' and c.kind in ('income', 'expense')
      group by t.concept
      order by recent_count desc, count desc
      limit 1500
    `),
  );
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    concept: String(r.concept),
    count: Number(r.count),
    recentCount: Number(r.recent_count),
    lastCategoryId: String(r.last_category_id),
    lastAmounts: [...new Set((r.last_amounts as string[]) ?? [])].slice(0, 3),
  }));
}

export type TransactionRow = {
  id: string;
  date: string;
  concept: string;
  amount: string | null;
  status: "confirmed" | "pending";
  notes: string | null;
  categoryId: string;
  categoryName: string;
  categoryKind: CategoryKind;
  categoryIcon: string | null;
  categoryColor: string | null;
  isGenerated: boolean;
};

const transactionColumns = {
  id: transactions.id,
  date: transactions.date,
  concept: transactions.concept,
  amount: transactions.amount,
  status: transactions.status,
  notes: transactions.notes,
  categoryId: transactions.categoryId,
  categoryName: categories.name,
  categoryKind: categories.kind,
  categoryIcon: categories.icon,
  categoryColor: categories.color,
  isGenerated: sql<boolean>`${transactions.tradeId} is not null`,
};

export type MovementFilter = "tots" | "despeses" | "ingressos" | "inversions";

export async function getMonthTransactions(user: JwtClaims, month: string, filter: MovementFilter, categoryIds?: string[]) {
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const kindFilter =
    filter === "despeses"
      ? eq(categories.kind, "expense")
      : filter === "ingressos"
        ? eq(categories.kind, "income")
        : filter === "inversions"
          ? eq(categories.kind, "investment")
          : undefined;

  return withRls(user, (tx) =>
    tx
      .select(transactionColumns)
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          gte(transactions.date, start),
          lt(transactions.date, end),
          kindFilter,
          categoryIds?.length ? inArray(transactions.categoryId, categoryIds) : undefined,
        ),
      )
      .orderBy(desc(transactions.date), desc(transactions.createdAt)),
  ) as Promise<TransactionRow[]>;
}

export async function getRecentTransactions(user: JwtClaims, limit = 5) {
  return withRls(user, (tx) =>
    tx
      .select(transactionColumns)
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(limit),
  ) as Promise<TransactionRow[]>;
}

export async function getPendingTransactions(user: JwtClaims) {
  return withRls(user, (tx) =>
    tx
      .select(transactionColumns)
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(eq(transactions.status, "pending"))
      .orderBy(asc(transactions.date)),
  ) as Promise<TransactionRow[]>;
}

export async function getTransaction(user: JwtClaims, id: string) {
  const [row] = (await withRls(user, (tx) =>
    tx
      .select(transactionColumns)
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(eq(transactions.id, id)),
  )) as TransactionRow[];
  return row ?? null;
}

export type MonthTotals = { income: string; expense: string; investment: string; saved: string; count: number };

/** Totals del mes calculats a Postgres (numeric), mai en coma flotant. */
export async function getMonthTotals(user: JwtClaims, month: string): Promise<MonthTotals> {
  const start = `${month}-01`;
  const rows = await withRls(user, (tx) =>
    tx.execute(sql`
      select coalesce(sum(t.amount) filter (where c.kind = 'income'), 0)::text as income,
             coalesce(sum(t.amount) filter (where c.kind = 'expense'), 0)::text as expense,
             coalesce(sum(t.amount) filter (where c.kind = 'investment'), 0)::text as investment,
             coalesce(sum(t.amount) filter (where c.kind in ('income', 'expense')), 0)::text as saved,
             count(*)::int as count
      from transactions t join categories c on c.id = t.category_id
      where t.status = 'confirmed'
        and t.date >= ${start}::date and t.date < (${start}::date + interval '1 month')
    `),
  );
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  return {
    income: String(r.income),
    expense: String(r.expense),
    investment: String(r.investment),
    saved: String(r.saved),
    count: Number(r.count),
  };
}

export async function getProfile(user: JwtClaims) {
  const [row] = await withRls(user, (tx) => tx.select().from(profiles).limit(1));
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard (fase 3). Tots els imports se sumen a Postgres i arriben com a text.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
const asRows = (r: unknown) => r as Row[];

export type MonthPoint = { month: string; income: string; expense: string; saved: string; count: number };

/** Ingressos, despeses i estalvi per mes, de `from` a `to` (yyyy-mm), amb els mesos buits a zero. */
export async function getMonthlySeries(user: JwtClaims, from: string, to: string): Promise<MonthPoint[]> {
  const rows = await withRls(user, (tx) =>
    tx.execute(sql`
      with months as (
        select generate_series(${`${from}-01`}::date, ${`${to}-01`}::date, interval '1 month')::date as m
      )
      select to_char(months.m, 'YYYY-MM') as month,
             coalesce(sum(t.amount) filter (where c.kind = 'income'), 0)::text as income,
             coalesce(sum(t.amount) filter (where c.kind = 'expense'), 0)::text as expense,
             coalesce(sum(t.amount) filter (where c.kind in ('income', 'expense')), 0)::text as saved,
             count(t.id)::int as count
      from months
      left join transactions t on t.status = 'confirmed' and date_trunc('month', t.date) = months.m
      left join categories c on c.id = t.category_id
      group by months.m order by months.m
    `),
  );
  return asRows(rows).map((r) => ({
    month: String(r.month),
    income: String(r.income),
    expense: String(r.expense),
    saved: String(r.saved),
    count: Number(r.count),
  }));
}

export type DayPoint = { day: number; expense: string };

/** Despesa de cada dia del mes (en positiu), amb els dies sense despesa a zero. */
export async function getDailyExpenses(user: JwtClaims, month: string): Promise<DayPoint[]> {
  const rows = await withRls(user, (tx) =>
    tx.execute(sql`
      with days as (
        select generate_series(${`${month}-01`}::date,
                               (${`${month}-01`}::date + interval '1 month' - interval '1 day')::date,
                               interval '1 day')::date as d
      )
      select extract(day from days.d)::int as day,
             coalesce(-sum(t.amount) filter (where c.kind = 'expense'), 0)::text as expense
      from days
      left join transactions t on t.status = 'confirmed' and t.date = days.d
      left join categories c on c.id = t.category_id
      group by days.d order by days.d
    `),
  );
  return asRows(rows).map((r) => ({ day: Number(r.day), expense: String(r.expense) }));
}

export type CategorySpend = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  current: string;
  previous: string;
  budget: string | null;
};

/** Despesa per categoria en un període i en el període anterior (mes o any), en positiu. */
export async function getCategorySpending(
  user: JwtClaims,
  period: { start: string; end: string; prevStart: string; prevEnd: string },
): Promise<CategorySpend[]> {
  // Agrupat per categoria principal: una subcategoria suma a la seva categoria (Restaurants → Oci).
  // Pressupost: el de la principal, o si no en té, la suma dels de les subcategories.
  const rows = await withRls(user, (tx) =>
    tx.execute(sql`
      with moves as (
        select coalesce(c.parent_id, c.id) as top_id, t.amount, t.date
        from transactions t join categories c on c.id = t.category_id
        where t.status = 'confirmed' and c.kind = 'expense'
          and t.date >= least(${period.start}::date, ${period.prevStart}::date)
          and t.date < greatest(${period.end}::date, ${period.prevEnd}::date)
      ),
      sub_budgets as (
        select parent_id as top_id, sum(monthly_budget) as budget
        from categories where parent_id is not null and monthly_budget is not null group by parent_id
      ),
      totals as (
        select top.id, top.name, top.icon, top.color, coalesce(top.monthly_budget, sb.budget) as budget,
               coalesce(-sum(m.amount) filter (where m.date >= ${period.start}::date and m.date < ${period.end}::date), 0) as current,
               coalesce(-sum(m.amount) filter (where m.date >= ${period.prevStart}::date and m.date < ${period.prevEnd}::date), 0) as previous
        from categories top
        left join moves m on m.top_id = top.id
        left join sub_budgets sb on sb.top_id = top.id
        where top.kind = 'expense' and top.parent_id is null
        group by top.id, sb.budget
      )
      select id::text, name, icon, color, budget::text, current::text, previous::text
      from totals
      where current <> 0 or budget is not null
      order by current desc
    `),
  );
  return asRows(rows).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    icon: (r.icon as string | null) ?? null,
    color: (r.color as string | null) ?? null,
    current: String(r.current),
    previous: String(r.previous),
    budget: (r.budget as string | null) ?? null,
  }));
}

export type YearSummary = {
  year: number;
  income: string;
  expense: string;
  saved: string;
  firstMonth: number;
  lastMonth: number;
  count: number;
};

/** Totals per any natural, per comparar anys entre ells (amb el primer i l'últim mes amb dades). */
export async function getYearSummaries(user: JwtClaims): Promise<YearSummary[]> {
  const rows = await withRls(user, (tx) =>
    tx.execute(sql`
      select extract(year from t.date)::int as year,
             coalesce(sum(t.amount) filter (where c.kind = 'income'), 0)::text as income,
             coalesce(sum(t.amount) filter (where c.kind = 'expense'), 0)::text as expense,
             coalesce(sum(t.amount) filter (where c.kind in ('income', 'expense')), 0)::text as saved,
             min(extract(month from t.date))::int as first_month,
             max(extract(month from t.date))::int as last_month,
             count(*)::int as count
      from transactions t join categories c on c.id = t.category_id
      where t.status = 'confirmed' and c.kind in ('income', 'expense')
      group by 1 order by 1
    `),
  );
  return asRows(rows).map((r) => ({
    year: Number(r.year),
    income: String(r.income),
    expense: String(r.expense),
    saved: String(r.saved),
    firstMonth: Number(r.first_month),
    lastMonth: Number(r.last_month),
    count: Number(r.count),
  }));
}

/** Primer mes amb moviments ("2023-09"), o null si encara no n'hi ha cap. */
export async function getFirstMovementMonth(user: JwtClaims): Promise<string | null> {
  const rows = (await withRls(user, (tx) =>
    tx.execute(sql`select to_char(min(date), 'YYYY-MM') as month from transactions`),
  )) as unknown as Array<{ month: string | null }>;
  return rows[0]?.month ?? null;
}
