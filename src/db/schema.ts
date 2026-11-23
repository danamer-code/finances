/**
 * Esquema de la base de dades. Font de veritat: les migracions SQL de supabase/migrations
 * es generen a partir d'aquest fitxer amb `npm run db:generate`.
 *
 * Regles que no es poden trencar (spec §2 i §9):
 * - Totes les taules d'usuari porten `user_id` i RLS amb política `user_id = auth.uid()`.
 * - Imports en `numeric`, mai `float`. Drizzle els retorna com a `string`: no els convertim a
 *   `number` per fer càlculs de diners.
 * - Les claus foranes entre taules d'usuari són compostes `(id, user_id)`: així un usuari no pot
 *   apuntar a files d'un altre encara que endevini l'id (les FK no passen per RLS).
 * - `tax_lots` i `tax_disposals` són derivades: l'usuari només les pot llegir.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const categoryKind = pgEnum("category_kind", ["income", "expense", "investment"]);
export const accountKind = pgEnum("account_kind", ["bank", "broker", "crypto", "cash", "loan"]);
export const holdingKind = pgEnum("holding_kind", ["fund", "stock", "crypto", "cash"]);
export const tradeSide = pgEnum("trade_side", [
  "buy",
  "sell",
  "transfer_in",
  "transfer_out",
  "scrip",
  "rights_sale",
  "reward",
]);
export const tradeSource = pgEnum("trade_source", [
  "broker_export",
  "broker_fiscal_report",
  "spreadsheet",
  "manual",
]);
export const recurringFrequency = pgEnum("recurring_frequency", ["monthly", "quarterly", "yearly"]);
export const transactionStatus = pgEnum("transaction_status", ["confirmed", "pending"]);
export const fiscalRegime = pgEnum("fiscal_regime", ["irpf", "irnr"]);
export const themePreference = pgEnum("theme_preference", ["dark", "light", "system"]);
export const appLocale = pgEnum("app_locale", ["ca", "en", "he"]);
export const baseCurrency = pgEnum("base_currency", ["EUR", "USD", "ILS"]);
export const snapshotSource = pgEnum("snapshot_source", ["spreadsheet", "cron"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const id = () => uuid().primaryKey().defaultRandom();

/** Propietari de la fila. Per defecte l'usuari autenticat, així el client no l'ha d'enviar. */
const ownerId = () =>
  uuid()
    .notNull()
    .default(sql`auth.uid()`)
    .references(() => authUsers.id, { onDelete: "cascade" });

const money = () => numeric({ precision: 14, scale: 2 });
const quantity = () => numeric({ precision: 20, scale: 8 });
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

const ownRows = (table: string, userId: AnyPgColumn) =>
  pgPolicy(`${table}_own_rows`, {
    as: "permissive",
    for: "all",
    to: authenticatedRole,
    using: sql`${userId} = ${authUid}`,
    withCheck: sql`${userId} = ${authUid}`,
  });

/** Taules derivades: l'usuari només llegeix; les escriu el servidor en regenerar el FIFO. */
const ownRowsReadOnly = (table: string, userId: AnyPgColumn) =>
  pgPolicy(`${table}_own_rows_select`, {
    as: "permissive",
    for: "select",
    to: authenticatedRole,
    using: sql`${userId} = ${authUid}`,
  });

// ---------------------------------------------------------------------------
// Perfil i preferències
// ---------------------------------------------------------------------------

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid()
      .primaryKey()
      .default(sql`auth.uid()`)
      .references(() => authUsers.id, { onDelete: "cascade" }),
    theme: themePreference().notNull().default("dark"),
    /** Idioma de la interfície. */
    locale: appLocale().notNull().default("ca"),
    /** Divisa en què es desen i es mostren els imports (no es converteixen si es canvia). */
    currency: baseCurrency().notNull().default("EUR"),
    /** Pestanya Fiscal (plusvàlues i IRPF d'Espanya). Amagada per defecte als usuaris nous. */
    fiscalTab: boolean().notNull().default(false),
    /** Llindar de l'avís de concentració (0,10 = 10 % de la cartera). */
    concentrationThreshold: numeric({ precision: 5, scale: 4 }).notNull().default("0.1000"),
    onboardedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [ownRows("profiles", t.userId)],
);

