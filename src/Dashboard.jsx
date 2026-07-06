import { useEffect, useState } from "react";
import { useEntitlements } from "./hooks/useEntitlements";
import { SUPPORT_EMAIL } from "./config";

// Vue d'accueil : point d'entrée unique qui résume ce qui demande de l'attention,
// pour ne pas forcer les utilisateurs à choisir une pièce/onglet dès l'ouverture.
export function Dashboard({
  projectName,
  lastSavedAt,
  orderedActiveRooms,
  allRoomPresets,
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
  projectId,
}) {
  const [aiUsage, setAiUsage] = useState(null);
  const entitlements = useEntitlements({ authedFetch, apiBase, enabled: !!authedFetch });

  useEffect(() => {
    if (!isOwner || !projectId || !authedFetch) return;
    authedFetch(`${apiBase}/load-room-items?projectId=${encodeURIComponent(projectId)}&type=ai-usage`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAiUsage(data); })
      .catch(() => {});
  }, [isOwner, projectId, authedFetch, apiBase]);

  const roomPending = (key) => {
    const list = roomLists[key] || {};
    return [...(list.shopping || []), ...(list.todos || [])].filter((i) => !i.done).length;
  };

  const cards = [
    {
      key: "todos",
      label: "À faire",
      value: totalPending,
      hint: totalPending > 0 ? `${totalPending} en attente` : "Rien en attente",
      highlight: totalPending > 0,
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map(({ key, label, value, hint, highlight }) => (
          <button key={key} type="button" onClick={() => onNavigateGeneral(key)}
            className={`rounded-xl border p-4 text-left transition-colors ${highlight ? "border-[#CDAA73] bg-[#FBF6EC]" : "border-black/10 bg-white hover:bg-black/[0.02]"}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#1C1A17]">{value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Pièces</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {orderedActiveRooms.map((key) => {
            const pending = roomPending(key);
            return (
              <button key={key} type="button" onClick={() => onNavigateRoom(key)}
                className="rounded-xl border border-black/10 bg-white p-3 text-left transition-colors hover:bg-black/[0.02]">
                <p className="truncate text-sm font-medium text-[#1C1A17]">{allRoomPresets[key]?.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{pending > 0 ? `${pending} en attente` : "À jour"}</p>
              </button>
            );
          })}
        </div>
      </div>

      {isOwner && entitlements.plan && entitlements.limits && entitlements.usage && (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Mon abonnement</p>
            <span className="rounded-full bg-[#FBF6EC] px-2 py-0.5 text-[11px] font-medium text-[#8A6D3B]">{entitlements.plan.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
            <div>
              <p className="text-slate-400">Projets actifs</p>
              <p className="font-semibold text-[#1C1A17]">{entitlements.usage.activeProjects} / {entitlements.limits.max_active_projects}</p>
            </div>
            <div>
              <p className="text-slate-400">Messages IA / jour</p>
              <p className="font-semibold text-[#1C1A17]">{entitlements.usage.aiMessages24h} / {entitlements.limits.ai_messages_per_day}</p>
            </div>
            <div>
              <p className="text-slate-400">Images IA / mois</p>
              <p className="font-semibold text-[#1C1A17]">{entitlements.usage.aiImages30d} / {entitlements.limits.ai_images_per_month}</p>
            </div>
            <div>
              <p className="text-slate-400">Membres / projet</p>
              <p className="font-semibold text-[#1C1A17]">Jusqu'à {entitlements.limits.max_members_per_project}, propriétaire inclus</p>
            </div>
          </div>
          {(entitlements.usage.activeProjects >= entitlements.limits.max_active_projects ||
            entitlements.usage.aiMessages24h >= entitlements.limits.ai_messages_per_day ||
            entitlements.usage.aiImages30d >= entitlements.limits.ai_images_per_month) && (
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Limite de plan atteinte sur Renoom")}`}
              className="mt-3 inline-block rounded-md border border-[#CDAA73] bg-[#FBF6EC] px-3 py-1.5 text-xs font-medium text-[#8A6D3B] hover:bg-[#F5EBD6]"
            >
              Une limite de ton plan est atteinte — Contacter l'équipe
            </a>
          )}
        </div>
      )}

      {isOwner && aiUsage && (
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Conso IA (24h, visible par toi seul)</p>
          <p className="text-sm text-slate-600">
            Global : <span className="font-semibold text-[#1C1A17]">{aiUsage.global.count}</span> / {aiUsage.global.limit} messages
          </p>
          <div className="mt-2 space-y-1">
            {aiUsage.perUser.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">{u.name}</span>
                <span>{u.messages24h} / {aiUsage.perUserLimit} msg · {u.tokens24h.toLocaleString("fr-FR")} tokens{u.webSearch24h > 0 ? ` · ${u.webSearch24h} recherches web` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
