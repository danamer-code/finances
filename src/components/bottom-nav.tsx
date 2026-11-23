"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useMessages, usePrefs } from "@/i18n/prefs";

import { Icon, type IconName } from "./icon";

const TABS: Array<{ href: string; label: "today" | "movements" | "portfolio" | "tax"; icon: IconName }> = [
  { href: "/", label: "today", icon: "home" },
  { href: "/moviments", label: "movements", icon: "list" },
  { href: "/cartera", label: "portfolio", icon: "trend" },
  { href: "/fiscal", label: "tax", icon: "receipt" },
];

/** Pastilla de navegació inferior amb el botó + sempre a l'abast del polze. */
export function BottomNavView({ pathname }: { pathname: string | null }) {
  const nav = useMessages().common.nav;
  // La pestanya Fiscal (impostos d'Espanya) només si l'usuari la vol.
  const { fiscal } = usePrefs();
  const tabs = fiscal ? TABS : TABS.filter((tab) => tab.href !== "/fiscal");
  const isActive = (href: string) => pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      aria-label={nav.main}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2.5 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
    >
      <div className="flex h-14 flex-1 items-center justify-between rounded-full bg-nav p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
        {tabs.map((tab) =>
          isActive(tab.href) ? (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current="page"
              className="flex h-11 items-center gap-2 rounded-full bg-nav-active pe-4 ps-3 text-sm font-semibold text-nav-active-ink"
            >
              <Icon name={tab.icon} />
              {nav[tab.label]}
            </Link>
          ) : (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={nav[tab.label]}
              className="flex size-11 items-center justify-center rounded-full bg-nav-2 text-[#f2f2ef]"
            >
              <Icon name={tab.icon} />
            </Link>
          ),
        )}
      </div>
      <Link
        href="/nou"
        aria-label={nav.newMovement}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition active:scale-95"
      >
        <Icon name="plus" size={24} strokeWidth={2.2} />
      </Link>
    </nav>
  );
}

/** Versió amb la pestanya activa. La ruta és dada de la petició: va dins d'un <Suspense>. */
export function BottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}
