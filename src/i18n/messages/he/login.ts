import type { Messages } from "../types";

const login: Messages["login"] = {
  title: "כניסה",
  intro: "התחברו עם האימייל והסיסמה שלכם.",
  email: "אימייל",
  emailPlaceholder: "you@example.com",
  password: "סיסמה",
  show: "הצגה",
  hide: "הסתרה",
  submit: "כניסה",
  submitting: "נכנסים…",
  errors: {
    invalid: "האימייל או הסיסמה שגויים.",
    tooMany: "יותר מדי ניסיונות ברצף. המתינו כמה דקות ונסו שוב.",
  },
};

export default login;
