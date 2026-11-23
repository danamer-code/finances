"use client";

import { createContext, useContext, type ReactNode } from "react";

import { DEFAULT_PREFS, type Prefs } from "./config";
import { MESSAGES } from "./messages";

const PrefsContext = createContext<Prefs>(DEFAULT_PREFS);

/** Idioma i divisa de l'usuari per als components del navegador (els posa el layout arrel). */
export function PrefsProvider({ prefs, children }: { prefs: Prefs; children: ReactNode }) {
  return <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
export const useMessages = () => MESSAGES[useContext(PrefsContext).locale];
