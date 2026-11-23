import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
  // Els tests creen i esborren usuaris: no s'han d'executar mai contra producció.
  throw new Error("Els tests només s'executen contra el Supabase local (DATABASE_URL a 127.0.0.1).");
}
