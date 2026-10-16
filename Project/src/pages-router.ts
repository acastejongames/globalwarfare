import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

/**
 * Router para el build estático de GitHub Pages (sin SSR).
 *
 * El sitio se publica en https://acastejongames.github.io/globalwarfare/, así que
 * hay que quitar el `base` de la URL antes de casar rutas: sin esto, `/globalwarfare/`
 * no coincidiría con la ruta `/`. Vite expone el base en `import.meta.env.BASE_URL`.
 */
export function basepathFromEnv(base: string | undefined) {
  if (!base || base === "/" || base === "./" || base === "") return "/";
  return base.replace(/\/+$/, "");
}

/**
 * El layout raíz define un `shellComponent` que genera el documento entero
 * (`<html><head>…<body>`). Eso es lo correcto con SSR, pero aquí no hay servidor
 * que renderice el documento: lo aporta `pages.html`. Si no lo quitamos, el SPA
 * montaría un `<html>` dentro de `#root`. Como el árbol de rutas es el mismo que
 * usa el resto de la app, lo neutralizamos solo para este router.
 */
function withoutDocumentShell(tree: typeof routeTree) {
  const options = (tree as unknown as { options: { shellComponent?: unknown } }).options;
  options.shellComponent = undefined;
  return tree;
}

export function createPagesRouter() {
  return createRouter({
    routeTree: withoutDocumentShell(routeTree),
    basepath: basepathFromEnv(import.meta.env.BASE_URL),
    context: { queryClient: new QueryClient() },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createPagesRouter>;
  }
}
