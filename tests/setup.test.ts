import { describe, expect, test } from "vitest";

import { defaultCurrencyFor, localeFromAcceptLanguage } from "@/i18n/config";

import { migrationFiles, migrationUrl } from "../scripts/db-migrate";

describe("idioma inicial a partir del navegador", () => {
  test("el primer idioma que l'app té, segons la preferència", () => {
    expect(localeFromAcceptLanguage("he-IL,he;q=0.9,en-US;q=0.8")).toBe("he");
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8,he;q=0.7")).toBe("en");
    expect(localeFromAcceptLanguage("en;q=0.5,he;q=0.9")).toBe("he");
    expect(localeFromAcceptLanguage("ca-ES,ca;q=0.9")).toBe("ca");
  });

  test("castellà → català; cap idioma conegut → anglès; sense capçalera → català", () => {
    expect(localeFromAcceptLanguage("es-ES,es;q=0.9")).toBe("ca");
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("ca");
    expect(localeFromAcceptLanguage("")).toBe("ca");
  });

  test("la divisa per defecte va amb l'idioma", () => {
    expect(defaultCurrencyFor("he")).toBe("ILS");
    expect(defaultCurrencyFor("en")).toBe("EUR");
  });
});

describe("migracions automàtiques", () => {
  test("del pooler en mode transacció al mode sessió, sense el paràmetre de Vercel", () => {
    const url = migrationUrl({ POSTGRES_URL: "postgres://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x" });
    expect(url).toBe("postgres://u:p@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require");
  });

  test("DATABASE_URL té preferència; la local es fa servir tal qual", () => {
    expect(migrationUrl({ DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres", POSTGRES_URL: "postgres://x@y:6543/z" })).toBe(
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    );
    expect(migrationUrl({})).toBeNull();
  });

  test("les migracions surten en ordre i amb el nom", async () => {
    const files = await migrationFiles();
    expect(files[0]).toMatchObject({ version: "20261122213218", name: "init" });
    expect(files.map((f) => f.version)).toEqual([...files.map((f) => f.version)].sort());
    expect(files.some((f) => f.name === "fiscal_tab")).toBe(true);
  });
});
