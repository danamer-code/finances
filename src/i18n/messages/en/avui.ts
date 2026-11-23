import { monthName } from "@/lib/format";

import type { Messages } from "../types";

const month = (m: number) => monthName(m, "en");

const avui: Messages["avui"] = {
  settings: "Settings",
  hello: "Hi",
  saved: (m) => `Saved in ${month(m)}`,
  overspent: (m) => `Spent more than you earned in ${month(m)}`,
  rateOfIncome: (rate) => `${rate}% of what you earned`,
  movementsThisMonth: (n) => (n === 1 ? "1 movement this month" : `${n} movements this month`),
  comparedTo: (more, m) => `${more ? "more" : "less"} than in ${month(m)}`,
  percent: (n) => `${n}%`,
  percentSign: "%",
  wrapped: {
    title: (year) => `Your ${year} is here`,
    subtitle: "Your year in a minute: savings, categories, places and portfolio",
  },
  glance: {
    title: "Your month at a glance",
    seeYear: "See the year",
    income: "Income · 6 months",
    expenses: "Expenses",
    now: "now",
    previous: (m) => month(m).slice(0, 3),
    budgetSpent: "Budget spent",
    budgetOf: "of",
    budgetEmpty: "Set budgets on your categories to see it here",
    budget: "Budget",
    perDay: "Spending per day",
  },
  pending: "Pending",
  balances: {
    title: (m) => `Update your ${month(m)} balances`,
    missing: (n) =>
      n === 1 ? "1 account doesn't have this month's balance yet" : `${n} accounts don't have this month's balance yet`,
  },
  byCategory: "By category",
  vs: (label) => `vs ${label}`,
  latest: "Latest movements",
  firstMovement: "Add your first movement",
  spending: {
    empty: "No spending in this period yet.",
    over: "Over",
    ofBudget: (n) => `${n}% of budget`,
    comparedTo: (label) => `Compared with ${label}`,
    isNew: "new",
  },
};

export default avui;
