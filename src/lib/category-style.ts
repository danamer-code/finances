/**
 * Icones i colors de les categories. Les categories guarden el nom de la icona i del color; si encara no
 * en tenen (p. ex. les migrades), se'n dedueixen pel nom.
 */
import { conceptKey } from "./concepts";

export const ICON_NAMES = [
  "cart", "coffee", "utensils", "beer", "train", "scooter", "car", "taxi", "plane", "home", "bolt",
  "repeat", "heart", "dumbbell", "book", "shirt", "scissors", "ticket", "party", "gift", "receipt",
  "wallet", "percent", "trend", "coins", "piggy", "tag",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/**
 * Plantilla de categories per a un usuari nou (pantalla de benvinguda). El nom de cada una surt dels textos
 * (`benvinguda.starter[key]`), en l'idioma que l'usuari tria.
 */
export const CATEGORY_TEMPLATE = [
  { key: "salary", kind: "income", icon: "wallet", color: "lime", checked: true },
  { key: "interest", kind: "income", icon: "percent", color: "lime", checked: true },
  { key: "otherIncome", kind: "income", icon: "coins", color: "lime", checked: true },
  { key: "groceries", kind: "expense", icon: "cart", color: "mint", checked: true },
  { key: "restaurants", kind: "expense", icon: "utensils", color: "coral", checked: true },
  { key: "coffee", kind: "expense", icon: "coffee", color: "amber", checked: true },
  { key: "publicTransport", kind: "expense", icon: "train", color: "sky", checked: true },
  { key: "car", kind: "expense", icon: "car", color: "sky", checked: false },
  { key: "taxi", kind: "expense", icon: "taxi", color: "sky", checked: false },
  { key: "housing", kind: "expense", icon: "home", color: "stone", checked: true },
  { key: "utilities", kind: "expense", icon: "bolt", color: "stone", checked: true },
  { key: "subscriptions", kind: "expense", icon: "repeat", color: "lilac", checked: true },
  { key: "health", kind: "expense", icon: "heart", color: "rose", checked: true },
  { key: "sport", kind: "expense", icon: "dumbbell", color: "mint", checked: false },
  { key: "clothes", kind: "expense", icon: "shirt", color: "rose", checked: true },
  { key: "leisure", kind: "expense", icon: "ticket", color: "coral", checked: true },
  { key: "travel", kind: "expense", icon: "plane", color: "lilac", checked: false },
  { key: "education", kind: "expense", icon: "book", color: "lilac", checked: false },
  { key: "gifts", kind: "expense", icon: "gift", color: "rose", checked: false },
  { key: "taxes", kind: "expense", icon: "receipt", color: "stone", checked: true },
  { key: "otherExpenses", kind: "expense", icon: "tag", color: "stone", checked: true },
  { key: "funds", kind: "investment", icon: "trend", color: "lime", checked: false },
  { key: "stocks", kind: "investment", icon: "trend", color: "lime", checked: false },
  { key: "investmentFees", kind: "investment", icon: "receipt", color: "stone", checked: false },
] as const satisfies ReadonlyArray<{ key: string; kind: "income" | "expense" | "investment"; icon: IconName; color: ColorName; checked: boolean }>;
export type StarterKey = (typeof CATEGORY_TEMPLATE)[number]["key"];

/** Paleta: tons que funcionen sobre fons fosc i clar, amb el llima de l'app com a primer color. Els noms visibles són als textos (`ajustos.categories.colors`). */
export const CATEGORY_COLORS = {
  lime: { bg: "#d6f35b", fg: "#121212" },
  sky: { bg: "#8ecdf6", fg: "#0b2233" },
  coral: { bg: "#ff9b85", fg: "#3a120a" },
  amber: { bg: "#ffc861", fg: "#3a2600" },
  mint: { bg: "#7fe0b5", fg: "#0a2c1d" },
  lilac: { bg: "#c4b0ff", fg: "#1f1640" },
  rose: { bg: "#f7a8d0", fg: "#3d0f26" },
  stone: { bg: "#c9c9c2", fg: "#1b1b1b" },
} as const;
export type ColorName = keyof typeof CATEGORY_COLORS;
export const COLOR_NAMES = Object.keys(CATEGORY_COLORS) as ColorName[];

const RULES: Array<[RegExp, IconName, ColorName]> = [
  [/super|mercat|compra|lidl|netto|carrefour/, "cart", "mint"],
  [/birra|cervesa/, "beer", "amber"],
  [/cafe|refresc|begud/, "coffee", "amber"],
  [/restaurant|menjar|sopar|dinar/, "utensils", "coral"],
  [/transport public|metro|bus|tren/, "train", "sky"],
  [/taxi|uber|cabify/, "taxi", "sky"],
  [/moto|cotxe|gasolina|parquing/, "car", "sky"],
  [/^transport/, "scooter", "sky"],
  [/vol|viatge|turisme/, "plane", "lilac"],
  [/lloguer|casa|habitatge/, "home", "stone"],
  [/llum|aigua|gas|subministr|internet/, "bolt", "stone"],
  [/subscrip/, "repeat", "lilac"],
  [/salut|metge|farmacia/, "heart", "rose"],
  [/esport|gimnas/, "dumbbell", "mint"],
  [/educa|curs|llibre/, "book", "lilac"],
  [/roba/, "shirt", "rose"],
  [/barber|perruq/, "scissors", "rose"],
  [/oci|cinema|concert/, "ticket", "coral"],
  [/festa/, "party", "coral"],
  [/regal/, "gift", "rose"],
  [/impost|taxa/, "receipt", "stone"],
  [/sou|nomina|salari/, "wallet", "lime"],
  [/interes|dividend/, "percent", "lime"],
  [/comissi/, "receipt", "stone"],
  [/inversio|fons|accions|cripto/, "trend", "lime"],
  [/ingres/, "coins", "lime"],
];

export function categoryStyle(cat: { name: string; icon: string | null; color: string | null; kind?: string }) {
  const key = conceptKey(cat.name);
  const rule = RULES.find(([re]) => re.test(key));
  const icon = (ICON_NAMES as readonly string[]).includes(cat.icon ?? "")
    ? (cat.icon as IconName)
    : (rule?.[1] ?? (cat.kind === "income" ? "coins" : cat.kind === "investment" ? "trend" : "tag"));
  const colorName = (cat.color && cat.color in CATEGORY_COLORS ? cat.color : (rule?.[2] ?? "stone")) as ColorName;
  return { icon, colorName, ...CATEGORY_COLORS[colorName] };
}
