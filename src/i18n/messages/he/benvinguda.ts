import type { Messages } from "../types";

const benvinguda: Messages["benvinguda"] = {
  title: "ברוכים הבאים",
  heading: "ברוכים הבאים ל-Finances",
  intro: "בחרו את הקטגוריות שתשתמשו בהן. תמיד אפשר לשנות אותן, להוסיף חדשות או להעביר אותן לארכיון.",
  accountLabel: "החשבון הראשי שלכם",
  defaultAccount: "חשבון עו״ש",
  preparing: "מכינים…",
  start: (n) => (n === 1 ? "להתחיל עם קטגוריה אחת" : `להתחיל עם ${n} קטגוריות`),
  starter: {
    salary: "משכורת",
    interest: "ריבית ודיבידנדים",
    otherIncome: "הכנסות אחרות",
    groceries: "סופרמרקט",
    restaurants: "מסעדות",
    coffee: "קפה ומשקאות",
    publicTransport: "תחבורה ציבורית",
    car: "רכב ואופנוע",
    taxi: "מוניות",
    housing: "שכירות או משכנתא",
    utilities: "חשבונות הבית",
    subscriptions: "מנויים",
    health: "בריאות",
    sport: "ספורט",
    clothes: "ביגוד",
    leisure: "פנאי",
    travel: "טיולים",
    education: "לימודים",
    gifts: "מתנות",
    taxes: "מסים",
    otherExpenses: "הוצאות אחרות",
    funds: "השקעה בקרנות",
    stocks: "השקעה במניות",
    investmentFees: "עמלות השקעה",
  },
  errors: {
    noCategories: "יש לבחור לפחות קטגוריה אחת",
    noAccountName: "יש לתת שם לחשבון",
  },
};

export default benvinguda;
