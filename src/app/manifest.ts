import type { MetadataRoute } from "next";

/** Perquè l'accés directe s'obri com una app: a pantalla completa, amb nom i icona propis. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finances",
    short_name: "Finances",
    description: "Finances personals: apunta una despesa en cinc segons.",
    lang: "ca",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0e0e",
    theme_color: "#0e0e0e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
