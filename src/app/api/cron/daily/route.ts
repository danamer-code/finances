import { NextResponse, type NextRequest } from "next/server";

import { getMessages } from "@/i18n/server";
import { runDaily } from "@/lib/cron";
import { isoDate } from "@/lib/format";

/**
 * Cron diari de Vercel (vercel.json). Vercel envia `Authorization: Bearer $CRON_SECRET`;
 * sense aquesta capçalera la ruta no fa res.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    const m = await getMessages();
    return NextResponse.json({ error: m.server.errors.unauthorized }, { status: 401 });
  }
  // Data del calendari de Madrid, no la UTC del servidor.
  const today = isoDate(new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" })));
  try {
    return NextResponse.json(await runDaily(today));
  } catch (e) {
    // La ruta només respon a qui té CRON_SECRET: el missatge ajuda a diagnosticar (no conté claus).
    console.error("cron diari", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
