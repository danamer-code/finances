/** Textos compartits per tota l'app (català). */
const common = {
  appName: "Finances",
  nav: { today: "Avui", movements: "Moviments", portfolio: "Cartera", tax: "Fiscal", newMovement: "Nou moviment", main: "Navegació principal" },
  actions: {
    save: "Desar",
    saving: "Desant…",
    saveChanges: "Desar canvis",
    cancel: "Cancel·la",
    close: "Tancar",
    back: "Tornar",
    delete: "Esborrar",
    confirmDelete: "Segur?",
    edit: "Editar",
    add: "Afegeix",
    retry: "Torna-ho a provar",
    seeAll: "Veure-ho tot",
  },
  errors: {
    generic: "No s'ha pogut desar. Torna-ho a provar.",
    invalid: "Dades no vàlides",
    invalidAmount: "L'import no és vàlid",
  },
  theme: { label: "Mode fosc o clar", dark: "Mode fosc", light: "Mode clar" },
  prefs: {
    language: "Idioma",
    currency: "Divisa",
    currencyWarning: "Els imports ja desats no es converteixen: només canvia el símbol amb què es mostren.",
    fiscal: "Pestanya Fiscal",
    fiscalHint: "Plusvàlues i IRPF d'Espanya",
  },
  offline: {
    noConnection: "Sense connexió: el que apuntis es desarà al mòbil.",
    queued: (n: number, online: boolean) =>
      `${n} ${n === 1 ? "moviment desat" : "moviments desats"} al mòbil${online ? ": enviant…" : ". S'enviaran quan tornis a tenir connexió."}`,
  },
};

export default common;
