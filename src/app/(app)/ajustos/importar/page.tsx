import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Icon } from "@/components/icon";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";

import { ImportFlow } from "./import-flow";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.importar.metaTitle} · ${m.common.appName}` };
}

export default async function ImportPage() {
  const m = await getMessages();
  return (
    <main className="flex flex-col gap-5 px-5 pt-5">
      <header className="flex items-center gap-3">
        <Link href="/ajustos" aria-label={m.common.actions.back} className="flex size-11 items-center justify-center rounded-full bg-surface">
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{m.importar.title}</h1>
      </header>
      <Suspense fallback={<div className="h-64 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Import />
      </Suspense>
    </main>
  );
}

async function Import() {
  const user = await requireUser();
  const categories = await getCategories(user);
  return <ImportFlow categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, isActive: c.isActive }))} />;
}
