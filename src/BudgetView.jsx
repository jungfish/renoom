import { useState } from "react";
import { STATUSES, effectiveStatus, statusMeta, deriveFlagsFromStatus, SPENT_STATUSES, PENDING_STATUSES } from "./lib/itemStatus.js";

function sumPrice(items) {
  return items.reduce((sum, i) => sum + (typeof i.price === "number" ? i.price : 0), 0);
}

// Vue Budget — objectif par projet, dépensé (Commandé + Acheté), en attente
// de dépense (Devis fait + Échantillon commandé + Sélectionné). Envie et
// Devis demandé restent visibles mais hors totaux monétaires (prix pas
// encore fiable à ce stade). Couleurs alignées sur la charte de l'app
// (or #CDAA73 = en attente, sauge #8FA37E = dépensé/soldé, terracotta = alerte)
// plutôt que des couleurs de dashboard génériques (orange/sky/rouge).
export function BudgetView({ orderedActiveRooms, allRoomPresets, roomLists, setRoomLists, saveRoomItemsFn, projectId, budgetTarget, onSetBudgetTarget, formatPrice, onNavigateToRoom }) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [addingLine, setAddingLine] = useState(false);
  const [newLine, setNewLine] = useState({ description: "", price: "", roomKey: "general", status: "selectionne" });
  const [showAllLines, setShowAllLines] = useState(false);

  const allKeys = ["general", ...orderedActiveRooms];
  const roomLabel = (key) => (key === "general" ? "Appartement" : allRoomPresets?.[key]?.label || key);

  const withPrice = (items) => items.filter((i) => typeof i.price === "number");
  const bucket = (items, statuses) => withPrice(items).filter((i) => statuses.includes(effectiveStatus(i)));

  const allShopping = allKeys.flatMap((key) => (roomLists[key]?.shopping || []).map((i) => ({ ...i, roomKey: key })));
  const spentItems = bucket(allShopping, SPENT_STATUSES);
  const pendingItems = bucket(allShopping, PENDING_STATUSES);
  const ideaCount = allShopping.filter((i) => ["envie", "devis_demande"].includes(effectiveStatus(i))).length;

  const spentAmount = sumPrice(spentItems);
  const pendingAmount = sumPrice(pendingItems);
  const currency = spentItems.find((i) => i.priceCurrency)?.priceCurrency || pendingItems.find((i) => i.priceCurrency)?.priceCurrency;
  const remaining = typeof budgetTarget === "number" ? budgetTarget - spentAmount : null;
  const progressPct = typeof budgetTarget === "number" && budgetTarget > 0
    ? Math.min(100, (spentAmount / budgetTarget) * 100)
    : 0;
  const overBudget = typeof budgetTarget === "number" && spentAmount > budgetTarget;

  const statusOrder = Object.fromEntries(STATUSES.map((s, idx) => [s.key, idx]));
  const sortByStatus = (items) => [...items].sort((a, b) => statusOrder[effectiveStatus(a)] - statusOrder[effectiveStatus(b)]);
  const linesByRoom = allKeys
    .map((key) => {
      const items = roomLists[key]?.shopping || [];
      return {
        key,
        label: roomLabel(key),
        items: sortByStatus(items),
        spent: sumPrice(bucket(items, SPENT_STATUSES)),
        pending: sumPrice(bucket(items, PENDING_STATUSES)),
      };
    })
    .filter((g) => g.items.length > 0);

  const perRoom = allKeys.map((key) => {
    const items = roomLists[key]?.shopping || [];
    return {
      key,
      label: roomLabel(key),
      spent: sumPrice(bucket(items, SPENT_STATUSES)),
      pending: sumPrice(bucket(items, PENDING_STATUSES)),
    };
  }).filter((r) => r.spent > 0 || r.pending > 0);

  const submitNewLine = (e) => {
    e.preventDefault();
    if (!newLine.description.trim()) return;
    const price = parseFloat(String(newLine.price).replace(",", "."));
    const targetRoom = newLine.roomKey;
    const currentItems = (roomLists[targetRoom] || {}).shopping || [];
    const item = {
      id: `shopping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: newLine.description.trim(),
      done: false,
      price: isNaN(price) ? undefined : price,
      priceCurrency: "EUR",
      status: newLine.status,
      ...deriveFlagsFromStatus(newLine.status),
    };
    const updated = [...currentItems, item];
    setRoomLists((prev) => ({ ...prev, [targetRoom]: { ...(prev[targetRoom] || {}), shopping: updated } }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, targetRoom, "shopping", updated);
    setNewLine({ description: "", price: "", roomKey: "general", status: "selectionne" });
    setAddingLine(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue générale</p>
        <h2 className="type-h2">Budget</h2>
      </div>

      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[#4D4A47]">Objectif</span>
          {editing ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              const v = parseFloat(inputValue.replace(",", "."));
              onSetBudgetTarget(isNaN(v) || v <= 0 ? null : v);
              setEditing(false);
            }} className="flex items-center gap-2">
              <input type="number" min="0" step="1" autoFocus value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-28 rounded-md border border-black/15 bg-white px-2 py-1 text-sm" />
              <button type="submit" className="rounded-md border border-black/15 bg-[#1C1A17] px-3 py-1 text-sm font-medium text-white">Enregistrer</button>
            </form>
          ) : (
            <button type="button" onClick={() => { setInputValue(budgetTarget ?? ""); setEditing(true); }}
              className="rounded-md border border-black/15 bg-white px-3 py-1 text-sm font-medium text-[#1C1A17] hover:bg-white/70">
              {typeof budgetTarget === "number" ? formatPrice(budgetTarget, currency) : "Définir un objectif"}
            </button>
          )}
        </div>

        {typeof budgetTarget === "number" && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
              <div className={`h-full rounded-full ${overBudget ? "bg-[#C97B5F]" : "bg-[#8FA37E]"}`}
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-semibold text-[#6E8558]">{formatPrice(spentAmount, currency)}</p>
            <p className="text-xs text-[#4D4A47]/70">Dépensé</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-[#A9803E]">{formatPrice(pendingAmount, currency)}</p>
            <p className="text-xs text-[#4D4A47]/70">En attente de dépense</p>
          </div>
          <div>
            <p className={`text-lg font-semibold ${overBudget ? "text-[#B3543A]" : "text-[#1C1A17]"}`}>
              {remaining != null ? formatPrice(remaining, currency) : "—"}
            </p>
            <p className="text-xs text-[#4D4A47]/70">Reste</p>
          </div>
        </div>

        {ideaCount > 0 && (
          <p className="mt-3 text-xs text-[#4D4A47]/70">{ideaCount} idée{ideaCount > 1 ? "s" : ""} non budgétée{ideaCount > 1 ? "s" : ""} (envie / devis demandé)</p>
        )}
      </div>

      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
        {addingLine ? (
          <form onSubmit={submitNewLine} className="flex flex-wrap items-center gap-2">
            <input type="text" autoFocus placeholder="Désignation" value={newLine.description}
              onChange={(e) => setNewLine((p) => ({ ...p, description: e.target.value }))}
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm" />
            <input type="number" step="0.01" placeholder="Prix" value={newLine.price}
              onChange={(e) => setNewLine((p) => ({ ...p, price: e.target.value }))}
              className="w-24 rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm" />
            <select value={newLine.roomKey} onChange={(e) => setNewLine((p) => ({ ...p, roomKey: e.target.value }))}
              className="rounded-md border border-black/15 bg-white px-2 py-1.5 text-xs">
              {allKeys.map((k) => <option key={k} value={k}>{roomLabel(k)}</option>)}
            </select>
            <select value={newLine.status} onChange={(e) => setNewLine((p) => ({ ...p, status: e.target.value }))}
              className="rounded-md border border-black/15 bg-white px-2 py-1.5 text-xs">
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
            </select>
            <button type="submit" className="rounded-md border border-black/15 bg-[#1C1A17] px-3 py-1.5 text-sm font-medium text-white">Ajouter</button>
            <button type="button" onClick={() => setAddingLine(false)} className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm">Annuler</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAddingLine(true)}
            className="w-full rounded-md border border-dashed border-black/20 bg-white/50 px-3 py-2 text-sm font-medium text-[#4D4A47] hover:bg-white">
            + Ajouter une ligne
          </button>
        )}
      </div>

      {(perRoom.length > 0 || linesByRoom.length > 0) && (
        <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#4D4A47]">{showAllLines ? "Toutes les lignes" : "Par pièce"}</h3>
            <div className="flex rounded-md border border-black/15 bg-white p-0.5 text-xs">
              <button type="button" onClick={() => setShowAllLines(false)}
                className={`rounded px-2 py-1 font-medium transition-colors ${!showAllLines ? "bg-[#1C1A17] text-white" : "text-[#4D4A47]"}`}>
                Par pièce
              </button>
              <button type="button" onClick={() => setShowAllLines(true)}
                className={`rounded px-2 py-1 font-medium transition-colors ${showAllLines ? "bg-[#1C1A17] text-white" : "text-[#4D4A47]"}`}>
                Toutes les lignes
              </button>
            </div>
          </div>

          {showAllLines ? (
            <div className="space-y-4">
              {linesByRoom.map((group) => (
                <div key={group.key}>
                  <button type="button"
                    onClick={() => group.key !== "general" && onNavigateToRoom?.(group.key)}
                    disabled={group.key === "general"}
                    className="mb-1 flex w-full items-center justify-between text-left disabled:cursor-default">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#4D4A47]/70 hover:text-[#4D4A47]">{group.label}</span>
                    <span className="text-xs text-slate-500">
                      {group.spent > 0 && <span className="text-[#6E8558]">{formatPrice(group.spent, currency)}</span>}
                      {group.spent > 0 && group.pending > 0 && " · "}
                      {group.pending > 0 && <span className="text-[#A9803E]">{formatPrice(group.pending, currency)} en attente</span>}
                    </span>
                  </button>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const meta = statusMeta(effectiveStatus(item));
                      return (
                        <li key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.dot }} title={meta.title} />
                          <span className="min-w-0 flex-1 truncate text-[#1C1A17]">{item.text}</span>
                          <span className="w-20 shrink-0 text-right text-slate-500">
                            {typeof item.price === "number" ? formatPrice(item.price, item.priceCurrency) : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-1">
              {perRoom.map((r) => (
                <li key={r.key}>
                  <button type="button"
                    onClick={() => r.key !== "general" && onNavigateToRoom?.(r.key)}
                    disabled={r.key === "general"}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/60 disabled:cursor-default disabled:hover:bg-transparent">
                    <span className="text-[#1C1A17]">{r.label}</span>
                    <span className="text-slate-500">
                      {r.spent > 0 && <span className="text-[#6E8558]">{formatPrice(r.spent, currency)}</span>}
                      {r.spent > 0 && r.pending > 0 && " · "}
                      {r.pending > 0 && <span className="text-[#A9803E]">{formatPrice(r.pending, currency)} en attente</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
