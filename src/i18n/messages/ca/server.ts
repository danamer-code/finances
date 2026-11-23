import { ofMonth } from "@/lib/format";

/** Textos que es generen al servidor: respostes d'error de les rutes i avisos (notificacions) del cron diari. */
const server = {
  errors: {
    unauthorized: "No autoritzat",
    invalidYear: "Any no vàlid",
    noData: "Sense dades",
  },
  notices: {
    /** «A, B i C». */
    list: (items: string[]) =>
      items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`,
    pending: {
      title: "Falta l'import",
      body: (concepts: string) => `${concepts}: escriu la xifra quan la tinguis.`,
    },
    budget: {
      over: (category: string) => `Has superat el pressupost de ${category}`,
      near: (category: string, percent: number) => `${category}: ja portes el ${percent} %`,
      /** Imports ja formatats en la divisa de l'usuari. */
      body: (spent: string, budget: string) => `${spent} de ${budget} aquest mes.`,
    },
    balances: {
      title: "Actualitza els saldos",
      body: (count: number, month: number) =>
        `${count === 1 ? "1 compte encara no té" : `${count} comptes encara no tenen`} el saldo ${ofMonth(month)}.`,
    },
    wrapped: {
      title: (year: number) => `El teu ${year} ja és aquí`,
      body: "L'any en un minut: estalvi, categories, llocs i cartera.",
    },
    wrappedFinal: {
      title: (year: number) => `El teu ${year}, complet`,
      body: (year: number) => `Ja pots veure el resum de tot el ${year}, fins al 31 de desembre.`,
    },
  },
};

export default server;
