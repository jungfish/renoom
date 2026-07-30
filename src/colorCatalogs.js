// Registre des catalogues de teintes disponibles dans le sélecteur de couleur.
// Ajouter un catalogue = ajouter une entrée à COLOR_CATALOGS ci-dessous : un fichier de données
// (voir farrowBall.js / ressource.js) qui exporte un dictionnaire de teintes {family, name, hex,
// ...} + un libellé de famille + une fonction de label — defineCatalog() se charge du reste
// (regroupement par famille, index par hex).

import { FB, FARROW_BALL_FAMILY_LABELS, fbLabel } from "./farrowBall.js";
import { RS, RESSOURCE_FAMILY_LABELS, rsLabel } from "./ressource.js";

function defineCatalog({ key, label, colors, familyLabels, labelFor, iconUrl, websiteUrl, description }) {
  const library = Object.values(colors);
  const families = Object.keys(familyLabels).map((familyKey) => ({
    key: familyKey,
    label: familyLabels[familyKey],
    colors: library.filter((entry) => entry.family === familyKey),
  }));
  return { key, label, library, families, labelFor, iconUrl, websiteUrl, description };
}

export const COLOR_CATALOGS = [
  defineCatalog({
    key: "farrowBall",
    label: "Farrow & Ball",
    colors: FB,
    familyLabels: FARROW_BALL_FAMILY_LABELS,
    labelFor: fbLabel,
    iconUrl: "https://www.farrow-ball.com/media/favicon/websites/5/New_Favicon_2024.jpg",
    websiteUrl: "https://www.farrow-ball.com/fr/",
    description: "Peinture artisanale britannique depuis 1946 — teintes sourdes et intemporelles, pigments naturels.",
  }),
  defineCatalog({
    key: "ressource",
    label: "Ressource",
    colors: RS,
    familyLabels: RESSOURCE_FAMILY_LABELS,
    labelFor: rsLabel,
    iconUrl: "https://ressource-peintures.com/wp-content/uploads/2024/04/favicon-logo-ressource-2024-200x200.png",
    websiteUrl: "https://ressource-peintures.com",
    description: "Peinture française haut de gamme — nuancier riche de 360 teintes aux noms poétiques, finitions chaux et minérales.",
  }),
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

// Formatte le code d'une teinte pour l'affichage : les références alphanumériques ("R111",
// "SL46") s'affichent telles quelles, les numéros purement numériques Farrow & Ball ("2003")
// reçoivent le préfixe "N°".
export function formatColorCode(code) {
  if (!code) return "";
  return /^\d+$/.test(code) ? `N°${code}` : code;
}
