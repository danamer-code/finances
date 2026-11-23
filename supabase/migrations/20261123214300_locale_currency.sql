CREATE TYPE "public"."app_locale" AS ENUM('ca', 'en', 'he');--> statement-breakpoint
CREATE TYPE "public"."base_currency" AS ENUM('EUR', 'USD', 'ILS');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "locale" "app_locale" DEFAULT 'ca' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "currency" "base_currency" DEFAULT 'EUR' NOT NULL;