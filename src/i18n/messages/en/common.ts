import type { Messages } from "../types";

const common: Messages["common"] = {
  appName: "Finances",
  nav: { today: "Today", movements: "Movements", portfolio: "Portfolio", tax: "Tax", newMovement: "New movement", main: "Main navigation" },
  actions: {
    save: "Save",
    saving: "Saving…",
    saveChanges: "Save changes",
    cancel: "Cancel",
    close: "Close",
    back: "Back",
    delete: "Delete",
    confirmDelete: "Sure?",
    edit: "Edit",
    add: "Add",
    retry: "Try again",
    seeAll: "See all",
  },
  errors: {
    generic: "Couldn't save. Please try again.",
    invalid: "Invalid data",
    invalidAmount: "The amount isn't valid",
  },
  theme: { label: "Dark or light mode", dark: "Dark mode", light: "Light mode" },
  prefs: {
    language: "Language",
    currency: "Currency",
    currencyWarning: "Amounts already saved aren't converted: only the symbol they're shown with changes.",
    fiscal: "Tax tab",
    fiscalHint: "Capital gains and Spanish income tax (IRPF)",
  },
  offline: {
    noConnection: "Offline: anything you add will be saved on this phone.",
    queued: (n, online) =>
      `${n} ${n === 1 ? "movement" : "movements"} saved on this phone${online ? ": sending…" : ". They'll be sent when you're back online."}`,
  },
};

export default common;
