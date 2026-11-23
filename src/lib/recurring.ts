import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { withRls, type JwtClaims } from "@/db";

import { addDays } from "./format";
import { nextOccurrence, occurrences, type Frequency } from "./recurrence";

type Db = { execute: (query: SQL) => Promise<unknown> };
type Row = Record<string, unknown>;

/** Com a molt es recuperen 3 mesos enrere (si el cron ha fallat uns dies, s'omplen; mai anys sencers). */
const MAX_LOOKBACK_DAYS = 93;

/**
 * Crea els moviments dels recurrents que toquen fins avui:
 * - import fix → moviment confirmat, amb el signe de la categoria (els ingressos sumen, la resta resta);
 * - import variable → moviment pendent sense import, perquè l'usuari hi escrigui la xifra.
 * Només genera dates posteriors a l'últim moviment de la regla: si se n'esborra un, no torna a aparèixer.
 * Amb `adminDb` ho fa per a tots els usuaris (cron); dins de `withRls`, només per a l'usuari de la sessió.
 */
export async function generateRecurring(db: Db, today: string): Promise<{ created: number; pending: number }> {
  const rules = (await db.execute(sql`
    select r.id::text, r.user_id::text, r.concept, r.amount::text, r.category_id::text, r.account_id::text,
           r.frequency::text, r.day_of_month, r.start_date::text, r.end_date::text, c.kind::text as category_kind,
           (select max(t.date)::text from transactions t where t.recurring_id = r.id) as last_date
    from recurring_rules r join categories c on c.id = r.category_id
    where r.is_active and r.start_date <= ${today}::date
  `)) as Row[];

  const floor = addDays(today, -MAX_LOOKBACK_DAYS);
  let created = 0;
  let pending = 0;
  for (const r of rules) {
    const last = (r.last_date as string | null) ?? null;
    const after = last && last > floor ? last : floor;
    const dates = occurrences(
      {
        frequency: r.frequency as Frequency,
        dayOfMonth: Number(r.day_of_month),
        startDate: String(r.start_date),
        endDate: (r.end_date as string | null) ?? null,
      },
      after,
      today,
    );
    const fixed = r.amount !== null;
    const signed = fixed ? (r.category_kind === "income" ? String(r.amount) : `-${String(r.amount)}`) : null;
    for (const date of dates) {
      const inserted = (await db.execute(sql`
        insert into transactions (user_id, date, concept, amount, status, category_id, account_id, recurring_id)
        values (${String(r.user_id)}, ${date}::date, ${String(r.concept)}, ${signed}::numeric,
                ${fixed ? "confirmed" : "pending"}::transaction_status, ${String(r.category_id)},
                ${(r.account_id as string | null) ?? null}, ${String(r.id)})
        on conflict (recurring_id, date) do nothing
        returning id
      `)) as Row[];
      if (inserted.length > 0) {
        created++;
        if (!fixed) pending++;
      }
    }
  }
  return { created, pending };
}

// ---------------------------------------------------------------------------
// Consultes per a la pantalla de recurrents (sempre amb RLS)
// ---------------------------------------------------------------------------

export type RecurringRule = {
  id: string;
  concept: string;
  /** Import sense signe; null = variable. */
  amount: string | null;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  categoryKind: string;
  frequency: Frequency;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  lastDate: string | null;
  nextDate: string | null;
};

export async function getRecurringRules(user: JwtClaims, today: string): Promise<RecurringRule[]> {
  const rows = (await withRls(user, (tx) =>
    tx.execute(sql`
      select r.id::text, r.concept, r.amount::text, r.category_id::text, c.name as category_name, c.icon, c.color,
             c.kind::text as category_kind, r.frequency::text, r.day_of_month, r.start_date::text, r.end_date::text,
             r.is_active, (select max(t.date)::text from transactions t where t.recurring_id = r.id) as last_date
      from recurring_rules r join categories c on c.id = r.category_id
      order by r.is_active desc, r.day_of_month, r.concept
    `),
  )) as unknown as Row[];
  return rows.map((r) => {
    const rule = {
      frequency: r.frequency as Frequency,
      dayOfMonth: Number(r.day_of_month),
      startDate: String(r.start_date),
      endDate: (r.end_date as string | null) ?? null,
    };
    const last = (r.last_date as string | null) ?? null;
    const from = last && last >= today ? addDays(last, 1) : addDays(today, 1);
    return {
      id: String(r.id),
      concept: String(r.concept),
      amount: (r.amount as string | null) ?? null,
      categoryId: String(r.category_id),
      categoryName: String(r.category_name),
      categoryIcon: (r.icon as string | null) ?? null,
      categoryColor: (r.color as string | null) ?? null,
      categoryKind: String(r.category_kind),
      ...rule,
      isActive: Boolean(r.is_active),
      lastDate: last,
      nextDate: r.is_active ? nextOccurrence(rule, from) : null,
    };
  });
}

export type RecurringSuggestion = {
  concept: string;
  categoryId: string;
  /** Import sense signe si sempre és el mateix; null si varia. */
  amount: string | null;
  dayOfMonth: number;
  months: number;
};

/**
 * Candidats a recurrent a partir dels últims 6 mesos: el mateix concepte i categoria en almenys 4 mesos
 * diferents, i com a molt un cop per mes (així el cafè o el súper no hi surten).
 */
export async function getRecurringSuggestions(user: JwtClaims, today: string): Promise<RecurringSuggestion[]> {
  const rows = (await withRls(user, (tx) =>
    tx.execute(sql`
      with recent as (
        select t.concept, t.category_id, abs(t.amount) as amount, t.date
        from transactions t
        where t.date > (${today}::date - interval '6 months') and t.date <= ${today}::date
          and t.status = 'confirmed' and t.amount is not null and t.recurring_id is null and t.trade_id is null
      ),
      g as (
        select lower(concept) as key, min(concept) as concept, category_id::text,
               count(distinct date_trunc('month', date))::int as months, count(*)::int as n,
               min(amount)::text as min_amount, max(amount)::text as max_amount,
               mode() within group (order by extract(day from date)::int) as day,
               (array_agg(amount order by date desc))[1]::text as last_amount
        from recent group by lower(concept), category_id
      )
      select g.* from g
      where g.months >= 4 and g.n <= g.months + 1
        and not exists (select 1 from recurring_rules r where lower(r.concept) = g.key)
      order by g.months desc, g.last_amount::numeric desc
      limit 12
    `),
  )) as unknown as Row[];
  return rows.map((r) => ({
    concept: String(r.concept),
    categoryId: String(r.category_id),
    amount: r.min_amount === r.max_amount ? String(r.last_amount) : null,
    dayOfMonth: Number(r.day),
    months: Number(r.months),
  }));
}
