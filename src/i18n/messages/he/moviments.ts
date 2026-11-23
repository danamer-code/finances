import { monthName } from "@/lib/format";

import type { Messages } from "../types";
import { pc } from "./percent";

const moviments: Messages["moviments"] = {
  title: "תנועות",
  month: "חודש",
  filter: "סינון",
  filters: { tots: "הכול", despeses: "הוצאות", ingressos: "הכנסות", inversions: "השקעות" },
  categoryMovements: (name) => `תנועות בקטגוריה ${name}`,
  countInMonth: (n, month) => `${n === 1 ? "תנועה אחת" : `${n} תנועות`} ב${monthName(month, "he")}`,
  clearCategory: "הסרת סינון הקטגוריה",
  general: (name) => `${name} (כללי)`,
  percent: (n) => pc(n),
  moneyIn: "כסף שנכנס",
  moneyOut: "כסף שיצא",
  empty: "אין תנועות החודש.",
  item: {
    generated: "נוצרה מפעולה בתיק ההשקעות",
    missingAmount: "חסר סכום",
  },
  detail: {
    title: "תנועה",
    complete: "השלמת התנועה",
    back: "חזרה לתנועות",
    generatedNotice: "התנועה הזו נוצרה אוטומטית מפעולה בתיק ההשקעות. אפשר יהיה לערוך אותה ממסך תיק ההשקעות.",
    amount: "סכום",
    concept: "תיאור",
    date: "תאריך",
    category: "קטגוריה",
    notes: "הערות",
    kinds: { expense: "הוצאות", income: "הכנסות", investment: "השקעות" },
    deleteMovement: "מחיקת התנועה",
    tapAgainToDelete: "הקישו שוב כדי למחוק",
    deleteFailed: "המחיקה נכשלה",
  },
  errors: {
    invalidDate: "תאריך לא תקין",
    conceptRequired: "צריך להזין תיאור",
    conceptTooLong: "התיאור ארוך מדי",
    notesTooLong: "ההערות ארוכות מדי",
    pickCategory: "בחרו קטגוריה",
    amountPositive: "הסכום חייב להיות גדול מאפס",
    categoryNotFound: "הקטגוריה הזו לא קיימת",
    notFound: "התנועה הזו לא קיימת",
    invalidMovement: "תנועה לא תקינה",
    fromTradeEdit: "התנועה הזו נוצרה מפעולה בתיק ההשקעות: ערכו את הפעולה עצמה.",
    fromTradeDelete: "התנועה הזו נוצרה מפעולה בתיק ההשקעות: מחקו את הפעולה עצמה.",
  },
};

export default moviments;
