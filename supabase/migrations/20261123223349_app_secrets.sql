CREATE TABLE "app_secrets" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_secrets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Defensa doble: ni tan sols amb una política nova, els rols de l'API no hi tenen accés.
REVOKE ALL ON "app_secrets" FROM anon, authenticated;
