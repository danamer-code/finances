import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getCategories, getConceptStats } from "@/lib/data";
import { todayIso } from "@/lib/format";

import { QuickEntry } from "./quick-entry";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.nou.title} · ${m.common.appName}` };
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-dvh w-full max-w-md bg-ground" />}>
      <NewTransaction />
    </Suspense>
  );
}

async function NewTransaction() {
  const user = await requireUser();
  const [categories, concepts] = await Promise.all([getCategories(user), getConceptStats(user)]);
  if (categories.length === 0) redirect("/benvinguda");
  const usable = categories
    .filter((c) => c.isActive && c.kind !== "investment")
    .map(({ id, name, kind, icon, color, parentId }) => ({ id, name, kind: kind as "income" | "expense", icon, color, parentId }));
  return <QuickEntry categories={usable} concepts={concepts} today={todayIso()} />;
}
