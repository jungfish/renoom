import { useEntitlements } from "./hooks/useEntitlements";
import { SUPPORT_EMAIL } from "./config";
import { isArchived } from "./lib/itemStatus.js";

function textColor(hex) {
  const c = hex.replace("#", "");
  const bigint = parseInt(c, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 165 ? "#24303a" : "#ffffff";
}

// Vue d'accueil : point d'entrée unique qui résume ce qui demande de l'attention,
// pour ne pas forcer les utilisateurs à choisir une pièce/onglet dès l'ouverture.
export function Dashboard({
  projectName,
  lastSavedAt,
  orderedActiveRooms,
  allRoomPresets,
  getRoomColors,
  roomLists,
  totalPending,
  totalUnread,
  totalMentionUnread,
  totalActivity,
  onNavigateGeneral,
  onNavigateRoom,
  isOwner,
  authedFetch,
  apiBase,
  startSteps = null,
  onHideStartSteps,
}) {
  // Le détail du plan et de la conso IA est dans le menu utilisateur (PlanUsageModal) ;
  // l'accueil n'affiche que l'alerte quand une limite est atteinte.
  const { limits, usage } = useEntitlements({ authedFetch, apiBase, enabled: !!authedFetch && isOwner });
  const limitReached = !!(limits && usage) && (
    usage.activeProjects >= limits.max_active_projects ||
    usage.aiMessages24h >= limits.ai_messages_per_day ||
    usage.aiImages30d >= limits.ai_images_per_month ||
    usage.pdfExports30d >= limits.pdf_exports_per_month
  );

  const roomPending = (key) => {
    const list = roomLists[key] || {};
    return [...(list.shopping || []), ...(list.todos || [])].filter((i) => !i.done && !isArchived(i)).length;
  };

  const cards = [
    {
      key: "todos",
      label: "Tâches",
      value: totalPending,
      hint: totalPending > 0 ? `${totalPending} en attente` : "Rien en attente",
      highlight: totalPending > 0,
    },
    {
      key: "courses",
      label: "Achats",
      value: null,
      hint: "Voir la liste",
      highlight: false,
    },
    {
      key: "discussions",
      label: "Discussions",
      value: totalUnread,
      hint: totalMentionUnread > 0 ? `${totalMentionUnread} mention${totalMentionUnread > 1 ? "s" : ""}` : totalUnread > 0 ? `${totalUnread} non lu${totalUnread > 1 ? "s" : ""}` : "Tout est lu",
      highlight: totalMentionUnread > 0,
    },
    {
      key: "activite",
      label: "Activité",
      value: totalActivity,
      hint: totalActivity > 0 ? `${totalActivity} nouveauté${totalActivity > 1 ? "s" : ""}` : "Rien de nouveau",
      highlight: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Accueil</p>
        <h2 className="type-h2">{projectName || "Votre projet"}</h2>
        {lastSavedAt && (
          <p className="mt-1 text-sm text-slate-500">
            Auto-sauvé {new Date(lastSavedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {startSteps && (
        <div className="rounded-xl border border-[#CDAA73]/50 bg-[#FBF6EC] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A6D3B]">
              Démarrage · {startSteps.filter((s) => s.done).length}/{startSteps.length}
            </p>
            <button type="button" onClick={onHideStartSteps} className="text-[11px] text-slate-400 hover:text-slate-600">
              Masquer
            </button>
          </div>
          <ul className="space-y-0.5">
            {startSteps.map((step) => (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={step.onClick}
                  disabled={step.done}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/70 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${step.done ? "border-[#8FA37E] bg-[#8FA37E] text-white" : "border-black/20 bg-white"}`}>
                    {step.done ? "✓" : ""}
                  </span>
                  <span className={`min-w-0 flex-1 ${step.done ? "text-slate-400 line-through" : "text-[#1C1A17]"}`}>{step.label}</span>
                  {!step.done && step.hint && (
                    <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{step.hint}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ key, label, value, hint, highlight }) => (
          <button key={key} type="button" onClick={() => onNavigateGeneral(key)}
            className={`rounded-xl border p-4 text-left transition-colors ${highlight ? "border-[#CDAA73] bg-[#FBF6EC]" : "border-black/10 bg-white hover:bg-black/[0.02]"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
            {value != null && <p className="mt-1 text-2xl font-semibold text-[#1C1A17]">{value}</p>}
            <p className={value != null ? "mt-0.5 text-xs text-slate-500" : "mt-1 text-sm text-slate-500"}>{hint}</p>
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Pièces</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {orderedActiveRooms.map((key) => {
            const pending = roomPending(key);
            const bg = getRoomColors?.(key)?.dominant?.hex;
            const fg = bg ? textColor(bg) : "#1C1A17";
            return (
              <button key={key} type="button" onClick={() => onNavigateRoom(key)}
                style={bg ? { backgroundColor: bg, color: fg } : undefined}
                className={`rounded-xl border border-black/10 p-3 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:brightness-95 ${bg ? "" : "bg-white"}`}>
                <p className="truncate text-sm font-medium" style={bg ? undefined : { color: "#1C1A17" }}>{allRoomPresets[key]?.label}</p>
                <p className="mt-0.5 text-xs" style={{ opacity: bg ? 0.75 : 1, color: bg ? fg : "#64748b" }}>{pending > 0 ? `${pending} en attente` : "À jour"}</p>
              </button>
            );
          })}
        </div>
      </div>

      {isOwner && limitReached && (
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Limite de plan atteinte sur Renoom")}`}
          className="block rounded-xl border border-[#CDAA73] bg-[#FBF6EC] px-4 py-3 text-sm font-medium text-[#8A6D3B] hover:bg-[#F5EBD6]"
        >
          Une limite de votre plan est atteinte — Contacter l'équipe
        </a>
      )}
    </div>
  );
}
