let ctx: AudioContext | null = null;
function tone(freqs: number[], dur = 0.15, type: OscillatorType = "sine", gap = 0.09) {
  if (typeof window === "undefined") return;
  ctx ??= new AudioContext();
  freqs.forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    const t = ctx!.currentTime + i * gap;
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx!.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  });
}
export const sfx = {
  tick: () => tone([880], 0.06, "square"),
  win: () => tone([523, 659, 784], 0.2, "triangle"),
  lose: () => tone([330, 277, 220], 0.3, "sawtooth", 0.12),
};
