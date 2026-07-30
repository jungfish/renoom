// Références Ressource Peintures. Ressource ne publie pas de codes hexadécimaux officiels
// (nuancier physique uniquement) : ces valeurs sont des approximations d'écran destinées à
// l'aperçu, pas des références d'achat de peinture. Sélection curatée parmi les ~360 teintes
// de la collection Ressource — noms et références (Rxxx) réels, hex approximés à partir des
// descriptions officielles de chaque teinte.

export const RESSOURCE_FAMILY_LABELS = {
  blancs: "Blancs",
  beiges: "Beiges",
  gris: "Gris",
  bruns: "Bruns",
  noirs: "Noirs",
  violets: "Violets",
  verts: "Verts",
  bleus: "Bleus",
  rouges: "Rouges",
  oranges: "Oranges",
  jaunes: "Jaunes",
  roses: "Roses",
};

export const RS = {
  // ── Blancs ───────────────────────────────────────────────────────────────
  laPurete: { ref: "R111", number: "R111", name: "La Pureté", hex: "#F4F1EA", family: "blancs" },
  linnocent: { ref: "R015", number: "R015", name: "L'Innocent", hex: "#F1E9D6", family: "blancs" },
  leCygne: { ref: "R238", number: "R238", name: "Le Cygne", hex: "#ECE6DC", family: "blancs" },
  laPorcelaine: { ref: "R056", number: "R056", name: "La Porcelaine", hex: "#E6DCC8", family: "blancs" },
  laDivinite: { ref: "R086", number: "R086", name: "La Divinité", hex: "#E3DED2", family: "blancs" },
  laRetenue: { ref: "R124", number: "R124", name: "La Retenue", hex: "#D6D0C3", family: "blancs" },

  // ── Beiges ───────────────────────────────────────────────────────────────
  leSouvenir: { ref: "R243", number: "R243", name: "Le Souvenir", hex: "#C7B99C", family: "beiges" },
  lagarAgar: { ref: "R222", number: "R222", name: "L'Agar-Agar", hex: "#D8CCB8", family: "beiges" },
  leCocon: { ref: "R139", number: "R139", name: "Le Cocon", hex: "#E2D3B0", family: "beiges" },
  leMacaron: { ref: "R051", number: "R051", name: "Le Macaron", hex: "#E6D8B8", family: "beiges" },
  laCandeur: { ref: "R128", number: "R128", name: "La Candeur", hex: "#EBE0C4", family: "beiges" },
  leMeistre: { ref: "R047", number: "R047", name: "Le Meistre", hex: "#BFA97C", family: "beiges" },

  // ── Gris ─────────────────────────────────────────────────────────────────
  loubli: { ref: "R173", number: "R173", name: "L'Oubli", hex: "#C3BFB6", family: "gris" },
  laPolitesse: { ref: "R167", number: "R167", name: "La Politesse", hex: "#D2CFC6", family: "gris" },
  laBanquise: { ref: "R246", number: "R246", name: "La Banquise", hex: "#CBD1CD", family: "gris" },
  leternite: { ref: "R164", number: "R164", name: "L'Eternité", hex: "#94918A", family: "gris" },
  leBrouillard: { ref: "R161", number: "R161", name: "Le Brouillard", hex: "#A3A5A0", family: "gris" },
  laGelee: { ref: "R065", number: "R065", name: "La Gelée", hex: "#D7DAD6", family: "gris" },

  // ── Bruns ────────────────────────────────────────────────────────────────
  leReconfort: { ref: "R214", number: "R214", name: "Le Réconfort", hex: "#6B4A34", family: "bruns" },
  laPromesse: { ref: "R168", number: "R168", name: "La Promesse", hex: "#77583D", family: "bruns" },
  leMusicien: { ref: "R154", number: "R154", name: "Le Musicien", hex: "#8A6E4C", family: "bruns" },
  laGabardine: { ref: "R059", number: "R059", name: "La Gabardine", hex: "#5A4430", family: "bruns" },
  lePelerin: { ref: "R125", number: "R125", name: "Le Pèlerin", hex: "#B7A077", family: "bruns" },
  leCentaure: { ref: "R011", number: "R011", name: "Le Centaure", hex: "#4A3626", family: "bruns" },

  // ── Noirs ────────────────────────────────────────────────────────────────
  lechiquier: { ref: "R014", number: "R014", name: "L'Echiquier", hex: "#4A4D4C", family: "noirs" },
  lobscurite: { ref: "R235", number: "R235", name: "L'Obscurité", hex: "#333739", family: "noirs" },
  laSignature: { ref: "R172", number: "R172", name: "La Signature", hex: "#292A2B", family: "noirs" },
  leTumulte: { ref: "R002", number: "R002", name: "Le Tumulte", hex: "#3B3936", family: "noirs" },
  loctave: { ref: "R250", number: "R250", name: "L'Octave", hex: "#201F1E", family: "noirs" },
  leGalant: { ref: "R188", number: "R188", name: "Le Galant", hex: "#3B4143", family: "noirs" },

  // ── Violets ──────────────────────────────────────────────────────────────
  laCuriosite: { ref: "R495", number: "R495", name: "La Curiosité", hex: "#4A2E3D", family: "violets" },
  leMelodrame: { ref: "R310", number: "R310", name: "Le Mélodrame", hex: "#5B3A45", family: "violets" },
  lovation: { ref: "R374", number: "R374", name: "L'Ovation", hex: "#6A4A63", family: "violets" },
  laDelectation: { ref: "R267", number: "R267", name: "La Délectation", hex: "#4E3A5C", family: "violets" },
  lextase: { ref: "R254", number: "R254", name: "L'Extase", hex: "#593548", family: "violets" },
  laFleurette: { ref: "R487", number: "R487", name: "La Fleurette", hex: "#A99AC4", family: "violets" },

  // ── Verts ────────────────────────────────────────────────────────────────
  laComplicite: { ref: "R081", number: "R081", name: "La Complicité", hex: "#8A9269", family: "verts" },
  legard: { ref: "R142", number: "R142", name: "L'Egard", hex: "#7C8A6A", family: "verts" },
  leMarais: { ref: "R196", number: "R196", name: "Le Marais", hex: "#566B4A", family: "verts" },
  lintrigue: { ref: "R089", number: "R089", name: "L'Intrigue", hex: "#4E6B45", family: "verts" },
  laLiqueur: { ref: "R257", number: "R257", name: "La Liqueur", hex: "#B7C46A", family: "verts" },
  lestompe: { ref: "R009", number: "R009", name: "L'Estompe", hex: "#6E7566", family: "verts" },

  // ── Bleus ────────────────────────────────────────────────────────────────
  leCapitaine: { ref: "R912", number: "R912", name: "Le Capitaine", hex: "#1F3A5C", family: "bleus" },
  leNaufrage: { ref: "R948", number: "R948", name: "Le Naufragé", hex: "#1E4A6E", family: "bleus" },
  laParade: { ref: "R845", number: "R845", name: "La Parade", hex: "#3E6A82", family: "bleus" },
  leDeluge: { ref: "R965", number: "R965", name: "Le Déluge", hex: "#3B5266", family: "bleus" },
  laPervenche: { ref: "R974", number: "R974", name: "La Pervenche", hex: "#7B8CC4", family: "bleus" },
  leCrepuscule: { ref: "R755", number: "R755", name: "Le Crépuscule", hex: "#223347", family: "bleus" },

  // ── Rouges ───────────────────────────────────────────────────────────────
  limpatience: { ref: "R270", number: "R270", name: "L'Impatience", hex: "#C1432B", family: "rouges" },
  lobsession: { ref: "R329", number: "R329", name: "L'Obsession", hex: "#8B3A2E", family: "rouges" },
  laDuchesse: { ref: "R481", number: "R481", name: "La Duchesse", hex: "#6E2E24", family: "rouges" },
  lenvie: { ref: "R331", number: "R331", name: "L'Envie", hex: "#8C2F42", family: "rouges" },
  laRencontre: { ref: "R278", number: "R278", name: "La Rencontre", hex: "#7A3B2E", family: "rouges" },
  leruption: { ref: "R466", number: "R466", name: "L'Eruption", hex: "#A85A34", family: "rouges" },

  // ── Oranges ──────────────────────────────────────────────────────────────
  laNefle: { ref: "R283", number: "R283", name: "La Nèfle", hex: "#C97A55", family: "oranges" },
  lexaltation: { ref: "R311", number: "R311", name: "L'Exaltation", hex: "#D89A5C", family: "oranges" },
  lardeur: { ref: "R382", number: "R382", name: "L'Ardeur", hex: "#B0602E", family: "oranges" },
  lincandescence: { ref: "R389", number: "R389", name: "L'Incandescence", hex: "#C8583E", family: "oranges" },
  leCharbonArdent: { ref: "R404", number: "R404", name: "Le Charbon Ardent", hex: "#A8492E", family: "oranges" },
  laube: { ref: "R490", number: "R490", name: "L'Aube", hex: "#D8763A", family: "oranges" },

  // ── Jaunes ───────────────────────────────────────────────────────────────
  laChaleur: { ref: "R473", number: "R473", name: "La Chaleur", hex: "#E8C24A", family: "jaunes" },
  laLueur: { ref: "R405", number: "R405", name: "La Lueur", hex: "#EAD48A", family: "jaunes" },
  leclat: { ref: "R390", number: "R390", name: "L'Eclat", hex: "#D8A83E", family: "jaunes" },
  laMerveille: { ref: "R325", number: "R325", name: "La Merveille", hex: "#D2B458", family: "jaunes" },
  leVicomte: { ref: "R462", number: "R462", name: "Le Vicomte", hex: "#D9A62E", family: "jaunes" },
  leuphorbe: { ref: "R264", number: "R264", name: "L'Euphorbe", hex: "#C7C24A", family: "jaunes" },

  // ── Roses ────────────────────────────────────────────────────────────────
  laNymphe: { ref: "R231", number: "R231", name: "La Nymphe", hex: "#E4B8AC", family: "roses" },
  laBerceuse: { ref: "R241", number: "R241", name: "La Berceuse", hex: "#DDAAA0", family: "roses" },
  laFrimousse: { ref: "R251", number: "R251", name: "La Frimousse", hex: "#E3AEB0", family: "roses" },
  laRosee: { ref: "R485", number: "R485", name: "La Rosée", hex: "#E8C4C2", family: "roses" },
  laSensation: { ref: "R384", number: "R384", name: "La Sensation", hex: "#D89C9E", family: "roses" },
  laPudeur: { ref: "R333", number: "R333", name: "La Pudeur", hex: "#C98C94", family: "roses" },
};

export const RESSOURCE_LIBRARY = Object.values(RS);
export const RESSOURCE_BY_HEX = Object.fromEntries(RESSOURCE_LIBRARY.map(entry => [entry.hex.toUpperCase(), entry]));

export const RESSOURCE_FAMILIES = Object.keys(RESSOURCE_FAMILY_LABELS).map(key => ({
  key,
  label: RESSOURCE_FAMILY_LABELS[key],
  colors: RESSOURCE_LIBRARY.filter(entry => entry.family === key),
}));

export function rsLabel(entry) {
  return `${entry.name} — ${entry.ref}`;
}
