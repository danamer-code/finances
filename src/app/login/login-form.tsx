"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { useMessages } from "@/i18n/prefs";

import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

const input =
  "h-14 w-full rounded-2xl bg-surface px-4 text-lg text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent";

export function LoginForm() {
  const params = useSearchParams();
  const t = useMessages().login;
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  // Sense sessió, les pàgines desades al mòbil per a l'ús sense connexió s'esborren.
  useEffect(() => {
    if (!("caches" in window)) return;
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("finances-pages")).map((k) => caches.delete(k))))
      .catch(() => {});
  }, []);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={params.get("next") ?? "/"} />
      <label htmlFor="email" className="text-sm text-ink-2">
        {t.email}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        required
        defaultValue={state.email}
        placeholder={t.emailPlaceholder}
        className={input}
      />
      <label htmlFor="password" className="mt-1 text-sm text-ink-2">
        {t.password}
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          className={`${input} pe-24`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-pressed={showPassword}
          className="absolute inset-y-0 end-2 my-auto h-10 rounded-full px-3 text-sm font-semibold text-ink-2"
        >
          {showPassword ? t.hide : t.show}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-negative">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-14 rounded-full bg-accent text-base font-semibold text-accent-ink transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
