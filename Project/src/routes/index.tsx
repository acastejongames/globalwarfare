import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { WorldMap } from "@/components/game/WorldMap";
import { SpainMap } from "@/components/game/SpainMap";
import { useGame, type Difficulty, type GameState, type Player } from "@/lib/game/useGame";
import { newRoomCode, useGuest, useHost } from "@/lib/game/online";
import { REGION_LABELS, countriesIn, isSpain, type Region } from "@/lib/geo/countries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GeoTurno · Guerra mundial de países" },
      { name: "description", content: "Conquista el mapamundi nombrando países por turnos. 45 segundos, 3 vidas, último superviviente gana." },
      { property: "og:title", content: "GeoTurno · Guerra mundial de países" },
      { property: "og:description", content: "Juego por turnos para conquistar países en un mapa en blanco." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Mode = { kind: "home" } | { kind: "local" } | { kind: "host" | "guest"; code: string; name: string };

function Index() {
  const [mode, setMode] = useState<Mode>({ kind: "home" });
  const [myId] = useState(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : "x"));
  const exit = () => setMode({ kind: "home" });
  return (
    <main className="min-h-screen bg-background text-foreground">
      {mode.kind === "home" && <Home onPick={setMode} />}
      {mode.kind === "local" && <LocalGame exit={exit} />}
      {mode.kind === "host" && <HostGame code={mode.code} name={mode.name} myId={myId} exit={exit} />}
      {mode.kind === "guest" && <GuestGame code={mode.code} name={mode.name} myId={myId} exit={exit} />}
    </main>
  );
}

const noop = () => {};
interface G {
  s: GameState;
  canEdit: boolean;
  online?: { code: string; myId: string };
  setRegion: (r: Region) => void;
  addPlayer: (name: string, bot?: Difficulty) => void;
  removePlayer: (id: string) => void;
  start: () => void;
  backToLobby: () => void;
  guess: (t: string) => { ok: boolean; msg: string } | void;
  exit: () => void;
}

function Screens({ g }: { g: G }) {
  return g.s.phase === "lobby" ? <Lobby g={g} /> : <Match g={g} />;
}
function LocalGame({ exit }: { exit: () => void }) {
  const g = useGame();
  return <Screens g={{ ...g, canEdit: true, exit }} />;
}
function HostGame({ code, name, myId, exit }: { code: string; name: string; myId: string; exit: () => void }) {
  const g = useHost(code, myId, name);
  return <Screens g={{ ...g, canEdit: true, exit, online: { code, myId }, guess: (t) => g.guess(t, myId) }} />;
}
function GuestGame({ code, name, myId, exit }: { code: string; name: string; myId: string; exit: () => void }) {
  const g = useGuest(code, myId, name);
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 6000);
    return () => clearTimeout(t);
  }, []);
  if (!g.s)
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">{code}</p>
        <h2 className="mt-3 text-2xl font-bold">{late ? "No encontramos esa sala" : "Conectando con la sala…"}</h2>
        {late && <p className="mt-2 text-muted-foreground">Comprueba el código o pide al anfitrión que la mantenga abierta.</p>}
        <button onClick={exit} className="btn-ghost mt-6">Volver</button>
      </div>
    );
  return (
    <Screens
      g={{
        s: g.s, canEdit: false, online: { code, myId },
        setRegion: noop, addPlayer: noop, removePlayer: noop, start: noop, backToLobby: noop,
        guess: (t) => { g.guess(t); },
        exit: () => { g.leave(); exit(); },
      }}
    />
  );
}

function Home({ onPick }: { onPick: (m: Mode) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const n = name.trim();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm uppercase tracking-[0.3em] text-primary">GeoTurno</p>
      <h1 className="mt-2 text-4xl font-extrabold md:text-6xl">Guerra mundial de países</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Por turnos, nombra un país que nadie haya dicho. 45 segundos. 3 vidas. El último en pie gana.
      </p>
      <section className="panel mt-10 p-6">
        <h2 className="font-bold">Jugar online</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={16} className="field mt-3 w-full" />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <button disabled={!n} onClick={() => onPick({ kind: "host", code: newRoomCode(), name: n })} className="btn-primary disabled:opacity-40">
            Crear sala
          </button>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (n && code.trim()) onPick({ kind: "guest", code: normalizeCode(code), name: n }); }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MUNDO-482" className="field min-w-0 flex-1 uppercase" />
            <button disabled={!n || !code.trim()} className="btn-ghost disabled:opacity-40">Unirse</button>
          </form>
        </div>
      </section>
      <section className="panel mt-4 flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <h2 className="font-bold">Jugar en local</h2>
          <p className="text-sm text-muted-foreground">Varias personas en este dispositivo, pasándose el turno, y bots.</p>
        </div>
        <button onClick={() => onPick({ kind: "local" })} className="btn-ghost">Partida local</button>
      </section>
    </div>
  );
}
const normalizeCode = (c: string) => {
  const d = c.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^MUNDO/, "");
  return `MUNDO-${d}`;
};

