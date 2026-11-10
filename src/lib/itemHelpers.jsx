import { useEffect, useRef, useState } from "react";

// Helpers UI partagés entre la liste (App.jsx) et le Kanban (ShoppingKanban.jsx)
// — extraits dans un module neutre pour éviter tout import circulaire entre
// les deux composants.
// Certains articles stockent encore "Titre — https://..." (aperçu jamais résolu) :
// l'URL est déjà affichée à part, on la retire du titre.
export function stripTrailingUrl(text) {
  if (!text) return text;
  const cleaned = text.replace(/[\s\-–—:]*https?:\/\/\S+$/i, "").trim();
  return cleaned || text;
}

// ── Quantité des achats ────────────────────────────────────────────────────
// `price` reste le prix unitaire ; `quantity` (décimale, ex: 12,5 m²) est
// absente quand elle vaut 1. Tous les totaux passent par lineTotal().
export function itemQuantity(item) {
  const q = Number(item?.quantity);
  return Number.isFinite(q) && q > 0 ? q : 1;
}
export function hasQuantity(item) {
  return itemQuantity(item) !== 1;
}
export function lineTotal(item) {
  return typeof item?.price === "number" ? item.price * itemQuantity(item) : 0;
}
export function sumLineTotals(items) {
  return items.reduce((sum, i) => sum + lineTotal(i), 0);
}
export function formatQuantity(q) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(q);
}
// Saisie libre ("2", "12,5", " 3 ") → nombre > 0, ou null si invalide/vide
export function parseQuantity(raw) {
  const q = parseFloat(String(raw ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(q) && q > 0 ? Math.round(q * 1000) / 1000 : null;
}
// Patch à appliquer à l'item : 1 ou vide → on retire le champ
export function quantityPatch(raw) {
  const q = parseQuantity(raw);
  return { quantity: q == null || q === 1 ? undefined : q };
}

// Badge "2 ×" devant le prix, cliquable pour éditer. Édition contrôlée par
// le parent (`editing`) pour pouvoir l'ouvrir aussi depuis le menu "⋯".
// Les clics ne remontent pas : le badge peut vivre dans un lien (aperçu).
export function QuantityControl({ item, editing, onStartEdit, onSave, onCancel, className = "text-xs" }) {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (editing) setValue(hasQuantity(item) ? formatQuantity(itemQuantity(item)).replace(/\s/g, "") : "");
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  if (editing) {
    return (
      <input type="text" inputMode="decimal" autoFocus value={value} placeholder="Qté"
        onClick={stop}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(quantityPatch(value))}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(quantityPatch(value)); if (e.key === "Escape") onCancel(); }}
        className={`w-14 shrink-0 rounded border border-amber-300 bg-white px-1 py-0.5 outline-none ${className}`} />
    );
  }
  if (!hasQuantity(item)) return null;
  return (
    <button type="button" onClick={(e) => { stop(e); onStartEdit(); }} title="Modifier la quantité"
      className={`shrink-0 font-semibold text-slate-600 hover:underline ${className}`}>
      {formatQuantity(itemQuantity(item))} ×
    </button>
  );
}

export function siteDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export function linkItemTitle(item) {
  return item.text && item.text !== item.url ? stripTrailingUrl(item.text) : (item.previewTitle || siteDomain(item.url));
}

// Logo du site marchand (service public de favicons de Google, sans clé) ;
// initiale du domaine si l'image ne charge pas.
export function SiteFavicon({ domain, size = 20 }) {
  const [failed, setFailed] = useState(false);
  if (!domain) return null;
  if (failed) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded bg-slate-200 font-semibold uppercase text-slate-500"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      >
        {domain.charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded bg-white object-contain"
      style={{ width: size, height: size }}
    />
  );
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
