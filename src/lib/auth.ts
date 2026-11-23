import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import type { JwtClaims } from "@/db";
import { createClient } from "@/lib/supabase/server";

/** Claims verificades del JWT de la petició actual, o null si no hi ha sessió. */
export const getClaims = cache(async (): Promise<JwtClaims | null> => {
  // La sessió sempre es llegeix en temps de petició: mai forma part del prerenderitzat
  // (amb Cache Components, el client de Supabase fa servir Date.now() per comprovar la caducitat).
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims as JwtClaims;
});

/** Per a pàgines i Server Functions: retorna l'usuari o redirigeix a /login. */
export async function requireUser(): Promise<JwtClaims> {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  return claims;
}

/** Només permet redireccions internes (evita que `next` porti a un altre domini). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
