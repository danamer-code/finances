import { monthName } from "@/lib/format";

import type { Messages } from "../types";
import { pc } from "./percent";

/** «i» en hebreu: «ו» enganxada a la paraula; davant d'una paraula no hebrea o d'una xifra, «ו-». */
const and = (word: string) => (/^[\u0590-\u05FF]/.test(word) ? `ו${word}` : `ו-${word}`);

const server: Messages["server"] = {
  errors: {
    unauthorized: "אין הרשאה",
    invalidYear: "שנה לא תקינה",
    noData: "אין נתונים",
  },
  notices: {
    list: (items) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${and(items[items.length - 1])}`),
    pending: {
      title: "חסר סכום",
      body: (concepts) => `${concepts}: אפשר להזין את הסכום כשהוא יהיה ידוע.`,
    },
    budget: {
      over: (category) => `חרגת מהתקציב של ${category}`,
      near: (category, percent) => `${category}: כבר הגעת ל-${pc(percent)}`,
      body: (spent, budget) => `${spent} מתוך ${budget} החודש.`,
    },
    balances: {
      title: "עדכנו את היתרות",
      body: (count, month) =>
        count === 1
          ? `לחשבון אחד עדיין אין יתרה של ${monthName(month, "he")}.`
          : `ל-${count} חשבונות עדיין אין יתרה של ${monthName(month, "he")}.`,
    },
    wrapped: {
      title: (year) => `ה-${year} שלך כבר כאן`,
      body: "השנה בדקה: חיסכון, קטגוריות, מקומות ותיק ההשקעות.",
    },
    wrappedFinal: {
      title: (year) => `ה-${year} שלך, במלואו`,
      body: (year) => `אפשר כבר לראות את הסיכום של כל ${year}, עד 31 בדצמבר.`,
    },
  },
};

export default server;
