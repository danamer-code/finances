import { monthName } from "@/lib/format";

import type { Messages } from "../types";

const server: Messages["server"] = {
  errors: {
    unauthorized: "Not authorised",
    invalidYear: "Invalid year",
    noData: "No data",
  },
  notices: {
    list: (items) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`),
    pending: {
      title: "Amount missing",
      body: (concepts) => `${concepts}: add the figure when you have it.`,
    },
    budget: {
      over: (category) => `You've gone over your ${category} budget`,
      near: (category, percent) => `${category}: you're already at ${percent}%`,
      body: (spent, budget) => `${spent} of ${budget} this month.`,
    },
    balances: {
      title: "Update your balances",
      body: (count, month) =>
        count === 1
          ? `1 account doesn't have its ${monthName(month, "en")} balance yet.`
          : `${count} accounts don't have their ${monthName(month, "en")} balance yet.`,
    },
    wrapped: {
      title: (year) => `Your ${year} is here`,
      body: "Your year in a minute: savings, categories, places and portfolio.",
    },
    wrappedFinal: {
      title: (year) => `Your ${year}, complete`,
      body: (year) => `You can now see the summary of all of ${year}, up to 31 December.`,
    },
  },
};

export default server;
