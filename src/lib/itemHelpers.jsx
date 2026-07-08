import { useEffect, useRef, useState } from "react";

// Helpers UI partagés entre la liste (App.jsx) et le Kanban (ShoppingKanban.jsx)
// — extraits dans un module neutre pour éviter tout import circulaire entre
// les deux composants.
export function linkItemTitle(item) {
  const domain = (() => { try { return new URL(item.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  return item.text && item.text !== item.url ? item.text : (item.previewTitle || domain);
}

const PERSON_PALETTE = ["#e8937a","#7ab4e8","#82d9a7","#d97ab4","#a87ae8","#e8c87a","#7ae8d4","#e87a7a"];
export function personColor(name) {
  let h = 0; for (const c of (name || "?")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PERSON_PALETTE[h % PERSON_PALETTE.length];
}
export function personInitials(name) {
  return (name || "?").trim().split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase();
}
export function formatDueDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  const months = ["jan","fév","mar","avr","mai","juin","juil","aoû","sep","oct","nov","déc"];
  return new Date().getFullYear() === y ? `${day} ${months[m-1]}` : `${day} ${months[m-1]} ${y}`;
}
export function isDueOverdue(d) { return !!d && d < new Date().toISOString().split("T")[0]; }
export function isDueSoonDate(d) { if (!d) return false; const diff = (new Date(d) - new Date()) / 86400000; return diff >= 0 && diff <= 3; }

export function PersonPicker({ allPersons, value, onSelect, onCreatePerson, onClose }) {
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const filtered = (allPersons || []).filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  const exactMatch = (allPersons || []).some(p => p.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div ref={ref} className="absolute z-50 w-52 rounded-xl border border-black/10 bg-white py-1 shadow-xl" style={{ top: "calc(100% + 4px)", left: 0 }}>
      <div className="px-2 pb-1">
        <input autoFocus value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && q.trim()) { if (exactMatch) { onSelect(filtered[0]?.name || q.trim()); onClose(); } else { onCreatePerson(q.trim()); onClose(); } }
            if (e.key === "Escape") onClose();
          }}
          placeholder="Rechercher…"
          className="w-full rounded-md border border-black/10 px-2 py-1 text-xs outline-none focus:border-black/25"
        />
      </div>
      <div className="max-h-40 overflow-y-auto">
        {filtered.length === 0 && !q.trim() && (
          <div className="px-3 py-2 text-xs text-slate-400">Aucune personne pour l'instant.</div>
        )}
        {filtered.map(p => (
          <button key={p.id} type="button" onClick={() => { onSelect(p.name); onClose(); }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 ${value === p.name ? "bg-slate-50" : ""}`}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: personColor(p.name) }}>{personInitials(p.name)}</span>
            <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
            {value === p.name && <span className="text-xs text-slate-400">✓</span>}
          </button>
        ))}
        {q.trim() && !exactMatch && (
          <button type="button" onClick={() => { onCreatePerson(q.trim()); onClose(); }}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 hover:bg-slate-50">
            <span className="text-sm font-medium">+</span> Créer « {q.trim()} »
          </button>
        )}
      </div>
      {value && (
        <div className="border-t border-black/5 px-2 pt-1">
          <button type="button" onClick={() => { onSelect(""); onClose(); }}
            className="w-full rounded px-2 py-1 text-center text-xs text-slate-400 hover:bg-slate-50">Retirer</button>
        </div>
      )}
    </div>
  );
}
