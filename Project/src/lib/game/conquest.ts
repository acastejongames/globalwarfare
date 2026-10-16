import { distanceKm, neighborsOf } from "@/lib/geo/adjacency";
import { countriesIn, type Region } from "@/lib/geo/countries";

/**
 * Reglas del modo conquista:
 *  - cada jugador empieza con un territorio (su país de salida),
 *  - solo se puede conquistar lo que toca lo que ya posees,
 *  - si no queda ninguna frontera libre, se puede saltar a los territorios
 *    más cercanos (evita que alguien se quede sin jugadas, p. ej. en una isla).
 */

export interface Moves {
  /** Territorios en contacto con los que ya posees. */
  frontier: string[];
  /** Sin frontera disponible: los más cercanos, por si hay que saltar. */
  nearest: string[];
  /** true cuando no hay frontera y hay que tirar de `nearest`. */
  fallback: boolean;
}

/** Cuántos territorios cercanos se ofrecen cuando no hay frontera. */
export const NEAREST_FALLBACK = 3;

export const territoriesOf = (guessed: Record<string, string>, playerId: string) =>
  Object.keys(guessed).filter((a2) => guessed[a2] === playerId);

export const freeTerritories = (region: Region, guessed: Record<string, string>) =>
  countriesIn(region)
    .map((country) => country.a2)
    .filter((a2) => guessed[a2] === undefined);

const distanceToOwned = (region: Region, owned: string[], a2: string) =>
  owned.reduce(
    (best, territory) => Math.min(best, distanceKm(region, territory, a2)),
    Number.POSITIVE_INFINITY,
  );

export function movesFor(region: Region, guessed: Record<string, string>, playerId: string): Moves {
  const owned = territoriesOf(guessed, playerId);
  const free = new Set(freeTerritories(region, guessed));

  const frontier = new Set<string>();
  for (const territory of owned) {
    for (const neighbour of neighborsOf(region, territory)) {
      if (free.has(neighbour)) frontier.add(neighbour);
    }
  }
  if (frontier.size) return { frontier: [...frontier].sort(), nearest: [], fallback: false };

  const ranked = [...free]
    .map((a2) => ({ a2, km: distanceToOwned(region, owned, a2) }))
    .sort((a, b) => a.km - b.km);
  return {
    frontier: [],
    nearest: ranked.slice(0, NEAREST_FALLBACK).map((item) => item.a2),
    fallback: true,
  };
}

export const canClaim = (moves: Moves, a2: string) =>
  moves.frontier.includes(a2) || moves.nearest.includes(a2);
