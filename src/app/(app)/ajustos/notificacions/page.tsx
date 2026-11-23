import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/icon";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { vapidKeys } from "@/lib/push";

import { NotificationSettings } from "./notification-settings";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.ajustos.notifications.title} · ${m.common.appName}` };
}

/** La clau pública de les notificacions (si encara no n'hi ha cap, es genera ara). */
async function Settings() {
  await requireUser();
  const publicKey = await vapidKeys()
    .then((k) => k.publicKey)
    .catch(() => "");
  return <NotificationSettings publicKey={publicKey} />;
}

export default async function NotificationsPage() {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <header className="flex items-center gap-3">
        <Link href="/ajustos" aria-label={m.common.actions.back} className="flex size-11 items-center justify-center rounded-full bg-surface">
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{m.ajustos.notifications.title}</h1>
      </header>
      <Suspense fallback={<div className="h-48 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Settings />
      </Suspense>

      <section className="flex flex-col gap-2 rounded-3xl bg-surface p-4 text-sm">
        <h2 className="text-[15px] font-semibold">{m.ajustos.notifications.whatTitle}</h2>
        <ul className="flex flex-col gap-1.5 text-ink-2">
          {m.ajustos.notifications.what.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
        <p className="text-xs text-ink-2">{m.ajustos.notifications.schedule}</p>
      </section>
    </main>
  );
}
