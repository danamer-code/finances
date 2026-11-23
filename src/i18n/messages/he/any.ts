import { monthName } from "@/lib/format";

import type { Messages } from "../types";
import { pc } from "./percent";

const any: Messages["any"] = {
  title: "סיכום השנה",
  backToToday: "חזרה להיום",
  year: "שנה",
  wrapped: {
    title: (year) => `ה-${year} שלך בדקה`,
    subtitle: (soFar) => `Year Wrapped${soFar ? " · בינתיים, עד היום" : ""}`,
  },
  saved: (year) => `נחסך ב-${year}`,
  overspent: (year) => `ההוצאות עלו על ההכנסות ב-${year}`,
  since: (month) => `מאז ${monthName(month, "he")}`,
  rateOfIncome: (rate) => `${pc(rate)} מההכנסות`,
  vs: (year) => `לעומת ${year}`,
  income: "הכנסות",
  expenses: "הוצאות",
  savings: "חיסכון",
  byCategory: "הוצאות לפי קטגוריה",
  empty: (year) => `עדיין אין תנועות ב-${year}.`,
  comparison: "השוואה בין שנים",
  tableCaption: "הכנסות, הוצאות וחיסכון בכל שנה",
  sinceShort: (month) => `מאז ${monthName(month, "he")}`,
  inProgress: "שנה נוכחית",
  percent: (n) => pc(n),
  chart: {
    series: "סדרה",
    ariaLabel: (label) => `${label} לפי חודש. הקישו על עמודה כדי לראות את הסכום.`,
  },
};

export default any;
