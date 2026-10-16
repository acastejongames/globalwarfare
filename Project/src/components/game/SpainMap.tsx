import { useId, useMemo } from "react";
import { COUNTRY_BY_A2, type SpainRegion } from "@/lib/geo/countries";
import { H, INSET_H, INSET_W, W, spainGeometry, type Shape } from "@/lib/geo/spainGeometry";
import type { Player } from "@/lib/game/useGame";
import { mapTransform, useMapView } from "./useMapView";

export function SpainMap({
  guessed,
  players,
  region,
  lastConquest,
  frontier,
  targets,
}: {
  guessed: Record<string, string>;
  players: Player[];
  region: SpainRegion;
  lastConquest?: { a2: string; at: number } | undefined;
  /** Territorios en contacto con lo que posee el jugador en turno (modo conquista). */
  frontier?: readonly string[] | undefined;
  /** Territorios a los que puede saltar si no tiene frontera. */
  targets?: readonly string[] | undefined;
}) {
  const geo = useMemo(() => spainGeometry(region), [region]);
  const { view, zoomBy, reset, svgProps } = useMapView();
  const uid = useId();
  const mainClip = `${uid}-main`;
  const insetClip = `${uid}-inset`;

  const colorOf = (pid: string) => players.find((p) => p.id === pid)?.color;
  const frontierSet = useMemo(() => new Set(frontier ?? []), [frontier]);
  const targetSet = useMemo(() => new Set(targets ?? []), [targets]);
  const last = lastConquest;

  const renderShapes = (shapes: Shape[], showZoom: boolean) =>
    shapes.map((s) => {
      const owner = guessed[s.id];
      const color = owner ? colorOf(owner) : undefined;
      return (
        <path
          key={s.id}
          d={s.d}
          className={`map-land ${color ? "map-land-owned" : ""} ${
            frontierSet.has(s.id) ? "map-land-frontier" : ""
          } ${targetSet.has(s.id) ? "map-land-target" : ""}`}
          style={color ? { fill: `var(--player-${color})` } : undefined}
          strokeWidth={showZoom ? 0.5 / view.k : 0.5}
        >
          {owner && <title>{COUNTRY_BY_A2[s.id]?.name ?? s.id}</title>}
        </path>
      );
    });

  const renderLabel = (shapes: Shape[]) => {
    const shape = last ? shapes.find((s) => s.id === last.a2) : undefined;
    if (!shape || !last || Date.now() - last.at >= 4000) return null;
    return (
      <g
        key={last.at}
        className="map-label"
        transform={`translate(${shape.centroid[0]} ${shape.centroid[1]})`}
      >
        <text textAnchor="middle" fontSize={12 / view.k}>
          {COUNTRY_BY_A2[shape.id]?.name ?? shape.id}
        </text>
      </g>
    );
  };

  const controlsTop = geo.box.y + INSET_H / 2 > H / 2;

  return (
    <div className="map-ocean relative h-full w-full overflow-hidden rounded-2xl">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        {...svgProps}
      >
        <defs>
          <clipPath id={mainClip}>
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
          {/* Dentro del grupo trasladado, así que el recorte va en coordenadas locales. */}
          <clipPath id={insetClip}>
            <rect x="0" y="0" width={INSET_W} height={INSET_H} rx="10" />
          </clipPath>
        </defs>

        <g clipPath={`url(#${mainClip})`}>
          <g transform={mapTransform(view, W, H)}>
            <path d={geo.mainGraticule} className="map-graticule" />
            {renderShapes(geo.main, true)}
            {renderLabel(geo.main)}
          </g>
        </g>

        <g transform={`translate(${geo.box.x} ${geo.box.y})`}>
          <rect className="map-inset" width={INSET_W} height={INSET_H} rx="10" />
          <g clipPath={`url(#${insetClip})`}>
            <path d={geo.insetGraticule} className="map-graticule" />
            {renderShapes(geo.inset, false)}
            {renderLabel(geo.inset)}
          </g>
          <text className="map-inset-label" x="14" y={INSET_H - 10}>
            Canarias
          </text>
        </g>
      </svg>
      <div className={`absolute right-3 flex flex-col gap-1 ${controlsTop ? "top-3" : "bottom-3"}`}>
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
