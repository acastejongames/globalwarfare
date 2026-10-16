// Modo conquista: reglas de frontera, territorio de salida y su reflejo en la interfaz.
import { RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createPagesRouter } from "@/pages-router";
import { movesFor } from "@/lib/game/conquest";
import { useGame } from "@/lib/game/useGame";
import { COUNTRY_BY_A2 } from "@/lib/geo/countries";

beforeAll(() => {
  class StubAudioContext {
    currentTime = 0;
    destination = {};
    createOscillator() {
      return {
        type: "",
        frequency: { value: 0 },
        connect() {
          return this;
        },
        start() {},
        stop() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {
          return this;
        },
      };
    }
  }
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = StubAudioContext;
});

const setup = (
  region: "SPAIN_PROVINCES" | "ALL" = "SPAIN_PROVINCES",
  capitals: [string, string] | null = ["ES-P-28", "ES-P-08"],
) => {
  const hook = renderHook(() => useGame());
  const g = () => hook.result.current;
  act(() => {
    g().setMode("conquest");
    g().setRegion(region);
  });
  act(() => {
    g().addPlayer("Ana");
    g().addPlayer("Luis");
  });
  const [ana, luis] = g().s.players;
  if (capitals)
    act(() => {
      g().setCapital(ana!.id, capitals[0]);
      g().setCapital(luis!.id, capitals[1]);
    });
  act(() => g().start());
  const guess = (text: string, playerId?: string) => {
    let out: { ok: boolean; msg: string } = { ok: false, msg: "" };
    act(() => {
      out = g().guess(text, playerId) as { ok: boolean; msg: string };
    });
    return out;
  };
  return { hook, g, ana: ana!, luis: luis!, guess };
};

describe("modo conquista · motor", () => {
  it("cada jugador empieza con su territorio de salida", () => {
    const { g, ana, luis } = setup();
    expect(g().s.mode).toBe("conquest");
    expect(g().s.phase).toBe("playing");
    expect(g().s.guessed["ES-P-28"]).toBe(ana.id);
    expect(g().s.guessed["ES-P-08"]).toBe(luis.id);
    expect(g().s.players.map((p) => p.count)).toEqual([1, 1]);
    expect(g().s.players.map((p) => p.capital)).toEqual(["ES-P-28", "ES-P-08"]);
  });

  it("solo acepta territorios que tocan los tuyos; si no, resta vida", () => {
    const { g, guess } = setup();
    const frontier = movesFor("SPAIN_PROVINCES", g().s.guessed, g().s.players[0]!.id).frontier;
    expect(frontier).toEqual(["ES-P-05", "ES-P-16", "ES-P-19", "ES-P-40", "ES-P-45"]); // Ávila, Cuenca, Guadalajara, Segovia, Toledo

    // Sevilla no toca Madrid
    const fail = guess("Sevilla");
    expect(fail.ok).toBe(false);
    expect(fail.msg).toMatch(/no toca tu territorio/);
    expect(g().s.guessed["ES-P-41"]).toBeUndefined();
    expect(g().s.players[0]!.lives).toBe(2);

    // ahora le toca a Luis (Barcelona) y sí puede con Girona
    expect(g().s.turn).toBe(1);
    const ok = guess("Girona");
    expect(ok.ok).toBe(true);
    expect(g().s.guessed["ES-P-17"]).toBe(g().s.players[1]!.id);
    expect(g().s.players[1]!.count).toBe(2);
  });

  it("una isla sin frontera ofrece los más cercanos", () => {
    const { g, guess } = setup("SPAIN_PROVINCES", ["ES-P-35", "ES-P-08"]); // Las Palmas
    const moves = movesFor("SPAIN_PROVINCES", g().s.guessed, g().s.players[0]!.id);
    expect(moves.fallback).toBe(true);
    expect(moves.frontier).toEqual([]);
    expect(moves.nearest).toHaveLength(3);

    // Madrid no está entre los más cercanos a Canarias
    const fail = guess("Madrid");
    expect(fail.ok).toBe(false);
    expect(fail.msg).toMatch(/no es de los más cercanos/);
    expect(g().s.players[0]!.lives).toBe(2);

    // el siguiente turno sí acepta uno de los cercanos (los calcula el propio motor)
    expect(g().s.turn).toBe(1);
    expect(guess("Girona").ok).toBe(true);
    const nearest = movesFor("SPAIN_PROVINCES", g().s.guessed, g().s.players[0]!.id).nearest[0]!;
    expect(guess(COUNTRY_BY_A2[nearest]!.name, g().s.players[0]!.id).ok).toBe(true);
    expect(g().s.guessed[nearest]).toBe(g().s.players[0]!.id);
  });

  it("repetir un territorio conquistado cuesta una vida", () => {
    const { g, guess } = setup();
    expect(guess("Toledo").ok).toBe(true);
    expect(g().s.turn).toBe(1);
    expect(guess("Girona").ok).toBe(true);
    expect(g().s.turn).toBe(0);
    const lives = g().s.players[0]!.lives;
    const repeat = guess("Toledo");
    expect(repeat.ok).toBe(false);
    expect(g().s.players[0]!.lives).toBe(lives - 1);
  });

  it("asigna territorio a quien no elija, sin repetir", () => {
    const { g } = setup("SPAIN_PROVINCES", null);
    const capitals = g().s.players.map((p) => p.capital);
    expect(capitals.every(Boolean)).toBe(true);
    expect(new Set(capitals).size).toBe(2);
    expect(Object.keys(g().s.guessed)).toHaveLength(2);
    expect(g().s.players.map((p) => p.count)).toEqual([1, 1]);
  });

  it("no deja que dos jugadores elijan el mismo territorio", () => {
    const hook = renderHook(() => useGame());
    const g = () => hook.result.current;
    act(() => {
      g().setMode("conquest");
      g().setRegion("SPAIN_PROVINCES");
      g().addPlayer("Ana");
      g().addPlayer("Luis");
    });
    const [ana, luis] = g().s.players;
    act(() => {
      g().setCapital(ana!.id, "ES-P-28");
      g().setCapital(luis!.id, "ES-P-28"); // ya es de Ana
    });
    expect(g().s.players[1]!.capital).toBeUndefined();
    act(() => g().setCapital(luis!.id, "ES-P-08"));
    expect(g().s.players[1]!.capital).toBe("ES-P-08");
  });

  it("en el mundo, la frontera respeta la región jugada", () => {
    const { g } = setup("ALL", ["ES", "BR"]);
    expect(movesFor("ALL", g().s.guessed, g().s.players[0]!.id).frontier).toEqual([
      "FR",
      "MA",
      "PT",
    ]);
  });

  it("el modo clásico sigue aceptando cualquier territorio libre", () => {
    const hook = renderHook(() => useGame());
    const g = () => hook.result.current;
    act(() => {
      g().setRegion("SPAIN_PROVINCES");
      g().addPlayer("Ana");
      g().addPlayer("Luis");
    });
    act(() => g().start());
    let out: { ok: boolean } | undefined;
    act(() => {
      out = g().guess("Sevilla");
    });
    expect(out).toMatchObject({ ok: true });
    expect(Object.keys(g().s.guessed)).toHaveLength(1);
  });
});

