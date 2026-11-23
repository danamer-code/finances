/**
 * Percentatge per als textos en hebreu. Si és negatiu, el tros «−26%» s'aïlla d'esquerra a dreta perquè el signe
 * quedi enganxat a l'esquerra de la xifra (si no, en un text de dreta a esquerra saltaria a l'altra banda).
 */
export function pc(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n < 0 ? `⁦−${-n}%⁩` : `${n}%`;
}