function Hearts({ n }: { n: number }) {
  return (
    <span className="tracking-tight">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? "text-destructive" : "text-muted-foreground/30"}>♥</span>
      ))}
    </span>
  );
}
const Dot = ({ p }: { p: Player }) => (
  <span className="inline-block h-3 w-3 rounded-full" style={{ background: `var(--player-${p.color})` }} />
);

function Lobby({ g }: { g: G }) {
  const { s } = g;
  const [name, setName] = useState("");
  const [diff, setDiff] = useState<Difficulty>("medium");
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <button onClick={g.exit} className="text-sm text-muted-foreground hover:text-foreground">← Salir</button>
      {g.online ? (
        <div className="mt-4">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Código de sala</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-5xl font-extrabold tracking-wider text-primary tabular-nums">{g.online.code}</h1>
            <button onClick={() => navigator.clipboard?.writeText(g.online!.code)} className="btn-ghost text-sm">Copiar</button>
          </div>
          <p className="mt-2 text-muted-foreground">Comparte este código para que tus amigos se unan desde su dispositivo.</p>
        </div>
      ) : (
        <h1 className="mt-4 text-4xl font-extrabold">Partida local</h1>
      )}

      <section className="panel mt-10 p-6">
        <h2 className="font-bold">Región</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(REGION_LABELS) as Region[]).map((r) => (
            <button key={r} disabled={!g.canEdit} onClick={() => g.setRegion(r)} className={`chip ${s.region === r ? "chip-on" : ""}`}>
              {REGION_LABELS[r]} <span className="opacity-60">· {countriesIn(r).length}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel mt-4 p-6">
        <h2 className="font-bold">Jugadores ({s.players.length}/6)</h2>
        <ul className="mt-3 space-y-2">
          {s.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2">
              <Dot p={p} />
              <span className="font-semibold">{p.name}</span>
              {p.isBot && <span className="text-xs text-muted-foreground">Bot · {{ easy: "Fácil", medium: "Medio", hard: "Experto" }[p.difficulty!]}</span>}
              {g.online?.myId === p.id && <span className="text-xs text-primary">Tú</span>}
              {g.canEdit && g.online?.myId !== p.id && <button onClick={() => g.removePlayer(p.id)} className="ml-auto text-sm text-muted-foreground hover:text-destructive">Quitar</button>}
            </li>
          ))}
        </ul>
        {g.canEdit && <>
        {!g.online && <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) g.addPlayer(name.trim());
            setName("");
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del jugador" className="field flex-1" maxLength={16} />
          <button className="btn-primary">Añadir</button>
        </form>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)} className="field">
            <option value="easy">Fácil</option>
            <option value="medium">Medio</option>
            <option value="hard">Experto</option>
          </select>
          <button onClick={() => g.addPlayer("", diff)} className="btn-ghost">+ Añadir bot</button>
        </div>
        </>}
      </section>

      {g.canEdit ? (
        <button disabled={!s.players.some((p) => !p.isBot)} onClick={g.start} className="btn-primary mt-6 w-full py-4 text-lg disabled:opacity-40">
          Comenzar partida
        </button>
      ) : (
        <p className="mt-6 text-center text-muted-foreground">Esperando a que el anfitrión empiece la partida…</p>
      )}
    </div>
  );
}

function Timer({ endsAt, total }: { endsAt: number; total: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);
  const left = Math.max(0, (endsAt - now) / 1000);
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} className="timer-track" />
        <circle cx="32" cy="32" r={r} className={left <= 5 ? "timer-bar timer-danger" : "timer-bar"} strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} />
      </svg>
      <span className={`absolute inset-0 grid place-items-center font-bold tabular-nums ${left <= 5 ? "text-destructive" : ""}`}>{Math.ceil(left)}</span>
    </div>
  );
}

