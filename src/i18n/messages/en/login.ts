import type { Messages } from "../types";

const login: Messages["login"] = {
  title: "Sign in",
  intro: "Sign in with your email and password.",
  email: "Email",
  emailPlaceholder: "you@example.com",
  password: "Password",
  show: "Show",
  hide: "Hide",
  submit: "Sign in",
  submitting: "Signing in…",
  errors: {
    invalid: "Incorrect email or password.",
    tooMany: "Too many attempts in a row. Wait a few minutes and try again.",
  },
};

export default login;
