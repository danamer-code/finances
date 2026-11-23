import { monthName } from "@/lib/format";

import type { Messages } from "../types";
import { pc } from "./percent";

const month = (m: number) => monthName(m, "he");

const avui: Messages["avui"] = {
  settings: "הגדרות",
  hello: "שלום",
  saved: (m) => `נחסך ב${month(m)}`,
  overspent: (m) => `ההוצאות עלו על ההכנסות ב${month(m)}`,
  rateOfIncome: (rate) => `${pc(rate)} מההכנסות`,
  movementsThisMonth: (n) => (n === 1 ? "תנועה אחת החודש" : `${n} תנועות החודש`),
  comparedTo: (more, m) => `${more ? "יותר" : "פחות"} מאשר ב${month(m)}`,
  percent: (n) => pc(n),
  percentSign: "%",
  wrapped: {
    title: (year) => `ה-${year} שלך כבר כאן`,
    subtitle: "השנה בדקה: חיסכון, קטגוריות, מקומות ותיק ההשקעות",
  },
  glance: {
    title: "החודש במבט אחד",
    seeYear: "הצגת השנה",
    income: "הכנסות · 6 חודשים",
    expenses: "הוצאות",
    now: "עכשיו",
    previous: (m) => month(m),
    budgetSpent: "ניצול התקציב",
    budgetOf: "מתוך",
    budgetEmpty: "הגדירו תקציב לקטגוריות כדי לראות אותו כאן",
    budget: "תקציב",
    perDay: "הוצאה ליום",
  },
  pending: "בהמתנה",
  balances: {
    title: (m) => `עדכנו את היתרות של ${month(m)}`,
    missing: (n) => (n === 1 ? "לחשבון אחד עדיין אין יתרה לחודש הזה" : `ל-${n} חשבונות עדיין אין יתרה לחודש הזה`),
  },
  byCategory: "לפי קטגוריה",
  vs: (label) => `לעומת ${label}`,
  latest: "תנועות אחרונות",
  firstMovement: "הוסיפו את התנועה הראשונה",
  spending: {
    empty: "עדיין אין הוצאות בתקופה הזו.",
    over: "חריגה",
    ofBudget: (n) => `${pc(n)} מהתקציב`,
    comparedTo: (label) => `לעומת ${label}`,
    isNew: "חדש",
  },
};

export default avui;
