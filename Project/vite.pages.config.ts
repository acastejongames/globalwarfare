// Config del build estático para GitHub Pages.
//
// El sitio vive en https://acastejongames.github.io/globalwarfare/ (subdirectorio),
// así que todo se emite con el prefijo `base`. Se sirve sin SSR: la app resuelve
// todo en el navegador (el motor de juego y Supabase Realtime ya funcionan así).
//
//   npm run build:pages          # genera dist-pages/ (index.html + assets)
//   PAGES_BASE=/otro/ npm run build:pages
//
// No incluye el plugin de TanStack Start ni nitro a propósito: Pages es estático
// y el wrapper del proyecto solo sabe construir para plataformas con servidor.
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const base = process.env["PAGES_BASE"] ?? "/globalwarfare/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    rollupOptions: {
      input: { index: path.resolve(import.meta.dirname, "pages.html") },
    },
  },
});
