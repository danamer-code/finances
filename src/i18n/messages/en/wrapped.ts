import type { Currency } from "@/i18n/config";
import { monthName } from "@/lib/format";

import type { Messages } from "../types";

const CURRENCY_NAMES: Record<Currency, string> = { EUR: "euros", USD: "dollars", ILS: "shekels" };
const month = (m: number) => monthName(m, "en");
const num = (n: number) => n.toLocaleString("en-GB");

const personas: Messages["wrapped"]["personas"] = {
  saver: {
    title: "Saving machine",
    description: (rate, currency) => `You kept ${rate} of every 100 ${CURRENCY_NAMES[currency]} that came in. A textbook year.`,
  },
  investor: {
    title: "Investor mindset",
    description: () => "A good chunk of what you saved went straight into your portfolio, to work for you.",
  },
  traveller: {
    title: "Wanderlust",
    description: () => "Your money had a passport: travel was your big priority.",
  },
  social: {
    title: "Social life",
    description: () => "Dinners, parties and coffees: a year lived in good company.",
  },
  steady: {
    title: "Steady saver",
    description: () => "Quietly, month after month, you set aside a good part of what came in.",
  },
  balanced: {
    title: "Balanced year",
    description: () => "Income and spending in balance: the perfect starting point for next year.",
  },
};

const wrapped: Messages["wrapped"] = {
  metaTitle: "Your year",
  brand: "Finances · Year Wrapped",
  number: num,
  percent: (n) => `${n}%`,
  through: (day, m) => `up to ${day} ${month(m)}`,
  soFar: (through) => `So far, ${through}`,
  period: (year, through) => (through ? `${year}, ${through}` : String(year)),
  versus: (change, prevYear, sameDates) => (sameDates ? `${change} vs the same dates in ${prevYear}` : `${change} vs ${prevYear}`),
  nav: {
    slide: "Slide",
    previous: "Previous",
    next: "Next",
    tapToContinue: "Tap to continue",
  },
  intro: {
    label: "Your year",
    title: ["Your ", ""],
    movements: (movements, concepts) =>
      `${movements === 1 ? "movement" : "movements"} logged, ${concepts === 1 ? "with 1 description" : `with ${num(concepts)} different descriptions`}`,
  },
  savings: {
    label: "Savings",
    kept: "You kept",
    overspent: "You spent more than came in",
    overspentNote: "over your income. It happens: some years are for doing things. A budget can lend you a hand.",
    rate: (rate) => `That's ${rate}% of everything that came in.`,
    noIncome: "Everything you didn't spend.",
    previous: (prevYear, sameDates, rate) => (sameDates ? `Same dates in ${prevYear}: ${rate}%.` : `In ${prevYear}: ${rate}%.`),
    gained: (points) => ` That's ${points} ${points === 1 ? "point" : "points"} better.`,
  },
  flows: {
    label: "Money in and out",
    title: (period) => `Money in and out in ${period}`,
    income: "Came in",
    expense: "Went out",
  },
  categories: {
    label: () => "Where your money went",
    win: (category, amount, prevYear, sameDates) => [
      "A win: you spent ",
      amount,
      " less on ",
      category,
      sameDates ? ` than at this point in ${prevYear}.` : ` than in ${prevYear}.`,
    ],
  },
  places: {
    label: "Your places",
    title: "The ones that came up most",
    times: (n) => (n === 1 ? "once" : `${n} times`),
  },
  rhythm: {
    label: "The rhythm",
    title: "The rhythm of the year",
    average: "spent per month, on average",
    priciest: "Priciest month:",
    calmest: "Calmest:",
  },
  subscriptions: {
    label: "Subscriptions",
    title: (count) => (count === 1 ? "On subscriptions, just 1" : `On subscriptions, ${count} different ones`),
    monthly: (amount) => ["About ", amount, " a month."],
    days: (days) => ` That's ${days} ${days === 1 ? "day" : "days"} of all your spending.`,
  },
  investments: {
    label: "Investments",
    title: "Your portfolio",
    start: (m) => (m === null ? "At the start of the year" : `On 1 ${month(m)}`),
    endOfYear: "At the end of the year",
    today: "Today",
    withFlows: "(including what you added and took out)",
    latent: "Unrealised gain on cost",
    realized: "Gains from sales",
    best: "Best position",
  },
  tax: {
    label: "Tax",
    private: "Just for you: it's not on the share card",
    sales: (n) => (n === 1 ? "1 sale with a net gain of" : `${n} sales with a net gain of`),
    nonResident: "Non-resident year (IRNR): the tax is worked out separately.",
    estimate: (amount) => ["Estimated tax on savings income: ", amount, ". Just a guide."],
    noTax: "No estimated tax.",
  },
  profile: {
    label: "Your profile",
    title: (year) => `Your ${year} profile`,
  },
  personas,
  share: {
    button: "Share the card",
    busy: "Preparing the image…",
    error: "Couldn't prepare the image. Please try again.",
    note: () => "Only percentages and rankings: no amounts.",
    again: "Watch again",
    title: (year) => `My ${year}`,
  },
  card: {
    title: ["My ", ""],
    profile: "My profile",
    savedRate: "of income saved",
    movements: (n) => (n === 1 ? "movement logged" : "movements logged"),
    topConcept: (concept) => `${concept}, the most frequent`,
    footer: "No amounts: just percentages and rankings.",
  },
};

export default wrapped;
