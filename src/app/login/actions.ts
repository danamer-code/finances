"use server";

import { redirect } from "next/navigation";

import { withRls, type JwtClaims } from "@/db";
import { profiles } from "@/db/schema";
import { getMessages, getPrefs, getUserPrefs, setPrefsCookies } from "@/i18n/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { email?: string; error?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const m = await getMessages();
  // Sempre el mateix missatge: no revela si el correu existeix ni si té accés.
  const invalid = m.login.errors.invalid;
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { email, error: invalid };

  // Instància d'un sol usuari: si ALLOWED_EMAILS està definit, només aquests correus poden entrar.
  const allowed = process.env.ALLOWED_EMAILS?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed?.length && !allowed.includes(email)) return { email, error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.status === 429) return { email, error: m.login.errors.tooMany };
    return { email, error: invalid };
  }

  // El perfil (tema, llindar de concentració, benvinguda) es crea la primera vegada que s'entra, amb l'idioma i la
  // divisa amb què s'ha vist la pàgina d'entrada (els del navegador si encara no n'hi havia cap de triat).
  const { data: session } = await supabase.auth.getClaims();
  const claims: JwtClaims = session?.claims?.sub
    ? { ...session.claims, sub: session.claims.sub }
    : { sub: data.user.id, role: "authenticated" };
  const { locale, currency } = await getPrefs();
  await withRls(claims, (tx) => tx.insert(profiles).values({ locale, currency }).onConflictDoNothing());
  // L'idioma i la divisa del perfil passen a aquest dispositiu.
  await setPrefsCookies(await getUserPrefs(claims.sub));

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
