"use client";

import { useEffect, useState, useTransition } from "react";

import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/prefs";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

function base64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function NotificationSettings({ publicKey }: { publicKey: string }) {
  const t = useMessages().ajustos.notifications;
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        next = isIos() && !isStandalone() ? "install" : "unsupported";
      } else if (Notification.permission === "denied") {
        next = "denied";
      } else {
        const sub = await (await registration()).pushManager.getSubscription();
        next = sub ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        // El permís s'ha de demanar just després del toc (l'iPhone ho exigeix).
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8Array(publicKey) });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const result = await savePushSubscription({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent.slice(0, 300) });
        if (!result.ok) throw new Error(result.error);
        setState("on");
        setMessage(t.enabled);
        await sendTestPush();
      } catch {
        setMessage(t.enableFailed);
      }
    });

  const disable = () =>
    startTransition(async () => {
      setMessage(null);
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });

  const test = () =>
    startTransition(async () => {
      const result = await sendTestPush();
      setMessage(result.ok ? t.testSent : result.error);
    });

  if (!publicKey) {
    return <p className="rounded-3xl bg-surface p-4 text-sm text-ink-2">{t.notConfigured}</p>;
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4" aria-live="polite">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${state === "on" ? "bg-accent text-accent-ink" : "bg-surface-2"}`}
          aria-hidden="true"
        >
          <Icon name="bell" />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">
            {state === "on" ? t.status.on : state === "loading" ? t.status.loading : t.status.off}
          </span>
          <span className="text-[13px] text-ink-2">
            {state === "install" && t.hints.install}
            {state === "unsupported" && t.hints.unsupported}
            {state === "denied" && t.hints.denied}
            {state === "off" && t.hints.off}
            {state === "on" && t.hints.on}
          </span>
        </span>
      </div>

      {state === "install" && (
        <ol className="flex flex-col gap-1.5 rounded-2xl bg-surface-2 p-3 text-sm">
          <li className="flex items-center gap-2">
            {t.install.step1} <Icon name="share" size={16} /> <b>{t.install.share}</b>.
          </li>
          <li>
            {t.install.step2} <b>{t.install.addToHome}</b>.
          </li>
          <li>{t.install.step3}</li>
        </ol>
      )}

      {state === "off" && (
        <button type="button" onClick={enable} disabled={pending} className="h-12 rounded-full bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50">
          {pending ? t.enabling : t.enable}
        </button>
      )}
      {state === "on" && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={test} disabled={pending} className="h-12 rounded-full bg-surface-2 text-sm font-semibold disabled:opacity-50">
            {t.sendTest}
          </button>
          <button type="button" onClick={disable} disabled={pending} className="h-12 rounded-full bg-surface-2 text-sm font-semibold text-ink-2 disabled:opacity-50">
            {t.disable}
          </button>
        </div>
      )}
      {message && <p className="text-sm text-ink-2">{message}</p>}
    </section>
  );
}