// ---------------------------------------------------------------------------
// Categories, comptes i saldos
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: id(),
    userId: ownerId(),
    name: text().notNull(),
    kind: categoryKind().notNull(),
    /** Categoria pare (un sol nivell): p. ex. Restaurants dins d'Oci. Null = categoria principal. */
    parentId: uuid(),
    monthlyBudget: money(),
    color: text(),
    icon: text(),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.userId, t.name),
    unique().on(t.id, t.userId),
    // Mateix usuari que el pare; no es pot esborrar un pare amb subcategories (s'arxiva).
    foreignKey({ columns: [t.parentId, t.userId], foreignColumns: [t.id, t.userId] }),
    check("categories_not_own_parent", sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
    index().on(t.parentId),
    ownRows("categories", t.userId),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: ownerId(),
    name: text().notNull(),
    kind: accountKind().notNull(),
    currency: char({ length: 3 }).notNull().default("EUR"),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.userId, t.name), unique().on(t.id, t.userId), ownRows("accounts", t.userId)],
);

/** Saldos mensuals d'efectiu i préstecs, introduïts a mà (no es poden derivar dels moviments). */
export const accountBalances = pgTable(
  "account_balances",
  {
    id: id(),
    userId: ownerId(),
    accountId: uuid().notNull(),
    date: date().notNull(),
    balance: money().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.accountId, t.date),
    foreignKey({ columns: [t.accountId, t.userId], foreignColumns: [accounts.id, accounts.userId] }).onDelete(
      "cascade",
    ),
    ownRows("account_balances", t.userId),
  ],
);

// ---------------------------------------------------------------------------
// Recurrents i moviments
// ---------------------------------------------------------------------------

export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: id(),
    userId: ownerId(),
    concept: text().notNull(),
    /** Null = import variable (p. ex. interessos): es genera el moviment pendent i l'usuari hi posa la xifra. */
    amount: money(),
    categoryId: uuid().notNull(),
    accountId: uuid(),
    frequency: recurringFrequency().notNull(),
    dayOfMonth: integer().notNull(),
    startDate: date().notNull(),
    endDate: date(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.id, t.userId),
    check("recurring_rules_day_of_month", sql`${t.dayOfMonth} between 1 and 31`),
    foreignKey({ columns: [t.categoryId, t.userId], foreignColumns: [categories.id, categories.userId] }),
    foreignKey({ columns: [t.accountId, t.userId], foreignColumns: [accounts.id, accounts.userId] }),
    ownRows("recurring_rules", t.userId),
  ],
);

// ---------------------------------------------------------------------------
// Inversions
// ---------------------------------------------------------------------------

export const holdings = pgTable(
  "holdings",
  {
    id: id(),
    userId: ownerId(),
    name: text().notNull(),
    kind: holdingKind().notNull(),
    /** Format del full de preus: NASDAQ:MSFT, BME:ITX… */
    ticker: text(),
    isin: text(),
    currency: char({ length: 3 }).notNull().default("EUR"),
    accountId: uuid().notNull(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.id, t.userId),
    foreignKey({ columns: [t.accountId, t.userId], foreignColumns: [accounts.id, accounts.userId] }),
    ownRows("holdings", t.userId),
  ],
);

