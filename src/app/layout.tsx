import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Suspense } from "react";

import { ServiceWorker } from "@/components/service-worker";
import { PrefsRoot } from "@/i18n/root";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finances",
  description: "Finances personals: apunta una despesa en cinc segons.",
  // A la pantalla d'inici de l'iPhone: s'obre a pantalla completa, sense les barres de Safari.
  appleWebApp: { capable: true, title: "Finances", statusBarStyle: "black" },
  // Icona: moneda llima amb el monograma «F.» (public/icon.svg és l'original).
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0e0e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Aplica el tema desat abans de pintar, per evitar un flaix de mode fosc quan l'usuari ha triat el clar. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Idioma i direcció del text (l'hebreu va de dreta a esquerra) abans de pintar: el de la galeta o, si no n'hi ha, el del navegador. */
const LANG_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )locale=(ca|en|he)/);var l=m?m[1]:"";if(!l){var n=navigator.languages||[navigator.language];for(var i=0;i<n.length&&!l;i++){var p=String(n[i]).toLowerCase().split("-")[0];l=p==="ca"||p==="en"||p==="he"?p:p==="es"?"ca":""}l=l||(n.length?"en":"ca")}var h=document.documentElement;h.lang=l;h.dir=l==="he"?"rtl":"ltr"}catch(e){}`;

/**
 * Oberta des de la icona de la pantalla d'inici, l'app arrenca sempre a Avui: l'iPhone guarda l'adreça de la
 * pàgina on eres en afegir l'accés directe. Només actua a la primera pàgina de cada arrencada; si cal entrar,
 * es treu el `next` perquè després d'entrar també vagi a Avui.
 */
const LAUNCH_SCRIPT = `try{var s=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;if(s&&!sessionStorage.getItem("launched")){sessionStorage.setItem("launched","1");var p=location.pathname;if(p.indexOf("/login")===0){if(location.search)location.replace("/login")}else if(p!=="/"){location.replace("/")}}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Mode fosc per defecte (spec §6); el clar és opcional i es desa al perfil.
    <html lang="ca" data-theme="dark" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Les preferències surten de les galetes de cada petició: tota l'app es renderitza en el moment. */}
        <Suspense fallback={null}>
          <PrefsRoot>{children}</PrefsRoot>
        </Suspense>
        <ServiceWorker />
      </body>
    </html>
  );
}
