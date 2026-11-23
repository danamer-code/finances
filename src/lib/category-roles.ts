/**
 * Categories amb un paper especial (interessos, subscripcions, comissions, inversions), reconegudes pel nom en
 * qualsevol dels idiomes de l'app, a més dels noms del full antic. Així funcionen igual per a un usuari que
 * comença en anglès o en hebreu.
 */
import { LOCALES } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";

type StarterKey = keyof (typeof MESSAGES)["ca"]["benvinguda"]["starter"];
const starter = (key: StarterKey) => LOCALES.map((l) => String(MESSAGES[l].benvinguda.starter[key]));

export const CATEGORY_ROLE_NAMES = {
  interest: [...starter("interest"), "Interessos/dividends"],
  subscriptions: starter("subscriptions"),
  fees: [...starter("investmentFees"), "Comissions d'inversió"],
  fund: starter("funds"),
  stock: starter("stocks"),
  crypto: ["Inversió cripto", "Crypto investments", "השקעה בקריפטו"],
} as const;

export type CategoryRole = keyof typeof CATEGORY_ROLE_NAMES;

/** Literal d'array de Postgres amb els noms en minúscules, per a `lower(c.name) = any(...::text[])`. */
export function roleNamesArray(role: CategoryRole): string {
  const quoted = CATEGORY_ROLE_NAMES[role].map((n) => `"${n.toLowerCase().replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `{${quoted.join(",")}}`;
}
