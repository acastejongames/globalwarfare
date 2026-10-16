import {
  geoConicConformal,
  geoGraticule,
  geoMercator,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import communities from "@/lib/geo/data/spain-communities.json";
import provinces from "@/lib/geo/data/spain-provinces.json";
import type { SpainRegion } from "@/lib/geo/countries";

export const W = 1100;
export const H = 700;
const PAD = 26;

// Canarias cae fuera del encuadre peninsular (27,6°N-29,5°N), así que va en un recuadro.
export const INSET_W = 268;
export const INSET_H = 156;
const INSET_MARGIN = 18;
const INSET_PAD = 12;
const INSET_LABEL = 22;
const CANARY_IDS = new Set(["ES-P-35", "ES-P-38", "ES-C-04"]);

type Position = [number, number];
type Bounds = [Position, Position];

interface SpainFeature {
  properties: { id: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

export interface Shape {
  id: string;
  d: string;
  centroid: Position;
  bounds: Bounds;
}

export interface SpainGeometry {
  main: Shape[];
  inset: Shape[];
  box: { x: number; y: number };
  mainGraticule: string;
  insetGraticule: string;
}

// Cono conforme centrado en el meridiano de Madrid (-3,5°): el meridiano sale vertical.
const mainProjection = geoConicConformal().parallels([38, 42]).rotate([3.5, 0]);
const insetProjection = geoMercator();

function pickInsetBox(bounds: Bounds[]) {
  const corners = [
    { x: W - INSET_W - INSET_MARGIN, y: H - INSET_H - INSET_MARGIN },
    { x: INSET_MARGIN, y: H - INSET_H - INSET_MARGIN },
    { x: W - INSET_W - INSET_MARGIN, y: INSET_MARGIN },
    { x: INSET_MARGIN, y: INSET_MARGIN },
  ];
  let best = { ...corners[0]!, hits: Number.POSITIVE_INFINITY };
  for (const c of corners) {
    const hits = bounds.filter(
      ([[x0, y0], [x1, y1]]) => x0 < c.x + INSET_W && c.x < x1 && y0 < c.y + INSET_H && c.y < y1,
    ).length;
    if (hits < best.hits) best = { ...c, hits };
    if (hits === 0) break;
  }
  return { x: best.x, y: best.y };
}

function shapesOf(features: SpainFeature[], path: ReturnType<typeof geoPath>): Shape[] {
  return features.map((f) => ({
    id: f.properties.id,
    d: path(f as unknown as GeoPermissibleObjects) ?? "",
    centroid: path.centroid(f as unknown as GeoPermissibleObjects),
    bounds: path.bounds(f as unknown as GeoPermissibleObjects) as Bounds,
  }));
}

function build(region: SpainRegion): SpainGeometry {
  const source = (region === "SPAIN_COMMUNITIES" ? communities : provinces) as unknown as {
    features: SpainFeature[];
  };
  const mainland: SpainFeature[] = [];
  const canary: SpainFeature[] = [];
  for (const f of source.features) (CANARY_IDS.has(f.properties.id) ? canary : mainland).push(f);

  const mainlandFC = {
    type: "FeatureCollection",
    features: mainland,
  } as unknown as GeoPermissibleObjects;
  mainProjection.fitExtent(
    [
      [PAD, PAD],
      [W - PAD, H - PAD],
    ],
    mainlandFC,
  );
  const mainPath = geoPath(mainProjection);
  const main = shapesOf(mainland, mainPath);

  const canaryFC = {
    type: "FeatureCollection",
    features: canary,
  } as unknown as GeoPermissibleObjects;
  insetProjection.fitExtent(
    [
      [INSET_PAD, INSET_PAD],
      [INSET_W - INSET_PAD, INSET_H - INSET_LABEL - INSET_PAD],
    ],
    canaryFC,
  );
  const insetPath = geoPath(insetProjection);

  return {
    main,
    inset: shapesOf(canary, insetPath),
    box: pickInsetBox(main.map((s) => s.bounds)),
    mainGraticule:
      mainPath(
        geoGraticule()
          .step([1, 1])
          .extent([
            [-11, 33],
            [6, 45],
          ]) as unknown as GeoPermissibleObjects,
      ) ?? "",
    insetGraticule:
      insetPath(
        geoGraticule()
          .step([1, 1])
          .extent([
            [-19, 26],
            [-12, 31],
          ]) as unknown as GeoPermissibleObjects,
      ) ?? "",
  };
}

const cache = new Map<SpainRegion, SpainGeometry>();
export function spainGeometry(region: SpainRegion) {
  let geo = cache.get(region);
  if (!geo) {
    geo = build(region);
    cache.set(region, geo);
  }
  return geo;
}
