// Ajustes posteriores al build de GitHub Pages:
//  - deja la portada como index.html (Vite la emite con el nombre del HTML de entrada),
//  - copia la portada a 404.html, que es lo que sirve Pages en rutas desconocidas,
//  - añade .nojekyll para que Pages no ignore los ficheros que empiezan por "_".
import { copyFileSync, existsSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = "dist-pages";
if (!existsSync(outDir)) {
  console.error(`No existe ${outDir}/: ejecuta antes "vite build --config vite.pages.config.ts".`);
  process.exit(1);
}

const htmlFiles = readdirSync(outDir).filter((f) => f.endsWith(".html"));
const index = join(outDir, "index.html");
if (!existsSync(index)) {
  if (htmlFiles.length !== 1) {
    console.error(
      `Esperaba un único HTML en ${outDir}/, encontrados: ${htmlFiles.join(", ") || "ninguno"}`,
    );
    process.exit(1);
  }
  renameSync(join(outDir, htmlFiles[0]), index);
  console.log(`index.html generado a partir de ${htmlFiles[0]}`);
}

copyFileSync(index, join(outDir, "404.html"));
writeFileSync(join(outDir, ".nojekyll"), "");
console.log("Listo: index.html, 404.html y .nojekyll en dist-pages/");
