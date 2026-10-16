import { useCallback, useEffect, useRef, useState } from "react";

import { canClaim, movesFor } from "@/lib/game/conquest";
import {
  COUNTRY_BY_A2,
  FAMOUS,
  countriesIn,
  isSpain,
  territoryPlural,
  type Region,
} from "@/lib/geo/countries";
import { matchAny, matchCountry } from "./validator";
import { sfx } from "./sfx";

export type Difficulty = "easy" | "medium" | "hard";
/** `conquest` añade fronteras: solo se conquista lo que toca lo que ya posees. */
export type GameMode = "classic" | "conquest";

export interface Player {
  id: string;
  name: string;
  color: string;
  lives: number;
  isBot?: boolean;
  difficulty?: Difficulty | undefined;
  alive: boolean;
  count: number;
  /** Modo conquista: territorio de salida del jugador. */
  capital?: string | undefined;
}
export interface FeedItem {
  id: number;
  text: string;
  tone: "good" | "bad" | "info";
}
export interface GameState {
  mode: GameMode;
  phase: "lobby" | "playing" | "over";
  region: Region;
  turnSeconds: number;
  players: Player[];
  guessed: Record<string, string>; // a2 -> playerId
  turn: number;
  turnEndsAt: number;
  feed: FeedItem[];
  lastConquest?: { a2: string; at: number } | undefined;
  winnerId?: string | null | undefined;
}

export const PLAYER_COLORS = ["emerald", "amber", "sapphire", "plum", "coral", "teal"] as const;
const BOT_NAMES = ["Atlas", "Mercator", "Magallanes", "Humboldt", "Ptolomeo", "Elcano"];

let fid = 0;
const feed = (s: GameState, text: string, tone: FeedItem["tone"]) => ({
  ...s,
  feed: [{ id: ++fid, text, tone }, ...s.feed].slice(0, 60),
});

const territoryName = (a2: string) => COUNTRY_BY_A2[a2]?.name ?? a2;

function nextTurn(s: GameState): GameState {
  const alive = s.players.filter((p) => p.alive);
  if (alive.length <= 1 && s.players.length > 1)
    return { ...s, phase: "over", winnerId: alive[0]?.id ?? null };
  if (alive.length === 0) return { ...s, phase: "over", winnerId: null };
  const left = countriesIn(s.region).filter((c) => !s.guessed[c.a2]);
  if (left.length === 0) {
    const best = [...alive].sort((a, b) => b.count - a.count)[0];
    return { ...feed(s, "¡Mapa completo!", "info"), phase: "over", winnerId: best?.id ?? null };
  }
  let t = s.turn;
  for (let i = 0; i < s.players.length; i++) {
    t = (t + 1) % s.players.length;
    if (s.players[t]?.alive) break;
  }
  return { ...s, turn: t, turnEndsAt: Date.now() + s.turnSeconds * 1000 };
}

function loseLife(s: GameState, reason: string): GameState {
  const p = s.players[s.turn];
  if (!p) return s;
  const lives = p.lives - 1;
  const players = s.players.map((x, i) => (i === s.turn ? { ...x, lives, alive: lives > 0 } : x));
  let n = feed({ ...s, players }, `${p.name}: ${reason} (−1 ♥)`, "bad");
  if (lives <= 0) n = feed(n, `${p.name} ha sido eliminado`, "bad");
  sfx.lose();
  return nextTurn(n);
}

/** Reparte territorios de salida a los jugadores que no hayan elegido (o que hayan repetido). */
function assignCapitals(s: GameState) {
  const territories = countriesIn(s.region).map((c) => c.a2);
  const taken = new Set<string>();
  const missing: Player[] = [];
  const players = s.players.map((p) => {
    const capital = p.capital;
    if (capital && territories.includes(capital) && !taken.has(capital)) {
      taken.add(capital);
      return { ...p, capital };
    }
    missing.push(p);
    return { ...p, capital: undefined };
  });
  for (const player of missing) {
    const free = territories.filter((a2) => !taken.has(a2));
    const pick = free[Math.floor(Math.random() * free.length)];
    if (!pick) continue;
    taken.add(pick);
    const index = players.findIndex((p) => p.id === player.id);
    const current = players[index];
    if (current) players[index] = { ...current, capital: pick };
  }
  return players;
}

