/**
 * Perfil de l'any del Year Wrapped: regles senzilles i amables sobre les xifres de l'any (sense gènere).
 * Funció pura perquè es pugui provar. Retorna la clau del perfil: el títol i la descripció surten del
 * diccionari de l'idioma de l'usuari (`wrapped.personas`).
 */
export type PersonaInput = {
  /** Percentatge d'estalvi sobre els ingressos (null si no hi ha ingressos). */
  savingsRate: number | null;
  /** Aportacions netes a la cartera durant l'any i estalvi de l'any, en la divisa de l'usuari. */
  contributions: number;
  saved: number;
  /** Categoria principal amb més despesa i el seu pes sobre la despesa total (0–100). */
  topCategory: { name: string; share: number } | null;
};

export const PERSONA_KEYS = ["saver", "investor", "traveller", "social", "steady", "balanced"] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

/** Clau del perfil i el percentatge d'estalvi arrodonit (el fa servir la descripció de «saver»). */
export type Persona = { key: PersonaKey; rate: number };

const has = (name: string, word: RegExp) => word.test(name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase());

export function personaFor(input: PersonaInput): Persona {
  const rate = input.savingsRate ?? 0;
  const top = input.topCategory;
  const persona = (key: PersonaKey): Persona => ({ key, rate: Math.round(rate) });
  if (rate >= 40) return persona("saver");
  if (input.contributions > 0 && input.saved > 0 && input.contributions >= input.saved * 0.5) return persona("investor");
  // Paraules en català, anglès i hebreu (també els noms de les categories inicials de cada idioma).
  if (top && has(top.name, /viatge|vol|turisme|travel|trip|flight|holiday|טיול|נסיע|טיס|חופש/) && top.share >= 15) return persona("traveller");
  if (top && has(top.name, /oci|restaurant|festa|bar|leisure|eating|party|night|פנאי|מסעד|בילוי|מסיב/) && top.share >= 20) return persona("social");
  if (rate >= 20) return persona("steady");
  return persona("balanced");
}
