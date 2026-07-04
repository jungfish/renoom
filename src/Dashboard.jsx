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
}) {
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
    </div>
  );
}
