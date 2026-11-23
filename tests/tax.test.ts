import { describe, expect, test } from "vitest";

import { compensate, marginalTax, savingsTax } from "@/lib/tax";

describe("impost de la base de l'estalvi", () => {
  test("aplica els trams de manera progressiva", () => {
    expect(savingsTax("0", 2026)).toBe("0.00");
    expect(savingsTax("-100", 2026)).toBe("0.00");
    expect(savingsTax("1000", 2026)).toBe("190.00");
    expect(savingsTax("6000", 2026)).toBe("1140.00");
    // 6.000 al 19 % + 4.000 al 21 %
    expect(savingsTax("10000", 2026)).toBe("1980.00");
    // 1.140 + 44.000 × 21 % + 150.000 × 23 % + 100.000 × 27 % + 50.000 × 30 %
    expect(savingsTax("350000", 2026)).toBe("86880.00");
  });

  test("el tram més alt depèn de l'any", () => {
    expect(savingsTax("350000", 2024)).toBe("85880.00");
    expect(savingsTax("60000", 2018)).toBe("12680.00");
  });

  test("impost marginal d'una venda sobre el que ja hi ha", () => {
    expect(marginalTax("5000", "2000", 2026)).toBe("400.00");
    expect(marginalTax("0", "-500", 2026)).toBe("0.00");
    expect(marginalTax("1000", "-500", 2026)).toBe("-95.00");
  });
});

describe("compensació de pèrdues", () => {
  test("una pèrdua compensa fins al 25 % dels interessos i la resta passa als anys següents", () => {
    const [y1, y2] = compensate([
      { year: 2026, regime: "irpf", net: "-1000", interest: "400" },
      { year: 2027, regime: "irpf", net: "1500", interest: "0" },
    ]);
    expect(y1.offsetAgainstInterest).toBe("100.00");
    expect(y1.base).toBe("300.00");
    expect(y1.pending).toEqual([{ year: 2026, amount: "900.00", expires: 2030 }]);
    expect(y2.carriedApplied).toBe("900.00");
    expect(y2.base).toBe("600.00");
    expect(y2.tax).toBe("114.00");
    expect(y2.pending).toEqual([]);
  });

  test("les pèrdues caduquen al cap de 4 anys i es fan servir primer les més antigues", () => {
    const r = compensate([
      { year: 2020, regime: "irpf", net: "-300", interest: "0" },
      { year: 2022, regime: "irpf", net: "-200", interest: "0" },
      { year: 2025, regime: "irpf", net: "100", interest: "0" },
      { year: 2026, regime: "irpf", net: "500", interest: "0" },
    ]);
    // La de 2020 només es podia compensar fins al 2024: el 2025 ja ha caducat i es fa servir la de 2022.
    expect(r[2].carriedApplied).toBe("100.00");
    expect(r[2].pending).toEqual([{ year: 2022, amount: "100.00", expires: 2026 }]);
    // El 2026 és l'últim any per a la de 2022.
    expect(r[3].carriedApplied).toBe("100.00");
    expect(r[3].base).toBe("400.00");
  });

  test("els anys de no resident (IRNR) no entren a la compensació", () => {
    const r = compensate([
      { year: 2025, regime: "irnr", net: "-1500.00", interest: "0" },
      { year: 2026, regime: "irpf", net: "4812.40", interest: "120" },
    ]);
    expect(r[0].base).toBeNull();
    expect(r[0].tax).toBeNull();
    expect(r[1].carriedApplied).toBe("0.00");
    expect(r[1].base).toBe("4932.40");
  });
});
