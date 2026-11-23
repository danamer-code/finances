/** Textos de la zona «fiscal» (català: la referència de les claus). */
const fiscal = {
  title: "Fiscal",
  taxYear: "Exercici fiscal",
  netGain: "Guany patrimonial net",
  noSales: "Cap venda aquest any",
  salesSummary: (n: number) => `${n} ${n === 1 ? "venda" : "vendes"} · calculat amb FIFO per lots`,
  irpf: "IRPF",
  /** Règim de no resident; el país només si no és Espanya. */
  irnr: (country: string | null) => `IRNR (no resident${country ? `, ${country}` : ""})`,
  gains: "Guanys",
  losses: "Pèrdues",
  estimatedTax: "Impost estimat",
  salesBalance: "Saldo de vendes",
  carriedLosses: "Pèrdues d'anys anteriors compensades",
  interestAndDividends: "Interessos i dividends",
  offsetAgainstInterest: "Pèrdua compensada amb interessos (25 %)",
  savingsBase: "Base de l'estalvi",
  brackets: (year: number) => `Trams de l'estalvi de ${year} (19–30 %). És una estimació orientativa, no la declaració.`,
  nonResident: "No resident aquest any",
  irnrDefault: "Règim IRNR: les vendes no entren a la base de l'estalvi de l'IRPF.",
  pendingLosses: "Pèrdues pendents de compensar",
  pendingItem: (year: number, expires: number) => `De ${year} · fins al ${expires}`,
  realizedSales: "Vendes realitzades",
  gainOrLoss: "guany o pèrdua",
  rights: "drets",
  /** Unitats curtes de cada venda: «3 acc.». */
  units: { rights: "drets", stock: "acc.", fund: "part.", other: "u." },
  lots: (n: number) => `${n} ${n === 1 ? "lot" : "lots"}`,
  /** «Lots de novembre 2023» o «Lots de novembre 2023 a gener 2024». */
  lotsRange: (from: string, to: string | null) => `Lots de ${to ? `${from} a ${to}` : from}`,
  /** Text abans i després de l'import venut: «1.234 € venut». */
  sold: { before: "", after: " venut" },
  interestFrom: (year: number) => `Moviments de la categoria d'interessos de ${year}`,
  costCriteria:
    "Criteri de cost: les accions alliberades (scrip) reparteixen el cost i hereten l'antiguitat de les originals, i els drets venuts abans de 2017 redueixen el cost. Xifres orientatives, pendents de confirmar.",
  simulator: {
    title: "Simulador de venda",
    subtitle: "Què passaria si venguessis avui",
    holding: "Posició",
    units: "Participacions",
    all: "Totes",
    youHave: (qty: string) => `En tens ${qty}`,
    unitPrice: "Preu per participació",
    lastKnownPrice: "L'últim preu conegut",
    decimalPlaceholder: "0,00",
    estimatedLoss: "Minusvàlua estimada",
    estimatedGain: "Plusvàlua estimada",
    fromLots: (n: number) => `Surt ${n === 1 ? "d'1 lot" : `de ${n} lots`}`,
    range: (from: string, to: string) => `de ${from} a ${to}`,
    proceeds: "Cobraries",
    fiscalCost: "Cost fiscal (FIFO)",
    taxSaved: "Impost que t'estalvies",
    taxExtra: "Impost de més aquest any",
    prompt: "Escriu quantes participacions vendries per veure el guany i els lots que surten.",
  },
  errors: {
    invalidInput: "Escriu una quantitat i un preu vàlids.",
    notEnough: (qty: string) => `Només en tens ${qty}.`,
    failed: "No s'ha pogut simular aquesta venda.",
  },
};

export default fiscal;
