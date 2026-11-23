import "server-only";

import { eq } from "drizzle-orm";
import webpush from "web-push";

import { adminDb } from "@/db";
import { appSecrets, pushSubscriptions } from "@/db/schema";

export type PushPayload = {
  title: string;
  body: string;
  /** Pàgina que s'obre en tocar la notificació. */
  url?: string;
  /** Agrupa notificacions del mateix tipus (una de nova substitueix l'anterior). */
  tag?: string;
  /** Número de la icona de l'app (moviments pendents). */
  badge?: number;
};

type VapidKeys = { publicKey: string; privateKey: string };

let keysPromise: Promise<VapidKeys> | null = null;

/**
 * Claus VAPID de les notificacions. Si no són a les variables d'entorn (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY`), l'app les genera la primera vegada i les desa a `app_secrets`: qui instal·la la seva
 * pròpia còpia no ha de fer res. Han de ser sempre les mateixes: si canviessin, caldria tornar a activar els avisos.
 */
export function vapidKeys(): Promise<VapidKeys> {
  keysPromise ??= loadVapidKeys().catch((e: unknown) => {
    keysPromise = null;
    throw e;
  });
  return keysPromise;
}

async function loadVapidKeys(): Promise<VapidKeys> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) return { publicKey, privateKey };
  const read = async () => {
    const [row] = await adminDb.select({ value: appSecrets.value }).from(appSecrets).where(eq(appSecrets.key, "vapid"));
    return row ? (JSON.parse(row.value) as VapidKeys) : null;
  };
  const saved = await read();
  if (saved) return saved;
  // Si dues peticions les generen alhora, en queda una (la primera que s'ha desat) i totes dues la fan servir.
  await adminDb.insert(appSecrets).values({ key: "vapid", value: JSON.stringify(webpush.generateVAPIDKeys()) }).onConflictDoNothing();
  return (await read())!;
}

let configured = false;

/** El «subject» és l'adreça de l'app (no cal cap correu). */
async function configure() {
  if (configured) return;
  const { publicKey, privateKey } = await vapidKeys();
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  webpush.setVapidDetails(host ? `https://${host}` : "mailto:finances@example.invalid", publicKey, privateKey);
  configured = true;
}

/**
 * Envia una notificació a tots els dispositius de l'usuari. Salta la RLS (la crida el cron o una acció ja
 * autenticada), sempre filtrant per `userId`. Les subscripcions caducades (404/410) s'esborren.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  await configure();
  const subs = await adminDb.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  let removed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
        urgency: "normal",
      });
      await adminDb.update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(eq(pushSubscriptions.id, s.id));
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await adminDb.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        removed++;
      }
    }
  }
  return { sent, removed };
}
