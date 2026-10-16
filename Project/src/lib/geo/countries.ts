import countriesLib from "i18n-iso-countries";
import es from "i18n-iso-countries/langs/es.json";
import world from "world-atlas/countries-110m.json";
import { SPAIN_COMMUNITIES, SPAIN_PROVINCES } from "./spain";

countriesLib.registerLocale(es);

type Continent = "EUROPE" | "AMERICA" | "ASIA" | "AFRICA" | "OCEANIA";
export type Region = "ALL" | Continent | "SPAIN_COMMUNITIES" | "SPAIN_PROVINCES";

export const REGION_LABELS: Record<Region, string> = {
  ALL: "Todo el mundo",
  EUROPE: "Europa",
  AMERICA: "América",
  ASIA: "Asia",
  AFRICA: "África",
  OCEANIA: "Oceanía",
  SPAIN_COMMUNITIES: "Comunidades de España",
  SPAIN_PROVINCES: "Provincias de España",
};

export type SpainRegion = "SPAIN_COMMUNITIES" | "SPAIN_PROVINCES";

export function isSpain(region: Region): region is SpainRegion {
  return region === "SPAIN_COMMUNITIES" || region === "SPAIN_PROVINCES";
}
export const territoryPlural = (region: Region) => region === "SPAIN_COMMUNITIES" ? "comunidades" : region === "SPAIN_PROVINCES" ? "provincias" : "países";
export const territorySingular = (region: Region) => region === "SPAIN_COMMUNITIES" ? "una comunidad" : region === "SPAIN_PROVINCES" ? "una provincia" : "un país";

const C: Record<Continent, string> = {
  EUROPE:
    "AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA",
  AMERICA:
    "AG AR BS BB BZ BO BR CA CL CO CR CU DM DO EC SV GD GT GY HT HN JM MX NI PA PY PE KN LC VC SR TT US UY VE PR GL FK",
  ASIA:
    "AF AM AZ BH BD BT BN KH CN GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
  AFRICA:
    "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH",
  OCEANIA: "AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU NC",
};

const continentOf: Record<string, Continent> = {};
for (const [k, v] of Object.entries(C)) for (const a of v.split(" ")) continentOf[a] = k as Continent;

const EXTRA: Record<string, string[]> = {
  US: ["Estados Unidos", "EEUU", "EE UU", "USA", "Estados Unidos de America"],
  GB: ["Reino Unido", "Inglaterra", "Gran Bretaña", "UK"],
  NL: ["Países Bajos", "Holanda"],
  RU: ["Rusia", "Federación Rusa"],
  CZ: ["Chequia", "República Checa"],
  KR: ["Corea del Sur", "Corea"],
  KP: ["Corea del Norte"],
  CD: ["República Democrática del Congo", "RD Congo", "Congo Kinsasa"],
  CG: ["Congo", "República del Congo", "Congo Brazzaville"],
  CI: ["Costa de Marfil"],
  MM: ["Myanmar", "Birmania"],
  SZ: ["Esuatini", "Suazilandia"],
  MK: ["Macedonia del Norte", "Macedonia"],
  TL: ["Timor Oriental"],
  IR: ["Irán"],
  SY: ["Siria"],
  LA: ["Laos"],
  VN: ["Vietnam"],
  BO: ["Bolivia"],
  VE: ["Venezuela"],
  TZ: ["Tanzania"],
  MD: ["Moldavia"],
  PS: ["Palestina"],
  TW: ["Taiwán"],
  XK: ["Kosovo"],
  EH: ["Sáhara Occidental"],
  BA: ["Bosnia", "Bosnia y Herzegovina"],
  DO: ["República Dominicana"],
  CF: ["República Centroafricana"],
  SS: ["Sudán del Sur"],
  FK: ["Malvinas", "Islas Malvinas"],
  GL: ["Groenlandia"],
  NC: ["Nueva Caledonia"],
  SB: ["Islas Salomón"],
  TR: ["Turquía"],
  BN: ["Brunéi"],
};

export interface Country {
  id: string; // numeric topo id
  a2: string;
  name: string;
  region: Exclude<Region, "ALL">;
  aliases: string[];
}

// world-atlas features without numeric ids
const NAME_FIX: Record<string, string> = { Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" };

type Geo = { id?: string; properties: { name: string } };
const geoms = (world as unknown as { objects: { countries: { geometries: Geo[] } } }).objects.countries.geometries;

export const COUNTRIES: Country[] = [];
export const featureToA2: Record<string, string> = {};
for (const g of geoms) {
  const a2 = (g.id && countriesLib.numericToAlpha2(g.id)) || NAME_FIX[g.properties.name];
  if (!a2) continue;
  featureToA2[g.id ?? g.properties.name] = a2;
  if (COUNTRIES.some((c) => c.a2 === a2)) continue;
  const region = continentOf[a2];
  if (!region) continue;
  const official = countriesLib.getName(a2, "es") ?? g.properties.name;
  const name = EXTRA[a2]?.[0] ?? official;
  const all = countriesLib.getName(a2, "es", { select: "all" }) ?? [];
  COUNTRIES.push({ id: g.id ?? g.properties.name, a2, name, region, aliases: [name, official, ...all, ...(EXTRA[a2] ?? [])] });
}

export const COUNTRY_BY_A2: Record<string, Country> = Object.fromEntries([...COUNTRIES, ...SPAIN_COMMUNITIES, ...SPAIN_PROVINCES].map((c) => [c.a2, c]));

export function countriesIn(region: Region) {
  if (region === "SPAIN_COMMUNITIES") return SPAIN_COMMUNITIES;
  if (region === "SPAIN_PROVINCES") return SPAIN_PROVINCES;
  return region === "ALL" ? COUNTRIES : COUNTRIES.filter((c) => c.region === region);
}

// Well-known countries for easy bots
export const FAMOUS = new Set(
  "ES FR DE IT PT GB US CA MX BR AR CL CO PE CN JP IN RU AU EG ZA MA NG KE AU NZ TR GR SE NO FI PL NL BE CH AT IE IR IQ SA KR VE CU UY EC BO".split(" "),
);
