import { describe, expect, test } from "vitest";

import {
  buildMovements,
  detectDateOrder,
  guessMapping,
  isFinancesSheet,
  parseAmountCell,
  parseCsv,
  parseDateCell,
  parseKindCell,
  planCategories,
  signedAmount,
  type ExistingCategory,
  type Mapping,
} from "@/lib/csv-import";

const FALLBACK = { income: "Ingressos importats", expense: "Despeses importades", investment: "Inversions importades" };

describe("CSV", () => {
  test("comes, cometes, salts de línia dins de cometes, BOM i CRLF", () => {
    expect(parseCsv('﻿a,"b, c","d ""e"""\r\n1,"2\n3",4\r\n\r\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "2\n3", "4"],
    ]);
  });

  test("punt i coma i tabulador", () => {
    expect(parseCsv("data;import\n01/02/2026;12,50")).toEqual([["data", "import"], ["01/02/2026", "12,50"]]);
    expect(parseCsv("date\tamount\n2026-02-01\t12.50")).toEqual([["date", "amount"], ["2026-02-01", "12.50"]]);
  });
});

describe("dates", () => {
  test("formats numèrics", () => {
    expect(parseDateCell("2026-11-23")).toBe("2026-11-23");
    expect(parseDateCell("23/11/2026")).toBe("2026-11-23");
    expect(parseDateCell("11/23/2026", "mdy")).toBe("2026-11-23");
    expect(parseDateCell("23.11.26")).toBe("2026-11-23");
    expect(parseDateCell("2026-11-23 10:15:00")).toBe("2026-11-23");
    expect(parseDateCell("11/2026")).toBe("2026-11-01");
    expect(parseDateCell("2026-11")).toBe("2026-11-01");
  });

  test("mesos en lletres (català, castellà, anglès, hebreu)", () => {
    expect(parseDateCell("Gener 2024")).toBe("2024-01-01");
    expect(parseDateCell("Març 2025")).toBe("2025-03-01");
    expect(parseDateCell("23 de novembre de 2026")).toBe("2026-11-23");
    expect(parseDateCell("septiembre 2023")).toBe("2023-09-01");
    expect(parseDateCell("Nov 23, 2026")).toBe("2026-11-23");
    expect(parseDateCell("23 Nov 2026")).toBe("2026-11-23");
    expect(parseDateCell("ינואר 2026")).toBe("2026-01-01");
    expect(parseDateCell("Jan-24")).toBe("2024-01-01");
  });

  test("dates impossibles o text", () => {
    expect(parseDateCell("31/02/2026")).toBeNull();
    expect(parseDateCell("hola")).toBeNull();
    expect(parseDateCell("")).toBeNull();
  });

  test("ordre dia/mes", () => {
    expect(detectDateOrder(["01/02/2026", "25/02/2026"])).toEqual({ order: "dmy", ambiguous: false });
    expect(detectDateOrder(["02/25/2026"])).toEqual({ order: "mdy", ambiguous: false });
    expect(detectDateOrder(["01/02/2026", "03/04/2026"])).toEqual({ order: "dmy", ambiguous: true });
  });
});

describe("imports", () => {
  test("separadors, signes i símbols", () => {
    expect(parseAmountCell("1.234,56 €")).toEqual({ abs: "1234.56", negative: false });
    expect(parseAmountCell("-12,5")).toEqual({ abs: "12.50", negative: true });
    expect(parseAmountCell("(12.50)")).toEqual({ abs: "12.50", negative: true });
    expect(parseAmountCell("12.50-")).toEqual({ abs: "12.50", negative: true });
    expect(parseAmountCell("₪1,234.567")).toEqual({ abs: "1234.57", negative: false });
    expect(parseAmountCell("12 EUR")).toEqual({ abs: "12.00", negative: false });
    expect(parseAmountCell("1.234")).toEqual({ abs: "1234.00", negative: false });
    expect(parseAmountCell("0,99")).toEqual({ abs: "0.99", negative: false });
  });

  test("buit, zero o text: res", () => {
    expect(parseAmountCell("")).toBeNull();
    expect(parseAmountCell("0")).toBeNull();
    expect(parseAmountCell("#N/A")).toBeNull();
    expect(parseAmountCell("-")).toBeNull();
  });

  test("tipus de la columna Tipus", () => {
    expect(parseKindCell("Ingressos")).toBe("income");
    expect(parseKindCell("Despeses")).toBe("expense");
    expect(parseKindCell("Inversions")).toBe("investment");
    expect(parseKindCell("הוצאות")).toBe("expense");
    expect(parseKindCell("altres")).toBeNull();
  });
});

describe("signe final segons la categoria", () => {
  test("tot en positiu: el tipus el diu la categoria; un negatiu és una devolució", () => {
    expect(signedAmount({ abs: "12.00", implied: null, reversed: false }, "expense")).toBe("-12.00");
    expect(signedAmount({ abs: "12.00", implied: null, reversed: false }, "income")).toBe("12.00");
    expect(signedAmount({ abs: "5.00", implied: null, reversed: true }, "expense")).toBe("5.00");
    expect(signedAmount({ abs: "40.00", implied: null, reversed: false }, "investment")).toBe("-40.00");
  });

  test("despeses en negatiu: el signe del full diu el tipus", () => {
    expect(signedAmount({ abs: "12.00", implied: "expense", reversed: false }, "expense")).toBe("-12.00");
    expect(signedAmount({ abs: "5.00", implied: "income", reversed: false }, "expense")).toBe("5.00");
    expect(signedAmount({ abs: "900.00", implied: "income", reversed: false }, "income")).toBe("900.00");
  });
});

