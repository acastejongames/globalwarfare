import { countriesIn, type Country, type Region } from "@/lib/geo/countries";

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/^(el|la|los|las|republica de|reino de) /, "")
    .replace(/\s+/g, "")
    .trim();
}

function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0] ?? 0;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j] ?? j;
      d[j] = Math.min(t + 1, (d[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length] ?? 99;
}

export function matchCountry(input: string, region: Region): Country | null {
  const n = normalize(input);
  if (n.length < 2) return null;
  const list = countriesIn(region);
  for (const c of list) if (c.aliases.some((a) => normalize(a) === n)) return c;
  if (n.length >= 5) {
    let best: Country | null = null;
    let bestD = 99;
    for (const c of list)
      for (const a of c.aliases) {
        const d = lev(n, normalize(a));
        if (d < bestD) [bestD, best] = [d, c];
      }
    if (bestD <= (n.length >= 9 ? 2 : 1)) return best;
  }
  return null;
}

/** Any country, used to tell "wrong region" apart from "unknown" */
export function matchAny(input: string) {
  return matchCountry(input, "ALL");
}
