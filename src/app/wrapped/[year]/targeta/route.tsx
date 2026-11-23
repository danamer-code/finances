import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { CSSProperties } from "react";

import { isRtl } from "@/i18n/config";
import { getMessages, getPrefs } from "@/i18n/server";
import { getClaims } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { getWrapped } from "@/lib/wrapped";

type Fonts = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;

/**
 * La lletra per defecte d'ImageResponse (Geist) no té l'alfabet hebreu. Per a la targeta en hebreu es baixen de
 * Google Fonts la Geist (la mateixa lletra, perquè la resta no canviï) i la Noto Sans Hebrew, senceres: així no
 * s'envia cap text de l'usuari a Google. Es baixen un cop per instància; si falla, es fa servir la de sempre.
 */
const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Geist&family=Noto+Sans+Hebrew";
// Amb un navegador antic, Google Fonts respon amb TTF (ImageResponse no llegeix woff2).
const TTF_AGENT =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
let hebrewFonts: Promise<Fonts | undefined> | null = null;

async function loadHebrewFonts(): Promise<Fonts> {
  const res = await fetch(FONTS_CSS, { headers: { "User-Agent": TTF_AGENT }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Google Fonts ${res.status}`);
  const css = await res.text();
  const faces = [...css.matchAll(/font-family: '([^']+)';[^}]*?src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/g)]
    .map(([, name, url]) => ({ name, url }))
    // La Geist primer: és la que es fa servir per a tot el que no és hebreu.
    .sort((a, b) => Number(b.name === "Geist") - Number(a.name === "Geist"));
  if (faces.length !== 2) throw new Error("Google Fonts: no s'han trobat les lletres");
  return Promise.all(
    faces.map(async ({ name, url }) => {
      const font = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!font.ok) throw new Error(`Google Fonts ${font.status}`);
      return { name, data: await font.arrayBuffer(), weight: 400 as const, style: "normal" as const };
    }),
  );
}

function getHebrewFonts() {
  hebrewFonts ??= loadHebrewFonts().catch((e) => {
    console.error("targeta: lletra hebrea", e);
    hebrewFonts = null; // es tornarà a provar a la propera petició
    return undefined;
  });
  return hebrewFonts;
}

/*
 * Satori (el motor d'ImageResponse) no aplica l'algorisme bidi: pinta tots els caràcters d'esquerra a dreta.
 * En hebreu, cada línia es parteix en paraules que es col·loquen de dreta a esquerra (row-reverse, i salten de
 * línia bé) i cada paraula es gira a mà: els trams hebreus al revés (amb els parèntesis emmirallats) i les xifres
 * i el text llatí tal qual.
 */
const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const LTR = /[0-9A-Za-z\u00C0-\u024F]/;
/** Signes que s'enganxen a una xifra («85%», «+3», «12×»). */
const NUMBER_AFFIX = /[%‰+\u2212×$€₪]/;
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "«": "»", "»": "«" };

/** Ordre visual (d'esquerra a dreta) d'un tros de text dins d'una línia hebrea. */
function visualRtl(text: string): string {
  const chars = [...text];
  const strong: Array<string | null> = chars.map((c) => (HEBREW.test(c) ? "R" : LTR.test(c) ? "L" : null));
  // Parells de parèntesis: si a dins només hi ha text llatí i abans també, van amb el text llatí («Super (Bonpreu)»).
  const open: number[] = [];
  chars.forEach((c, i) => {
    if ("([{".includes(c)) open.push(i);
    else if (")]}".includes(c) && open.length > 0) {
      const start = open.pop()!;
      const inside = strong.slice(start + 1, i);
      let before: string | null = null;
      for (let j = start - 1; j >= 0 && !before; j--) before = strong[j];
      const dir = inside.includes("R") ? "R" : inside.includes("L") && before === "L" ? "L" : inside.includes("L") ? "R" : null;
      if (dir) strong[start] = strong[i] = dir;
    }
  });
  const dirs = chars.map((c, i) => {
    if (strong[i]) return strong[i];
    let before: string | null = null;
    for (let j = i - 1; j >= 0 && !before; j--) before = strong[j];
    let after: string | null = null;
    for (let j = i + 1; j < chars.length && !after; j++) after = strong[j];
    if (before === "L" && after === "L") return "L";
    if (NUMBER_AFFIX.test(c) && (strong[i - 1] === "L" || strong[i + 1] === "L")) return "L";
    return "R";
  });
  const runs: Array<{ dir: string; chars: string[] }> = [];
  chars.forEach((c, i) => {
    const run = runs[runs.length - 1];
    if (run && run.dir === dirs[i]) run.chars.push(c);
    else runs.push({ dir: dirs[i], chars: [c] });
  });
  return runs
    .reverse()
    .map((r) => (r.dir === "L" ? r.chars.join("") : r.chars.reverse().map((c) => MIRROR[c] ?? c).join("")))
    .join("");
}

type Part = { text: string; color?: string };
type Chunk = { text: string; color?: string; spaceAfter: boolean };

/** Paraules en ordre lògic; les paraules seguides que no són hebrees (noms, xifres) van juntes. */
function rtlChunks(parts: Part[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const part of parts) {
    for (const token of part.text.split(/( +)/)) {
      if (!token) continue;
      const prev = chunks[chunks.length - 1];
      if (token.trim() === "") {
        if (prev) prev.spaceAfter = true;
      } else if (prev?.spaceAfter && prev.color === part.color && !HEBREW.test(prev.text) && !HEBREW.test(token)) {
        prev.text += ` ${token}`;
        prev.spaceAfter = false;
      } else {
        chunks.push({ text: token, color: part.color, spaceAfter: false });
      }
    }
  }
  return chunks;
}

/** Una línia de text de la targeta. En català i anglès, tal qual; en hebreu, muntada de dreta a esquerra. */
function Line({ parts, rtl, size, style }: { parts: Part[]; rtl: boolean; size: number; style?: CSSProperties }) {
  // Les marques invisibles de direcció (LRM, aïllaments) són per al navegador: Satori les pintaria com a caixes.
  const visible = parts.map((p) => ({ ...p, text: p.text.replace(/[\u200e\u200f\u2066-\u2069]/g, "") })).filter((p) => p.text);
  if (!rtl) {
    return (
      <div style={{ display: "flex", ...style }}>
        {visible.map((p, i) => (p.color ? <span key={i} style={{ color: p.color }}>{p.text}</span> : p.text))}
      </div>
    );
  }
  const space = Math.round(size * 0.26);
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", flexWrap: "wrap", ...style }}>
      {rtlChunks(visible).map((c, i) => (
        <span key={i} style={{ ...(c.color ? { color: c.color } : {}), marginLeft: c.spaceAfter ? space : 0 }}>
          {visualRtl(c.text)}
        </span>
      ))}
    </div>
  );
}

/**
 * Targeta per compartir del Year Wrapped (1080×1920, format story). Només percentatges, rànquings i recomptes:
 * cap import, res de la cartera ni d'Hisenda. Es genera per a l'usuari de la sessió, en el seu idioma, i no es
 * desa enlloc.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/wrapped/[year]/targeta">) {
  const m = await getMessages();
  const prefs = await getPrefs();
  const claims = await getClaims();
  if (!claims) return new Response(m.server.errors.unauthorized, { status: 401 });
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) return new Response(m.server.errors.invalidYear, { status: 400 });
  const d = await getWrapped(claims, Number(year), todayIso());
  if (!d) return new Response(m.server.errors.noData, { status: 404 });

  const t = m.wrapped;
  const rtl = isRtl(prefs.locale);
  const fonts = rtl ? await getHebrewFonts() : undefined;
  const text = (s: string): Part[] => [{ text: s }];
  const row = rtl ? "row-reverse" : "row";

  const ink = "#f2f2ef";
  const muted = "#a3a39c";
  const lime = "#d6f35b";
  const stats: Array<[string, string]> = [];
  if (d.savingsRate !== null && d.savingsRate > 0) stats.push([t.percent(d.savingsRate), t.card.savedRate]);
  stats.push([t.number(d.movements), t.card.movements(d.movements)]);
  const topConcept = d.topConcepts[0];
  if (topConcept) stats.push([`${topConcept.count}×`, t.card.topConcept(topConcept.concept)]);
  const [before, after] = t.card.title;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0e0e0e", color: ink, padding: 96 }}>
        <Line parts={text(t.brand)} rtl={rtl} size={34} style={{ fontSize: 34, color: muted }} />
        <Line
          // Espai fix entre «El meu» i l'any, com abans (&nbsp;).
          parts={[{ text: rtl ? before : before.replace(/ $/, "\u00a0") }, { text: String(d.year), color: lime }, { text: after }]}
          rtl={rtl}
          size={140}
          style={{ marginTop: 40, fontSize: 140, letterSpacing: -6, lineHeight: 1 }}
        />
        {d.through && (
          <Line
            parts={text(t.soFar(t.through(d.through.day, d.through.month)))}
            rtl={rtl}
            size={34}
            style={{ fontSize: 34, color: muted, marginTop: 16 }}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", marginTop: 110, padding: 56, borderRadius: 48, background: lime, color: "#121212" }}>
          <Line parts={text(t.card.profile)} rtl={rtl} size={34} style={{ fontSize: 34 }} />
          <Line
            parts={text(t.personas[d.persona.key].title)}
            rtl={rtl}
            size={96}
            style={{ fontSize: 96, letterSpacing: -4, lineHeight: 1.05, marginTop: 12 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 64, gap: 36 }}>
          {stats.map(([value, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 28 }}>
              <Line parts={text(value)} rtl={rtl} size={88} style={{ fontSize: 88, letterSpacing: -3, minWidth: 300 }} />
              <Line parts={text(label)} rtl={rtl} size={36} style={{ fontSize: 36, color: muted }} />
            </div>
          ))}
        </div>

        {d.topCategories.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 72, gap: 18 }}>
            <Line parts={text(t.categories.label(prefs.currency))} rtl={rtl} size={34} style={{ fontSize: 34, color: muted }} />
            {d.topCategories.map((c, i) => (
              <div key={c.id} style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 24, fontSize: 52 }}>
                <Line parts={text(String(i + 1))} rtl={rtl} size={52} style={{ color: lime, width: 50 }} />
                <Line parts={text(c.name)} rtl={rtl} size={52} style={{ flex: 1 }} />
                <Line parts={text(t.percent(c.share))} rtl={rtl} size={52} style={{ color: muted }} />
              </div>
            ))}
          </div>
        )}

        <Line parts={text(t.card.footer)} rtl={rtl} size={30} style={{ marginTop: "auto", fontSize: 30, color: muted }} />
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store" }, ...(fonts ? { fonts } : {}) },
  );
}
