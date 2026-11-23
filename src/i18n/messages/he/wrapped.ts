import type { Currency } from "@/i18n/config";
import { monthName } from "@/lib/format";

import type { Messages } from "../types";
import { pc } from "./percent";

/** Com es diu darrere d'una xifra: «100 שקל», «100 דולר», «100 יורו». */
const CURRENCY_NAMES: Record<Currency, string> = { EUR: "יורו", USD: "דולר", ILS: "שקל" };
const month = (m: number) => monthName(m, "he");
const num = (n: number) => n.toLocaleString("he-IL");

const personas: Messages["wrapped"]["personas"] = {
  saver: {
    title: "מכונת חיסכון",
    description: (rate, currency) => `מכל 100 ${CURRENCY_NAMES[currency]} שנכנסו, ${rate} נשארו אצלך. שנה למופת.`,
  },
  investor: {
    title: "השקעה חכמה",
    description: () => "חלק נכבד ממה שחסכת הלך ישר לתיק ההשקעות, לעבוד בשבילך.",
  },
  traveller: {
    title: "רוח הרפתקנית",
    description: () => "לכסף שלך היה דרכון: טיולים היו בראש סדר העדיפויות.",
  },
  social: {
    title: "חיי חברה",
    description: () => "ארוחות ערב, מסיבות וקפה: שנה שעברה בחברה טובה.",
  },
  steady: {
    title: "חיסכון יציב",
    description: () => "בשקט, חודש אחרי חודש, חסכת חלק יפה ממה שנכנס.",
  },
  balanced: {
    title: "שנה של איזון",
    description: () => "הכנסות והוצאות באיזון: נקודת פתיחה מושלמת לשנה הבאה.",
  },
};

const wrapped: Messages["wrapped"] = {
  metaTitle: "השנה שלך",
  brand: "Finances · Year Wrapped",
  number: num,
  percent: (n) => pc(n),
  through: (day, m) => `עד ה-${day} ב${month(m)}`,
  soFar: (through) => `בינתיים, ${through}`,
  period: (year, through) => (through ? `${year}, ${through}` : String(year)),
  versus: (change, prevYear, sameDates) =>
    sameDates ? `${change} לעומת אותה תקופה ב-${prevYear}` : `${change} לעומת ${prevYear}`,
  nav: {
    slide: "שקופית",
    previous: "הקודם",
    next: "הבא",
    tapToContinue: "הקישו להמשך",
  },
  intro: {
    label: "השנה שלך",
    title: ["ה-", " שלך"],
    movements: (movements, concepts) =>
      `${movements === 1 ? "תנועה שרשמת" : "תנועות שרשמת"}, ${concepts === 1 ? "עם תיאור אחד" : `עם ${num(concepts)} תיאורים שונים`}`,
  },
  savings: {
    label: "חיסכון",
    kept: "חסכת",
    overspent: "הוצאת יותר ממה שנכנס",
    overspentNote: "מעבר להכנסות. זה קורה: יש שנים שבהן עושים דברים. תקציב יכול לעזור בזה.",
    rate: (rate) => `${pc(rate)} מכל מה שנכנס.`,
    noIncome: "כל מה שלא הוצאת.",
    previous: (prevYear, sameDates, rate) => (sameDates ? `באותה תקופה ב-${prevYear}: ${pc(rate)}.` : `ב-${prevYear}: ${pc(rate)}.`),
    gained: (points) => (points === 1 ? " שיפור של נקודה אחת." : ` שיפור של ${points} נקודות.`),
  },
  flows: {
    label: "הכנסות והוצאות",
    title: (period) => `הכנסות והוצאות ב-${period}`,
    income: "נכנס",
    expense: "יצא",
  },
  categories: {
    label: () => "לאן הלך הכסף",
    win: (category, amount, prevYear, sameDates) => [
      "ניצחון: על ",
      category,
      " הוצאת ",
      amount,
      sameDates ? ` פחות מאשר באותה תקופה ב-${prevYear}.` : ` פחות מאשר ב-${prevYear}.`,
    ],
  },
  places: {
    label: "המקומות שלך",
    title: "מה שחזר הכי הרבה",
    times: (n) => (n === 1 ? "פעם אחת" : `${n} פעמים`),
  },
  rhythm: {
    label: "הקצב",
    title: "הקצב של השנה",
    average: "הוצאה בחודש, בממוצע",
    priciest: "החודש היקר ביותר:",
    calmest: "הרגוע ביותר:",
  },
  subscriptions: {
    label: "מנויים",
    title: (count) => (count === 1 ? "על מנוי אחד" : `על ${count} מנויים שונים`),
    monthly: (amount) => ["בערך ", amount, " בחודש."],
    days: (days) => (days === 1 ? " זה כמו יום אחד של כל ההוצאות שלך." : ` זה כמו ${days} ימים של כל ההוצאות שלך.`),
  },
  investments: {
    label: "השקעות",
    title: "תיק ההשקעות שלך",
    start: (m) => (m === null ? "בתחילת השנה" : `ב-1 ב${month(m)}`),
    endOfYear: "בסוף השנה",
    today: "היום",
    withFlows: "(כולל מה שהוספת ומשכת)",
    latent: "רווח לא ממומש ביחס לעלות",
    realized: "רווחים ממכירות",
    best: "ההשקעה הטובה ביותר",
  },
  tax: {
    label: "מס",
    private: "רק בשבילך: זה לא מופיע בכרטיס לשיתוף",
    sales: (n) => (n === 1 ? "מכירה אחת עם רווח נקי של" : `${n} מכירות עם רווח נקי של`),
    nonResident: "שנה של אי-תושבות (IRNR): המס מחושב בנפרד.",
    estimate: (amount) => ["מס משוער על רווחי ההון: ", amount, ". להערכה בלבד."],
    noTax: "אין מס משוער.",
  },
  profile: {
    label: "הפרופיל שלך",
    title: (year) => `הפרופיל שלך ל-${year}`,
  },
  personas,
  share: {
    button: "שיתוף הכרטיס",
    busy: "מכינים את התמונה…",
    error: "לא הצלחנו להכין את התמונה. נסו שוב.",
    note: () => "רק אחוזים ודירוגים: בלי סכומים.",
    again: "צפייה חוזרת",
    title: (year) => `ה-${year} שלי`,
  },
  card: {
    title: ["ה-", " שלי"],
    profile: "הפרופיל שלי",
    savedRate: "נחסך ממה שנכנס",
    movements: (n) => (n === 1 ? "תנועה נרשמה" : "תנועות נרשמו"),
    topConcept: (concept) => `${concept}, הכי הרבה פעמים`,
    footer: "בלי סכומים: רק אחוזים ודירוגים.",
  },
};

export default wrapped;
