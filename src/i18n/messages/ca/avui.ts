import { inMonth, monthName, ofMonth } from "@/lib/format";

/** Textos de la zona «avui» (català: la referència de les claus). */
const avui = {
  settings: "Ajustos",
  hello: "Hola",
  saved: (month: number) => `Estalviat ${inMonth(month)}`,
  overspent: (month: number) => `Has gastat més del que has ingressat ${inMonth(month)}`,
  rateOfIncome: (rate: number) => `El ${rate} % del que has ingressat`,
  movementsThisMonth: (n: number) => (n === 1 ? "1 moviment aquest mes" : `${n} moviments aquest mes`),
  comparedTo: (more: boolean, month: number) => `${more ? "més" : "menys"} que ${inMonth(month)}`,
  /** Percentatge: «12 %» en català, «12%» en anglès i hebreu. */
  percent: (n: number) => `${n} %`,
  percentSign: " %",
  wrapped: {
    title: (year: number) => `El teu ${year} ja és aquí`,
    subtitle: "L'any en un minut: estalvi, categories, llocs i cartera",
  },
  glance: {
    title: "El mes d'un cop d'ull",
    seeYear: "Veure l'any",
    income: "Ingressos · 6 mesos",
    expenses: "Despeses",
    now: "ara",
    /** Mes anterior a la llegenda del minigràfic: «oct.». */
    previous: (month: number) => `${monthName(month).slice(0, 3)}.`,
    budgetSpent: "Pressupost gastat",
    budgetOf: "de",
    budgetEmpty: "Posa pressupost a les categories per veure'l aquí",
    budget: "Pressupost",
    perDay: "Despesa per dia",
  },
  pending: "Pendent",
  balances: {
    title: (month: number) => `Actualitza els saldos ${ofMonth(month)}`,
    missing: (n: number) => `${n === 1 ? "1 compte encara no té" : `${n} comptes encara no tenen`} el saldo d'aquest mes`,
  },
  byCategory: "Per categoria",
  vs: (label: string) => `vs ${label}`,
  latest: "Últims moviments",
  firstMovement: "Apunta el primer moviment",
  /** Despesa per categoria (també la fa servir el resum de l'any). */
  spending: {
    empty: "Encara no hi ha despeses en aquest període.",
    over: "Superat",
    ofBudget: (n: number) => `${n} % del pressupost`,
    comparedTo: (label: string) => `Respecte ${label}`,
    isNew: "nou",
  },
};

export default avui;
