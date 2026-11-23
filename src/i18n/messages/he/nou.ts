import type { Messages } from "../types";

const nou: Messages["nou"] = {
  title: "תנועה חדשה",
  kind: "סוג התנועה",
  expense: "הוצאה",
  income: "הכנסה",
  concept: "תיאור",
  conceptPlaceholder: "תיאור · למשל קפה",
  clearConcept: "ניקוי התיאור",
  exists: (concept) => `"${concept}" כבר קיים: הקישו עליו כדי לא ליצור כפילות`,
  newConcept: "תיאור חדש: ייווצר בשמירה",
  saved: (label) => `נשמר: ${label}`,
  inARow: (n) => `${n} ברצף`,
  savedOnPhone: "נשמר בטלפון",
  pickCategory: "בחירת קטגוריה",
  pickDate: "בחירת תאריך",
  category: "קטגוריה",
  date: "תאריך",
  likeLastTime: "כמו בפעם הקודמת",
  lastTimes: "בפעמים הקודמות",
  backspace: "מחיקה",
  saveAndAnother: "שמירה והוספת עוד",
  general: "כללי",
  manageCategories: "ניהול קטגוריות",
  today: "היום",
  yesterday: "אתמול",
  dayBeforeYesterday: "שלשום",
  otherDate: "תאריך אחר",
};

export default nou;
