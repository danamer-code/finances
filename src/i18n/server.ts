import "server-only";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { adminDb } from "@/db";
import { profiles } from "@/db/schema";

import {
  CURRENCY_COOKIE,
  DEFAULT_PREFS,
  defaultCurrencyFor,
  FISCAL_COOKIE,
  isCurrency,
  isLocale,
  LOCALE_COOKIE,
  localeFromAcceptLanguage,
  type Prefs,
} from "./config";
import { MESSAGES } from "./messages";

/**
 * Preferències de la petició (galetes). Sense galeta d'idioma (pàgina d'entrada, primer cop), el del navegador;
 * la divisa per defecte va amb l'idioma (xèquels en hebreu, euros si no).
 */
export const getPrefs = cache(async (): Promise<Prefs> => {
  const jar = await cookies();
  const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
  const currency = jar.get(CURRENCY_COOKIE)?.value;
  const fiscal = jar.get(FISCAL_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : localeFromAcceptLanguage((await headers()).get("accept-language"));
  return {
    locale,
    currency: isCurrency(currency) ? currency : defaultCurrencyFor(locale),
    fiscal: fiscal === undefined ? DEFAULT_PREFS.fiscal : fiscal === "1",
  };
});

export async function getMessages() {
  return MESSAGES[(await getPrefs()).locale];
}

/** Preferències desades al perfil (per al cron, que no té galetes, i per posar-les en entrar). */
export async function getUserPrefs(userId: string): Promise<Prefs> {
  const [row] = await adminDb
    .select({ locale: profiles.locale, currency: profiles.currency, fiscal: profiles.fiscalTab })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  return row ?? DEFAULT_PREFS;
}

/** Desa les preferències a les galetes (un any). */
export async function setPrefsCookies(prefs: Prefs) {
  const jar = await cookies();
  const options = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  jar.set(LOCALE_COOKIE, prefs.locale, options);
  jar.set(CURRENCY_COOKIE, prefs.currency, options);
  jar.set(FISCAL_COOKIE, prefs.fiscal ? "1" : "0", options);
}
