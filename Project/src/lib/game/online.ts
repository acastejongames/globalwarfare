import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useGame, type GameState } from "./useGame";

export const newRoomCode = () => `MUNDO-${Math.floor(100 + Math.random() * 900)}`;

function useChannel(code: string, onMsg: (event: string, payload: any) => void, onReady: (ch: RealtimeChannel) => void) {
  const chRef = useRef<RealtimeChannel | null>(null);
  const cb = useRef(onMsg);
  cb.current = onMsg;
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const ch = supabase.channel(`geoturno:${code}`, { config: { broadcast: { self: false } } });
    for (const ev of ["state", "join", "guess", "hello", "leave"])
      ch.on("broadcast", { event: ev }, ({ payload }) => cb.current(ev, payload));
    ch.subscribe((st) => {
      if (st === "SUBSCRIBED") ready.current(ch);
    });
    chRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [code]);
  return chRef;
}

/** Host runs the authoritative engine (timer, bots, validation) and broadcasts state. */
export function useHost(code: string, myId: string, myName: string) {
  const g = useGame();
  const ch = useChannel(
    code,
    (ev, p) => {
      if (ev === "join" && g.s.phase === "lobby") g.addPlayer(String(p.name).slice(0, 16), undefined, p.id);
      if (ev === "hello" || ev === "join") send();
      if (ev === "guess") g.guess(String(p.text).slice(0, 60), p.id);
      if (ev === "leave" && g.s.phase === "lobby") g.removePlayer(p.id);
    },
    () => send(),
  );
  const send = () => ch.current?.send({ type: "broadcast", event: "state", payload: { s: stateRef.current } });
  const stateRef = useRef(g.s);
  stateRef.current = g.s;
  useEffect(() => {
    if (!g.s.players.some((p) => p.id === myId)) g.addPlayer(myName, undefined, myId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.s]);
  return g;
}

export function useGuest(code: string, myId: string, myName: string) {
  const [s, setS] = useState<GameState | null>(null);
  const [hostSeen, setHostSeen] = useState(false);
  const ch = useChannel(
    code,
    (ev, p) => {
      if (ev === "state") {
        setS(p.s);
        setHostSeen(true);
      }
    },
    (c) => {
      c.send({ type: "broadcast", event: "join", payload: { id: myId, name: myName } });
    },
  );
  const sRef = useRef(s);
  sRef.current = s;
  // Keep asking to join until the host lists us
  useEffect(() => {
    const i = setInterval(() => {
      const st = sRef.current;
      if (!st || (st.phase === "lobby" && !st.players.some((p) => p.id === myId)))
        ch.current?.send({ type: "broadcast", event: "join", payload: { id: myId, name: myName } });
    }, 2000);
    return () => clearInterval(i);
  }, [ch, myId, myName]);
  return {
    s,
    hostSeen,
    guess: (text: string) => ch.current?.send({ type: "broadcast", event: "guess", payload: { id: myId, text } }),
    leave: () => ch.current?.send({ type: "broadcast", event: "leave", payload: { id: myId } }),
  };
}
