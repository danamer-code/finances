"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { isRtl, type Prefs } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { useMessages, usePrefs } from "@/i18n/prefs";
import { ltrIsolate, monthName } from "@/lib/format";
import type { WrappedData } from "@/lib/wrapped";

type Tone = "ground" | "accent" | "surface";
type Slide = { key: string; tone: Tone; label: string; content: ReactNode };

const TONE: Record<Tone, string> = {
  ground: "bg-ground text-ink",
  accent: "bg-accent text-accent-ink",
  surface: "bg-surface text-ink",
};

/** Element que entra amb animació, amb un petit retard per a cada línia. */
function In({ step = 0, className = "", children }: { step?: number; className?: string; children: ReactNode }) {
  return (
    <div className={`wrapped-in ${className}`} style={{ animationDelay: `${120 + step * 140}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

const big = "text-[60px] leading-[0.95] font-semibold tracking-[-0.05em] whitespace-nowrap";

/** Frase del diccionari amb trossos de JSX (un import, una categoria en negreta…) dins. */
const rich = (parts: ReactNode[]) => parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);

function buildSlides(d: WrappedData, m: Messages, prefs: Prefs): Slide[] {
  const t = m.wrapped;
  const slides: Slide[] = [];
  // En hebreu, el signe ha d'anar enganxat a la xifra a l'esquerra: s'aïlla com a text d'esquerra a dreta.
  const signedPct = (n: number) => {
    return ltrIsolate(`${n > 0 ? "+" : n < 0 ? "−" : ""}${t.percent(Math.abs(n))}`, prefs.locale);
  };
  const through = d.through ? t.through(d.through.day, d.through.month) : null;
  const period = t.period(d.year, through);
  // Amb l'any en marxa, es compara amb el mateix tros de l'any anterior.
  const sameDates = !d.final;
  const versus = (change: number) => (d.prev ? t.versus(signedPct(change), d.prev.year, sameDates) : signedPct(change));

  slides.push({
    key: "intro",
    tone: "ground",
    label: t.intro.label,
    content: (
      <>
        <In className="text-[17px] text-ink-2">{t.brand}</In>
        <In step={1} className="text-[56px] leading-none font-semibold tracking-[-0.05em]">
          {t.intro.title[0]}
          <span className="text-accent">{d.year}</span>
          {t.intro.title[1]}
        </In>
        {through && <In step={2} className="text-[17px] text-ink-2">{t.soFar(through)}</In>}
        <In step={3} className="mt-6 flex flex-col gap-1">
          <span className="text-[40px] font-semibold tracking-tight">{t.number(d.movements)}</span>
          <span className="text-[17px] text-ink-2">{t.intro.movements(d.movements, d.concepts)}</span>
        </In>
      </>
    ),
  });

  const overspent = d.saved.startsWith("-");
  slides.push({
    key: "estalvi",
    tone: "accent",
    label: t.savings.label,
    content: (
      <>
        <In className="text-[19px] font-medium">{overspent ? t.savings.overspent : t.savings.kept}</In>
        <In step={1}>
          <Money amount={d.saved.replace(/^-/, "")} className={big} centsClassName="opacity-50" />
        </In>
        <In step={2} className="text-[19px] font-medium">
          {overspent ? t.savings.overspentNote : d.savingsRate !== null ? t.savings.rate(d.savingsRate) : t.savings.noIncome}
        </In>
        {d.prev && d.prev.savingsRate !== null && d.savingsRate !== null && (
          <In step={3} className="mt-4 rounded-2xl bg-black/10 px-4 py-3 text-[15px]">
            {t.savings.previous(d.prev.year, sameDates, d.prev.savingsRate)}
            {d.savingsRate > d.prev.savingsRate && t.savings.gained(d.savingsRate - d.prev.savingsRate)}
          </In>
        )}
      </>
    ),
  });

  slides.push({
    key: "entrades",
    tone: "ground",
    label: t.flows.label,
    content: (
      <>
        <In className="text-[19px] text-ink-2">{t.flows.title(period)}</In>
        {[
          { key: "income", label: t.flows.income, amount: d.income, prev: d.prev?.income, color: "text-positive" },
          { key: "expense", label: t.flows.expense, amount: d.expense, prev: d.prev?.expense, color: "text-ink" },
        ].map((row, i) => {
          const delta = row.prev && Number(row.prev) > 0 ? Math.round((Number(row.amount) / Number(row.prev) - 1) * 100) : null;
          return (
            <In key={row.key} step={i + 1} className="flex flex-col gap-1">
              <span className="text-[15px] text-ink-2">{row.label}</span>
              <Money amount={row.amount} className={`text-[48px] leading-none font-semibold tracking-[-0.04em] ${row.color}`} />
              {delta !== null && <span className="text-[15px] text-ink-2">{versus(delta)}</span>}
            </In>
          );
        })}
      </>
    ),
  });

  if (d.topCategories.length > 0) {
    slides.push({
      key: "categories",
      tone: "surface",
      label: t.categories.label(prefs.currency),
      content: (
        <>
          <In className="text-[19px] text-ink-2">{t.categories.label(prefs.currency)}</In>
          <div className="flex flex-col gap-4">
            {d.topCategories.map((c, i) => (
              <In key={c.id} step={i + 1} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-[22px] font-semibold text-ink-3">{i + 1}</span>
                  <CategoryBadge category={c} size={40} />
                  <span className="flex-1 truncate text-[22px] font-semibold">{c.name}</span>
                  <span className="text-[22px] font-semibold">{t.percent(c.share)}</span>
                </div>
                <div className="ms-9 h-2 rounded-full bg-surface-2" aria-hidden="true">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(3, c.share)}%` }} />
                </div>
                <span className="ms-9 text-[14px] text-ink-2">
                  <Money amount={c.total} noCents />
                  {c.change !== null && ` · ${versus(c.change)}`}
                </span>
              </In>
            ))}
          </div>
          {d.win && d.prev && (
            <In step={5} className="mt-2 flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-[15px]">
              <Icon name="check" size={20} className="shrink-0 text-accent" />
              <span>{rich(t.categories.win(<b>{d.win.name}</b>, <Money amount={d.win.drop} noCents />, d.prev.year, sameDates))}</span>
            </In>
          )}
        </>
      ),
    });
  }

  if (d.topConcepts.length > 0) {
    slides.push({
      key: "llocs",
      tone: "ground",
      label: t.places.label,
      content: (
        <>
          <In className="text-[19px] text-ink-2">{t.places.title}</In>
          <ol className="flex flex-col gap-3.5">
            {d.topConcepts.map((c, i) => (
              <In key={c.concept} step={i + 1}>
                <li className="flex items-center gap-3">
                  <span className="w-6 text-[22px] font-semibold text-accent">{i + 1}</span>
                  <CategoryBadge category={c.category} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[20px] font-semibold">{c.concept}</span>
                    <span className="text-[14px] text-ink-2">
                      {t.places.times(c.count)} · <Money amount={c.total} noCents />
                    </span>
                  </span>
                </li>
              </In>
            ))}
          </ol>
        </>
      ),
    });
  }

  if (d.priciestMonth) {
    const max = Math.max(...d.months.map((m) => Number(m.expense)), 1);
    slides.push({
      key: "ritme",
      tone: "surface",
      label: t.rhythm.label,
      content: (
        <>
          <In className="text-[19px] text-ink-2">{t.rhythm.title}</In>
          <In step={1} className="flex flex-col gap-1">
            <Money amount={d.monthlyAverage} className="text-[48px] leading-none font-semibold tracking-[-0.04em]" />
            <span className="text-[15px] text-ink-2">{t.rhythm.average}</span>
          </In>
          <In step={2} className="flex h-40 items-end gap-1.5" aria-hidden="true">
            {d.months.map((m) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={`w-full rounded-md ${m.month === d.priciestMonth!.month ? "bg-accent" : "bg-ink-3"}`}
                  style={{ height: `${Math.max(3, (Number(m.expense) / max) * 128)}px` }}
                />
                <span className="text-[11px] text-ink-2 uppercase">{monthName(m.month, prefs.locale).charAt(0)}</span>
              </div>
            ))}
          </In>
          <In step={3} className="flex flex-col gap-1 text-[16px]">
            <span>
              {t.rhythm.priciest} <b>{monthName(d.priciestMonth.month, prefs.locale)}</b> (
              <Money amount={d.priciestMonth.expense} noCents />)
            </span>
            {d.cheapestMonth && d.cheapestMonth.month !== d.priciestMonth.month && (
              <span className="text-ink-2">
                {t.rhythm.calmest} {monthName(d.cheapestMonth.month, prefs.locale)} (<Money amount={d.cheapestMonth.expense} noCents />)
              </span>
            )}
          </In>
        </>
      ),
    });
  }

  if (d.subscriptions) {
    const s = d.subscriptions;
    slides.push({
      key: "subscripcions",
      tone: "accent",
      label: t.subscriptions.label,
      content: (
        <>
          <In className="text-[19px] font-medium">{t.subscriptions.title(s.count)}</In>
          <In step={1}>
            <Money amount={s.total} className={big} centsClassName="opacity-50" />
          </In>
          <In step={2} className="text-[19px] font-medium">
            {rich(t.subscriptions.monthly(<Money amount={s.monthly} noCents />))}
            {s.days > 0 && t.subscriptions.days(s.days)}
          </In>
        </>
      ),
    });
  }

  if (d.investments) {
    const inv = d.investments;
    slides.push({
      key: "inversions",
      tone: "ground",
      label: t.investments.label,
      content: (
        <>
          <In className="text-[19px] text-ink-2">{t.investments.title}</In>
          <In step={1} className="flex flex-col gap-1">
            <span className="text-[15px] text-ink-2">{t.investments.start(inv.startMonth)}</span>
            <Money amount={inv.start} noCents className="text-[28px] font-semibold text-ink-2" />
          </In>
          <In step={2} className="flex flex-col gap-1">
            <span className="text-[15px] text-ink-2">{d.final ? t.investments.endOfYear : t.investments.today}</span>
            <Money amount={inv.end} noCents className="text-[56px] leading-none font-semibold tracking-[-0.05em]" />
            {inv.change !== null && (
              <span className={`text-[17px] font-semibold ${inv.change >= 0 ? "text-positive" : "text-negative"}`}>
                {signedPct(inv.change)} <span className="font-normal text-ink-2">{t.investments.withFlows}</span>
              </span>
            )}
          </In>
          <In step={3} className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-3 text-[15px]">
            {inv.latent && (
              <span className="flex justify-between gap-3">
                {t.investments.latent} <Money amount={inv.latent} signed noCents className="font-semibold" />
              </span>
            )}
            {inv.realized && (
              <span className="flex justify-between gap-3">
                {t.investments.realized} <Money amount={inv.realized} signed noCents className="font-semibold" />
              </span>
            )}
            {inv.best && (
              <span className="flex justify-between gap-3">
                {t.investments.best}{" "}
                <b>
                  {inv.best.name} {signedPct(inv.best.pct)}
                </b>
              </span>
            )}
          </In>
        </>
      ),
    });
  }

  if (d.tax) {
    const tax = d.tax;
    slides.push({
      key: "hisenda",
      tone: "surface",
      label: t.tax.label,
      content: (
        <>
          <In className="flex items-center gap-2 text-[15px] text-ink-2">
            <Icon name="receipt" size={18} /> {t.tax.private}
          </In>
          <In step={1} className="text-[19px] text-ink-2">
            {t.tax.sales(tax.sales)}
          </In>
          <In step={2}>
            <Money amount={tax.net} signed className="text-[52px] leading-none font-semibold tracking-[-0.05em] whitespace-nowrap" />
          </In>
          <In step={3} className="text-[17px] text-ink-2">
            {tax.regime === "irnr"
              ? t.tax.nonResident
              : tax.tax
                ? rich(t.tax.estimate(<Money amount={tax.tax} className="font-semibold text-ink" />))
                : t.tax.noTax}
          </In>
        </>
      ),
    });
  }

  const persona = t.personas[d.persona.key];
  slides.push({
    key: "perfil",
    tone: "accent",
    label: t.profile.label,
    content: (
      <>
        <In className="text-[19px] font-medium">{t.profile.title(d.year)}</In>
        <In step={1} className="text-[52px] leading-none font-semibold tracking-[-0.05em]">
          {persona.title}
        </In>
        <In step={2} className="text-[19px] font-medium">
          {persona.description(d.persona.rate, prefs.currency)}
        </In>
      </>
    ),
  });

  return slides;
}

