import Link from "next/link";

import { getMessages } from "@/i18n/server";
import type { TransactionRow } from "@/lib/data";

import { CategoryBadge } from "./category-badge";
import { Icon } from "./icon";
import { Money } from "./money";

/** Fila de moviment: icona de categoria, concepte, categoria i import (positius en verd). */
export async function TransactionItem({ tx, first }: { tx: TransactionRow; first?: boolean }) {
  const t = (await getMessages()).moviments.item;
  const isIncome = tx.categoryKind === "income";
  const pending = tx.status === "pending";
  return (
    <Link
      href={`/moviments/${tx.id}`}
      className={`flex items-center gap-3 py-3 transition active:opacity-70 ${first ? "" : "border-t border-line"}`}
    >
      <CategoryBadge
        category={{ name: tx.categoryName, icon: tx.categoryIcon, color: tx.categoryColor, kind: tx.categoryKind }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{tx.concept}</span>
        <span className="flex items-center gap-1 truncate text-[13px] text-ink-2">
          {tx.isGenerated && <Icon name="trend" size={13} label={t.generated} />}
          {tx.categoryName}
        </span>
      </span>
      {pending ? (
        <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-[13px] font-semibold text-accent-ink">
          {t.missingAmount}
        </span>
      ) : (
        <Money
          amount={tx.amount}
          signed
          className={`shrink-0 text-[15px] font-semibold ${isIncome ? "text-positive" : "text-ink"}`}
        />
      )}
    </Link>
  );
}

export function TransactionCard({ items }: { items: TransactionRow[] }) {
  return (
    <div className="flex flex-col rounded-[22px] bg-surface px-3.5 py-1">
      {items.map((tx, i) => (
        <TransactionItem key={tx.id} tx={tx} first={i === 0} />
      ))}
    </div>
  );
}
