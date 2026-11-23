/** Idiomes i divises de l'app. L'idioma i la divisa són preferències de cada usuari (perfil + galeta). */
export const LOCALES = ["ca", "en", "he"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ca";

export const CURRENCIES = ["EUR", "USD", "ILS"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "EUR";

export const LOCALE_COOKIE = "locale";
export const CURRENCY_COOKIE = "currency";
/** «1» o «0»: si es mostra la pestanya Fiscal (impostos d'Espanya). */
export const FISCAL_COOKIE = "fiscal";

/** Nom de cada idioma en el seu propi idioma (per al selector). */
export const LOCALE_NAMES: Record<Locale, string> = { ca: "Català", en: "English", he: "עברית" };
export const CURRENCY_SYMBOLS: Record<Currency, string> = { EUR: "€", USD: "$", ILS: "₪" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
export const isRtl = (l: Locale) => l === "he";

/** Etiqueta BCP 47 per a Intl i l'atribut lang. */
export const LOCALE_TAGS: Record<Locale, string> = { ca: "ca-ES", en: "en-GB", he: "he-IL" };

/** `fiscal`: si es mostra la pestanya Fiscal (plusvàlues i IRPF d'Espanya). */
export type Prefs = { locale: Locale; currency: Currency; fiscal: boolean };
export const DEFAULT_PREFS: Prefs = { locale: DEFAULT_LOCALE, currency: DEFAULT_CURRENCY, fiscal: true };

/**
 * Idioma per a qui encara no en té cap triat (pàgina d'entrada, primer cop): el primer del navegador que l'app
 * tingui. El castellà va al català; qualsevol altre idioma, a l'anglès.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const ranked = (header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.trim().slice(2) ?? "1");
      return { lang: tag.split("-")[0], q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((x) => x.lang && x.lang !== "*" && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { lang } of ranked) {
    if (isLocale(lang)) return lang;
    if (lang === "es") return "ca";
  }
  return ranked.length > 0 ? "en" : DEFAULT_LOCALE;
}

/** Divisa per defecte d'un idioma (només per a qui encara no n'ha triat cap). */
export const defaultCurrencyFor = (locale: Locale): Currency => (locale === "he" ? "ILS" : "EUR");
