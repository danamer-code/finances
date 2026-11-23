import { monthName } from "@/lib/format";

import type { Messages } from "../types";

const any: Messages["any"] = {
  title: "Year summary",
  backToToday: "Back to Today",
  year: "Year",
  wrapped: {
    title: (year) => `Your ${year} in a minute`,
    subtitle: (soFar) => `Year Wrapped${soFar ? " · so far, up to today" : ""}`,
  },
  saved: (year) => `Saved in ${year}`,
  overspent: (year) => `Overspent in ${year}`,
  since: (month) => `since ${monthName(month, "en")}`,
  rateOfIncome: (rate) => `${rate}% of income`,
  vs: (year) => `vs ${year}`,
  income: "Income",
  expenses: "Expenses",
  savings: "Savings",
  byCategory: "Spending by category",
  empty: (year) => `No movements in ${year} yet.`,
  comparison: "Year by year",
  tableCaption: "Income, expenses and savings for each year",
  sinceShort: (month) => `since ${monthName(month, "en").slice(0, 3)}`,
  inProgress: "in progress",
  percent: (n) => `${n}%`,
  chart: {
    series: "Series",
    ariaLabel: (label) => `${label} by month. Tap a bar to see its amount.`,
  },
};

export default any;
