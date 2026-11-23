/** Categories agrupades en dos nivells: cada categoria principal amb les seves subcategories. */
export type CategoryNode<T> = { category: T; children: T[] };

type TreeItem = { id: string; parentId: string | null };

/**
 * Manté l'ordre en què arriben les categories (sortOrder, nom). Una subcategoria el pare de la qual no hi és
 * (p. ex. filtrada per tipus o arxivada) es mostra com a principal, perquè no desaparegui.
 */
export function categoryTree<T extends TreeItem>(items: T[]): CategoryNode<T>[] {
  const ids = new Set(items.map((c) => c.id));
  const nodes = new Map<string, CategoryNode<T>>();
  for (const c of items) if (!c.parentId || !ids.has(c.parentId)) nodes.set(c.id, { category: c, children: [] });
  for (const c of items) if (c.parentId && ids.has(c.parentId)) nodes.get(c.parentId)?.children.push(c);
  return [...nodes.values()];
}
