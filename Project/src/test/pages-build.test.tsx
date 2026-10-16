// Build estático de GitHub Pages: el sitio se sirve desde un subdirectorio y sin SSR.
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter, rootRouteId } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { basepathFromEnv, createPagesRouter } from "@/pages-router";
import { routeTree } from "@/routeTree.gen";

const go = (url: string) => window.history.replaceState({}, "", url);

afterEach(() => go("/"));

describe("build de Pages (sin SSR)", () => {
  it("quita el base del subdirectorio para poder casar rutas", () => {
    expect(basepathFromEnv("/globalwarfare/")).toBe("/globalwarfare");
    expect(basepathFromEnv("/globalwarfare")).toBe("/globalwarfare");
    expect(basepathFromEnv("/")).toBe("/");
    expect(basepathFromEnv(undefined)).toBe("/");
  });

  it("con basepath, la URL publicada carga la portada", async () => {
    go("/globalwarfare/");
    const router = createRouter({
      routeTree,
      basepath: basepathFromEnv("/globalwarfare/"),
      context: { queryClient: new QueryClient() },
    });
    await router.load();
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.matches.at(-1)?.routeId).toBe("/");
  });

  it("sin basepath, esa misma URL no casa con ninguna ruta (por eso hace falta)", async () => {
    go("/globalwarfare/");
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    await router.load();
    expect(router.state.matches.at(-1)?.routeId).toBe(rootRouteId);
  });

  it("renderiza la portada sin anidar <html> dentro del contenedor", async () => {
    const router = createPagesRouter();
    await router.load();
    const { container } = render(<RouterProvider router={router} />);
    expect(await screen.findByText(/Guerra mundial de países/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Jugar online/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Partida local/i })).toBeInTheDocument();
    // el shell del documento no debe montarse en el SPA
    expect(container.querySelector("html")).toBeNull();
    expect(container.querySelector("body")).toBeNull();
  });
});
