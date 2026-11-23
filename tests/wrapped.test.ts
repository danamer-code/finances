import { describe, expect, test } from "vitest";

import { CURRENCIES, LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";
import { PERSONA_KEYS, personaFor, type PersonaInput } from "@/lib/wrapped-persona";

const base = { savingsRate: 10, contributions: 0, saved: 1000, topCategory: null };
const title = (input: PersonaInput) => MESSAGES.ca.wrapped.personas[personaFor(input).key].title;

describe("perfil del Year Wrapped", () => {
  test("un estalvi molt alt mana per sobre de tot", () => {
    const persona = personaFor({ ...base, savingsRate: 45, contributions: 5000, topCategory: { name: "Oci", share: 40 } });
    expect(persona).toEqual({ key: "saver", rate: 45 });
    expect(MESSAGES.ca.wrapped.personas.saver.title).toBe("Màquina d'estalviar");
  });

  test("si la meitat de l'estalvi va a la cartera, ment inversora", () => {
    expect(title({ ...base, savingsRate: 25, contributions: 600, saved: 1000 })).toBe("Ment inversora");
  });

  test("la categoria principal defineix el perfil si pesa prou", () => {
    expect(title({ ...base, topCategory: { name: "Viatges", share: 18 } })).toBe("Esperit viatger");
    expect(title({ ...base, topCategory: { name: "Oci", share: 22 } })).toBe("Vida social");
    expect(title({ ...base, topCategory: { name: "Oci", share: 12 } })).toBe("Any d'equilibri");
  });

  test("estalvi moderat i per defecte", () => {
    expect(title({ ...base, savingsRate: 22 })).toBe("Estalvi constant");
    expect(title({ ...base, savingsRate: null })).toBe("Any d'equilibri");
  });
});

describe("textos del Year Wrapped", () => {
  test("cada perfil té títol i descripció en tots els idiomes i divises", () => {
    for (const locale of LOCALES) {
      for (const key of PERSONA_KEYS) {
        const persona = MESSAGES[locale].wrapped.personas[key];
        expect(persona.title, `${locale}.${key}`).not.toBe("");
        for (const currency of CURRENCIES) expect(persona.description(42, currency), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  test("la descripció de l'estalvi diu el percentatge en la divisa de l'usuari", () => {
    expect(MESSAGES.ca.wrapped.personas.saver.description(45, "EUR")).toBe(
      "T'has quedat 45 de cada 100 euros que han entrat. Un any de manual.",
    );
    expect(MESSAGES.en.wrapped.personas.saver.description(45, "USD")).toContain("100 dollars");
    expect(MESSAGES.he.wrapped.personas.saver.description(45, "ILS")).toContain("100 שקל");
  });

  test("dates de l'avançament i de la cartera en cada idioma", () => {
    expect(MESSAGES.ca.wrapped.soFar(MESSAGES.ca.wrapped.through(23, 11))).toBe("De moment, fins al 23 de novembre");
    expect(MESSAGES.ca.wrapped.through(1, 10)).toBe("fins al 1 d'octubre");
    expect(MESSAGES.en.wrapped.through(23, 11)).toBe("up to 23 November");
    expect(MESSAGES.he.wrapped.through(23, 11)).toBe("עד ה-23 בנובמבר");
    expect(MESSAGES.ca.wrapped.investments.start(null)).toBe("A l'inici de l'any");
    expect(MESSAGES.ca.wrapped.investments.start(3)).toBe("L'1 de març");
    expect(MESSAGES.en.wrapped.investments.start(3)).toBe("On 1 March");
  });

  test("percentatges: amb espai en català, enganxats en anglès i hebreu", () => {
    expect(MESSAGES.ca.wrapped.percent(12)).toBe("12 %");
    expect(MESSAGES.en.wrapped.percent(12)).toBe("12%");
    expect(MESSAGES.he.wrapped.percent(12)).toBe("12%");
  });
});
