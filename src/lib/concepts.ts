/**
 * Clau de comparació de conceptes: sense accents, en minúscules i amb els espais compactats.
 * La fan servir l'app (autocompletat, evitar duplicats) i l'script de migració.
 */
export function conceptKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Neteja el que escriu l'usuari: espais compactats i inicial en majúscula (excepte "iCloud" i similars). */
export function tidyConcept(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s || /^\p{Lu}/u.test(s) || /^\p{Ll}\p{Lu}/u.test(s)) return s;
  return s.charAt(0).toLocaleUpperCase("ca") + s.slice(1);
}