function Match({ g }: { g: G }) {
  const { s } = g;
  const cur = s.players[s.turn];
  const [val, setVal] = useState("");
  const [fb, setFb] = useState<{ ok: boolean; msg: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const human = s.phase === "playing" && !!cur && !cur.isBot && (!g.online || cur.id === g.online.myId);
  useEffect(() => {
    if (human) input.current?.focus();
  }, [human, s.turn, s.turnEndsAt]);
  const winner = s.players.find((p) => p.id === s.winnerId);
  const total = countriesIn(s.region).length;

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 md:p-5">
      <header className="panel flex flex-wrap items-center gap-4 px-4 py-3">
        <button onClick={g.exit} className="text-sm text-muted-foreground hover:text-foreground">←</button>
        <div className="font-extrabold">GeoTurno <span className="font-normal text-muted-foreground">· {REGION_LABELS[s.region]} · {Object.keys(s.guessed).length}/{total}</span></div>
        <div className="flex flex-1 flex-wrap gap-2">
          {s.players.map((p, i) => (
            <div key={p.id} className={`player-pill ${i === s.turn && s.phase === "playing" ? "player-pill-active" : ""} ${!p.alive ? "opacity-40" : ""}`}>
              <Dot p={p} />
              <span className="font-semibold">{p.name}</span>
              <Hearts n={p.lives} />
              <span className="tabular-nums text-muted-foreground">{p.count}</span>
            </div>
          ))}
        </div>
        {s.phase === "playing" && <Timer key={s.turnEndsAt} endsAt={s.turnEndsAt} total={s.turnSeconds} />}
      </header>

      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_280px]">
        <div className="relative min-h-[50vh]">
          {isSpain(s.region) ? (
            <SpainMap guessed={s.guessed} players={s.players} region={s.region} lastConquest={s.lastConquest} />
          ) : (
            <WorldMap guessed={s.guessed} players={s.players} region={s.region} lastConquest={s.lastConquest} />
          )}
          {s.phase === "over" && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/70 backdrop-blur-sm">
              <div className="panel max-w-sm p-8 text-center">
                <p className="text-sm uppercase tracking-widest text-muted-foreground">Fin de la partida</p>
                <h2 className="mt-2 text-3xl font-extrabold">{winner ? `¡${winner.name} gana!` : "Sin supervivientes"}</h2>
                <ol className="mt-5 space-y-1 text-left">
                  {[...s.players].sort((a, b) => b.count - a.count).map((p) => (
                    <li key={p.id} className="flex items-center gap-2"><Dot p={p} />{p.name}<span className="ml-auto tabular-nums">{p.count} países</span></li>
                  ))}
                </ol>
                {g.canEdit ? <div className="mt-6 flex gap-2">
                  <button onClick={g.start} className="btn-primary flex-1">Otra ronda</button>
                  <button onClick={g.backToLobby} className="btn-ghost flex-1">Sala</button>
                </div> : <button onClick={g.exit} className="btn-ghost mt-6 w-full">Salir</button>}
              </div>
            </div>
          )}
        </div>
        <aside className="panel max-h-[70vh] overflow-y-auto p-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Crónica</h3>
          <ul className="space-y-1.5 text-sm">
            {s.feed.map((f) => (
              <li key={f.id} className={f.tone === "good" ? "text-foreground" : f.tone === "bad" ? "text-destructive" : "text-primary"}>{f.text}</li>
            ))}
          </ul>
        </aside>
      </div>

      {s.phase === "playing" && cur && (
        <form
          className="panel flex flex-wrap items-center gap-3 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!val.trim() || !human) return;
            setFb(g.guess(val.trim()) ?? null);
            setVal("");
          }}
        >
          <span className="flex items-center gap-2 font-bold"><Dot p={cur} />{human ? (g.online ? "¡Tu turno!" : `Turno de ${cur.name}`) : cur.isBot ? `${cur.name} está pensando…` : `Turno de ${cur.name}`}</span>
          <input ref={input} disabled={!human} value={val} onChange={(e) => setVal(e.target.value)} placeholder="Escribe un país…" className="field min-w-[200px] flex-1" autoComplete="off" />
          <button disabled={!human} className="btn-primary disabled:opacity-40">Enviar país</button>
          {fb && <span className={fb.ok ? "text-primary" : "text-destructive"}>{fb.msg}</span>}
        </form>
      )}
    </div>
  );
}
