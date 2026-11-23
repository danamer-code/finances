import "server-only";

import { sql } from "drizzle-orm";

import { adminDb } from "@/db";
import { getUserPrefs } from "@/i18n/server";

import { coinbaseProvider } from "./prices/coinbase";
import { countStaleBalances } from "./balances";
import { getCategorySpending } from "./data";
import { shiftMonth } from "./format";
import { planNotices } from "./notifications";
import { sendPushToUser } from "./push";
import { generateRecurring } from "./recurring";
import { ecbProvider } from "./prices/ecb";
import { eodhdProvider } from "./prices/eodhd";
import { googleSheetProvider } from "./prices/google-sheet";
import { isSuspicious, type FxProvider, type HoldingKind, type HoldingRef, type PriceProvider } from "./prices/quotes";

type Row = Record<string, unknown>;

export type DailyReport = {
  date: string;
  prices: {
    updated: number;
    /** Posicions sense cap font que les cobreixi: el preu es posa a mà des del detall. */
    uncovered: string[];
    skipped: string[];
    suspicious: string[];
    errors: string[];
  };
  fx: { updated: number; error?: string };
  recurring: { created: number; pending: number; error?: string };
  notifications: { sent: number; error?: string };
  snapshots: { taken: boolean; users: number };
};

/** Fonts de preus, per ordre de preferència: cada posició la cotitza la primera que la cobreix. */
export function defaultProviders(today?: string): PriceProvider[] {
  return [coinbaseProvider, eodhdProvider(undefined, today), googleSheetProvider()].filter(
    (p): p is PriceProvider => p !== null,
  );
}

/**
 * Feina diària (un sol cron, compatible amb el pla gratuït de Vercel):
 * 1. Preus de les posicions actives (cada font cobreix uns tipus) i tipus de canvi oficials del BCE.
 * 2. Moviments recurrents que toquen avui (els d'import variable queden pendents).
 * 3. Avisos (notificacions) als usuaris que les tenen activades.
 * 4. El dia 1 de cada mes, foto del patrimoni de cada usuari a net_worth_snapshots.
 */
