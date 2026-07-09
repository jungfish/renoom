import { useState } from "react";
import { ItemRowActions } from "./ItemRowActions.jsx";
import {
  formatDueDate, isDueOverdue, isDueSoonDate, personColor, personInitials, linkItemTitle, PersonPicker,
} from "./lib/itemHelpers.jsx";
import { STATUSES, effectiveStatus } from "./lib/itemStatus.js";

// Kanban desktop (lg:+) des envies/courses — dérive ses colonnes du champ
// `status` (7 étapes). La liste mobile garde le select de statut équivalent
// pour rester utilisable sans glisser-déposer. Les colonnes sans item se
// replient automatiquement (cliquables pour les déplier) afin qu'un cycle
// à 7 étapes reste lisible sans configuration.
export function ShoppingKanban({ items, formatPrice, onMoveItem, onDelete, onSetDueDate, onSetAssignee, onSetTitle, onSetPrice, allPersons, onCreatePerson }) {
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [editingDateId, setEditingDateId] = useState(null);
  const [openPickerId, setOpenPickerId] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [forceExpanded, setForceExpanded] = useState(() => new Set());

  const commitTitle = (item) => {
    const value = editingTitleValue.trim();
    if (value) onSetTitle(item.id, value);
    setEditingTitleId(null);
  };
  const commitPrice = (item) => {
    const parsed = parseFloat(editingPriceValue.replace(",", "."));
    onSetPrice(item.id, isNaN(parsed) ? undefined : parsed, item.priceCurrency);
    setEditingPriceId(null);
  };

  const columns = STATUSES.map((s) => ({
    ...s,
    items: items.filter((item) => effectiveStatus(item) === s.key),
  }));

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-start gap-3" style={{ minWidth: "max-content" }}>
        {columns.map((col) => {
          const isEmpty = col.items.length === 0;
          const collapsed = isEmpty && !forceExpanded.has(col.key);
          const subtotal = col.items.reduce((sum, i) => sum + (typeof i.price === "number" ? i.price : 0), 0);
          const currency = col.items.find((i) => i.priceCurrency)?.priceCurrency;

          if (collapsed) {
            return (
              <button key={col.key} type="button"
                onClick={() => setForceExpanded((prev) => new Set(prev).add(col.key))}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || draggedId;
                  setDraggedId(null); setDragOverColumn(null);
                  if (id) onMoveItem(id, col.key);
                }}
                className={`flex h-40 w-9 shrink-0 flex-col items-center justify-between rounded-xl border py-2 transition-colors ${
                  dragOverColumn === col.key ? "border-[#CDAA73] bg-[#FCF8D5]/40" : "border-black/10 bg-[#faf7f2] hover:bg-[#f3ede2]"
                }`}
                title={`${col.title} — vide, cliquer pour déplier`}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.dot }} />
                <span className="text-[10px] font-medium text-slate-500 [writing-mode:vertical-rl]">{col.title}</span>
              </button>
            );
          }

          return (
            <div key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key); }}
              onDragLeave={() => setDragOverColumn((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggedId;
                setDraggedId(null);
                setDragOverColumn(null);
                if (id) onMoveItem(id, col.key);
              }}
              className={`flex w-64 shrink-0 flex-col gap-2 rounded-xl border p-2 transition-colors ${
                dragOverColumn === col.key ? "border-[#CDAA73] bg-[#FCF8D5]/30" : "border-black/10 bg-[#faf7f2]"
              }`}>
              <div className="flex items-center justify-between px-1">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#4D4A47]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.dot }} />
                  {col.title}
                </h4>
                <span className="text-[11px] text-slate-400">{col.items.length}</span>
              </div>
              {subtotal > 0 && (
                <p className="px-1 text-xs font-semibold text-[#4D4A47]">{formatPrice(subtotal, currency)}</p>
              )}
              <div className="flex min-h-[40px] flex-col gap-2">
                {col.items.map((item) => (
                  <div key={item.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; setDraggedId(item.id); }}
                    onDragEnd={() => { setDraggedId(null); setDragOverColumn(null); }}
                    className={`group flex cursor-grab flex-col rounded-lg border border-black/10 bg-white shadow-sm transition-all active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md ${
                      draggedId === item.id ? "rotate-1 scale-[1.02] opacity-50 shadow-lg" : ""
                    }`}>
                    {item.image && (
                      <img src={item.image} alt="" draggable={false} className="h-24 w-full rounded-t-lg object-cover" />
                    )}
                    <div className="flex flex-col gap-1.5 p-2">
                      <div className="flex items-start gap-1.5">
                        {editingTitleId === item.id ? (
                          <input autoFocus value={editingTitleValue}
                            onChange={(e) => setEditingTitleValue(e.target.value)}
                            onBlur={() => commitTitle(item)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitTitle(item); if (e.key === "Escape") setEditingTitleId(null); }}
                            className="min-w-0 flex-1 rounded border border-amber-300 bg-amber-50 px-1 text-sm leading-snug text-[#1C1A17] outline-none" />
                        ) : (
                          <p className="line-clamp-2 flex-1 text-sm leading-snug text-[#1C1A17]">
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" draggable={false}
                                className="hover:underline">
                                {linkItemTitle(item)}
                              </a>
                            ) : item.text}
                          </p>
                        )}
                        <ItemRowActions
                          item={item}
                          onAddDueDate={() => setEditingDateId(item.id)}
                          onAddAssignee={() => setOpenPickerId(`item-${item.id}`)}
                          onEditTitle={() => { setEditingTitleId(item.id); setEditingTitleValue(linkItemTitle(item)); }}
                          onEditPrice={() => { setEditingPriceId(item.id); setEditingPriceValue(item.price != null ? String(item.price) : ""); }}
                          onDelete={() => onDelete(item.id)}
                        />
                      </div>
                      {editingPriceId === item.id ? (
                        <input type="number" step="0.01" autoFocus value={editingPriceValue}
                          onChange={(e) => setEditingPriceValue(e.target.value)}
                          onBlur={() => commitPrice(item)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitPrice(item); if (e.key === "Escape") setEditingPriceId(null); }}
                          placeholder="Prix"
                          className="w-20 rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-xs outline-none" />
                      ) : typeof item.price === "number" ? (
                        <button type="button" onClick={() => { setEditingPriceId(item.id); setEditingPriceValue(String(item.price)); }}
                          className="text-left text-xs font-medium text-slate-500 hover:underline" title="Modifier le prix">
                          {formatPrice(item.price, item.priceCurrency)}
                        </button>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select value={effectiveStatus(item)}
                          onChange={(e) => onMoveItem(item.id, e.target.value)}
                          className="rounded-md border border-black/15 bg-white px-1 py-0.5 text-[10px] text-slate-600">
                          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
                        </select>
                        {editingDateId === item.id ? (
                          <input type="date" autoFocus value={item.dueDate || ""}
                            onChange={(e) => onSetDueDate(item.id, e.target.value)}
                            onBlur={() => setEditingDateId(null)}
                            className="w-28 rounded border border-black/15 px-1 py-0.5 text-[10px] outline-none" />
                        ) : item.dueDate ? (
                          <button type="button" onClick={() => setEditingDateId(item.id)}
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isDueOverdue(item.dueDate) ? "bg-red-50 text-red-500" : isDueSoonDate(item.dueDate) ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                            {formatDueDate(item.dueDate)}
                          </button>
                        ) : null}
                        {(item.assignee || openPickerId === `item-${item.id}`) && (
                          <div className="relative">
                            {item.assignee && (
                              <button type="button" onClick={() => setOpenPickerId(openPickerId === `item-${item.id}` ? null : `item-${item.id}`)}
                                className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white"
                                style={{ background: personColor(item.assignee) }} title={item.assignee}>
                                {personInitials(item.assignee)}
                              </button>
                            )}
                            {openPickerId === `item-${item.id}` && (
                              <PersonPicker allPersons={allPersons} value={item.assignee || ""}
                                onSelect={(name) => { onSetAssignee(item.id, name); setOpenPickerId(null); }}
                                onCreatePerson={(name) => { onCreatePerson(name); onSetAssignee(item.id, name); setOpenPickerId(null); }}
                                onClose={() => setOpenPickerId(null)} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