export function useGame() {
  const [s, setS] = useState<GameState>({
    mode: "classic",
    phase: "lobby",
    region: "ALL",
    turnSeconds: 45,
    players: [],
    guessed: {},
    turn: 0,
    turnEndsAt: 0,
    feed: [],
  });
  const ref = useRef(s);
  ref.current = s;

  const setMode = (mode: GameMode) =>
    setS((x) =>
      x.phase !== "lobby"
        ? x
        : {
            ...x,
            mode,
            guessed: {},
            winnerId: undefined,
            players: x.players.map((p) => ({ ...p, capital: undefined })),
          },
    );

  const setRegion = (region: Region) =>
    setS((x) => ({ ...x, region, players: x.players.map((p) => ({ ...p, capital: undefined })) }));

  const addPlayer = (name: string, bot?: Difficulty, id?: string) =>
    setS((x) => {
      if (x.players.length >= 6 || (id && x.players.some((q) => q.id === id))) return x;
      const used = new Set(x.players.map((p) => p.color));
      const color = PLAYER_COLORS.find((c) => !used.has(c));
      if (!color) return x;
      const p: Player = {
        id: id ?? crypto.randomUUID(),
        name: bot ? (BOT_NAMES.find((n) => !x.players.some((q) => q.name === n)) ?? "Bot") : name,
        color,
        lives: 3,
        alive: true,
        count: 0,
        isBot: !!bot,
        difficulty: bot,
      };
      return { ...x, players: [...x.players, p] };
    });
  const removePlayer = (id: string) =>
    setS((x) => ({ ...x, players: x.players.filter((p) => p.id !== id) }));

  /** Territorio de salida: solo en el vestíbulo y si no lo tiene ya otro jugador. */
  const setCapital = (playerId: string, a2: string) =>
    setS((x) => {
      if (x.phase !== "lobby") return x;
      if (!countriesIn(x.region).some((c) => c.a2 === a2)) return x;
      if (x.players.some((p) => p.id !== playerId && p.capital === a2)) return x;
      return {
        ...x,
        players: x.players.map((p) => (p.id === playerId ? { ...p, capital: a2 } : p)),
      };
    });

  const randomCapital = (playerId: string) =>
    setS((x) => {
      if (x.phase !== "lobby") return x;
      const taken = new Set(x.players.filter((p) => p.id !== playerId).map((p) => p.capital));
      const pool = countriesIn(x.region)
        .map((c) => c.a2)
        .filter((a2) => !taken.has(a2));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!pick) return x;
      return {
        ...x,
        players: x.players.map((p) => (p.id === playerId ? { ...p, capital: pick } : p)),
      };
    });

  const start = () =>
    setS((x) => {
      if (!x.players.some((p) => !p.isBot)) return x;
      if (x.mode === "classic")
        return {
          ...x,
          phase: "playing",
          guessed: {},
          turn: 0,
          winnerId: undefined,
          lastConquest: undefined,
          players: x.players.map((p) => ({ ...p, lives: 3, alive: true, count: 0 })),
          turnEndsAt: Date.now() + x.turnSeconds * 1000,
          feed: [
            {
              id: ++fid,
              text: `Comienza la partida · ${countriesIn(x.region).length} ${territoryPlural(x.region)}`,
              tone: "info",
            },
          ],
        };

      // Conquista: cada jugador arranca en su territorio de salida.
      const players = assignCapitals(x);
      const guessed: Record<string, string> = {};
      for (const p of players) if (p.capital) guessed[p.capital] = p.id;
      const opening: FeedItem[] = [
        {
          id: ++fid,
          text: `Comienza la conquista · ${countriesIn(x.region).length} ${territoryPlural(x.region)}`,
          tone: "info",
        },
        ...players
          .filter((p) => p.capital)
          .map((p) => ({
            id: ++fid,
            text: `${p.name} sale desde ${territoryName(p.capital!)}`,
            tone: "info" as const,
          })),
      ];
      return {
        ...x,
        phase: "playing",
        guessed,
        turn: 0,
        winnerId: undefined,
        lastConquest: undefined,
        players: players.map((p) => ({ ...p, lives: 3, alive: true, count: p.capital ? 1 : 0 })),
        turnEndsAt: Date.now() + x.turnSeconds * 1000,
        feed: opening,
      };
    });
  const backToLobby = () => setS((x) => ({ ...x, phase: "lobby" }));

  const guess = useCallback((input: string, fromId?: string): { ok: boolean; msg: string } => {
    const x = ref.current;
    if (x.phase !== "playing") return { ok: false, msg: "" };
    if (fromId && x.players[x.turn]?.id !== fromId) return { ok: false, msg: "No es tu turno" };
    const p = x.players[x.turn];
    if (!p) return { ok: false, msg: "No hay jugador activo" };
    const c = matchCountry(input, x.region);
    if (!c) {
      const any = isSpain(x.region) ? null : matchAny(input);
      const why = any ? `${any.name} no está en esta región` : `"${input}" no reconocido`;
      setS(loseLife(x, why));
      return { ok: false, msg: why };
    }
    if (x.guessed[c.a2]) {
      const why = `${c.name} ya fue dicho`;
      setS(loseLife(x, why));
      return { ok: false, msg: why };
    }
    if (x.mode === "conquest") {
      const moves = movesFor(x.region, x.guessed, p.id);
      if (!canClaim(moves, c.a2)) {
        const why = moves.fallback
          ? `${c.name} no es de los más cercanos`
          : `${c.name} no toca tu territorio`;
        setS(loseLife(x, why));
        return { ok: false, msg: why };
      }
    }
    sfx.win();
    const players = x.players.map((q, i) => (i === x.turn ? { ...q, count: q.count + 1 } : q));
    const n = feed(
      {
        ...x,
        players,
        guessed: { ...x.guessed, [c.a2]: p.id },
        lastConquest: { a2: c.a2, at: Date.now() },
      },
      `${p.name} conquista ${c.name}`,
      "good",
    );
    setS(nextTurn(n));
    return { ok: true, msg: `¡${c.name}!` };
  }, []);

  // Timer + bots
  useEffect(() => {
    if (s.phase !== "playing") return;
    const p = s.players[s.turn];
    let lastTick = -1;
    const iv = setInterval(() => {
      const left = Math.ceil((ref.current.turnEndsAt - Date.now()) / 1000);
      if (left <= 5 && left > 0 && left !== lastTick) {
        lastTick = left;
        sfx.tick();
      }
      if (left <= 0) {
        clearInterval(iv);
        setS((x) => loseLife(x, "tiempo agotado"));
      }
    }, 200);
    let bt: ReturnType<typeof setTimeout> | undefined;
    if (p?.isBot) {
      bt = setTimeout(
        () => {
          const x = ref.current;
          let pool: { a2: string; name: string }[];
          if (x.mode === "conquest") {
            // El bot solo puede tirar de su frontera (o de los más cercanos si no tiene).
            const moves = movesFor(x.region, x.guessed, p.id);
            const allowed = new Set([...moves.frontier, ...moves.nearest]);
            pool = countriesIn(x.region).filter((c) => allowed.has(c.a2));
          } else {
            pool = countriesIn(x.region).filter((c) => !x.guessed[c.a2]);
          }
          const fail = { easy: 0.2, medium: 0.1, hard: 0.03 }[p.difficulty ?? "medium"];
          let candidates = pool;
          if (p.difficulty === "easy" && !isSpain(x.region))
            candidates = pool.filter((c) => FAMOUS.has(c.a2));
          else if (p.difficulty === "medium") {
            const famous = pool.filter((c) => FAMOUS.has(c.a2) || Math.random() < 0.5);
            if (famous.length) candidates = famous;
          }
          if (!candidates.length || Math.random() < fail) {
            const said = Object.keys(x.guessed);
            const repeated = said[Math.floor(Math.random() * said.length)];
            guess((repeated && COUNTRY_BY_A2[repeated]?.name) || "Atlantida");
          } else {
            const choice = candidates[Math.floor(Math.random() * candidates.length)];
            if (choice) guess(choice.name);
          }
        },
        3000 + Math.random() * 7000,
      );
    }
    return () => {
      clearInterval(iv);
      if (bt) clearTimeout(bt);
    };
  }, [s.phase, s.turn, s.turnEndsAt, s.players, guess]);

  return {
    s,
    setMode,
    setRegion,
    addPlayer,
    removePlayer,
    setCapital,
    randomCapital,
    start,
    guess,
    backToLobby,
  };
}
