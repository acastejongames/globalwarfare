import provinces from "./data/spain-provinces.json";

const communities: [string, string, string[]][] = [
  ["01", "Andalucía", []], ["02", "Aragón", []],
  ["03", "Islas Baleares", ["Baleares", "Illes Balears"]],
  ["04", "Canarias", ["Islas Canarias"]], ["05", "Cantabria", []],
  ["06", "Castilla-La Mancha", ["Castilla la Mancha"]],
  ["07", "Castilla y León", ["Castilla León"]],
  ["08", "Cataluña", ["Catalunya"]], ["10", "Extremadura", []],
  ["11", "Galicia", ["Galiza"]], ["12", "La Rioja", ["Rioja"]],
  ["13", "Comunidad de Madrid", ["Madrid"]],
  ["15", "Región de Murcia", ["Murcia"]],
  ["16", "Navarra", ["Comunidad Foral de Navarra", "Nafarroa"]],
  ["17", "País Vasco", ["Euskadi"]], ["18", "Asturias", ["Principado de Asturias"]],
  ["19", "Comunidad Valenciana", ["Comunitat Valenciana", "Valencia"]],
];

const provinceNames: Record<string, string[]> = {
  "01": ["Álava", "Araba", "Araba/Álava"],
  "03": ["Alicante", "Alacant", "Alacant/Alicante"],
  "07": ["Islas Baleares", "Baleares", "Illes Balears"],
  "12": ["Castellón", "Castelló", "Castelló/Castellón"],
  "15": ["A Coruña", "La Coruña", "Coruña"],
  "20": ["Guipúzcoa", "Gipuzkoa", "Gipuzkoa/Guipúzcoa"],
  "26": ["La Rioja", "Rioja"], "32": ["Ourense", "Orense"],
  "35": ["Las Palmas"], "38": ["Santa Cruz de Tenerife", "Tenerife"],
  "46": ["Valencia", "València", "València/Valencia"],
  "48": ["Vizcaya", "Bizkaia", "Bizkaia/Vizcaya"],
  "17": ["Girona", "Gerona"], "25": ["Lleida", "Lérida"],
};

export const SPAIN_COMMUNITIES = communities.map(([id, name, aliases]) => ({
  id: `ES-C-${id}`, a2: `ES-C-${id}`, name, aliases: [name, ...aliases], region: "SPAIN_COMMUNITIES" as const,
}));

export const SPAIN_PROVINCES = provinces.features.map((f) => {
  const id = f.properties.id;
  const names = provinceNames[id.slice(-2)] ?? [f.properties.name];
  return { id, a2: id, name: names[0] ?? f.properties.name, aliases: names, region: "SPAIN_PROVINCES" as const };
});