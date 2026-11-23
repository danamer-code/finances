import type { ReactNode } from "react";

import { PrefsProvider } from "./prefs";
import { getPrefs } from "./server";

/** Llegeix les preferències de la petició i les passa als components del navegador. */
export async function PrefsRoot({ children }: { children: ReactNode }) {
  return <PrefsProvider prefs={await getPrefs()}>{children}</PrefsProvider>;
}
