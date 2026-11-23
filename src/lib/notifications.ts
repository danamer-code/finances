/**
 * Quins avisos toca enviar avui (funció pura). Cada avís té una clau única: si ja consta com a enviat, no es repeteix.
 * Els textos surten del diccionari de l'idioma de l'usuari i els imports, en la seva divisa.
 */
import Big from "big.js";

import { DEFAULT_PREFS, type Prefs } from "@/i18n/config";
import { MESSAGES } from "@/i18n/messages";

import { formatMoney } from "./format";

export type Notice = { key: string; title: string; body: string; url: string; tag: string };

export type NoticeState = {
  today: string;
  /** Moviments pendents d'import creats avui pels recurrents variables. */
  newPending: string[];
  /** Categories principals amb pressupost i el que portes gastat aquest mes. */
  budgets: Array<{ id: string; name: string; spent: string; budget: string }>;
  /** Comptes que encara no tenen el saldo d'aquest mes. */
  staleBalances: number;
  alreadySent: Set<string>;
};

export function planNotices(s: NoticeState, prefs: Pick<Prefs, "locale" | "currency"> = DEFAULT_PREFS): Notice[] {
  const t = MESSAGES[prefs.locale].server.notices;
  const notices: Notice[] = [];
  const month = s.today.slice(0, 7);
  const monthNumber = Number(s.today.slice(5, 7));
  const year = Number(s.today.slice(0, 4));
  const add = (n: Notice) => {
    if (!s.alreadySent.has(n.key)) notices.push(n);
  };

  if (s.newPending.length > 0) {
    add({
      key: `pendents:${s.today}`,
      title: t.pending.title,
      body: t.pending.body(t.list(s.newPending)),
      url: "/",
      tag: "pendents",
    });
  }

  for (const b of s.budgets) {
    const budget = new Big(b.budget);
    if (budget.lte(0)) continue;
    const ratio = new Big(b.spent).div(budget);
    const level = ratio.gte(1) ? 100 : ratio.gte(0.8) ? 80 : null;
    if (!level) continue;
    // Si ja s'ha superat, l'avís del 80 % no cal.
    if (level === 80 && s.alreadySent.has(`pressupost:${b.id}:${month}:100`)) continue;
    const pct = Math.round(ratio.times(100).toNumber());
    add({
      key: `pressupost:${b.id}:${month}:${level}`,
      title: level === 100 ? t.budget.over(b.name) : t.budget.near(b.name, pct),
      body: t.budget.body(formatMoney(b.spent, prefs), formatMoney(b.budget, prefs)),
      url: `/moviments?mes=${month}&categoria=${b.id}`,
      tag: `pressupost-${b.id}`,
    });
  }

  if (s.staleBalances > 0) {
    add({
      key: `saldos:${month}`,
      title: t.balances.title,
      body: t.balances.body(s.staleBalances, monthNumber),
      url: "/ajustos/saldos",
      tag: "saldos",
    });
  }

  if (monthNumber === 12) {
    add({
      key: `wrapped:${year}`,
      title: t.wrapped.title(year),
      body: t.wrapped.body,
      url: `/wrapped/${year}`,
      tag: "wrapped",
    });
  } else if (monthNumber === 1) {
    add({
      key: `wrapped-final:${year - 1}`,
      title: t.wrappedFinal.title(year - 1),
      body: t.wrappedFinal.body(year - 1),
      url: `/wrapped/${year - 1}`,
      tag: "wrapped",
    });
  }

  return notices;
}
