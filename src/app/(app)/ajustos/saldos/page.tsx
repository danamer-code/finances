import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/icon";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getAccountBalances } from "@/lib/balances";
import { todayIso } from "@/lib/format";

import { BalancesForm } from "./balances-form";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.ajustos.balances.metaTitle} · ${m.common.appName}` };
}

export default async function BalancesPage() {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <header className="flex items-center gap-3">
        <Link href="/ajustos" aria-label={m.common.actions.back} className="flex size-11 items-center justify-center rounded-full bg-surface">
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{m.ajustos.balances.title}</h1>
      </header>
      <Suspense fallback={<div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Balances />
      </Suspense>
    </main>
  );
}

async function Balances() {
  const user = await requireUser();
  const accounts = await getAccountBalances(user);
  return <BalancesForm accounts={accounts} today={todayIso()} />;
}
