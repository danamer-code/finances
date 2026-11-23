"use client";

import { useEffect, useState } from "react";

import { setTheme } from "@/app/actions/profile";
import { useMessages } from "@/i18n/prefs";

import { Icon } from "./icon";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0e0e0e" : "#efefec");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Sense emmagatzematge (navegació privada): el canvi dura fins que es tanqui la pàgina.
  }
}

/**
 * Interruptor sol/lluna. Aplica el tema a l'instant i el desa al perfil perquè sigui el mateix
 * a tots els dispositius. `serverTheme` és el del perfil: si aquest dispositiu encara no en té cap, s'aplica.
 */
export function ThemeToggle({ serverTheme }: { serverTheme?: "dark" | "light" | "system" }) {
  const t = useMessages().common.theme;
  const [theme, setLocalTheme] = useState<Theme>("dark");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {}
    const initial: Theme =
      stored === "light" || stored === "dark" ? stored : serverTheme === "light" ? "light" : "dark";
    applyTheme(initial);
    // Sincronitza l'estat local amb el DOM un cop muntat (el tema es decideix al client).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalTheme(initial);
  }, [serverTheme]);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setLocalTheme(next);
    navigator.vibrate?.(8);
    void setTheme(next);
  };

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${t.label}: ${isDark ? t.dark : t.light}`}
      className="flex h-11 items-center gap-0.5 rounded-full bg-surface p-1"
    >
      <span
        className={`flex size-9 items-center justify-center rounded-full ${isDark ? "text-ink-2" : "bg-ink text-accent"}`}
      >
        <Icon name="sun" size={18} />
      </span>
      <span
        className={`flex size-9 items-center justify-center rounded-full ${isDark ? "bg-accent text-accent-ink" : "text-ink-2"}`}
      >
        <Icon name="moon" size={18} />
      </span>
    </button>
  );
}
