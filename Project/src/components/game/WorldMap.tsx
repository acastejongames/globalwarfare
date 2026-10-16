import { useMemo } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { COUNTRY_BY_A2, countriesIn, featureToA2, type Region } from "@/lib/geo/countries";
import type { Player } from "@/lib/game/useGame";
import { mapTransform, useMapView } from "./useMapView";

const W = 960,
  H = 500;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fc = feature(world as any, (world as any).objects.countries) as any;
const proj = geoNaturalEarth1().fitSize([W, H], fc);
const path = geoPath(proj);
const grat = path(geoGraticule10()) ?? "";
const shapes = (fc.features as { id?: string; properties: { name: string } }[]).map((f) => ({
  a2: featureToA2[f.id ?? f.properties.name],
  d: path(f as never) ?? "",
  c: path.centroid(f as never),
}));

export function WorldMap({
  guessed,
  players,
  region,
  lastConquest,
}: {
  guessed: Record<string, string>;
  players: Player[];
  region: Region;
  lastConquest?: { a2: string; at: number } | undefined;
}) {
  const { view, zoomBy, reset, svgProps } = useMapView();
  const inRegion = useMemo(() => new Set(countriesIn(region).map((c) => c.a2)), [region]);
  const colorOf = (pid: string) => players.find((p) => p.id === pid)?.color;
  const last = lastConquest && shapes.find((s) => s.a2 === lastConquest.a2);

  return (
    <div className="map-ocean relative h-full w-full overflow-hidden rounded-2xl">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        {...svgProps}
      >
        <g transform={mapTransform(view, W, H)}>
          <path d={grat} className="map-graticule" />
          {shapes.map((s, i) => {
            const owner = s.a2 && guessed[s.a2];
            const color = owner ? colorOf(owner) : undefined;
            return (
              <path
                key={i}
                d={s.d}
                className={`map-land ${s.a2 && inRegion.has(s.a2) ? "" : "map-land-out"} ${color ? "map-land-owned" : ""}`}
                style={color ? { fill: `var(--player-${color})` } : undefined}
                strokeWidth={0.5 / view.k}
              >
                {owner && s.a2 && <title>{COUNTRY_BY_A2[s.a2]?.name}</title>}
              </path>
            );
          })}
          {last && Date.now() - lastConquest!.at < 4000 && (
            <g
              key={lastConquest!.at}
              className="map-label"
              transform={`translate(${last.c[0]} ${last.c[1]})`}
            >
              <text textAnchor="middle" fontSize={12 / view.k}>
                {COUNTRY_BY_A2[last.a2!]?.name}
              </text>
            </g>
          )}
        </g>
      </svg>
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        {[
          ["+", 1.4],
          ["−", 1 / 1.4],
        ].map(([label, factor]) => (
          <button key={String(label)} className="map-ctrl" onClick={() => zoomBy(Number(factor))}>
            {String(label)}
          </button>
        ))}
        <button className="map-ctrl text-xs" onClick={reset}>
          ⟲
        </button>
      </div>
    </div>
  );
}
