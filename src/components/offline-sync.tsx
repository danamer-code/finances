"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { createTransaction } from "@/app/actions/transactions";
import { useMessages } from "@/i18n/prefs";
import { isNetworkError, QUEUE_EVENT, queuedTransactions, removeQueued } from "@/lib/offline-queue";

import { Icon } from "./icon";

/**
 * Envia els moviments desats al mòbil sense connexió: en obrir l'app, en tornar la connexió i en tornar-hi.
 * (L'iPhone no permet enviar-los en segon pla amb l'app tancada.) Mentre n'hi ha, ho diu a dalt.
 */
export function OfflineSync() {
  const router = useRouter();
  const t = useMessages().common.offline;
  const [count, setCount] = useState(0);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const busy = useRef(false);

  useEffect(() => {
    const refreshCount = () => queuedTransactions().then((q) => setCount(q.length)).catch(() => {});

    const flush = async () => {
      if (busy.current || !navigator.onLine) return;
      busy.current = true;
      let sent = 0;
      try {
        for (const t of await queuedTransactions()) {
          try {
            const result = await createTransaction({ id: t.id, amount: t.amount, concept: t.concept, categoryId: t.categoryId, date: t.date });
            if (result.ok) {
              await removeQueued(t.id);
              sent++;
            }
          } catch (e) {
            if (isNetworkError(e)) break;
          }
        }
      } finally {
        busy.current = false;
        await refreshCount();
        if (sent > 0) router.refresh();
      }
    };

    const onOnline = () => void flush();
    const onVisible = () => document.visibilityState === "visible" && void flush();

    void refreshCount().then(flush);
    window.addEventListener("online", onOnline);
    window.addEventListener(QUEUE_EVENT, refreshCount);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(QUEUE_EVENT, refreshCount);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  if (count === 0 && online) return null;
  return (
    <div role="status" className="mx-5 mt-3 flex items-center gap-2.5 rounded-2xl bg-surface px-4 py-2.5 text-[13px]">
      <Icon name="alert" size={16} className="shrink-0 text-accent" />
      <span className="flex-1">
        {!online && count === 0 && t.noConnection}
        {count > 0 && t.queued(count, online)}
      </span>
    </div>
  );
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