describe("modo conquista · interfaz", () => {
  const renderApp = async () => {
    const router = createPagesRouter();
    await router.load();
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole("button", { name: /Partida local/i }));
    return { router };
  };

  const addPlayer = (name: string) => {
    fireEvent.change(screen.getByPlaceholderText("Nombre del jugador"), {
      target: { value: name },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Añadir$/ }));
  };

  const pickCapital = (index: number, country: string) => {
    const inputs = screen.getAllByPlaceholderText("Escribe un país…");
    fireEvent.change(inputs[index]!, { target: { value: country } });
    const row = inputs[index]!.closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /^Elegir$/ }));
  };

  it("vestíbulo: elige modo, región y territorio de salida", async () => {
    await renderApp();
    addPlayer("Ana");
    addPlayer("Luis");

    fireEvent.click(screen.getByRole("button", { name: /^Conquista$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Provincias de España/ }));
    expect(screen.getByText(/cada jugador sale desde un territorio/i)).toBeInTheDocument();

    pickCapital(0, "Madrid");
    pickCapital(1, "Barcelona");
    expect(screen.getByText(COUNTRY_BY_A2["ES-P-28"]!.name)).toBeInTheDocument();
    expect(screen.getByText(COUNTRY_BY_A2["ES-P-08"]!.name)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Comenzar partida/i }));

    // empieza la partida: se ve la frontera de Madrid resaltada en el mapa
    const hint = await screen.findAllByText(
      (_, el) =>
        el?.textContent?.replace(/\s+/g, " ").trim() ===
        "Frontera de Ana: 5 territorios en contacto contigo.",
    );
    expect(hint.length).toBeGreaterThan(0);
    const map = document.querySelector(".map-ocean")!;
    expect(map.querySelectorAll("path.map-land-frontier")).toHaveLength(5);
    expect(map.querySelectorAll("path.map-land-target")).toHaveLength(0);
  });

  it("interfaz: sin frontera avisa de los más cercanos", async () => {
    await renderApp();
    addPlayer("Ana");
    addPlayer("Luis");
    fireEvent.click(screen.getByRole("button", { name: /^Conquista$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Provincias de España/ }));
    pickCapital(0, "Las Palmas");
    pickCapital(1, "Barcelona");
    fireEvent.click(screen.getByRole("button", { name: /Comenzar partida/i }));

    expect(
      await screen.findByText(/Sin frontera libre: puedes elegir uno de los/),
    ).toBeInTheDocument();
    const map = document.querySelector(".map-ocean")!;
    expect(map.querySelectorAll("path.map-land-target")).toHaveLength(3);

    // el botón permite ocultar el resaltado
    fireEvent.click(screen.getByRole("button", { name: /Ocultar frontera/i }));
    expect(document.querySelectorAll("path.map-land-target")).toHaveLength(0);
  });

  it("interfaz: fallar el nombre resta una vida en el marcador", async () => {
    await renderApp();
    addPlayer("Ana");
    addPlayer("Luis");
    fireEvent.click(screen.getByRole("button", { name: /^Conquista$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Provincias de España/ }));
    pickCapital(0, "Madrid");
    pickCapital(1, "Barcelona");
    fireEvent.click(screen.getByRole("button", { name: /Comenzar partida/i }));

    const input = await screen.findByPlaceholderText("Escribe un país…");
    fireEvent.change(input, { target: { value: "Sevilla" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar país/i }));

    // aparece en el aviso del turno y en la crónica
    expect((await screen.findAllByText(/no toca tu territorio/)).length).toBeGreaterThanOrEqual(1);
    const anaRow = screen.getByText("Ana").closest("div.player-pill") as HTMLElement;
    const hearts = within(anaRow).getAllByText("♥");
    expect(hearts.filter((h) => h.className.includes("text-destructive"))).toHaveLength(2);
    // la crónica registra la conquista fallida
    expect(screen.getByText(/Ana: Sevilla no toca tu territorio \(−1 ♥\)/)).toBeInTheDocument();
  });
});
