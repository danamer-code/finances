import "server-only";

import { sql } from "drizzle-orm";

import { withRls, type JwtClaims } from "@/db";

type Row = Record<string, unknown>;

export type AccountBalance = { id: string; name: string; kind: string; balance: string | null; date: string | null };

/** Comptes actius amb l'últim saldo introduït (efectiu, préstecs...: no es poden derivar dels moviments). */
export async function getAccountBalances(user: JwtClaims): Promise<AccountBalance[]> {
  const rows = (await withRls(user, (tx) =>
    tx.execute(sql`
      select a.id::text, a.name, a.kind::text, b.balance::text, b.date::text
      from accounts a
      left join lateral (
        select balance, date from account_balances where account_id = a.id order by date desc limit 1
      ) b on true
      where a.is_active
      order by (b.date is null), a.sort_order, a.name
    `),
  )) as unknown as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    kind: String(r.kind),
    balance: (r.balance as string | null) ?? null,
    date: (r.date as string | null) ?? null,
  }));
}

/** Comptes que fan servir saldos però encara no en tenen cap d'aquest mes (per a l'avís d'Avui). */
export async function countStaleBalances(user: JwtClaims, today: string): Promise<number> {
  const [row] = (await withRls(user, (tx) =>
    tx.execute(sql`
      select count(*)::int as n from (
        select a.id, max(b.date) as last
        from accounts a join account_balances b on b.account_id = a.id
        where a.is_active
        group by a.id
      ) s
      where s.last < date_trunc('month', ${today}::date)
    `),
  )) as unknown as Row[];
  return Number(row?.n ?? 0);
}
