import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PrefsPicker } from "@/components/prefs-picker";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";

import { Onboarding } from "./onboarding";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.benvinguda.title} · ${m.common.appName}` };
}

export default async function WelcomePage() {
  const m = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-8 pb-10">
      <h1 className="text-[32px] leading-tight font-semibold tracking-tight">{m.benvinguda.heading}</h1>
      {/* Primer l'idioma i la divisa: la resta de la pantalla (i les categories que es creen) ja surten en l'idioma triat. */}
      <section className="rounded-3xl bg-surface">
        <PrefsPicker confirmCurrency={false} />
      </section>
      <p className="text-ink-2">{m.benvinguda.intro}</p>
      <Suspense fallback={<div className="h-96 rounded-3xl bg-surface" aria-hidden="true" />}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const user = await requireUser();
  const categories = await getCategories(user);
  if (categories.length > 0) redirect("/");
  return <Onboarding />;
}
