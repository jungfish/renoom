// Références Ressource Peintures. Ressource ne publie pas de codes hexadécimaux officiels
// (nuancier physique uniquement) : ces valeurs sont des approximations d'écran destinées à
// l'aperçu, pas des références d'achat de peinture. Sélection curatée parmi les ~360 teintes
// de la collection Ressource (réf. Rxxx) et quelques teintes de collections dérivées (Maison
// Sarah Lavoine, Maison de Vacances, Enduit Romain) — noms et références réels, hex approximés
// à partir des descriptions officielles de chaque teinte.

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
  lePiano: { ref: "R187", number: "R187", name: "Le Piano", hex: "#EEE7D8", family: "blancs" },
  laChantilly: { ref: "R245", number: "R245", name: "La Chantilly", hex: "#EDE8DC", family: "blancs" },
  laLimpidite: { ref: "R095", number: "R095", name: "La Limpidité", hex: "#F0F1EC", family: "blancs" },
  laNoce: { ref: "R212", number: "R212", name: "La Noce", hex: "#E8E6DE", family: "blancs" },
  laSylphide: { ref: "R179", number: "R179", name: "La Sylphide", hex: "#E7DFC4", family: "blancs" },
  laPorcelaine: { ref: "R056", number: "R056", name: "La Porcelaine", hex: "#E6DCC8", family: "blancs" },
  laDivinite: { ref: "R086", number: "R086", name: "La Divinité", hex: "#E3DED2", family: "blancs" },
  laRetenue: { ref: "R124", number: "R124", name: "La Retenue", hex: "#D6D0C3", family: "blancs" },
  laPamoison: { ref: "R153", number: "R153", name: "La Pâmoison", hex: "#E9DED5", family: "blancs" },
  // Collection "Maison de Vacances" (peinture/enduit à la chaux) x Ressource.
  meringue: { ref: "RMDV03", number: "RMDV03", name: "Meringue", hex: "#F0E9DC", family: "blancs" },

  // ── Beiges ───────────────────────────────────────────────────────────────
  laPleiade: { ref: "R185", number: "R185", name: "La Pléiade", hex: "#C9B98A", family: "beiges" },
  leSouvenir: { ref: "R243", number: "R243", name: "Le Souvenir", hex: "#C7B99C", family: "beiges" },
  lagarAgar: { ref: "R222", number: "R222", name: "L'Agar-Agar", hex: "#D8CCB8", family: "beiges" },
  leCocon: { ref: "R139", number: "R139", name: "Le Cocon", hex: "#E2D3B0", family: "beiges" },
  leMacaron: { ref: "R051", number: "R051", name: "Le Macaron", hex: "#E6D8B8", family: "beiges" },
  laCandeur: { ref: "R128", number: "R128", name: "La Candeur", hex: "#EBE0C4", family: "beiges" },
  lhommage: { ref: "R144", number: "R144", name: "L'Hommage", hex: "#D6BE93", family: "beiges" },
  linvitation: { ref: "R189", number: "R189", name: "L'Invitation", hex: "#C9BFA9", family: "beiges" },
  leRocher: { ref: "R069", number: "R069", name: "Le Rocher", hex: "#A8967A", family: "beiges" },
  leMeistre: { ref: "R047", number: "R047", name: "Le Meistre", hex: "#BFA97C", family: "beiges" },
  linstinct: { ref: "R028", number: "R028", name: "L'Instinct", hex: "#BDAE8E", family: "beiges" },
  larome: { ref: "R206", number: "R206", name: "L'Arôme", hex: "#B39F7C", family: "beiges" },

  // ── Gris ─────────────────────────────────────────────────────────────────
  leMurmure: { ref: "R203", number: "R203", name: "Le Murmure", hex: "#E4E1DA", family: "gris" },
  laDentelle: { ref: "R181", number: "R181", name: "La Dentelle", hex: "#DAD6CC", family: "gris" },
  lame: { ref: "R149", number: "R149", name: "L'Âme", hex: "#D6D2C7", family: "gris" },
  laFragilite: { ref: "R029", number: "R029", name: "La Fragilité", hex: "#DAD6C8", family: "gris" },
  leFrisson: { ref: "R033", number: "R033", name: "Le Frisson", hex: "#D9DBD6", family: "gris" },
  laGelee: { ref: "R065", number: "R065", name: "La Gelée", hex: "#D7DAD6", family: "gris" },
  loubli: { ref: "R173", number: "R173", name: "L'Oubli", hex: "#C3BFB6", family: "gris" },
  laPolitesse: { ref: "R167", number: "R167", name: "La Politesse", hex: "#D2CFC6", family: "gris" },
  laBanquise: { ref: "R246", number: "R246", name: "La Banquise", hex: "#CBD1CD", family: "gris" },
  laBenediction: { ref: "R013", number: "R013", name: "La Bénédiction", hex: "#B9B7AE", family: "gris" },
  leBrouillard: { ref: "R161", number: "R161", name: "Le Brouillard", hex: "#A3A5A0", family: "gris" },
  leternite: { ref: "R164", number: "R164", name: "L'Eternité", hex: "#94918A", family: "gris" },
  lesquisse: { ref: "R249", number: "R249", name: "L'Esquisse", hex: "#9C9C96", family: "gris" },

  // ── Bruns ────────────────────────────────────────────────────────────────
  lePelerin: { ref: "R125", number: "R125", name: "Le Pèlerin", hex: "#B7A077", family: "bruns" },
  lePortrait: { ref: "R137", number: "R137", name: "Le Portrait", hex: "#8B6F52", family: "bruns" },
  leMusicien: { ref: "R154", number: "R154", name: "Le Musicien", hex: "#8A6E4C", family: "bruns" },
  leCamarade: { ref: "R170", number: "R170", name: "Le Camarade", hex: "#736A5C", family: "bruns" },
  lePreambule: { ref: "R177", number: "R177", name: "Le Préambule", hex: "#6F675A", family: "bruns" },
  leReconfort: { ref: "R214", number: "R214", name: "Le Réconfort", hex: "#6B4A34", family: "bruns" },
  laSpirale: { ref: "R122", number: "R122", name: "La Spirale", hex: "#6E5C48", family: "bruns" },
  laPromesse: { ref: "R168", number: "R168", name: "La Promesse", hex: "#77583D", family: "bruns" },
  lepine: { ref: "R220", number: "R220", name: "L'Epine", hex: "#5C6449", family: "bruns" },
  laGabardine: { ref: "R059", number: "R059", name: "La Gabardine", hex: "#5A4430", family: "bruns" },
  leTaciturne: { ref: "R133", number: "R133", name: "Le Taciturne", hex: "#4F3B28", family: "bruns" },
  leCentaure: { ref: "R011", number: "R011", name: "Le Centaure", hex: "#4A3626", family: "bruns" },

  // ── Noirs ────────────────────────────────────────────────────────────────
  laMeteorite: { ref: "R054", number: "R054", name: "La Météorite", hex: "#55524C", family: "noirs" },
  leRecif: { ref: "R121", number: "R121", name: "Le Récif", hex: "#3A3E3D", family: "noirs" },
  leConcerto: { ref: "R244", number: "R244", name: "Le Concerto", hex: "#3F473B", family: "noirs" },
  lechiquier: { ref: "R014", number: "R014", name: "L'Echiquier", hex: "#4A4D4C", family: "noirs" },
  leProtocole: { ref: "R248", number: "R248", name: "Le Protocole", hex: "#4B4A47", family: "noirs" },
  leMetronome: { ref: "R145", number: "R145", name: "Le Métronome", hex: "#45403A", family: "noirs" },
  leMirliflore: { ref: "R152", number: "R152", name: "Le Mirliflore", hex: "#403C3A", family: "noirs" },
  lobscurite: { ref: "R235", number: "R235", name: "L'Obscurité", hex: "#333739", family: "noirs" },
  leGalant: { ref: "R188", number: "R188", name: "Le Galant", hex: "#3B4143", family: "noirs" },
  leTumulte: { ref: "R002", number: "R002", name: "Le Tumulte", hex: "#3B3936", family: "noirs" },
  laSignature: { ref: "R172", number: "R172", name: "La Signature", hex: "#292A2B", family: "noirs" },
  loctave: { ref: "R250", number: "R250", name: "L'Octave", hex: "#201F1E", family: "noirs" },

  // ── Violets ──────────────────────────────────────────────────────────────
  laFleurette: { ref: "R487", number: "R487", name: "La Fleurette", hex: "#A99AC4", family: "violets" },
  laTentation: { ref: "R412", number: "R412", name: "La Tentation", hex: "#B79AC7", family: "violets" },
  leJoueur: { ref: "R285", number: "R285", name: "Le Joueur", hex: "#9C88A8", family: "violets" },
  lespieglerie: { ref: "R423", number: "R423", name: "L'Espièglerie", hex: "#7A5A8C", family: "violets" },
  laMelancolie: { ref: "R345", number: "R345", name: "La Mélancolie", hex: "#8B6A93", family: "violets" },
  lovation: { ref: "R374", number: "R374", name: "L'Ovation", hex: "#6A4A63", family: "violets" },
  leMelodrame: { ref: "R310", number: "R310", name: "Le Mélodrame", hex: "#5B3A45", family: "violets" },
  laCuriosite: { ref: "R495", number: "R495", name: "La Curiosité", hex: "#4A2E3D", family: "violets" },
  laDelectation: { ref: "R267", number: "R267", name: "La Délectation", hex: "#4E3A5C", family: "violets" },
  lextase: { ref: "R254", number: "R254", name: "L'Extase", hex: "#593548", family: "violets" },

  // ── Verts ────────────────────────────────────────────────────────────────
  laLiqueur: { ref: "R257", number: "R257", name: "La Liqueur", hex: "#B7C46A", family: "verts" },
  lePrintemps: { ref: "R590", number: "R590", name: "Le Printemps", hex: "#B7C285", family: "verts" },
  laMessagere: { ref: "R004", number: "R004", name: "La Messagère", hex: "#C7BC8E", family: "verts" },
  leDesinvolte: { ref: "R129", number: "R129", name: "Le Désinvolte", hex: "#A79E7E", family: "verts" },
  laComplicite: { ref: "R081", number: "R081", name: "La Complicité", hex: "#8A9269", family: "verts" },
  laMelopee: { ref: "R234", number: "R234", name: "La Mélopée", hex: "#8B9184", family: "verts" },
  legard: { ref: "R142", number: "R142", name: "L'Egard", hex: "#7C8A6A", family: "verts" },
  loffrande: { ref: "R186", number: "R186", name: "L'Offrande", hex: "#9C9A6E", family: "verts" },
  leSoupir: { ref: "R240", number: "R240", name: "Le Soupir", hex: "#7A7D6C", family: "verts" },
  lestompe: { ref: "R009", number: "R009", name: "L'Estompe", hex: "#6E7566", family: "verts" },
  leQuatuor: { ref: "R101", number: "R101", name: "Le Quatuor", hex: "#6E7048", family: "verts" },
  leMarais: { ref: "R196", number: "R196", name: "Le Marais", hex: "#566B4A", family: "verts" },
  lintrigue: { ref: "R089", number: "R089", name: "L'Intrigue", hex: "#4E6B45", family: "verts" },

  // ── Bleus ────────────────────────────────────────────────────────────────
  lextravagance: { ref: "R763", number: "R763", name: "L'Extravagance", hex: "#6A5FA0", family: "bleus" },
  laPervenche: { ref: "R974", number: "R974", name: "La Pervenche", hex: "#7B8CC4", family: "bleus" },
  laNoblesse: { ref: "R890", number: "R890", name: "La Noblesse", hex: "#5C4A78", family: "bleus" },
  lallegorie: { ref: "R865", number: "R865", name: "L'Allégorie", hex: "#5C5478", family: "bleus" },
  laParade: { ref: "R845", number: "R845", name: "La Parade", hex: "#3E6A82", family: "bleus" },
  leDeluge: { ref: "R965", number: "R965", name: "Le Déluge", hex: "#3B5266", family: "bleus" },
  leCapitaine: { ref: "R912", number: "R912", name: "Le Capitaine", hex: "#1F3A5C", family: "bleus" },
  leNaufrage: { ref: "R948", number: "R948", name: "Le Naufragé", hex: "#1E4A6E", family: "bleus" },
  leCrepuscule: { ref: "R755", number: "R755", name: "Le Crépuscule", hex: "#223347", family: "bleus" },
  leCosmos: { ref: "R901", number: "R901", name: "Le Cosmos", hex: "#2B2E33", family: "bleus" },
  leFirmament: { ref: "R829", number: "R829", name: "Le Firmament", hex: "#1A2233", family: "bleus" },

  // ── Rouges ───────────────────────────────────────────────────────────────
  leFestin: { ref: "R455", number: "R455", name: "Le Festin", hex: "#B4874A", family: "rouges" },
  laFanfare: { ref: "R408", number: "R408", name: "La Fanfare", hex: "#9C5A32", family: "rouges" },
  leruption: { ref: "R466", number: "R466", name: "L'Eruption", hex: "#A85A34", family: "rouges" },
  limpatience: { ref: "R270", number: "R270", name: "L'Impatience", hex: "#C1432B", family: "rouges" },
  laRencontre: { ref: "R278", number: "R278", name: "La Rencontre", hex: "#7A3B2E", family: "rouges" },
  lenvie: { ref: "R331", number: "R331", name: "L'Envie", hex: "#8C2F42", family: "rouges" },
  lobsession: { ref: "R329", number: "R329", name: "L'Obsession", hex: "#8B3A2E", family: "rouges" },
  laDuchesse: { ref: "R481", number: "R481", name: "La Duchesse", hex: "#6E2E24", family: "rouges" },
  laFriandise: { ref: "R477", number: "R477", name: "La Friandise", hex: "#4A2036", family: "rouges" },

  // ── Oranges ──────────────────────────────────────────────────────────────
  lhydromel: { ref: "R298", number: "R298", name: "L'Hydromel", hex: "#C99A3E", family: "oranges" },
  laGourmande: { ref: "R344", number: "R344", name: "La Gourmande", hex: "#E0A778", family: "oranges" },
  laCharmeuse: { ref: "R500", number: "R500", name: "La Charmeuse", hex: "#D98A6E", family: "oranges" },
  laNefle: { ref: "R283", number: "R283", name: "La Nèfle", hex: "#C97A55", family: "oranges" },
  lexaltation: { ref: "R311", number: "R311", name: "L'Exaltation", hex: "#D89A5C", family: "oranges" },
  lePolisson: { ref: "R410", number: "R410", name: "Le Polisson", hex: "#D97A6A", family: "oranges" },
  lencens: { ref: "R476", number: "R476", name: "L'Encens", hex: "#B88358", family: "oranges" },
  lardeur: { ref: "R382", number: "R382", name: "L'Ardeur", hex: "#B0602E", family: "oranges" },
  lincandescence: { ref: "R389", number: "R389", name: "L'Incandescence", hex: "#C8583E", family: "oranges" },
  leRougeoiement: { ref: "R326", number: "R326", name: "Le Rougeoiement", hex: "#C8642E", family: "oranges" },
  leCharbonArdent: { ref: "R404", number: "R404", name: "Le Charbon Ardent", hex: "#A8492E", family: "oranges" },
  laube: { ref: "R490", number: "R490", name: "L'Aube", hex: "#D8763A", family: "oranges" },

  // ── Jaunes ───────────────────────────────────────────────────────────────
  lePoeme: { ref: "R012", number: "R012", name: "Le Poème", hex: "#EDE0B8", family: "jaunes" },
  laureole: { ref: "R347", number: "R347", name: "L'Auréole", hex: "#E3CE8E", family: "jaunes" },
  laLueur: { ref: "R405", number: "R405", name: "La Lueur", hex: "#EAD48A", family: "jaunes" },
  laChaleur: { ref: "R473", number: "R473", name: "La Chaleur", hex: "#E8C24A", family: "jaunes" },
  // Collection "Enduit Romain" x Ressource.
  albatre: { ref: "ER46", number: "ER46", name: "Albâtre", hex: "#E6D9B8", family: "jaunes" },
  laMerveille: { ref: "R325", number: "R325", name: "La Merveille", hex: "#D2B458", family: "jaunes" },
  leclat: { ref: "R390", number: "R390", name: "L'Eclat", hex: "#D8A83E", family: "jaunes" },
  lalliance: { ref: "R480", number: "R480", name: "L'Alliance", hex: "#CE9A3A", family: "jaunes" },
  leVicomte: { ref: "R462", number: "R462", name: "Le Vicomte", hex: "#D9A62E", family: "jaunes" },
  // Collection Maison Sarah Lavoine x Ressource.
  dune: { ref: "SL46", number: "SL46", name: "Dune", hex: "#CBAD7C", family: "jaunes" },
  leuphorbe: { ref: "R264", number: "R264", name: "L'Euphorbe", hex: "#C7C24A", family: "jaunes" },
  laPreciosite: { ref: "R411", number: "R411", name: "La Préciosité", hex: "#B8B23E", family: "jaunes" },
  lantidote: { ref: "R271", number: "R271", name: "L'Antidote", hex: "#C9B430", family: "jaunes" },

  // ── Roses ────────────────────────────────────────────────────────────────
  laDouceur: { ref: "R299", number: "R299", name: "La Douceur", hex: "#E4CFC8", family: "roses" },
  laSensibilite: { ref: "R079", number: "R079", name: "La Sensibilité", hex: "#E8D6C4", family: "roses" },
  laRosee: { ref: "R485", number: "R485", name: "La Rosée", hex: "#E8C4C2", family: "roses" },
  laTimidite: { ref: "R276", number: "R276", name: "La Timidité", hex: "#D9C2BE", family: "roses" },
  lemoi: { ref: "R498", number: "R498", name: "L'Emoi", hex: "#D8B8C8", family: "roses" },
  laMarquise: { ref: "R171", number: "R171", name: "La Marquise", hex: "#D9B6AC", family: "roses" },
  laNymphe: { ref: "R231", number: "R231", name: "La Nymphe", hex: "#E4B8AC", family: "roses" },
  laFrimousse: { ref: "R251", number: "R251", name: "La Frimousse", hex: "#E3AEB0", family: "roses" },
  laBerceuse: { ref: "R241", number: "R241", name: "La Berceuse", hex: "#DDAAA0", family: "roses" },
  laSensation: { ref: "R384", number: "R384", name: "La Sensation", hex: "#D89C9E", family: "roses" },
  laPudeur: { ref: "R333", number: "R333", name: "La Pudeur", hex: "#C98C94", family: "roses" },
};

export function rsLabel(entry) {
  return `${entry.name} — ${entry.ref}`;
}
