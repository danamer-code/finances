import type { Messages } from "../types";

const common: Messages["common"] = {
  appName: "Finances",
  nav: { today: "היום", movements: "תנועות", portfolio: "תיק השקעות", tax: "מס", newMovement: "תנועה חדשה", main: "ניווט ראשי" },
  actions: {
    save: "שמירה",
    saving: "שומר…",
    saveChanges: "שמירת שינויים",
    cancel: "ביטול",
    close: "סגירה",
    back: "חזרה",
    delete: "מחיקה",
    confirmDelete: "בטוח?",
    edit: "עריכה",
    add: "הוספה",
    retry: "נסו שוב",
    seeAll: "הצגת הכול",
  },
  errors: {
    generic: "השמירה נכשלה. נסו שוב.",
    invalid: "נתונים לא תקינים",
    invalidAmount: "הסכום לא תקין",
  },
  theme: { label: "מצב כהה או בהיר", dark: "מצב כהה", light: "מצב בהיר" },
  prefs: {
    language: "שפה",
    currency: "מטבע",
    currencyWarning: "סכומים שכבר נשמרו לא מומרים: משתנה רק הסימן שבו הם מוצגים.",
    fiscal: "לשונית מס",
    fiscalHint: "רווחי הון ומס הכנסה בספרד (IRPF)",
  },
  offline: {
    noConnection: "אין חיבור: מה שתוסיפו יישמר בטלפון.",
    queued: (n, online) =>
      `${n === 1 ? "תנועה אחת נשמרה" : `${n} תנועות נשמרו`} בטלפון${online ? ": שולח…" : ". הן יישלחו כשהחיבור יחזור."}`,
  },
};

export default common;
