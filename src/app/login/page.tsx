import type { Metadata } from "next";
import { Suspense } from "react";

import { getMessages } from "@/i18n/server";

import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.login.title} · ${m.common.appName}` };
}

export default async function LoginPage() {
  const m = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">{m.common.appName}</h1>
        <p className="text-ink-2">{m.login.intro}</p>
      </div>
      <Suspense fallback={<div className="h-40 rounded-3xl bg-surface" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
