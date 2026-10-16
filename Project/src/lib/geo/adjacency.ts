import { geoCentroid, geoDistance } from "d3-geo";
import { feature, neighbors } from "topojson-client";
import world from "world-atlas/countries-110m.json";

import { countriesIn, featureToA2, isSpain, type Region } from "./countries";
import communities from "./data/spain-communities.json";
import provinces from "./data/spain-provinces.json";

/**
 * Fronteras entre territorios, que es la base del modo conquista.
 *
 * - Países: los arcos compartidos del TopoJSON de world-atlas. Al ser una malla
 *   topológica, dos países son vecinos exactamente cuando comparten arco.
 * - Provincias y comunidades: no vienen de un TopoJSON, pero sí de un mismo
 *   fichero simplificado, así que las fronteras comparten las mismas coordenadas;
 *   se emparejan las aristas idénticas.
 *
 * Los territorios aislados (islas, como Australia, Japón o Baleares) se quedan
 * sin vecinos: el juego los cubre con la regla de "los más cercanos".
 */

type Position = [number, number];

interface Graph {
  adjacency: Map<string, Set<string>>;
  centroids: Map<string, Position>;
}

interface Geom {
  id?: string | number | undefined;
  properties: { name: string };
}

interface SpainFeature {
  properties: { id: string };
  geometry: { type: string; coordinates: unknown };
}

const EARTH_RADIUS_KM = 6371;

/**
 * Fronteras reales que este mapa (110m) no dibuja: enclaves y microestados que
 * la simplificación elimina. Solo se añaden cuando los dos territorios existen
 * en el dataset; los microestados (Andorra, Mónaco, San Marino, Liechtenstein,
 * Vaticano) no están, así que no hacen falta.
 */
const UNDRAWN_BORDERS: readonly (readonly [string, string])[] = [
  ["ES", "MA"], // Ceuta y Melilla
];

const link = (graph: Map<string, Set<string>>, a: string, b: string) => {
  const set = graph.get(a) ?? new Set<string>();
  set.add(b);
  graph.set(a, set);
};

let worldGraph: Graph | undefined;

function graphOfWorld(): Graph {
  if (worldGraph) return worldGraph;
  const topology = world as unknown as { objects: { countries: { geometries: Geom[] } } };
  const geometries = topology.objects.countries.geometries;
  const neighbourIndexes = neighbors(geometries as never);
  const features = (
    feature(topology as never, topology.objects.countries as never) as unknown as {
      features: unknown[];
    }
  ).features;

  const adjacency = new Map<string, Set<string>>();
  const centroids = new Map<string, Position>();
  geometries.forEach((geometry, index) => {
    const a2 = featureToA2[geometry.id ?? geometry.properties.name];
    if (!a2) return;
    if (!centroids.has(a2)) centroids.set(a2, geoCentroid(features[index] as never) as Position);
    for (const other of neighbourIndexes[index] ?? []) {
      const neighbourGeometry = geometries[other];
      if (!neighbourGeometry) continue;
      const otherA2 = featureToA2[neighbourGeometry.id ?? neighbourGeometry.properties.name];
      if (otherA2 && otherA2 !== a2) link(adjacency, a2, otherA2);
    }
  });

  for (const [a, b] of UNDRAWN_BORDERS) {
    if (centroids.has(a) && centroids.has(b)) {
      link(adjacency, a, b);
      link(adjacency, b, a);
    }
  }

  worldGraph = { adjacency, centroids };
  return worldGraph;
}

const ringsOf = (feature_: SpainFeature): Position[][] => {
  const { type, coordinates } = feature_.geometry;
  const polygons = (type === "MultiPolygon" ? coordinates : [coordinates]) as Position[][][];
  return polygons.flat();
};

const vertexKey = (position: Position) => `${position[0]?.toFixed(4)},${position[1]?.toFixed(4)}`;

function graphOfFeatures(source: { features: SpainFeature[] }): Graph {
  const adjacency = new Map<string, Set<string>>();
  const centroids = new Map<string, Position>();
  const byEdge = new Map<string, string[]>();

  for (const item of source.features) {
    const id = item.properties.id;
    centroids.set(id, geoCentroid(item as never) as Position);
    for (const ring of ringsOf(item)) {
      for (let i = 0; i < ring.length - 1; i++) {
        const from = ring[i];
        const to = ring[i + 1];
        if (!from || !to) continue;
        const a = vertexKey(from);
        const b = vertexKey(to);
        if (a === b) continue;
        const edge = a < b ? `${a}|${b}` : `${b}|${a}`;
        const owners = byEdge.get(edge);
        if (owners) owners.push(id);
        else byEdge.set(edge, [id]);
      }
    }
  }

  // Una arista compartida por dos territorios es una frontera; el resto son costas.
  for (const owners of byEdge.values()) {
    const [a, b] = owners;
    if (owners.length !== 2 || !a || !b || a === b) continue;
    link(adjacency, a, b);
    link(adjacency, b, a);
  }

  return { adjacency, centroids };
}

const spainGraphs = new Map<Region, Graph>();

function graphFor(region: Region): Graph {
  if (!isSpain(region)) return graphOfWorld();
  let graph = spainGraphs.get(region);
  if (!graph) {
    const source = (region === "SPAIN_COMMUNITIES" ? communities : provinces) as unknown as {
      features: SpainFeature[];
    };
    graph = graphOfFeatures(source);
    spainGraphs.set(region, graph);
  }
  return graph;
}

/** Territorios que tocan a `a2` y además forman parte de la región jugada. */
export function neighborsOf(region: Region, a2: string): string[] {
  const allowed = new Set(countriesIn(region).map((country) => country.a2));
  return [...(graphFor(region).adjacency.get(a2) ?? [])].filter((id) => allowed.has(id)).sort();
}

/** Distancia en km entre los centros de dos territorios (Infinity si falta alguno). */
export function distanceKm(region: Region, a: string, b: string): number {
  const centroids = graphFor(region).centroids;
  const from = centroids.get(a);
  const to = centroids.get(b);
  if (!from || !to) return Number.POSITIVE_INFINITY;
  return geoDistance(from, to) * EARTH_RADIUS_KM;
}