/** Operacions: font de veritat de la cartera. */
export const trades = pgTable(
  "trades",
  {
    id: id(),
    userId: ownerId(),
    holdingId: uuid().notNull(),
    date: date().notNull(),
    side: tradeSide().notNull(),
    quantity: quantity().notNull(),
    /** En divisa del producte. Pot faltar si el broker només dona l'import total. */
    price: quantity(),
    fees: money().notNull().default("0"),
    /** Tipus de canvi a EUR guardat el dia de l'operació, mai recalculat. */
    fxRate: numeric({ precision: 18, scale: 8 }),
    /** Import net en EUR, comissions incloses. És el que compta fiscalment. */
    amountEur: money().notNull(),
    /** Enllaça les dues potes d'un traspàs: el lot conserva cost i data. */
    transferGroupId: uuid(),
    isEstimated: boolean().notNull().default(false),
    source: tradeSource().notNull().default("manual"),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.id, t.userId),
    check("trades_quantity_positive", sql`${t.quantity} > 0`),
    index().on(t.holdingId, t.date),
    foreignKey({ columns: [t.holdingId, t.userId], foreignColumns: [holdings.id, holdings.userId] }).onDelete(
      "cascade",
    ),
    ownRows("trades", t.userId),
  ],
);

/** Moviments. Taula central. Positiu = ingrés, negatiu = despesa. */
export const transactions = pgTable(
  "transactions",
  {
    /** El client pot generar l'UUID (alta offline sense duplicats en sincronitzar). */
    id: id(),
    userId: ownerId(),
    date: date().notNull(),
    concept: text().notNull(),
    amount: money(),
    status: transactionStatus().notNull().default("confirmed"),
    categoryId: uuid().notNull(),
    accountId: uuid(),
    recurringId: uuid(),
    /** Aportació o desinversió generada automàticament a partir d'una operació. */
    tradeId: uuid(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("transactions_amount_when_confirmed", sql`${t.status} = 'pending' or ${t.amount} is not null`),
    unique("transactions_trade_unique").on(t.tradeId),
    unique("transactions_recurring_date_unique").on(t.recurringId, t.date),
    index().on(t.userId, t.date),
    index().on(t.userId, t.concept),
    foreignKey({ columns: [t.categoryId, t.userId], foreignColumns: [categories.id, categories.userId] }),
    foreignKey({ columns: [t.accountId, t.userId], foreignColumns: [accounts.id, accounts.userId] }),
    foreignKey({
      columns: [t.recurringId, t.userId],
      foreignColumns: [recurringRules.id, recurringRules.userId],
    }),
    foreignKey({ columns: [t.tradeId, t.userId], foreignColumns: [trades.id, trades.userId] }).onDelete(
      "cascade",
    ),
    ownRows("transactions", t.userId),
  ],
);

/** Variants d'un concepte (cafe, Cafè, cafès) que apunten al nom canònic. */
export const conceptAliases = pgTable(
  "concept_aliases",
  {
    id: id(),
    userId: ownerId(),
    alias: text().notNull(),
    canonical: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.userId, t.alias), ownRows("concept_aliases", t.userId)],
);

// ---------------------------------------------------------------------------
// Fiscal (derivat de trades)
// ---------------------------------------------------------------------------

export const taxLots = pgTable(
  "tax_lots",
  {
    id: id(),
    userId: ownerId(),
    holdingId: uuid().notNull(),
    buyTradeId: uuid().notNull(),
    /** Data fiscal: en un traspàs és la de la compra original. */
    buyDate: date().notNull(),
    quantity: quantity().notNull(),
    remainingQty: quantity().notNull(),
    unitCostEur: quantity().notNull(),
  },
  (t) => [
    unique().on(t.id, t.userId),
    index().on(t.holdingId, t.buyDate),
    foreignKey({ columns: [t.holdingId, t.userId], foreignColumns: [holdings.id, holdings.userId] }).onDelete(
      "cascade",
    ),
    foreignKey({ columns: [t.buyTradeId, t.userId], foreignColumns: [trades.id, trades.userId] }).onDelete(
      "cascade",
    ),
    ownRowsReadOnly("tax_lots", t.userId),
  ],
);

