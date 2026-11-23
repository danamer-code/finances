import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/icon";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { todayIso } from "@/lib/format";
import { getRecurringRules, getRecurringSuggestions } from "@/lib/recurring";

import { RecurringManager } from "./recurring-manager";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.ajustos.recurring.title} · ${m.common.appName}` };
}

export default async function RecurringPage() {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <header className="flex items-center gap-3">
        <Link href="/ajustos" aria-label={m.common.actions.back} className="flex size-11 items-center justify-center rounded-full bg-surface">
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{m.ajustos.recurring.title}</h1>
      </header>
      <Suspense fallback={<div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Recurring />
      </Suspense>
    </main>
  );
}

async function Recurring() {
  const user = await requireUser();
  const today = todayIso();
  const [rules, suggestions, categories] = await Promise.all([
    getRecurringRules(user, today),
    getRecurringSuggestions(user, today),
    getCategories(user),
  ]);
  return (
    <RecurringManager
      rules={rules}
      suggestions={suggestions}
      categories={categories.filter((c) => c.isActive && c.kind !== "investment")}
      today={today}
    />
  );
}
