import { categoryStyle } from "@/lib/category-style";

import { Icon } from "./icon";

/** Cercle de color amb la icona de la categoria. */
export function CategoryBadge({
  category,
  size = 40,
}: {
  category: { name: string; icon: string | null; color: string | null; kind?: string };
  size?: number;
}) {
  const style = categoryStyle(category);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: style.bg, color: style.fg }}
    >
      <Icon name={style.icon} size={Math.round(size * 0.46)} />
    </span>
  );
}