// Mateixa estructura que la pestanya Data del full de Finances; dades inventades.
const FINANCES_CSV = [
  "Concepte,Valor,Categoria,Mes,Any,Tipus",
  "Nòmina,1500,Sou,Gener,2024,Ingressos",
  "Súper,80.5,Súper,Gener,2024,Despeses",
  "Súper,80.5,Súper,Gener,2024,Despeses",
  "Cartera,300,Fons ApM,Gener,2024,Inversions",
  "Valor fons,12000,Fons,Gener,2024,Inversions",
  ",,,,,#N/A",
  "Sopar,,Restaurants,Febrer,2024,Despeses",
].join("\n");

describe("full de Finances (pestanya Data)", () => {
  const rows = parseCsv(FINANCES_CSV);
  const map = guessMapping(rows, 0);

  test("es reconeix i les columnes s'endevinen", () => {
    expect(isFinancesSheet(rows[0])).toBe(true);
    expect(map).toMatchObject({ format: "rows", date: 3, year: 4, amount: 1, concept: 0, category: 2, type: 5, signs: "positive" });
  });

  test("moviments: dia 1 del mes, iguals no es fusionen, files sense import s'avisen", () => {
    const { movements, skipped } = buildMovements(rows, map, "Importat");
    expect(movements).toHaveLength(5);
    expect(movements[0]).toMatchObject({ date: "2024-01-01", concept: "Nòmina", category: "Sou", abs: "1500.00", kindHint: "income" });
    expect(movements[1].key).not.toBe(movements[2].key);
    expect(skipped).toEqual([{ line: 7, reason: "date" }, { line: 8, reason: "amount" }]);
  });

  test("categories: les existents pel nom, les fotos de la cartera fora i les aportacions a la d'inversió", () => {
    const { movements } = buildMovements(rows, map, "Importat");
    const existing: ExistingCategory[] = [
      { id: "11111111-1111-4111-8111-111111111111", name: "súper", kind: "expense" },
      { id: "22222222-2222-4222-8222-222222222222", name: "Inversió fons", kind: "investment" },
    ];
    const plan = planCategories(movements, existing, { financesSheet: true, fallbackNames: FALLBACK });
    const by = Object.fromEntries(plan.map((p) => [p.ref, p]));
    expect(by["super"].target).toEqual({ type: "existing", id: existing[0].id });
    expect(by["sou"].target).toEqual({ type: "new", kind: "income" });
    expect(by["fons"]).toMatchObject({ target: { type: "skip" }, note: "snapshot" });
    expect(by["fons apm"].target).toEqual({ type: "existing", id: existing[1].id });
  });
});

describe("altres fulls", () => {
  test("una fila per moviment amb despeses en negatiu i sense categoria", () => {
    const rows = parseCsv("Date,Description,Amount\n03/01/2026,Coffee,-3.20\n15/01/2026,Salary,2500\n20/01/2026,Rent,-900");
    const map = guessMapping(rows, 0);
    expect(map).toMatchObject({ date: 0, concept: 1, amount: 2, category: null, signs: "negativeExpenses", dateOrder: "dmy" });
    const { movements } = buildMovements(rows, map, "Imported");
    expect(movements.map((m) => [m.date, m.implied])).toEqual([
      ["2026-01-03", "expense"],
      ["2026-01-15", "income"],
      ["2026-01-20", "expense"],
    ]);
    const plan = planCategories(movements, [], { financesSheet: false, fallbackNames: FALLBACK });
    expect(plan.map((p) => [p.ref, p.name, p.count])).toEqual([
      ["__expense__", "Despeses importades", 2],
      ["__income__", "Ingressos importats", 1],
    ]);
  });

  test("columnes d'ingressos i despeses", () => {
    const rows = parseCsv("Fecha;Concepto;Ingresos;Gastos\n01/03/2026;Nómina;2.000,00;\n02/03/2026;Luz;;45,10");
    const map = guessMapping(rows, 0);
    expect(map).toMatchObject({ amount: null, income: 2, expense: 3 });
    const { movements } = buildMovements(rows, map, "Importado");
    expect(movements.map((m) => [m.abs, m.implied])).toEqual([
      ["2000.00", "income"],
      ["45.10", "expense"],
    ]);
  });

  test("una columna per categoria (totals per mes)", () => {
    const rows = parseCsv("Mes,Súper,Lloguer,Sou\n01/2026,320,900,2500\n02/2026,280,900,");
    const map: Mapping = { format: "columns", headerRow: 0, date: 0, columns: [1, 2, 3], dateOrder: "dmy", signs: "positive" };
    const { movements } = buildMovements(rows, map, "x");
    expect(movements).toHaveLength(5);
    expect(movements[0]).toMatchObject({ date: "2026-01-01", concept: "Súper", category: "Súper", abs: "320.00", implied: null });
  });

  test("la clau és estable: tornar a importar el mateix fitxer no canvia res", () => {
    const rows = parseCsv(FINANCES_CSV);
    const a = buildMovements(rows, guessMapping(rows, 0), "x").movements.map((m) => m.key);
    const b = buildMovements(parseCsv(FINANCES_CSV), guessMapping(rows, 0), "x").movements.map((m) => m.key);
    expect(a).toEqual(b);
  });
});
