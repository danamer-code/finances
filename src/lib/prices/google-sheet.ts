import "server-only";

import { createSign } from "node:crypto";

import type { PriceProvider } from "./quotes";
import { parseSheetRows } from "./sheet-rows";

/**
 * Accions i fons des d'un Google Sheet propi amb fórmules GOOGLEFINANCE() (opcional).
 * S'hi accedeix amb un compte de servei de només lectura (el full no cal publicar-lo).
 *
 * Variables: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY (clau privada PEM),
 * PRICES_SHEET_ID i, opcionalment, PRICES_SHEET_RANGE (per defecte "Preus!A2:C").
 */
export function googleSheetProvider(): PriceProvider | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.PRICES_SHEET_ID;
  if (!email || !key || !sheetId) return null;
  const range = process.env.PRICES_SHEET_RANGE ?? "Preus!A2:C";

  return {
    name: "google-sheet",
    covers: (h) => h.kind !== "crypto",
    async fetch() {
      const token = await accessToken(email, key);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Google Sheets ha respost ${res.status}`);
      const body = (await res.json()) as { values?: unknown[][] };
      return parseSheetRows(body.values ?? []);
    },
  };
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/** Token OAuth amb un JWT signat pel compte de servei (flux "service account", sense dependències). */
async function accessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(privateKey);
  const assertion = `${header}.${claims}.${b64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google OAuth ha respost ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}
