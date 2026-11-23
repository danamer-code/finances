"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Icon } from "./icon";

export type PeriodOption = { value: string; label: string; href: string };

/**
 * Desplegable d'any o de mes (al mòbil obre la roda nativa). En triar-ne un, navega a la seva adreça.
 */
export function PeriodSelect({
  value,
  options,
  label,
  size = "md",
}: {
  value: string;
  options: PeriodOption[];
  /** Nom accessible, p. ex. "Exercici fiscal". */
  label: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <span className={`relative inline-flex shrink-0 items-center self-start ${pending ? "opacity-60" : ""}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          const option = options.find((o) => o.value === e.target.value);
          if (option) startTransition(() => router.push(option.href));
        }}
        className={`appearance-none rounded-full bg-surface pe-10 ps-4 font-semibold text-ink outline-none focus:ring-2 focus:ring-accent ${
          size === "lg" ? "h-12 text-[20px] tracking-tight" : "h-11 text-[15px]"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={18} className="pointer-events-none absolute end-3.5 text-ink-2" />
    </span>
  );
}
