import { monthName } from "@/lib/format";

import type { Messages } from "../types";

const moviments: Messages["moviments"] = {
  title: "Movements",
  month: "Month",
  filter: "Filter",
  filters: { tots: "All", despeses: "Expenses", ingressos: "Income", inversions: "Investments" },
  categoryMovements: (name) => `${name} movements`,
  countInMonth: (n, month) => `${n} ${n === 1 ? "movement" : "movements"} in ${monthName(month, "en")}`,
  clearCategory: "Remove category filter",
  general: (name) => `${name} (general)`,
  percent: (n) => `${n}%`,
  moneyIn: "Money in",
  moneyOut: "Money out",
  empty: "No movements this month.",
  item: {
    generated: "Generated from a portfolio trade",
    missingAmount: "Amount missing",
  },
  detail: {
    title: "Movement",
    complete: "Complete the movement",
    back: "Back to movements",
    generatedNotice:
      "This movement was generated automatically from a portfolio trade. You'll be able to edit it from the Portfolio screen.",
    amount: "Amount",
    concept: "Description",
    date: "Date",
    category: "Category",
    notes: "Notes",
    kinds: { expense: "Expenses", income: "Income", investment: "Investments" },
    deleteMovement: "Delete movement",
    tapAgainToDelete: "Tap again to delete it",
    deleteFailed: "Couldn't delete",
  },
  errors: {
    invalidDate: "Invalid date",
    conceptRequired: "A description is required",
    conceptTooLong: "The description is too long",
    notesTooLong: "The notes are too long",
    pickCategory: "Pick a category",
    amountPositive: "The amount must be greater than zero",
    categoryNotFound: "This category doesn't exist",
    notFound: "This movement doesn't exist",
    invalidMovement: "Invalid movement",
    fromTradeEdit: "This movement comes from a portfolio trade: edit the trade instead.",
    fromTradeDelete: "This movement comes from a portfolio trade: delete the trade instead.",
  },
};

export default moviments;
