import { monthName } from "@/lib/format";

/** Textos de la zona «any» (català: la referència de les claus). */
const any = {
  title: "Resum de l'any",
  backToToday: "Tornar a Avui",
  year: "Any",
  wrapped: {
    title: (year: number) => `El teu ${year} en un minut`,
    subtitle: (soFar: boolean) => `Year Wrapped${soFar ? " · de moment, fins avui" : ""}`,
  },
  saved: (year: number) => `Estalviat el ${year}`,
  overspent: (year: number) => `Gastat de més el ${year}`,
  since: (month: number) => `des de ${monthName(month)}`,
  rateOfIncome: (rate: number) => `El ${rate} % dels ingressos`,
  vs: (year: number) => `vs ${year}`,
  income: "Ingressos",
  expenses: "Despeses",
  savings: "Estalvi",
  byCategory: "Despesa per categoria",
  empty: (year: number) => `Encara no hi ha moviments el ${year}.`,
  comparison: "Comparativa entre anys",
  tableCaption: "Ingressos, despeses i estalvi de cada any",
  sinceShort: (month: number) => `des de ${monthName(month).slice(0, 3)}.`,
  inProgress: "en curs",
  percent: (n: number) => `${n} %`,
  chart: {
    series: "Sèrie",
    ariaLabel: (label: string) => `${label} per mes. Toca una barra per veure'n l'import.`,
  },
};

export default any;