export function WrappedStory({ data }: { data: WrappedData }) {
  const m = useMessages();
  const prefs = usePrefs();
  const t = m.wrapped;
  // En hebreu (de dreta a esquerra) tot es mira al revés: tocar a la dreta torna enrere i la fletxa esquerra avança.
  const rtl = isRtl(prefs.locale);
  const slides = buildSlides(data, m, prefs);
  const [index, setIndex] = useState(0);
  const [sharing, setSharing] = useState<"idle" | "busy" | "error">("idle");
  const last = slides.length - 1;
  const slide = slides[index];

  const go = (delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta)));

  useEffect(() => {
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const onKey = (e: KeyboardEvent) => {
      const delta = e.key === forward || e.key === " " ? 1 : e.key === back ? -1 : 0;
      if (delta) setIndex((i) => Math.min(last, Math.max(0, i + delta)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, rtl]);

  const share = async () => {
    setSharing("busy");
    try {
      const res = await fetch(`/wrapped/${data.year}/targeta`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], `finances-${data.year}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.share.title(data.year) });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
      setSharing("idle");
    } catch (e) {
      // Cancel·lar el full de compartir no és un error.
      setSharing(e instanceof DOMException && e.name === "AbortError" ? "idle" : "error");
    }
  };

  const tone = TONE[slide.tone];
  const onAccent = slide.tone === "accent";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col transition-colors duration-500 select-none ${tone}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        // El 30 % del costat d'on es ve (l'esquerra, o la dreta en hebreu) torna enrere; la resta avança.
        const x = e.clientX / window.innerWidth;
        go((rtl ? x > 0.7 : x < 0.3) ? -1 : 1);
      }}
    >
      <div className="flex flex-col gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex gap-1" role="progressbar" aria-label={t.nav.slide} aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={index + 1}>
          {slides.map((s, i) => (
            <span key={s.key} className={`h-1 flex-1 rounded-full ${i <= index ? (onAccent ? "bg-accent-ink" : "bg-ink") : onAccent ? "bg-black/20" : "bg-ink-3/40"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[13px] font-medium ${onAccent ? "opacity-70" : "text-ink-2"}`}>{slide.label}</span>
          <Link
            href={`/any?any=${data.year}`}
            aria-label={m.common.actions.close}
            className={`flex size-10 items-center justify-center rounded-full ${onAccent ? "bg-black/10" : "bg-surface-2"}`}
          >
            <Icon name="x" size={18} />
          </Link>
        </div>
      </div>

      <main key={slide.key} className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 overflow-y-auto px-6 pb-6">
        {slide.content}
        {index === last && (
          <In step={4} className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={share}
              disabled={sharing === "busy"}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-accent-ink text-[15px] font-semibold text-accent disabled:opacity-60"
            >
              {sharing === "busy" ? t.share.busy : t.share.button}
            </button>
            <span className="text-center text-[13px] opacity-70">{sharing === "error" ? t.share.error : t.share.note(prefs.currency)}</span>
            <button type="button" onClick={() => setIndex(0)} className="h-11 text-[15px] font-semibold underline underline-offset-4">
              {t.share.again}
            </button>
          </In>
        )}
      </main>

      <div className="flex justify-between px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} className="sr-only focus:not-sr-only">
          {t.nav.previous}
        </button>
        <span className={`text-[12px] ${onAccent ? "opacity-60" : "text-ink-3"}`} aria-hidden="true">
          {index < last ? t.nav.tapToContinue : ""}
        </span>
        <button type="button" onClick={() => go(1)} disabled={index === last} className="sr-only focus:not-sr-only">
          {t.nav.next}
        </button>
      </div>
    </div>
  );
}
