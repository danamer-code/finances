import { describe, expect, test } from "vitest";

import { defaultStart, describeRule, nextOccurrence, occurrences, type RuleDates } from "@/lib/recurrence";

const monthly = (day: number, startDate: string, endDate: string | null = null): RuleDates => ({
  frequency: "monthly",
  dayOfMonth: day,
  startDate,
  endDate,
});

describe("dates dels recurrents", () => {
  test("mensual: un cop al mes, a partir de la data d'inici", () => {
    expect(occurrences(monthly(5, "2026-09-10"), null, "2026-12-31")).toEqual(["2026-10-05", "2026-11-05", "2026-12-05"]);
  });

  test("el dia 31 cau l'últim dia dels mesos curts, també al febrer de traspàs", () => {
    expect(occurrences(monthly(31, "2027-12-01"), null, "2028-04-30")).toEqual([
      "2027-12-31",
      "2028-01-31",
      "2028-02-29",
      "2028-03-31",
      "2028-04-30",
    ]);
  });

  test("només retorna les dates posteriors a l'última generada i fins avui", () => {
    expect(occurrences(monthly(1, "2026-01-01"), "2026-10-01", "2026-11-23")).toEqual(["2026-11-01"]);
    expect(occurrences(monthly(1, "2026-01-01"), "2026-11-01", "2026-11-23")).toEqual([]);
  });

  test("respecta la data de final", () => {
    expect(occurrences(monthly(15, "2026-01-01", "2026-03-15"), null, "2026-12-31")).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
    ]);
  });

  test("trimestral i anual compten des del mes d'inici", () => {
    expect(occurrences({ frequency: "quarterly", dayOfMonth: 20, startDate: "2026-02-20", endDate: null }, null, "2026-12-31")).toEqual([
      "2026-02-20",
      "2026-05-20",
      "2026-08-20",
      "2026-11-20",
    ]);
    expect(occurrences({ frequency: "yearly", dayOfMonth: 3, startDate: "2025-03-01", endDate: null }, null, "2027-12-31")).toEqual([
      "2025-03-03",
      "2026-03-03",
      "2027-03-03",
    ]);
  });

  test("propera data i data d'inici per defecte", () => {
    expect(nextOccurrence(monthly(1, "2026-01-01"), "2026-11-23")).toBe("2026-12-01");
    expect(nextOccurrence(monthly(1, "2026-01-01", "2026-06-30"), "2026-11-23")).toBeNull();
    expect(defaultStart(25, "2026-11-23")).toBe("2026-11-25");
    expect(defaultStart(1, "2026-11-23")).toBe("2026-12-01");
    expect(defaultStart(5, "2026-12-23")).toBe("2027-01-05");
    expect(defaultStart(23, "2026-11-23")).toBe("2026-12-23");
    expect(defaultStart(31, "2027-01-31")).toBe("2027-02-28");
  });

  test("descripció curta, en l'idioma de l'usuari", () => {
    expect(describeRule({ frequency: "monthly", dayOfMonth: 1 })).toBe("Cada mes, el dia 1");
    expect(describeRule({ frequency: "quarterly", dayOfMonth: 15 }, "ca")).toBe("Cada trimestre, el dia 15");
    expect(describeRule({ frequency: "yearly", dayOfMonth: 3 }, "en")).toBe("Every year, on day 3");
    expect(describeRule({ frequency: "monthly", dayOfMonth: 1 }, "he")).toBe("כל חודש, ב-1 לחודש");
  });
});