export const taxDisposals = pgTable(
  "tax_disposals",
  {
    id: id(),
    userId: ownerId(),
    sellTradeId: uuid().notNull(),
    taxLotId: uuid().notNull(),
    quantity: quantity().notNull(),
    proceedsEur: money().notNull(),
    costBasisEur: money().notNull(),
    gainEur: money().notNull().generatedAlwaysAs(sql`proceeds_eur - cost_basis_eur`),
    fiscalYear: integer().notNull(),
  },
  (t) => [
    index().on(t.userId, t.fiscalYear),
    foreignKey({ columns: [t.sellTradeId, t.userId], foreignColumns: [trades.id, trades.userId] }).onDelete(
      "cascade",
    ),
    foreignKey({ columns: [t.taxLotId, t.userId], foreignColumns: [taxLots.id, taxLots.userId] }).onDelete(
      "cascade",
    ),
    ownRowsReadOnly("tax_disposals", t.userId),
  ],
);

/** Règim fiscal de cada any (IRNR només el 2025): canvia com es compensen les pèrdues. */
export const fiscalYears = pgTable(
  "fiscal_years",
  {
    id: id(),
    userId: ownerId(),
    year: integer().notNull(),
    regime: fiscalRegime().notNull().default("irpf"),
    country: char({ length: 2 }).notNull().default("ES"),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.userId, t.year), ownRows("fiscal_years", t.userId)],
);

// ---------------------------------------------------------------------------
// Preus, canvis de divisa i patrimoni
// ---------------------------------------------------------------------------

export const prices = pgTable(
  "prices",
  {
    userId: ownerId(),
    holdingId: uuid().notNull(),
    date: date().notNull(),
    price: quantity().notNull(),
    currency: char({ length: 3 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.holdingId, t.date] }),
    foreignKey({ columns: [t.holdingId, t.userId], foreignColumns: [holdings.id, holdings.userId] }).onDelete(
      "cascade",
    ),
    ownRows("prices", t.userId),
  ],
);

/** Dades de referència compartides (no són de cap usuari): lectura per a tothom, escriu el cron. */
export const fxRates = pgTable(
  "fx_rates",
  {
    date: date().notNull(),
    base: char({ length: 3 }).notNull(),
    quote: char({ length: 3 }).notNull(),
    rate: numeric({ precision: 18, scale: 8 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.date, t.base, t.quote] }),
    pgPolicy("fx_rates_read", { as: "permissive", for: "select", to: authenticatedRole, using: sql`true` }),
  ],
);

export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    id: id(),
    userId: ownerId(),
    date: date().notNull(),
    marketValue: money().notNull(),
    contributed: money(),
    /** {funds, stocks, crypto, cash, loans} */
    breakdown: jsonb().$type<Record<string, string>>().notNull().default({}),
    source: snapshotSource().notNull().default("cron"),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.userId, t.date), ownRows("net_worth_snapshots", t.userId)],
);

// ---------------------------------------------------------------------------
// Notificacions
// ---------------------------------------------------------------------------

/** Una subscripció de Web Push per dispositiu (l'iPhone amb l'app instal·lada, un ordinador...). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: ownerId(),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: createdAt(),
    lastSuccessAt: timestamp({ withTimezone: true }),
  },
  (t) => [unique().on(t.endpoint), ownRows("push_subscriptions", t.userId)],
);

/** Avisos ja enviats (clau única per avís: p. ex. `saldos:2026-12`), perquè cap no es repeteixi. Ho escriu el cron. */
export const notificationLog = pgTable(
  "notification_log",
  {
    id: id(),
    userId: ownerId(),
    key: text().notNull(),
    sentAt: createdAt(),
  },
  (t) => [unique().on(t.userId, t.key), ownRowsReadOnly("notification_log", t.userId)],
);

/**
 * Secrets de la instal·lació que l'app genera sola la primera vegada (p. ex. les claus VAPID de les notificacions,
 * si no són a les variables d'entorn). RLS activada i cap política: només el servidor (`adminDb`) hi arriba.
 */
export const appSecrets = pgTable("app_secrets", {
  key: text().primaryKey(),
  value: text().notNull(),
  createdAt: createdAt(),
}).enableRLS();
