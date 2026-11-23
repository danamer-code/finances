"use client";

import { usePrefs } from "@/i18n/prefs";
import { formatWhole, moneyParts } from "@/lib/format";

/** Import amb els cèntims en gris, com als mockups, en l'idioma i la divisa de l'usuari. Els imports arriben com a text. */
export function Money({
  amount,
  signed = false,
  className,
  centsClassName = "text-ink-3",
  noCents = false,
}: {
  amount: string | null | undefined;
  signed?: boolean;
  className?: string;
  centsClassName?: string;
  /** Unitats senceres (per a taules estretes): arrodonit, sense cèntims. */
  noCents?: boolean;
}) {
  const prefs = usePrefs();
  if (noCents) return <span className={className}>{formatWhole(amount, { signed, ...prefs })}</span>;
  const p = moneyParts(amount, { signed, ...prefs });
  return (
    <span className={className}>
      {p.sign}
      {p.prefix}
      {p.integer}
      <span className={centsClassName}>{p.decimals}</span>
    </span>
  );
}
