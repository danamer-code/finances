"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { withRls } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

const subscriptionInput = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
  userAgent: z.string().max(300).optional(),
});

export type PushResult = { ok: true } | { ok: false; error: string };

export async function savePushSubscription(input: z.input<typeof subscriptionInput>): Promise<PushResult> {
  const user = await requireUser();
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: (await getMessages()).ajustos.notifications.errors.invalidSubscription };
  const { endpoint, keys, userAgent } = parsed.data;
  await withRls(user, (tx) =>
    tx
      .insert(pushSubscriptions)
      .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent ?? null })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent ?? null } }),
  );
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string): Promise<PushResult> {
  const user = await requireUser();
  await withRls(user, (tx) => tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint))));
  return { ok: true };
}

export async function sendTestPush(): Promise<PushResult> {
  const user = await requireUser();
  const m = await getMessages();
  const [row] = (await withRls(user, (tx) =>
    tx.execute(sql`select count(*)::int as n from transactions where status = 'pending'`),
  )) as unknown as Array<{ n: number }>;
  const { sent } = await sendPushToUser(user.sub, {
    title: m.common.appName,
    body: m.ajustos.notifications.testBody,
    url: "/ajustos/notificacions",
    tag: "prova",
    badge: row?.n ?? 0,
  });
  return sent > 0 ? { ok: true } : { ok: false, error: m.ajustos.notifications.errors.sendFailed };
}
