import type { Messages } from "../types";

const benvinguda: Messages["benvinguda"] = {
  title: "Welcome",
  heading: "Welcome to Finances",
  intro: "Choose the categories you'll use. You can change them, add more or archive them whenever you like.",
  accountLabel: "Your main account",
  defaultAccount: "Current account",
  preparing: "Getting ready…",
  start: (n) => `Start with ${n} ${n === 1 ? "category" : "categories"}`,
  starter: {
    salary: "Salary",
    interest: "Interest and dividends",
    otherIncome: "Other income",
    groceries: "Groceries",
    restaurants: "Restaurants",
    coffee: "Coffee and drinks",
    publicTransport: "Public transport",
    car: "Car and motorbike",
    taxi: "Taxi",
    housing: "Rent or mortgage",
    utilities: "Utilities",
    subscriptions: "Subscriptions",
    health: "Health",
    sport: "Sport",
    clothes: "Clothes",
    leisure: "Leisure",
    travel: "Travel",
    education: "Education",
    gifts: "Gifts",
    taxes: "Taxes",
    otherExpenses: "Other expenses",
    funds: "Fund investments",
    stocks: "Stock investments",
    investmentFees: "Investment fees",
  },
  errors: {
    noCategories: "Choose at least one category",
    noAccountName: "Give the account a name",
  },
};

export default benvinguda;
