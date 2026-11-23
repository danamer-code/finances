import type { Messages } from "../types";

const nou: Messages["nou"] = {
  title: "New movement",
  kind: "Movement type",
  expense: "Expense",
  income: "Income",
  concept: "Description",
  conceptPlaceholder: "Description · e.g. coffee",
  clearConcept: "Clear description",
  exists: (concept) => `“${concept}” already exists: tap it to avoid a duplicate`,
  newConcept: "New description: it'll be created when you save",
  saved: (label) => `Saved: ${label}`,
  inARow: (n) => `${n} in a row`,
  savedOnPhone: "saved on this phone",
  pickCategory: "Pick a category",
  pickDate: "Pick the date",
  category: "Category",
  date: "Date",
  likeLastTime: "Same as last time",
  lastTimes: "Last few times",
  backspace: "Delete",
  saveAndAnother: "Save & add another",
  general: "General",
  manageCategories: "Manage categories",
  today: "Today",
  yesterday: "Yesterday",
  dayBeforeYesterday: "Day before yesterday",
  otherDate: "Another date",
};

export default nou;
