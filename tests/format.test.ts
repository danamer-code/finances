import { describe, expect, test } from "vitest";

import { conceptKey, tidyConcept } from "@/lib/concepts";
import {
  addDays,
  dayLabel,
  dayMonth,
  formatMoney,
  formatWhole,
  longToday,
  monthLabel,
  moneyParts,
  ofMonth,
  parseAmountInput,
  shiftMonth,
} from "@/lib/format";

describe("format de moneda", () => {
  test("format català amb punt de milers i coma decimal", () => {
    expect(formatMoney("1234.56")).toBe("1.234,56 €");
    expect(formatMoney("-1234.5")).toBe("−1.234,50 €");
    expect(formatMoney("1000000")).toBe("1.000.000,00 €");
    expect(formatMoney("0.00")).toBe("0,00 €");
    expect(formatMoney("4.12", { signed: true })).toBe("+4,12 €");
    expect(formatMoney("-0.00", { signed: true })).toBe("0,00 €");
  });

  test("separa la part entera dels cèntims per pintar-los en gris", () => {
    expect(moneyParts("-2.2")).toEqual({ sign: "−", prefix: "", integer: "2", decimals: ",20 €" });
  });

  test("cada idioma i divisa amb el seu format", () => {
    expect(formatMoney("1234.5", { locale: "en", currency: "EUR" })).toBe("€1,234.50");
    expect(formatMoney("-1234.5", { locale: "en", currency: "USD" })).toBe("−$1,234.50");
    expect(formatMoney("1234.5", { locale: "he", currency: "ILS" })).toBe("1,234.50 ₪");
    // En hebreu (de dreta a esquerra), la marca LRM manté el signe a l'esquerra de les xifres.
    expect(formatMoney("-0.99", { locale: "he", currency: "ILS" })).toBe("‎−0.99 ₪");
    expect(formatWhole("-12", { locale: "ca" })).toBe("−12 €");
    expect(formatMoney("1234.5", { locale: "ca", currency: "USD" })).toBe("1.234,50 $");
    expect(moneyParts("12.3", { locale: "en", signed: true })).toEqual({ sign: "+", prefix: "€", integer: "12", decimals: ".30" });
    expect(formatWhole("1234.56", { locale: "ca" })).toBe("1.235 €");
    expect(formatWhole("1234.4", { locale: "en", currency: "ILS" })).toBe("₪1,234");
  });
});

describe("dates en cada idioma", () => {
  test("mes, dia i avui", () => {
    expect(monthLabel("2026-11", "en")).toBe("November 2026");
    expect(dayMonth("2026-11-01", "ca")).toBe("1 de novembre");
    expect(dayMonth("2026-10-05", "ca")).toBe("5 d'octubre");
    expect(dayMonth("2026-11-01", "he")).toBe("1 בנובמבר");
    expect(dayLabel("2026-11-23", "2026-11-23", "en").title).toBe("Today");
    expect(longToday("2026-11-23", "en")).toBe("Monday, 23 Nov");
  });
});

describe("lectura de l'import escrit", () => {
  test("accepta coma o punt decimal i completa els cèntims", () => {
    expect(parseAmountInput("2,5")).toBe("2.50");
    expect(parseAmountInput("2.5")).toBe("2.50");
    expect(parseAmountInput("12")).toBe("12.00");
    expect(parseAmountInput("1.234,56")).toBe("1234.56");
    expect(parseAmountInput("12,")).toBe("12.00");
  });

  test("entén els formats de tots els idiomes i els símbols", () => {
    expect(parseAmountInput("1,234.56")).toBe("1234.56");
    expect(parseAmountInput("1.234")).toBe("1234.00");
    expect(parseAmountInput("1,234")).toBe("1234.00");
    expect(parseAmountInput("1,234,567.5")).toBe("1234567.50");
    expect(parseAmountInput("12.5")).toBe("12.50");
    expect(parseAmountInput("$12.50")).toBe("12.50");
    expect(parseAmountInput("12,50 ₪")).toBe("12.50");
    expect(parseAmountInput("€ 7")).toBe("7.00");
    expect(parseAmountInput("1.2.3")).toBeNull();
  });

  test("rebutja imports no vàlids", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("1,2345")).toBeNull();
    expect(parseAmountInput("-5")).toBeNull();
  });
});

describe("dates", () => {
  test("etiquetes de dia", () => {
    expect(dayLabel("2026-11-22", "2026-11-22").title).toBe("Avui");
    expect(dayLabel("2026-11-21", "2026-11-22").title).toBe("Ahir");
    expect(dayLabel("2026-11-19", "2026-11-22")).toEqual({ title: "Dijous", subtitle: "19 de novembre" });
    expect(dayLabel("2025-10-03", "2026-11-22").subtitle).toBe("3 d'octubre 2025");
  });

  test("aritmètica de dies i mesos", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(ofMonth(4)).toBe("d'abril");
  });
});

describe("conceptes", () => {
  test("neteja i clau", () => {
    expect(tidyConcept("  cafè  amb llet ")).toBe("Cafè amb llet");
    expect(tidyConcept("iCloud")).toBe("iCloud");
    expect(conceptKey("Cafè")).toBe(conceptKey("cafe"));
  });
});

describe("preposicions de mes", () => {
  test("a l'octubre, al novembre", async () => {
    const { inMonth } = await import("@/lib/format");
    expect(inMonth(10)).toBe("a l'octubre");
    expect(inMonth(11)).toBe("al novembre");
    expect(inMonth(4)).toBe("a l'abril");
  });
});

describe("arbre de categories", () => {
  test("agrupa les subcategories sota la principal i conserva l'ordre", async () => {
    const { categoryTree } = await import("@/lib/category-tree");
    const tree = categoryTree([
      { id: "oci", parentId: null },
      { id: "super", parentId: null },
      { id: "restaurants", parentId: "oci" },
      { id: "bars", parentId: "oci" },
      { id: "orfe", parentId: "no-hi-es" },
    ]);
    expect(tree.map((n) => [n.category.id, n.children.map((c) => c.id)])).toEqual([
      ["oci", ["restaurants", "bars"]],
      ["super", []],
      ["orfe", []],
    ]);
  });
});
