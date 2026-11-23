import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// Drizzle és la font de veritat de l'esquema. Les migracions es generen com a SQL dins de
// supabase/migrations amb prefix de data, perquè el CLI de Supabase les apliqui (`supabase db reset`).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  casing: "snake_case",
  schemaFilter: ["public"],
  migrations: { prefix: "supabase" },
  entities: { roles: { provider: "supabase" } },
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
