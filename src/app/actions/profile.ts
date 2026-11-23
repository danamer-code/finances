"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db";
import { profiles } from "@/db/schema";
import { CURRENCIES, LOCALES } from "@/i18n/config";
import { getPrefs, setPrefsCookies } from "@/i18n/server";
import { requireUser } from "@/lib/auth";

export async function setTheme(theme: "dark" | "light") {
  const user = await requireUser();
  const parsed = z.enum(["dark", "light"]).safeParse(theme);
  if (!parsed.success) return;
  await withRls(user, (tx) =>
    tx
      .insert(profiles)
      .values({ theme: parsed.data })
      .onConflictDoUpdate({ target: profiles.userId, set: { theme: parsed.data } }),
  );
}

const prefsInput = z.object({
  locale: z.enum(LOCALES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  fiscal: z.boolean().optional(),
});

/** Canvia l'idioma, la divisa o la pestanya Fiscal: es desa al perfil (per a tots els dispositius) i a les galetes (per a aquest). */
export async function updatePrefs(input: z.input<typeof prefsInput>): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = prefsInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const current = await getPrefs();
  const next = {
    locale: parsed.data.locale ?? current.locale,
    currency: parsed.data.currency ?? current.currency,
    fiscal: parsed.data.fiscal ?? current.fiscal,
  };
  const row = { locale: next.locale, currency: next.currency, fiscalTab: next.fiscal };
  await withRls(user, (tx) =>
    tx
      .insert(profiles)
      .values(row)
      .onConflictDoUpdate({ target: profiles.userId, set: row }),
  );
  await setPrefsCookies(next);
  revalidatePath("/", "layout");
  return { ok: true };
}
