/**
 * Tests del motor FIFO (spec §2: abans de connectar-lo a res). Són la xarxa de seguretat de la fiscalitat.
 */
import { describe, expect, test } from "vitest";

import { computeFifo, summarizeFifo, type FifoTrade } from "@/lib/fifo";

let n = 0;
const t = (p: Partial<FifoTrade> & Pick<FifoTrade, "date" | "side" | "quantity" | "amountEur">): FifoTrade => ({
  id: p.id ?? `t${++n}`,
  holdingId: p.holdingId ?? "H",
  transferGroupId: p.transferGroupId ?? null,
  ...p,
});

const sum = (xs: string[]) => xs.reduce((a, x) => a + Math.round(Number(x) * 100), 0) / 100;

describe("compres i vendes", () => {
  test("una venda consumeix primer el lot més antic", () => {
    const r = computeFifo([
      t({ date: "2024-01-10", side: "buy", quantity: "10", amountEur: "100.00", id: "a" }),
      t({ date: "2024-06-10", side: "buy", quantity: "10", amountEur: "200.00", id: "b" }),
      t({ date: "2025-03-01", side: "sell", quantity: "5", amountEur: "150.00", id: "s" }),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.disposals).toEqual([
      { sellTradeId: "s", lotKey: "a", quantity: "5.00000000", proceedsEur: "150.00", costBasisEur: "50.00", gainEur: "100.00", fiscalYear: 2025 },
    ]);
    const lotA = r.lots.find((l) => l.key === "a")!;
    expect(lotA.remainingQty).toBe("5.00000000");
    expect(lotA.remainingCostEur).toBe("50.00");
  });

  test("una venda que travessa dos lots reparteix l'import en proporció", () => {
    const r = computeFifo([
      t({ date: "2024-01-10", side: "buy", quantity: "3", amountEur: "30.00", id: "a" }),
      t({ date: "2024-02-10", side: "buy", quantity: "3", amountEur: "60.00", id: "b" }),
      t({ date: "2025-01-10", side: "sell", quantity: "4", amountEur: "100.00", id: "s" }),
    ]);
    expect(r.disposals.map((d) => [d.lotKey, d.quantity, d.proceedsEur, d.costBasisEur, d.gainEur])).toEqual([
      ["a", "3.00000000", "75.00", "30.00", "45.00"],
      ["b", "1.00000000", "25.00", "20.00", "5.00"],
    ]);
  });

  test("els imports de les vendes sumen exactament el total, sense perdre cèntims", () => {
    const r = computeFifo([
      t({ date: "2024-01-01", side: "buy", quantity: "1", amountEur: "10.00" }),
      t({ date: "2024-01-02", side: "buy", quantity: "1", amountEur: "10.00" }),
      t({ date: "2024-01-03", side: "buy", quantity: "1", amountEur: "10.00" }),
      t({ date: "2025-01-01", side: "sell", quantity: "3", amountEur: "100.00" }),
    ]);
    expect(sum(r.disposals.map((d) => d.proceedsEur))).toBe(100);
    expect(r.disposals.map((d) => d.proceedsEur)).toEqual(["33.33", "33.33", "33.34"]);
  });

  test("el cost venut més el cost que queda és el que s'ha pagat", () => {
    const r = computeFifo([
      t({ date: "2024-01-01", side: "buy", quantity: "7", amountEur: "100.00", id: "a" }),
      t({ date: "2025-01-01", side: "sell", quantity: "3", amountEur: "50.00" }),
      t({ date: "2025-02-01", side: "sell", quantity: "2", amountEur: "40.00" }),
    ]);
    const sold = sum(r.disposals.map((d) => d.costBasisEur));
    const left = sum(r.lots.map((l) => l.remainingCostEur));
    expect(sold + left).toBe(100);
  });

  test("vendre més del que es té és un error", () => {
    const r = computeFifo([
      t({ date: "2024-01-01", side: "buy", quantity: "2", amountEur: "20.00" }),
      t({ date: "2025-01-01", side: "sell", quantity: "3", amountEur: "30.00" }),
    ]);
    expect(r.errors[0]).toMatch(/sense prou participacions/);
  });

  test("dins d'un mateix dia, la compra va abans que la venda", () => {
    const r = computeFifo([
      t({ date: "2025-01-01", side: "sell", quantity: "1", amountEur: "12.00", id: "s" }),
      t({ date: "2025-01-01", side: "buy", quantity: "1", amountEur: "10.00", id: "b" }),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.disposals[0].gainEur).toBe("2.00");
  });

  test("l'any fiscal és el de la venda", () => {
    const r = computeFifo([
      t({ date: "2023-05-01", side: "buy", quantity: "1", amountEur: "10.00" }),
      t({ date: "2026-05-04", side: "sell", quantity: "1", amountEur: "8.00" }),
    ]);
    expect(r.disposals[0]).toMatchObject({ fiscalYear: 2026, gainEur: "-2.00" });
  });
});

describe("accions totalment alliberades (scrip)", () => {
  test("el cost total no canvia i les noves hereten l'antiguitat (exemple 1 + 1 gratis)", () => {
    const r = computeFifo([
      t({ date: "2010-01-01", side: "buy", quantity: "1", amountEur: "10.00", id: "a" }),
      t({ date: "2010-06-01", side: "scrip", quantity: "1", amountEur: "0.00", id: "s" }),
    ]);
    const lot = r.lots.find((l) => l.key === "a")!;
    expect(lot.remainingQty).toBe("2.00000000");
    expect(lot.remainingCostEur).toBe("10.00");
    expect(lot.unitCostEur).toBe("5.00000000");
    expect(lot.buyDate).toBe("2010-01-01");
    expect(r.lots).toHaveLength(1);
  });

  test("es reparteixen entre els lots oberts en proporció a les accions de cada un", () => {
    const r = computeFifo([
      t({ date: "2010-01-01", side: "buy", quantity: "30", amountEur: "300.00", id: "a" }),
      t({ date: "2011-01-01", side: "buy", quantity: "10", amountEur: "200.00", id: "b" }),
      t({ date: "2012-01-01", side: "scrip", quantity: "4", amountEur: "0.00" }),
    ]);
    expect(r.lots.find((l) => l.key === "a")!.remainingQty).toBe("33.00000000");
    expect(r.lots.find((l) => l.key === "b")!.remainingQty).toBe("11.00000000");
    expect(sum(r.lots.map((l) => l.remainingCostEur))).toBe(500);
  });

  test("vendre després d'una scrip fa servir el cost repartit (no l'infla)", () => {
    const r = computeFifo([
      t({ date: "2010-01-01", side: "buy", quantity: "1", amountEur: "10.00" }),
      t({ date: "2010-06-01", side: "scrip", quantity: "1", amountEur: "0.00" }),
      t({ date: "2025-01-01", side: "sell", quantity: "2", amountEur: "8.00" }),
    ]);
    expect(sum(r.disposals.map((d) => d.costBasisEur))).toBe(10);
    expect(sum(r.disposals.map((d) => d.gainEur))).toBe(-2);
  });
});

describe("vendes de drets de subscripció", () => {
  test("abans del 2017 rebaixen el cost dels lots oberts", () => {
    const r = computeFifo([
      t({ date: "2010-01-01", side: "buy", quantity: "10", amountEur: "100.00", id: "a" }),
      t({ date: "2012-01-01", side: "rights_sale", quantity: "10", amountEur: "3.00" }),
    ]);
    expect(r.disposals).toEqual([]);
    expect(r.lots.find((l) => l.key === "a")!.remainingCostEur).toBe("97.00");
  });

  test("des del 2017 són guany pel total, l'any de la venda", () => {
    const r = computeFifo([
      t({ date: "2010-01-01", side: "buy", quantity: "10", amountEur: "100.00", id: "a" }),
      t({ date: "2018-10-31", side: "rights_sale", quantity: "58", amountEur: "0.88", id: "d" }),
    ]);
    expect(r.disposals).toEqual([
      { sellTradeId: "d", lotKey: "d:drets", quantity: "58.00000000", proceedsEur: "0.88", costBasisEur: "0.00", gainEur: "0.88", fiscalYear: 2018 },
    ]);
    expect(r.lots.find((l) => l.key === "a")!.remainingCostEur).toBe("100.00");
  });
});

describe("traspassos entre fons", () => {
  test("els lots passen al fons de destí amb la data i el cost originals, sense guany", () => {
    const r = computeFifo([
      t({ date: "2022-01-31", side: "buy", quantity: "10", amountEur: "1000.00", holdingId: "A", id: "a1" }),
      t({ date: "2024-12-23", side: "buy", quantity: "5", amountEur: "600.00", holdingId: "A", id: "a2" }),
      t({ date: "2025-06-10", side: "transfer_out", quantity: "15", amountEur: "0.00", holdingId: "A", transferGroupId: "g" }),
      t({ date: "2025-06-10", side: "transfer_in", quantity: "30", amountEur: "0.00", holdingId: "B", transferGroupId: "g", id: "in" }),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.disposals).toEqual([]);
    const inB = r.lots.filter((l) => l.holdingId === "B");
    expect(inB.map((l) => [l.buyDate, l.remainingQty, l.remainingCostEur])).toEqual([
      ["2022-01-31", "20.00000000", "1000.00"],
      ["2024-12-23", "10.00000000", "600.00"],
    ]);
    const summary = summarizeFifo(r);
    expect(summary.positions.get("A")).toEqual({ quantity: "0.00000000", cost: "0.00" });
    expect(summary.positions.get("B")).toEqual({ quantity: "30.00000000", cost: "1600.00" });
  });

  test("un lot importat sense grup (lot fiscal o saldo d'obertura) entra amb la seva data", () => {
    const r = computeFifo([t({ date: "2022-03-22", side: "transfer_in", quantity: "12.5", amountEur: "150.67", id: "x" })]);
    expect(r.lots[0]).toMatchObject({ buyDate: "2022-03-22", remainingQty: "12.50000000", remainingCostEur: "150.67" });
  });

  test("una sortida sense entrada és un error", () => {
    const r = computeFifo([
      t({ date: "2024-01-01", side: "buy", quantity: "1", amountEur: "10.00", holdingId: "A" }),
      t({ date: "2025-01-01", side: "transfer_out", quantity: "1", amountEur: "0.00", holdingId: "A", transferGroupId: "g" }),
    ]);
    expect(r.errors.join(" ")).toMatch(/sense l'entrada/);
  });
});

describe("recompenses de staking", () => {
  test("cada recompensa és un lot nou amb el valor del dia com a cost", () => {
    const r = computeFifo([
      t({ date: "2026-11-22", side: "transfer_in", quantity: "0.5", amountEur: "680.96", holdingId: "ETH", id: "open" }),
      t({ date: "2026-12-01", side: "reward", quantity: "0.001", amountEur: "1.60", holdingId: "ETH", id: "r1" }),
      t({ date: "2027-01-10", side: "sell", quantity: "0.5", amountEur: "900.00", holdingId: "ETH", id: "s" }),
    ]);
    expect(r.disposals).toHaveLength(1);
    expect(r.disposals[0]).toMatchObject({ lotKey: "open", costBasisEur: "680.96", gainEur: "219.04", fiscalYear: 2027 });
    expect(r.lots.find((l) => l.key === "r1")!.remainingQty).toBe("0.00100000");
  });
});
