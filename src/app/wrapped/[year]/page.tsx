import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { getWrapped } from "@/lib/wrapped";

import { WrappedStory } from "./story";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.wrapped.metaTitle} · ${m.common.appName}` };
}

export default function WrappedPage({ params }: PageProps<"/wrapped/[year]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-ground" aria-hidden="true" />}>
      <Wrapped params={params} />
    </Suspense>
  );
}

async function Wrapped({ params }: Pick<PageProps<"/wrapped/[year]">, "params">) {
  const user = await requireUser();
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();
  const data = await getWrapped(user, Number(year), todayIso());
  if (!data) notFound();
  return <WrappedStory data={data} />;
}
