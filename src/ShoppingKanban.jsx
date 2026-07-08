import { useState } from "react";
import { ItemRowActions } from "./ItemRowActions.jsx";
import {
  formatDueDate, isDueOverdue, isDueSoonDate, personColor, personInitials, linkItemTitle, PersonPicker,
} from "./lib/itemHelpers.jsx";
import { STATUSES, effectiveStatus } from "./lib/itemStatus.js";

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" className="shrink-0 text-slate-300 group-hover:text-slate-400">
      <circle cx="2.5" cy="2.5" r="1.3" /><circle cx="7.5" cy="2.5" r="1.3" />
      <circle cx="2.5" cy="8" r="1.3" /><circle cx="7.5" cy="8" r="1.3" />
      <circle cx="2.5" cy="13.5" r="1.3" /><circle cx="7.5" cy="13.5" r="1.3" />
    </svg>
  );
}

// Kanban desktop (lg:+) des envies/courses — dérive ses colonnes du champ
// `status` (7 étapes). La liste mobile garde le select de statut équivalent
// pour rester utilisable sans glisser-déposer. Les colonnes sans item se
// replient automatiquement (cliquables pour les déplier) afin qu'un cycle
// à 7 étapes reste lisible sans configuration.
export function ShoppingKanban({ items, formatPrice, onMoveItem, onDelete, onSetDueDate, onSetAssignee, allPersons, onCreatePerson }) {
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [editingDateId, setEditingDateId] = useState(null);
  const [openPickerId, setOpenPickerId] = useState(null);
  const [forceExpanded, setForceExpanded] = useState(() => new Set());

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
              className={`flex w-[240px] shrink-0 flex-col gap-2 rounded-xl border p-2 transition-colors ${
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
                    className={`group flex cursor-grab items-start gap-1.5 rounded-lg border border-black/10 bg-white p-2 shadow-sm transition-all active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md ${
                      draggedId === item.id ? "rotate-1 scale-[1.02] opacity-50 shadow-lg" : ""
                    }`}>
                    <span className="mt-1 shrink-0"><GripIcon /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        {item.image && (
                          <img src={item.image} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[#1C1A17]">
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" draggable={false}
                                className="hover:underline">
                                {linkItemTitle(item)}
                              </a>
                            ) : item.text}
                          </p>
                          {typeof item.price === "number" && (
                            <p className="text-xs font-medium text-slate-500">{formatPrice(item.price, item.priceCurrency)}</p>
                          )}
                        </div>
                        <ItemRowActions
                          item={item}
                          onAddDueDate={() => setEditingDateId(item.id)}
                          onAddAssignee={() => setOpenPickerId(`item-${item.id}`)}
                          onDelete={() => onDelete(item.id)}
                        />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
                        {item.assignee && (
                          <div className="relative">
                            <button type="button" onClick={() => setOpenPickerId(openPickerId === `item-${item.id}` ? null : `item-${item.id}`)}
                              className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white"
                              style={{ background: personColor(item.assignee) }} title={item.assignee}>
                              {personInitials(item.assignee)}
                            </button>
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
