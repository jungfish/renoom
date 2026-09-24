import { useEffect, useState } from "react";
import { useEntitlements } from "../hooks/useEntitlements";
import { SUPPORT_EMAIL } from "../config";

const formatLimit = (n) => (n >= 100000 ? "∞" : n);

// Détail du plan et de la consommation IA — ouvert depuis le menu utilisateur,
// pour garder l'accueil centré sur le projet.
export function PlanUsageModal({ authedFetch, apiBase, projectId, isOwner, onClose }) {
  const [aiUsage, setAiUsage] = useState(null);
  const entitlements = useEntitlements({ authedFetch, apiBase, enabled: !!authedFetch });

  useEffect(() => {
    if (!isOwner || !projectId || !authedFetch) return;
    authedFetch(`${apiBase}/load-room-items?projectId=${encodeURIComponent(projectId)}&type=ai-usage`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAiUsage(data); })
      .catch(() => {});
  }, [isOwner, projectId, authedFetch, apiBase]);

  const { plan, limits, usage } = entitlements;
  const limitReached = !!(limits && usage) && (
    usage.activeProjects >= limits.max_active_projects ||
    usage.aiMessages24h >= limits.ai_messages_per_day ||
    usage.aiImages30d >= limits.ai_images_per_month ||
    usage.pdfExports30d >= limits.pdf_exports_per_month
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Abonnement et usage</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-lg leading-none text-slate-400 hover:text-slate-700">×</button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {plan && limits && usage ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Mon abonnement</p>
                <span className="rounded-full bg-[#FBF6EC] px-2 py-0.5 text-[11px] font-medium text-[#8A6D3B]">{plan.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                  <p className="text-slate-400">Projets actifs</p>
                  <p className="font-semibold text-[#1C1A17]">{usage.activeProjects} / {formatLimit(limits.max_active_projects)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Messages IA / jour</p>
                  <p className="font-semibold text-[#1C1A17]">{usage.aiMessages24h} / {formatLimit(limits.ai_messages_per_day)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Images IA / mois</p>
                  <p className="font-semibold text-[#1C1A17]">{usage.aiImages30d} / {formatLimit(limits.ai_images_per_month)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Exports PDF / mois</p>
                  <p className="font-semibold text-[#1C1A17]">{usage.pdfExports30d} / {formatLimit(limits.pdf_exports_per_month)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-400">Membres / projet</p>
                  <p className="font-semibold text-[#1C1A17]">Jusqu'à {formatLimit(limits.max_members_per_project)}, propriétaire inclus</p>
                </div>
              </div>
              {limitReached && (
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Limite de plan atteinte sur Renoom")}`}
                  className="mt-3 inline-block rounded-md border border-[#CDAA73] bg-[#FBF6EC] px-3 py-1.5 text-xs font-medium text-[#8A6D3B] hover:bg-[#F5EBD6]"
                >
                  Une limite de votre plan est atteinte — Contacter l'équipe
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{entitlements.loading ? "Chargement…" : "Informations indisponibles pour le moment."}</p>
          )}

          {isOwner && aiUsage && (
            <div className="border-t border-black/8 pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Conso IA du projet (24h, visible par vous seul)</p>
              <p className="text-sm text-slate-600">
                Global : <span className="font-semibold text-[#1C1A17]">{aiUsage.global.count}</span> / {aiUsage.global.limit} messages
              </p>
              <div className="mt-2 space-y-1">
                {aiUsage.perUser.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="truncate">{u.name}</span>
                    <span className="shrink-0">{u.messages24h} / {aiUsage.perUserLimit} msg · {u.tokens24h.toLocaleString("fr-FR")} tokens{u.webSearch24h > 0 ? ` · ${u.webSearch24h} recherche${u.webSearch24h > 1 ? "s" : ""} web` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
