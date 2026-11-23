import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/icon";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { getTradeFormData } from "@/lib/portfolio";

import { TradeForm } from "./trade-form";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.cartera.form.title} · ${m.common.appName}` };
}

export default async function NewTradePage({ searchParams }: PageProps<"/cartera/operacio">) {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <header className="flex items-center gap-3">
        <Link href="/cartera" aria-label={m.cartera.backToPortfolio} className="flex size-11 items-center justify-center rounded-full bg-surface">
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{m.cartera.form.title}</h1>
      </header>
      <Suspense fallback={<div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />}>
        <NewTrade searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function NewTrade({ searchParams }: Pick<PageProps<"/cartera/operacio">, "searchParams">) {
  const user = await requireUser();
  const params = await searchParams;
  const data = await getTradeFormData(user);
  const preselected = typeof params.posicio === "string" ? params.posicio : undefined;
  return <TradeForm holdings={data.holdings} accounts={data.accounts} today={todayIso()} preselected={preselected} />;
}
