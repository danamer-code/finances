CREATE TYPE "public"."account_kind" AS ENUM('bank', 'broker', 'crypto', 'cash', 'loan');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('income', 'expense', 'investment');--> statement-breakpoint
CREATE TYPE "public"."fiscal_regime" AS ENUM('irpf', 'irnr');--> statement-breakpoint
CREATE TYPE "public"."holding_kind" AS ENUM('fund', 'stock', 'crypto', 'cash');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."snapshot_source" AS ENUM('spreadsheet', 'cron');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('dark', 'light', 'system');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('buy', 'sell', 'transfer_in', 'transfer_out', 'scrip', 'rights_sale', 'reward');--> statement-breakpoint
CREATE TYPE "public"."trade_source" AS ENUM('broker_export', 'broker_fiscal_report', 'spreadsheet', 'manual');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('confirmed', 'pending');--> statement-breakpoint
CREATE TABLE "account_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_balances_accountId_date_unique" UNIQUE("account_id","date")
);
--> statement-breakpoint
ALTER TABLE "account_balances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"kind" "account_kind" NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_userId_name_unique" UNIQUE("user_id","name"),
	CONSTRAINT "accounts_id_userId_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"monthly_budget" numeric(14, 2),
	"color" text,
	"icon" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_userId_name_unique" UNIQUE("user_id","name"),
	CONSTRAINT "categories_id_userId_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "concept_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"alias" text NOT NULL,
	"canonical" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_aliases_userId_alias_unique" UNIQUE("user_id","alias")
);
--> statement-breakpoint
ALTER TABLE "concept_aliases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"year" integer NOT NULL,
	"regime" "fiscal_regime" DEFAULT 'irpf' NOT NULL,
	"country" char(2) DEFAULT 'ES' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fiscal_years_userId_year_unique" UNIQUE("user_id","year")
);
--> statement-breakpoint
ALTER TABLE "fiscal_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"date" date NOT NULL,
	"base" char(3) NOT NULL,
	"quote" char(3) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	CONSTRAINT "fx_rates_date_base_quote_pk" PRIMARY KEY("date","base","quote")
);
--> statement-breakpoint
ALTER TABLE "fx_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"kind" "holding_kind" NOT NULL,
	"ticker" text,
	"isin" text,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"account_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_id_userId_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "holdings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "net_worth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"date" date NOT NULL,
	"market_value" numeric(14, 2) NOT NULL,
	"contributed" numeric(14, 2),
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" "snapshot_source" DEFAULT 'cron' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "net_worth_snapshots_userId_date_unique" UNIQUE("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prices" (
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"date" date NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"currency" char(3) NOT NULL,
	CONSTRAINT "prices_holding_id_date_pk" PRIMARY KEY("holding_id","date")
);
--> statement-breakpoint
ALTER TABLE "prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY DEFAULT auth.uid() NOT NULL,
	"theme" "theme_preference" DEFAULT 'dark' NOT NULL,
	"concentration_threshold" numeric(5, 4) DEFAULT '0.1000' NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"concept" text NOT NULL,
	"amount" numeric(14, 2),
	"category_id" uuid NOT NULL,
	"account_id" uuid,
	"frequency" "recurring_frequency" NOT NULL,
	"day_of_month" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_rules_id_userId_unique" UNIQUE("id","user_id"),
	CONSTRAINT "recurring_rules_day_of_month" CHECK ("recurring_rules"."day_of_month" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "recurring_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"sell_trade_id" uuid NOT NULL,
	"tax_lot_id" uuid NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"proceeds_eur" numeric(14, 2) NOT NULL,
	"cost_basis_eur" numeric(14, 2) NOT NULL,
	"gain_eur" numeric(14, 2) GENERATED ALWAYS AS (proceeds_eur - cost_basis_eur) STORED NOT NULL,
	"fiscal_year" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tax_disposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"buy_trade_id" uuid NOT NULL,
	"buy_date" date NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"remaining_qty" numeric(20, 8) NOT NULL,
	"unit_cost_eur" numeric(20, 8) NOT NULL,
	CONSTRAINT "tax_lots_id_userId_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "tax_lots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"holding_id" uuid NOT NULL,
	"date" date NOT NULL,
	"side" "trade_side" NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8),
	"fees" numeric(14, 2) DEFAULT '0' NOT NULL,
	"fx_rate" numeric(18, 8),
	"amount_eur" numeric(14, 2) NOT NULL,
	"transfer_group_id" uuid,
	"is_estimated" boolean DEFAULT false NOT NULL,
	"source" "trade_source" DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_id_userId_unique" UNIQUE("id","user_id"),
	CONSTRAINT "trades_quantity_positive" CHECK ("trades"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "trades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"date" date NOT NULL,
	"concept" text NOT NULL,
	"amount" numeric(14, 2),
	"status" "transaction_status" DEFAULT 'confirmed' NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid,
	"recurring_id" uuid,
	"trade_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_trade_unique" UNIQUE("trade_id"),
	CONSTRAINT "transactions_recurring_date_unique" UNIQUE("recurring_id","date"),
	CONSTRAINT "transactions_amount_when_confirmed" CHECK ("transactions"."status" = 'pending' or "transactions"."amount" is not null)
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "year_wrapped_frozen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"year" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "year_wrapped_frozen_userId_year_unique" UNIQUE("user_id","year")
);
--> statement-breakpoint
ALTER TABLE "year_wrapped_frozen" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_user_id_accounts_id_user_id_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_aliases" ADD CONSTRAINT "concept_aliases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_user_id_accounts_id_user_id_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_holding_id_user_id_holdings_id_user_id_fk" FOREIGN KEY ("holding_id","user_id") REFERENCES "public"."holdings"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_user_id_categories_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_account_id_user_id_accounts_id_user_id_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_disposals" ADD CONSTRAINT "tax_disposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_disposals" ADD CONSTRAINT "tax_disposals_sell_trade_id_user_id_trades_id_user_id_fk" FOREIGN KEY ("sell_trade_id","user_id") REFERENCES "public"."trades"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_disposals" ADD CONSTRAINT "tax_disposals_tax_lot_id_user_id_tax_lots_id_user_id_fk" FOREIGN KEY ("tax_lot_id","user_id") REFERENCES "public"."tax_lots"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_lots" ADD CONSTRAINT "tax_lots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_lots" ADD CONSTRAINT "tax_lots_holding_id_user_id_holdings_id_user_id_fk" FOREIGN KEY ("holding_id","user_id") REFERENCES "public"."holdings"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_lots" ADD CONSTRAINT "tax_lots_buy_trade_id_user_id_trades_id_user_id_fk" FOREIGN KEY ("buy_trade_id","user_id") REFERENCES "public"."trades"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_holding_id_user_id_holdings_id_user_id_fk" FOREIGN KEY ("holding_id","user_id") REFERENCES "public"."holdings"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_user_id_categories_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_user_id_accounts_id_user_id_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."accounts"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_id_user_id_recurring_rules_id_user_id_fk" FOREIGN KEY ("recurring_id","user_id") REFERENCES "public"."recurring_rules"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_trade_id_user_id_trades_id_user_id_fk" FOREIGN KEY ("trade_id","user_id") REFERENCES "public"."trades"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "year_wrapped_frozen" ADD CONSTRAINT "year_wrapped_frozen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tax_disposals_user_id_fiscal_year_index" ON "tax_disposals" USING btree ("user_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "tax_lots_holding_id_buy_date_index" ON "tax_lots" USING btree ("holding_id","buy_date");--> statement-breakpoint
CREATE INDEX "trades_holding_id_date_index" ON "trades" USING btree ("holding_id","date");--> statement-breakpoint
CREATE INDEX "transactions_user_id_date_index" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transactions_user_id_concept_index" ON "transactions" USING btree ("user_id","concept");--> statement-breakpoint
CREATE POLICY "account_balances_own_rows" ON "account_balances" AS PERMISSIVE FOR ALL TO "authenticated" USING ("account_balances"."user_id" = (select auth.uid())) WITH CHECK ("account_balances"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "accounts_own_rows" ON "accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("accounts"."user_id" = (select auth.uid())) WITH CHECK ("accounts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "categories_own_rows" ON "categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("categories"."user_id" = (select auth.uid())) WITH CHECK ("categories"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "concept_aliases_own_rows" ON "concept_aliases" AS PERMISSIVE FOR ALL TO "authenticated" USING ("concept_aliases"."user_id" = (select auth.uid())) WITH CHECK ("concept_aliases"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "fiscal_years_own_rows" ON "fiscal_years" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fiscal_years"."user_id" = (select auth.uid())) WITH CHECK ("fiscal_years"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "fx_rates_read" ON "fx_rates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "holdings_own_rows" ON "holdings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("holdings"."user_id" = (select auth.uid())) WITH CHECK ("holdings"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "net_worth_snapshots_own_rows" ON "net_worth_snapshots" AS PERMISSIVE FOR ALL TO "authenticated" USING ("net_worth_snapshots"."user_id" = (select auth.uid())) WITH CHECK ("net_worth_snapshots"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "prices_own_rows" ON "prices" AS PERMISSIVE FOR ALL TO "authenticated" USING ("prices"."user_id" = (select auth.uid())) WITH CHECK ("prices"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_own_rows" ON "profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("profiles"."user_id" = (select auth.uid())) WITH CHECK ("profiles"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "recurring_rules_own_rows" ON "recurring_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("recurring_rules"."user_id" = (select auth.uid())) WITH CHECK ("recurring_rules"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "tax_disposals_own_rows_select" ON "tax_disposals" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("tax_disposals"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "tax_lots_own_rows_select" ON "tax_lots" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("tax_lots"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "trades_own_rows" ON "trades" AS PERMISSIVE FOR ALL TO "authenticated" USING ("trades"."user_id" = (select auth.uid())) WITH CHECK ("trades"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "transactions_own_rows" ON "transactions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("transactions"."user_id" = (select auth.uid())) WITH CHECK ("transactions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "year_wrapped_frozen_own_rows" ON "year_wrapped_frozen" AS PERMISSIVE FOR ALL TO "authenticated" USING ("year_wrapped_frozen"."user_id" = (select auth.uid())) WITH CHECK ("year_wrapped_frozen"."user_id" = (select auth.uid()));