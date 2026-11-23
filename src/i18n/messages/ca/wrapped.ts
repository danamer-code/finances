import type { ReactNode } from "react";

import type { Currency } from "@/i18n/config";
import { ofMonth } from "@/lib/format";
import type { PersonaKey } from "@/lib/wrapped-persona";

/** Nom de la divisa en plural, per a frases com «cap import en euros». */
const CURRENCY_NAMES: Record<Currency, string> = { EUR: "euros", USD: "dòlars", ILS: "xéquels" };

/** «el 2025» o, amb l'any en marxa, «el 2025 en les mateixes dates». */
const previous = (year: number, sameDates: boolean) => `el ${year}${sameDates ? " en les mateixes dates" : ""}`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Títol i descripció de cada perfil de l'any (`personaFor` en tria la clau). */
export type PersonaText = { title: string; description: (rate: number, currency: Currency) => string };

const personas: Record<PersonaKey, PersonaText> = {
  saver: {
    title: "Màquina d'estalviar",
    description: (rate, currency) => `T'has quedat ${rate} de cada 100 ${CURRENCY_NAMES[currency]} que han entrat. Un any de manual.`,
  },
  investor: {
    title: "Ment inversora",
    description: () => "Bona part del que has estalviat ha anat directe a la cartera a treballar per tu.",
  },
  traveller: {
    title: "Esperit viatger",
    description: (_rate, currency) => `Els ${CURRENCY_NAMES[currency]} han tingut passaport: viatjar ha estat la teva gran prioritat.`,
  },
  social: {
    title: "Vida social",
    description: () => "Sopars, festes i cafès: l'any s'ha viscut en bona companyia.",
  },
  steady: {
    title: "Estalvi constant",
    description: () => "Sense fer soroll, mes a mes, has anat guardant una bona part del que entrava.",
  },
  balanced: {
    title: "Any d'equilibri",
    description: () => "Ingressos i despeses en equilibri: el punt de partida perfecte per a l'any que ve.",
  },
};

/** Textos del Year Wrapped: la història, la targeta per compartir i el perfil de l'any (català: la referència de les claus). */
const wrapped = {
  metaTitle: "El teu any",
  brand: "Finances · Year Wrapped",
  number: (n: number) => n.toLocaleString("ca-ES"),
  percent: (n: number) => `${n} %`,
  /** Fins on arriba l'avançament de l'any en curs: «fins al 23 de novembre». */
  through: (day: number, month: number) => `fins al ${day} ${ofMonth(month)}`,
  soFar: (through: string) => `De moment, ${through}`,
  period: (year: number, through: string | null) => (through ? `${year}, ${through}` : String(year)),
  /** «+12 % respecte el 2025». */
  versus: (change: string, prevYear: number, sameDates: boolean) => `${change} respecte ${previous(prevYear, sameDates)}`,
  nav: {
    slide: "Diapositiva",
    previous: "Anterior",
    next: "Següent",
    tapToContinue: "Toca per continuar",
  },
  intro: {
    label: "El teu any",
    /** Text abans i després de l'any (que va en color): «El teu 2026». */
    title: ["El teu ", ""] as [string, string],
    movements: (movements: number, concepts: number) =>
      `${movements === 1 ? "moviment apuntat" : "moviments apuntats"}, amb ${concepts.toLocaleString("ca-ES")} ${concepts === 1 ? "concepte" : "conceptes diferents"}`,
  },
  savings: {
    label: "Estalvi",
    kept: "T'has quedat",
    overspent: "Has gastat més del que ha entrat",
    overspentNote: "per sobre dels ingressos. Passa: hi ha anys de fer coses. El pressupost t'hi pot donar un cop de mà.",
    rate: (rate: number) => `El ${rate} % de tot el que ha entrat.`,
    noIncome: "Tot el que no has gastat.",
    previous: (prevYear: number, sameDates: boolean, rate: number) => `${capitalize(previous(prevYear, sameDates))}: ${rate} %.`,
    gained: (points: number) => ` Hi has guanyat ${points} ${points === 1 ? "punt" : "punts"}.`,
  },
  flows: {
    label: "Entrades i sortides",
    title: (period: string) => `Entrades i sortides de ${period}`,
    income: "Ha entrat",
    expense: "Ha sortit",
  },
  categories: {
    label: (currency: Currency) => `On han anat els ${CURRENCY_NAMES[currency]}`,
    /** La categoria (en negreta) i l'import arriben ja muntats. */
    win: (category: ReactNode, amount: ReactNode, prevYear: number, sameDates: boolean): ReactNode[] => [
      "Victòria: a ",
      category,
      " hi has gastat ",
      amount,
      ` menys que ${previous(prevYear, sameDates)}.`,
    ],
  },
  places: {
    label: "Els teus llocs",
    title: "Els que més s'han repetit",
    times: (n: number) => `${n} ${n === 1 ? "vegada" : "vegades"}`,
  },
  rhythm: {
    label: "El ritme",
    title: "El ritme de l'any",
    average: "de despesa al mes, de mitjana",
    priciest: "El mes més car:",
    calmest: "El més tranquil:",
  },
  subscriptions: {
    label: "Subscripcions",
    title: (count: number) => `En subscripcions, ${count} de diferents`,
    monthly: (amount: ReactNode): ReactNode[] => ["Unes ", amount, " al mes."],
    days: (days: number) => ` Equival a ${days} ${days === 1 ? "dia" : "dies"} de tota la teva despesa.`,
  },
  investments: {
    label: "Inversions",
    title: "La teva cartera",
    /** Primera foto de la cartera de l'any: l'1 de gener (null) o l'1 d'un altre mes. */
    start: (month: number | null) => (month === null ? "A l'inici de l'any" : `L'1 ${ofMonth(month)}`),
    endOfYear: "A final d'any",
    today: "Avui",
    withFlows: "(amb el que hi has afegit i tret)",
    latent: "Guany latent sobre el cost",
    realized: "Guanys de les vendes",
    best: "Millor posició",
  },
  tax: {
    label: "Hisenda",
    private: "Només per a tu: no surt a la targeta per compartir",
    sales: (n: number) => `${n} ${n === 1 ? "venda" : "vendes"} amb un guany net de`,
    nonResident: "Any de no resident (IRNR): el càlcul de l'impost és a part.",
    estimate: (amount: ReactNode): ReactNode[] => ["Impost estimat de l'estalvi: ", amount, ". Orientatiu."],
    noTax: "Sense impost estimat.",
  },
  profile: {
    label: "El teu perfil",
    title: (year: number) => `El teu perfil del ${year}`,
  },
  personas,
  share: {
    button: "Comparteix la targeta",
    busy: "Preparant la imatge…",
    error: "No s'ha pogut preparar la imatge. Torna-ho a provar.",
    note: (currency: Currency) => `Només percentatges i rànquings: cap import en ${CURRENCY_NAMES[currency]}.`,
    again: "Torna-ho a veure",
    title: (year: number) => `El meu ${year}`,
  },
  /** Targeta per compartir (imatge): en primera persona. */
  card: {
    title: ["El meu ", ""] as [string, string],
    profile: "El meu perfil",
    savedRate: "del que ha entrat, estalviat",
    movements: (n: number): string => (n === 1 ? "moviment apuntat" : "moviments apuntats"),
    topConcept: (concept: string) => `${concept}, el més repetit`,
    footer: "Sense imports: només percentatges i rànquings.",
  },
};

export default wrapped;
