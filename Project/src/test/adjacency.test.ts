// Fronteras entre territorios (países, provincias y comunidades).
import { describe, expect, it } from "vitest";
import { distanceKm, neighborsOf } from "@/lib/geo/adjacency";
import { canClaim, movesFor, NEAREST_FALLBACK } from "@/lib/game/conquest";

describe("adyacencia", () => {
  it("mundo", () => {
    expect(neighborsOf("ALL", "ES")).toContain("FR");
    expect(neighborsOf("ALL", "ES")).toContain("PT");
    expect(neighborsOf("ALL", "ES")).toContain("MA");
    expect(neighborsOf("ALL", "DE")).toEqual(
      expect.arrayContaining(["FR", "PL", "NL", "BE", "DK", "CZ", "AT", "CH"]),
    );
    // islas sin vecinos
    expect(neighborsOf("ALL", "AU")).toEqual([]);
    expect(neighborsOf("ALL", "JP")).toEqual([]);
    // filtrado por región
    expect(neighborsOf("EUROPE", "ES")).toEqual(expect.arrayContaining(["FR", "PT"]));
    expect(neighborsOf("EUROPE", "ES")).not.toContain("MA");
    expect(distanceKm("ALL", "ES", "FR")).toBeGreaterThan(200);
    expect(distanceKm("ALL", "ES", "FR")).toBeLessThan(1500);
  });
  it("españa", () => {
    expect(neighborsOf("SPAIN_PROVINCES", "ES-P-28").length).toBe(5); // Madrid
    expect(neighborsOf("SPAIN_PROVINCES", "ES-P-35")).toEqual([]); // Las Palmas (islas)
    expect(neighborsOf("SPAIN_COMMUNITIES", "ES-C-13")).toEqual(
      expect.arrayContaining(["ES-C-06", "ES-C-07"]),
    ); // Madrid ~ Castilla-La Mancha y Castilla y León
    expect(distanceKm("SPAIN_PROVINCES", "ES-P-28", "ES-P-08")).toBeGreaterThan(400); // Madrid-Barcelona
  });
});

describe("reglas de conquista", () => {
  it("sin territorios propios, todo está libre", () => {
    const m = movesFor("SPAIN_COMMUNITIES", {}, "p1");
    expect(m.frontier).toEqual([]);
    expect(m.nearest.length).toBe(NEAREST_FALLBACK);
    expect(m.fallback).toBe(true);
  });
  it("la frontera son los vecinos libres de lo que posees", () => {
    const guessed = { "ES-C-13": "p1" }; // Madrid
    const m = movesFor("SPAIN_COMMUNITIES", guessed, "p1");
    expect(m.fallback).toBe(false);
    expect(m.frontier).toEqual(expect.arrayContaining(["ES-C-06", "ES-C-07"]));
    expect(canClaim(m, "ES-C-06")).toBe(true);
    expect(canClaim(m, "ES-C-01")).toBe(false); // Andalucía no toca Madrid
  });
  it("lo ya conquistado no cuenta como frontera", () => {
    const guessed = { "ES-C-13": "p1", "ES-C-06": "p2", "ES-C-07": "p2" };
    const m = movesFor("SPAIN_COMMUNITIES", guessed, "p1");
    expect(m.fallback).toBe(true); // Madrid está rodeada y sin salida
    expect(m.nearest.length).toBe(NEAREST_FALLBACK);
  });
  it("islas: sin frontera se ofrecen los más cercanos", () => {
    const m = movesFor("ALL", { AU: "p1" }, "p1");
    expect(m.fallback).toBe(true);
    expect(m.nearest).not.toContain("AU");
    expect(m.nearest.length).toBe(NEAREST_FALLBACK);
  });
  it("frontera internacional", () => {
    const m = movesFor("EUROPE", { ES: "p1" }, "p1");
    expect(m.frontier).toEqual(expect.arrayContaining(["FR", "PT"]));
    expect(m.frontier).not.toContain("MA"); // no está en Europa
  });
});
