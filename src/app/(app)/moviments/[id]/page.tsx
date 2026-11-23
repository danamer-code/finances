import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Icon } from "@/components/icon";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getCategories, getTransaction } from "@/lib/data";

import { EditTransactionForm } from "./edit-form";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.moviments.detail.title} · ${m.common.appName}` };
}

export default function TransactionPage({ params }: PageProps<"/moviments/[id]">) {
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <Suspense fallback={<div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Transaction params={params} />
      </Suspense>
    </main>
  );
}

async function Transaction({ params }: Pick<PageProps<"/moviments/[id]">, "params">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [tx, categories] = await Promise.all([getTransaction(user, id), getCategories(user)]);
  if (!tx) notFound();
  const t = (await getMessages()).moviments.detail;

  return (
    <>
      <header className="flex items-center gap-3">
        <Link
          href={`/moviments?mes=${tx.date.slice(0, 7)}`}
          aria-label={t.back}
          className="flex size-11 items-center justify-center rounded-full bg-surface"
        >
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{tx.status === "pending" ? t.complete : t.title}</h1>
      </header>
      <EditTransactionForm
        tx={{
          id: tx.id,
          date: tx.date,
          concept: tx.concept,
          amount: tx.amount ? tx.amount.replace(/^-/, "") : "",
          categoryId: tx.categoryId,
          notes: tx.notes ?? "",
          isGenerated: tx.isGenerated,
        }}
        categories={categories
          .filter((c) => c.isActive || c.id === tx.categoryId)
          .map(({ id, name, kind, icon, color, parentId }) => ({ id, name, kind, icon, color, parentId }))}
      />
    </>
  );
}
