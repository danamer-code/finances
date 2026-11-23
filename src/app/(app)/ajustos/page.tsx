import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { signOut } from "@/app/actions";
import { Icon } from "@/components/icon";
import { PrefsPicker } from "@/components/prefs-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.ajustos.title} · ${m.common.appName}` };
}

export default async function SettingsPage() {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label={m.common.actions.back} className="flex size-11 items-center justify-center rounded-full bg-surface">
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{m.ajustos.title}</h1>
      </header>
      <Suspense fallback={<div className="h-48 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const user = await requireUser();
  const [profile, m] = await Promise.all([getProfile(user), getMessages()]);
  const row = "flex min-h-14 items-center gap-3 px-4 py-3";

  return (
    <>
      <section className="flex flex-col rounded-3xl bg-surface">
        <div className={row}>
          <span className="flex size-10 items-center justify-center rounded-full bg-nav text-accent">
            {(user.email ?? "?").charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm text-ink-2">{m.ajustos.signedInAs}</span>
            <span className="truncate font-semibold">{user.email}</span>
          </span>
        </div>
      </section>

      <section className="flex flex-col divide-y divide-line rounded-3xl bg-surface">
        <Link href="/ajustos/categories" className={row}>
          <Icon name="tag" />
          <span className="flex-1 font-medium">{m.ajustos.links.categories}</span>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>
        <Link href="/ajustos/recurrents" className={row}>
          <Icon name="repeat" />
          <span className="flex-1 font-medium">{m.ajustos.links.recurring}</span>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>
        <Link href="/ajustos/notificacions" className={row}>
          <Icon name="bell" />
          <span className="flex-1 font-medium">{m.ajustos.links.notifications}</span>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>
        <Link href="/ajustos/saldos" className={row}>
          <Icon name="wallet" />
          <span className="flex-1 font-medium">{m.ajustos.links.balances}</span>
          <Icon name="chevronRight" className="text-ink-3" />
        </Link>
        <div className={row}>
          <Icon name="moon" />
          <span className="flex-1 font-medium">{m.common.theme.label}</span>
          <ThemeToggle serverTheme={profile?.theme} />
        </div>
      </section>

      <section className="rounded-3xl bg-surface">
        <PrefsPicker />
      </section>

      <form action={signOut}>
        <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-surface font-semibold">
          <Icon name="logout" size={18} />
          {m.ajustos.signOut}
        </button>
      </form>
    </>
  );
}