export async function runDaily(
  today: string,
  providers: PriceProvider[] = defaultProviders(today),
  fxProvider: FxProvider = ecbProvider,
): Promise<DailyReport> {
  const report: DailyReport = {
    date: today,
    prices: { updated: 0, uncovered: [], skipped: [], suspicious: [], errors: [] },
    fx: { updated: 0 },
    recurring: { created: 0, pending: 0 },
    notifications: { sent: 0 },
    snapshots: { taken: false, users: 0 },
  };

  const holdings = (await adminDb.execute(sql`
    select h.id::text, h.user_id::text, h.kind::text, h.currency,
           upper(coalesce(nullif(h.ticker, ''), h.isin, '')) as key,
           (select p.price::text from prices p where p.holding_id = h.id order by p.date desc limit 1) as last_price
    from holdings h
    where h.is_active and coalesce(nullif(h.ticker, ''), h.isin) is not null
  `)) as unknown as Array<{ id: string; user_id: string; kind: HoldingKind; currency: string; key: string; last_price: string | null }>;

  // Una mateixa clau (p. ex. NASDAQ:MSFT) pot ser de diversos usuaris: es cotitza una sola vegada.
  const refs = new Map<string, HoldingRef>();
  for (const h of holdings) refs.set(h.key, { key: h.key, kind: h.kind, currency: h.currency });
  const pending = new Map(refs);

  for (const provider of providers) {
    const batch = [...pending.values()].filter(provider.covers);
    if (batch.length === 0) continue;
    try {
      const { quotes, skipped, error } = await provider.fetch(batch);
      report.prices.skipped.push(...skipped.map((k) => `${k} (${provider.name})`));
      if (error) report.prices.errors.push(`${provider.name}: ${error}`);
      for (const q of quotes) {
        if (!pending.has(q.key)) continue;
        pending.delete(q.key);
        for (const h of holdings.filter((x) => x.key === q.key)) {
          if (isSuspicious(h.last_price, q.price)) {
            report.prices.suspicious.push(`${q.key}: ${h.last_price} → ${q.price} (${provider.name})`);
            continue;
          }
          await adminDb.execute(sql`
            insert into prices (user_id, holding_id, date, price, currency)
            values (${h.user_id}, ${h.id}, ${q.date ?? today}::date, ${q.price}::numeric, ${q.currency})
            on conflict (holding_id, date) do update set price = excluded.price, currency = excluded.currency
          `);
          report.prices.updated++;
        }
      }
    } catch (e) {
      report.prices.errors.push(`${provider.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  report.prices.uncovered = [...pending.keys()].filter((k) => !providers.some((p) => p.covers(refs.get(k)!)));

  try {
    // Divises de les posicions i les divises principals dels usuaris (per convertir, p. ex., dòlars a xéquels).
    const bases = (await adminDb.execute(sql`select distinct currency::text as c from profiles`)) as unknown as Row[];
    const currencies = [...new Set([...holdings.map((h) => h.currency), ...bases.map((b) => String(b.c))])];
    for (const f of await fxProvider.fetch(currencies)) {
      await adminDb.execute(sql`
        insert into fx_rates (date, base, quote, rate) values (${f.date}::date, ${f.base}, ${f.quote}, ${f.rate}::numeric)
        on conflict (date, base, quote) do update set rate = excluded.rate
      `);
      report.fx.updated++;
    }
  } catch (e) {
    report.fx.error = e instanceof Error ? e.message : String(e);
  }

  try {
    report.recurring = await generateRecurring(adminDb, today);
  } catch (e) {
    report.recurring.error = e instanceof Error ? e.message : String(e);
  }

  try {
    report.notifications.sent = await sendDailyNotices(today);
  } catch (e) {
    report.notifications.error = e instanceof Error ? e.message : String(e);
  }

  if (today.endsWith("-01")) {
    const result = (await adminDb.execute(sql`
      with lots as (
        select user_id, holding_id, sum(remaining_qty) as qty, sum(round(remaining_qty * unit_cost_eur, 2)) as cost
        from tax_lots group by user_id, holding_id
      ),
      last_price as (select distinct on (holding_id) holding_id, price, currency from prices order by holding_id, date desc),
      last_fx as (select distinct on (base) base, rate from fx_rates where quote = 'EUR' order by base, date desc),
      user_base as (
        select pr.user_id, pr.currency::text as cur,
               case when pr.currency = 'EUR' then 1 else (select rate from last_fx where last_fx.base = pr.currency::text) end as rate
        from profiles pr
      ),
      valued as (
        select l.user_id, h.kind, l.cost,
               round(l.qty * p.price * coalesce(
                 case when p.currency = ub.cur then 1 end,
                 coalesce(case when p.currency = 'EUR' then 1 end, fx.rate) / nullif(ub.rate, 0)
               ), 2) as value
        from lots l
        join holdings h on h.id = l.holding_id
        join last_price p on p.holding_id = l.holding_id
        left join last_fx fx on fx.base = p.currency
        left join user_base ub on ub.user_id = l.user_id
        where l.qty > 0
      ),
      balances as (
        select distinct on (b.account_id) b.user_id, b.account_id, b.balance, a.kind
        from account_balances b join accounts a on a.id = b.account_id
        order by b.account_id, b.date desc
      ),
      per_user as (
        select user_id,
               coalesce(sum(value), 0) as market_value,
               coalesce(sum(cost), 0) as contributed,
               coalesce(sum(value) filter (where kind = 'fund'), 0) as funds,
               coalesce(sum(value) filter (where kind = 'stock'), 0) as stocks,
               coalesce(sum(value) filter (where kind = 'crypto'), 0) as crypto
        from valued group by user_id
      )
      insert into net_worth_snapshots (user_id, date, market_value, contributed, breakdown, source)
      select u.user_id, ${today}::date, u.market_value, u.contributed,
             jsonb_build_object(
               'funds', u.funds::text, 'stocks', u.stocks::text, 'crypto', u.crypto::text,
               'cash', coalesce((select sum(balance) from balances b where b.user_id = u.user_id and b.kind <> 'loan'), 0)::text,
               'loans', coalesce((select sum(balance) from balances b where b.user_id = u.user_id and b.kind = 'loan'), 0)::text
             ),
             'cron'
      from per_user u
      on conflict (user_id, date) do update
        set market_value = excluded.market_value, contributed = excluded.contributed,
            breakdown = excluded.breakdown, source = excluded.source
      returning user_id
    `)) as unknown as Row[];
    report.snapshots = { taken: true, users: result.length };
  }

  return report;
}

/**
 * Avisos del dia per a cada usuari amb algun dispositiu subscrit, en el seu idioma i la seva divisa (del perfil:
 * el cron no té galetes). Retorna quants avisos s'han enviat.
 */
async function sendDailyNotices(today: string): Promise<number> {
  const users = (await adminDb.execute(sql`select distinct user_id::text from push_subscriptions`)) as unknown as Row[];
  const month = today.slice(0, 7);
  let sent = 0;
  for (const u of users) {
    const userId = String(u.user_id);
    const claims = { sub: userId, role: "authenticated" };
    const pending = (await adminDb.execute(sql`
      select concept, (date = ${today}::date and recurring_id is not null) as is_new
      from transactions where user_id = ${userId} and status = 'pending'
    `)) as unknown as Row[];
    const spending = await getCategorySpending(claims, {
      start: `${month}-01`,
      end: `${shiftMonth(month, 1)}-01`,
      prevStart: `${shiftMonth(month, -1)}-01`,
      prevEnd: `${month}-01`,
    });
    const sentKeys = (await adminDb.execute(sql`select key from notification_log where user_id = ${userId}`)) as unknown as Row[];
    const prefs = await getUserPrefs(userId);
    const notices = planNotices(
      {
        today,
        newPending: pending.filter((p) => p.is_new).map((p) => String(p.concept)),
        budgets: spending.filter((c) => c.budget !== null).map((c) => ({ id: c.id, name: c.name, spent: c.current, budget: c.budget! })),
        staleBalances: await countStaleBalances(claims, today),
        alreadySent: new Set(sentKeys.map((k) => String(k.key))),
      },
      prefs,
    );
    for (const n of notices) {
      const result = await sendPushToUser(userId, { title: n.title, body: n.body, url: n.url, tag: n.tag, badge: pending.length });
      if (result.sent > 0) {
        await adminDb.execute(sql`
          insert into notification_log (user_id, key) values (${userId}, ${n.key}) on conflict (user_id, key) do nothing
        `);
        sent++;
      }
    }
  }
  return sent;
}
