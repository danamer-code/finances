ALTER TABLE "profiles" ADD COLUMN "fiscal_tab" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Qui ja feia servir l'app la conserva; els usuaris nous la tenen amagada (es pot activar a Ajustos).
UPDATE "profiles" SET "fiscal_tab" = true;
