import type { IconName as CategoryIconName } from "@/lib/category-style";

const PATHS = {
  // Categories
  cart: "M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2M10 20h.01M17 20h.01",
  coffee: "M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3",
  utensils: "M5 3v7a2 2 0 0 0 4 0V3M7 12v9M17 21V3c-2 1-3 3-3 6v4h3",
  beer: "M6 9h9v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 9a3 3 0 0 1 4-3.5 3 3 0 0 1 5 2.5M9.5 13v4M12 13v4",
  train: "M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM4 11h16M8.5 14h.01M15.5 14h.01M8 21l1.5-4M16 21l-1.5-4",
  scooter: "M6 18a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5zM18 18a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5zM8.5 15.5H15l3-9h2.5",
  car: "M3 17v-5l2-5h14l2 5v5zM3 12h18M7 17v2M17 17v2M7 14.5h.01M17 14.5h.01",
  taxi: "M3 17v-5l2-5h14l2 5v5zM3 12h18M7 17v2M17 17v2M10 7V4h4v3",
  plane: "M10.5 13.5 3 11l1.5-1.5 8 1L17 6c1-1 2.5-1.5 3.2-.8.7.7.2 2.2-.8 3.2l-4.5 4.5 1 8L14.5 22 12 14.5l-3 3V20l-1.5 1.5-1-3.5L3 17l1.5-1.5H7z",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  repeat: "M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  dumbbell: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 1 2-2h13v2H6",
  shirt: "M8 3 4 5 2 9l3 2 2-1v11h10V10l2 1 3-2-2-4-4-2a4 4 0 0 1-8 0z",
  scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12",
  ticket: "M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4zM13 6v2M13 11v2M13 16v2",
  party: "M4 20 9 7l8 8zM14 4c.5 1.5 0 3-1 4M20 10c-1.5-.5-3 0-4 1M17 3l.5 1.5M21 7l-1.5.5",
  gift: "M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9C10 9 7 8 7 6a2 2 0 0 1 4-1l1 4M12 9c2 0 5-1 5-3a2 2 0 0 0-4-1l-1 4",
  receipt: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4",
  wallet: "M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01",
  percent: "M19 5 5 19M7 9.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5zM17 19.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5z",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  coins: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  piggy: "M5 11a7 6 0 0 1 12-3h2l-1 3a6 6 0 0 1-1 6v3h-3v-2h-4v2H7v-3a6 6 0 0 1-2-6zM16 10h.01M2 9v2",
  tag: "M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01",
  // Interfície
  list: "M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  backspace: "M21 5H8.5L2.5 12l6 7H21a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM17 9.5l-5 5M12 9.5l5 5",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  sun: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4",
  check: "M5 12.5l4.5 4.5L19 7",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-3.5-3.5",
  alert: "M10.3 4 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0zM12 9v4.5M12 17h.01",
  pencil: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  bell: "M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0",
  share: "M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  import: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14l3 3 3-3",
} as const satisfies Record<CategoryIconName, string> & Record<string, string>;

export type IconName = keyof typeof PATHS;

/** Icones amb direcció: en idiomes de dreta a esquerra (hebreu) s'inverteixen. */
const DIRECTIONAL = new Set<string>(["chevronLeft", "chevronRight"]);

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className,
  label,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={DIRECTIONAL.has(name) ? `rtl:-scale-x-100 ${className ?? ""}` : className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
