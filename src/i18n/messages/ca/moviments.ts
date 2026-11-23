import { inMonth } from "@/lib/format";

/** Textos de la zona «moviments» (català: la referència de les claus). */
const moviments = {
  title: "Moviments",
  month: "Mes",
  filter: "Filtre",
  /** Claus = valors de `?tipus=` (MovementFilter). */
  filters: { tots: "Tots", despeses: "Despeses", ingressos: "Ingressos", inversions: "Inversions" },
  categoryMovements: (name: string) => `Moviments de ${name}`,
  countInMonth: (n: number, month: number) => `${n} ${n === 1 ? "moviment" : "moviments"} ${inMonth(month)}`,
  clearCategory: "Treure el filtre de categoria",
  general: (name: string) => `${name} (general)`,
  percent: (n: number) => `${n} %`,
  moneyIn: "Entrades",
  moneyOut: "Sortides",
  empty: "Cap moviment aquest mes.",
  item: {
    generated: "Generat des d'una operació",
    missingAmount: "Falta l'import",
  },
  detail: {
    title: "Moviment",
    complete: "Completa el moviment",
    back: "Tornar a moviments",
    generatedNotice:
      "Aquest moviment s'ha generat automàticament a partir d'una operació de la cartera. Es podrà editar des de la pantalla Cartera.",
    amount: "Import",
    concept: "Concepte",
    date: "Data",
    category: "Categoria",
    notes: "Notes",
    kinds: { expense: "Despeses", income: "Ingressos", investment: "Inversions" },
    deleteMovement: "Esborrar moviment",
    tapAgainToDelete: "Toca un altre cop per esborrar-lo",
    deleteFailed: "No s'ha pogut esborrar",
  },
  errors: {
    invalidDate: "Data no vàlida",
    conceptRequired: "Cal un concepte",
    conceptTooLong: "Concepte massa llarg",
    notesTooLong: "Les notes són massa llargues",
    pickCategory: "Tria una categoria",
    amountPositive: "L'import ha de ser més gran que zero",
    categoryNotFound: "Aquesta categoria no existeix",
    notFound: "Aquest moviment no existeix",
    invalidMovement: "Moviment no vàlid",
    fromTradeEdit: "Aquest moviment ve d'una operació de la cartera: edita l'operació.",
    fromTradeDelete: "Aquest moviment ve d'una operació de la cartera: esborra l'operació.",
  },
};

export default moviments;
