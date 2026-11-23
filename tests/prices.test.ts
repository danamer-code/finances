import { describe, expect, test } from "vitest";

import { coinbasePair, parseCoinbaseSpot } from "@/lib/prices/coinbase";
import { parseEcbCsv } from "@/lib/prices/ecb";
import { eodhdSymbol, latestClose } from "@/lib/prices/eodhd";
import { isSuspicious, toDecimal } from "@/lib/prices/quotes";
import { parseSheetRows } from "@/lib/prices/sheet-rows";

describe("números de les fonts de preus", () => {
  test("llegeix números en qualsevol format i descarta els no vàlids", () => {
    expect(toDecimal(484.52)).toBe("484.52");
    expect(toDecimal("484,52")).toBe("484.52");
    expect(toDecimal("1.234,5")).toBe("1234.5");
    expect(toDecimal("#N/A")).toBeNull();
    expect(toDecimal(0)).toBeNull();
    expect(toDecimal(-3)).toBeNull();
  });

  test("marca com a sospitós un salt de més del 50 %", () => {
    expect(isSuspicious(null, "10")).toBe(false);
    expect(isSuspicious("10", "14.99")).toBe(false);
    expect(isSuspicious("10", "4.99")).toBe(true);
    expect(isSuspicious("10", "1000")).toBe(true);
  });
});

describe("Coinbase", () => {
  test("el parell per defecte és en euros", () => {
    expect(coinbasePair("eth-eur")).toBe("ETH-EUR");
    expect(coinbasePair("ETH")).toBe("ETH-EUR");
  });

  test("llegeix el preu spot i rebutja respostes estranyes", () => {
    expect(parseCoinbaseSpot({ data: { amount: "1560.365", base: "ETH", currency: "EUR" } })).toEqual({
      price: "1560.365",
      currency: "EUR",
    });
    expect(parseCoinbaseSpot({ errors: [{ id: "not_found" }] })).toBeNull();
    expect(parseCoinbaseSpot({ data: { amount: "0", currency: "EUR" } })).toBeNull();
    expect(parseCoinbaseSpot(null)).toBeNull();
  });
});

describe("BCE", () => {
  const csv = [
    "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS",
    "EXR.D.CAD.EUR.SP00.A,D,CAD,EUR,SP00,A,2026-11-20,1.5723,A",
    "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-11-20,1.099,A",
    "EXR.D.GBP.EUR.SP00.A,D,GBP,EUR,SP00,A,2026-11-20,NaN,A",
  ].join("\n");

  test("inverteix el tipus (1 USD = x EUR) i conserva la data oficial", () => {
    expect(parseEcbCsv(csv)).toEqual([
      { date: "2026-11-20", base: "CAD", quote: "EUR", rate: "0.63601094" },
      { date: "2026-11-20", base: "USD", quote: "EUR", rate: "0.90991811" },
    ]);
  });

  test("una resposta sense les columnes esperades no dona cap tipus", () => {
    expect(parseEcbCsv("<html>error</html>")).toEqual([]);
    expect(parseEcbCsv("")).toEqual([]);
  });
});

describe("full de preus (Google Sheet)", () => {
  test("separa els preus vàlids de les files que no es poden llegir", () => {
    expect(
      parseSheetRows([
        ["NASDAQ:MSFT", 484.52, "USD"],
        ["ie00b4l5y983", "10,0974", "eur"],
        ["NYSE:XYZ", "#N/A", "USD"],
        ["", 1, "EUR"],
        ["BME:ITX", 52.1],
      ]),
    ).toEqual({
      quotes: [
        { key: "NASDAQ:MSFT", price: "484.52", currency: "USD" },
        { key: "IE00B4L5Y983", price: "10.0974", currency: "EUR" },
        { key: "BME:ITX", price: "52.1", currency: "EUR" },
      ],
      skipped: ["NYSE:XYZ"],
    });
  });
});

describe("EODHD", () => {
  test("tradueix els tickers de l'app i els ISIN als símbols d'EODHD", () => {
    expect(eodhdSymbol({ key: "BME:ITX", kind: "stock" })).toBe("ITX.MC");
    expect(eodhdSymbol({ key: "AMS:ADYEN", kind: "stock" })).toBe("ADYEN.AS");
    expect(eodhdSymbol({ key: "ETR:SAP", kind: "stock" })).toBe("SAP.XETRA");
    expect(eodhdSymbol({ key: "NASDAQ:AAPL", kind: "stock" })).toBe("AAPL.US");
    expect(eodhdSymbol({ key: "NYSE:XYZ", kind: "stock" })).toBe("XYZ.US");
    expect(eodhdSymbol({ key: "CVE:ABC", kind: "stock" })).toBe("ABC.V");
    expect(eodhdSymbol({ key: "ABC.TO", kind: "stock" })).toBe("ABC.TO");
    expect(eodhdSymbol({ key: "NYSE:BRK.B", kind: "stock" })).toBe("BRK-B.US");
    expect(eodhdSymbol({ key: "IE00B5BMR087", kind: "fund" })).toBe("IE00B5BMR087.EUFUND");
    expect(eodhdSymbol({ key: "XXX:ABC", kind: "stock" })).toBeNull();
    expect(eodhdSymbol({ key: "ETH-EUR", kind: "crypto" })).toBeNull();
  });

  test("agafa l'últim tancament vàlid amb la seva data", () => {
    expect(
      latestClose([
        { date: "2026-11-18", close: 267.74 },
        { date: "2026-11-20", close: 270.1 },
        { date: "2026-11-19", close: 268 },
        { date: "2026-11-21", close: null },
      ]),
    ).toEqual({ date: "2026-11-20", price: "270.1" });
    expect(latestClose([])).toBeNull();
    expect(latestClose({ error: "Ticker Not Found" })).toBeNull();
  });
});
