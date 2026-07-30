// Registre des catalogues de teintes disponibles dans le sélecteur de couleur.
// Ajouter un catalogue = ajouter une entrée ici (voir farrowBall.js / ressource.js pour la forme des données).

import { fbLabel, FARROW_BALL_LIBRARY, FARROW_BALL_FAMILIES } from "./farrowBall.js";
import { rsLabel, RESSOURCE_LIBRARY, RESSOURCE_FAMILIES } from "./ressource.js";

export const COLOR_CATALOGS = [
  { key: "farrowBall", label: "Farrow & Ball", library: FARROW_BALL_LIBRARY, families: FARROW_BALL_FAMILIES, labelFor: fbLabel },
  { key: "ressource", label: "Ressource", library: RESSOURCE_LIBRARY, families: RESSOURCE_FAMILIES, labelFor: rsLabel },
];

const ALL_COLORS = COLOR_CATALOGS.flatMap((catalog) =>
  catalog.library.map((entry) => ({ ...entry, catalogKey: catalog.key, label: catalog.labelFor(entry) }))
);
const ALL_COLORS_BY_HEX = Object.fromEntries(ALL_COLORS.map((entry) => [entry.hex.toUpperCase(), entry]));

function hexToRgbTriplet(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function nearestColor(hex) {
  const [r, g, b] = hexToRgbTriplet(hex);
  let best = null;
  let bestDist = Infinity;
  for (const entry of ALL_COLORS) {
    const [er, eg, eb] = hexToRgbTriplet(entry.hex);
    const dist = (r - er) ** 2 + (g - eg) ** 2 + (b - eb) ** 2;
    if (dist < bestDist) { bestDist = dist; best = entry; }
  }
  return best;
}

// Décrit un hex avec sa référence catalogue (exacte si connue, sinon la plus proche, tous
// catalogues confondus) : on n'affiche jamais un code hexadécimal brut à l'utilisateur.
export function describeColor(hex) {
  if (!hex) return "";
  const exact = ALL_COLORS_BY_HEX[hex.toUpperCase()];
  if (exact) return exact.label;
  const near = nearestColor(hex);
  return near ? `≈ ${near.label}` : hex.toUpperCase();
}

export function catalogAndFamilyOfHex(hex) {
  if (!hex) return null;
  const entry = ALL_COLORS_BY_HEX[hex.toUpperCase()] || nearestColor(hex);
  return entry ? { catalogKey: entry.catalogKey, familyKey: entry.family } : null;
}

export const ALL_COLORS_LIBRARY = ALL_COLORS;

// Formatte le code d'une teinte pour l'affichage : les références Ressource ("R111")
// s'affichent telles quelles, les numéros Farrow & Ball ("2003") reçoivent le préfixe "N°".
export function formatColorCode(code) {
  if (!code) return "";
  return /^R\d/.test(code) ? code : `N°${code}`;
}
