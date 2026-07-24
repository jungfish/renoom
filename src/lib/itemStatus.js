// Statuts du cycle d'achat pour les items "shopping" — source de vérité pour
// le select (liste + Kanban + import devis) et pour le Kanban/Budget.
// Teintes alignées sur la charte existante de l'app (crème/or/sauge/ambre —
// voir renderList/TodosGlobalView) plutôt que des couleurs Tailwind
// génériques (bleu/violet/orange) qui juraient avec le reste de l'UI.
export const STATUSES = [
  { key: "envie", title: "Envie", border: "border-black/10", bg: "bg-white", text: "text-slate-500", dot: "#B9B4A8" },
  { key: "devis_demande", title: "Devis demandé", border: "border-[#e3ddc9]", bg: "bg-[#faf7f0]", text: "text-[#8a7f5c]", dot: "#C9BE9A" },
  { key: "devis_fait", title: "Devis fait", border: "border-[#e3cfa0]", bg: "bg-[#FCF8D5]/60", text: "text-[#8a6d2f]", dot: "#CDAA73" },
  { key: "echantillon_commande", title: "Échantillon commandé", border: "border-[#dcb8a0]", bg: "bg-[#f6ebe3]", text: "text-[#8a5636]", dot: "#C08A63" },
  { key: "selectionne", title: "Sélectionné pour achat", border: "border-[#c9d3b6]", bg: "bg-[#eef1e4]", text: "text-[#4f5d3a]", dot: "#93A87C" },
  { key: "commande", title: "Commandé", border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", dot: "#D9A441" },
  { key: "achete", title: "Acheté / Reçu", border: "border-[#8FA37E]", bg: "bg-[#e9edd9]", text: "text-[#445533]", dot: "#6E8558" },
];

const STATUS_BY_KEY = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

export const SPENT_STATUSES = ["commande", "achete"];
export const PENDING_STATUSES = ["devis_fait", "echantillon_commande", "selectionne"];

// `done`/`selected_for_purchase` restent en base pour ne pas casser le code
// existant (export PDF, "Budget global", outil IA du chat) qui les lit
// encore — tout changement de statut doit aussi mettre à jour ces 2 champs.
export function deriveFlagsFromStatus(status) {
  return {
    selectedForPurchase: ["selectionne", "commande", "achete"].includes(status),
    done: status === "achete",
  };
}

// Fallback pour les lignes chargées avant la migration ou depuis un cache
// qui n'a pas encore `status`.
export function effectiveStatus(item) {
  if (item.status && STATUS_BY_KEY[item.status]) return item.status;
  if (item.done) return "achete";
  if (item.selectedForPurchase) return "selectionne";
  return "envie";
}

export function statusMeta(status) {
  return STATUS_BY_KEY[status] || STATUS_BY_KEY.envie;
}

// Style du select de statut lui-même (façon tag Notion) — la couleur reste
// sur le badge/select, plus sur la carte/ligne qui le contient.
export function selectStyleForStatus(status) {
  const meta = statusMeta(status);
  return `${meta.bg} ${meta.text}`;
}
