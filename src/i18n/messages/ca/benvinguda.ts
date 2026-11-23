import type { StarterKey } from "@/lib/category-style";

/** Textos de la zona «benvinguda» (català: la referència de les claus). */
const benvinguda = {
  title: "Benvinguda",
  heading: "Et donem la benvinguda a Finances",
  intro: "Tria les categories que faràs servir. Les podràs canviar, afegir-ne o arxivar-ne quan vulguis.",
  accountLabel: "El teu compte principal",
  defaultAccount: "Compte corrent",
  preparing: "Preparant…",
  start: (n: number) => `Començar amb ${n} categories`,
  /** Noms de les categories de la plantilla (`CATEGORY_TEMPLATE`), tal com es creen. */
  starter: {
    salary: "Nòmina",
    interest: "Interessos i dividends",
    otherIncome: "Altres ingressos",
    groceries: "Supermercat",
    restaurants: "Restaurants",
    coffee: "Cafè i begudes",
    publicTransport: "Transport públic",
    car: "Cotxe i moto",
    taxi: "Taxi",
    housing: "Lloguer o hipoteca",
    utilities: "Subministraments",
    subscriptions: "Subscripcions",
    health: "Salut",
    sport: "Esport",
    clothes: "Roba",
    leisure: "Oci",
    travel: "Viatges",
    education: "Educació",
    gifts: "Regals",
    taxes: "Impostos",
    otherExpenses: "Altres despeses",
    funds: "Inversió fons",
    stocks: "Inversió accions",
    investmentFees: "Comissions d'inversió",
  } satisfies Record<StarterKey, string>,
  errors: {
    noCategories: "Tria almenys una categoria",
    noAccountName: "Posa nom al compte",
  },
};

export default benvinguda;
