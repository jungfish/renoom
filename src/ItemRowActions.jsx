import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 176; // w-44

// Bouton "⋯" toujours visible qui regroupe les actions secondaires d'un item
// (ajouter échéance, assigner, modifier, supprimer) — remplace les icônes qui
// n'apparaissaient qu'au survol (inutilisables au toucher). La sélection pour
// l'achat se fait désormais via le select de statut affiché sur la ligne.
// Le menu est rendu via un portail en position fixe (coordonnées calculées au
// clic) car le Kanban est dans un conteneur `overflow-x-auto`, qui force
// l'axe vertical à cliper aussi (règle CSS overflow) — un menu positionné en
// absolute serait coupé près du bas d'une colonne.
export function ItemRowActions({ item, onAddDueDate, onAddAssignee, onEditTitle, onEditPrice, onDelete }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button ref={btnRef} type="button" onClick={toggleOpen} title="Autres actions"
        className="grid h-5 w-5 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
      {open && createPortal(
        <div ref={menuRef} className="fixed z-50 w-44 rounded-xl border border-black/10 bg-white py-1 shadow-xl" style={{ top: coords.top, left: coords.left }}>
          <button type="button" onClick={() => { onAddDueDate(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {item.dueDate ? "Modifier l'échéance" : "Ajouter une échéance"}
          </button>
          <button type="button" onClick={() => { onAddAssignee(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
            {item.assignee ? "Modifier l'assignation" : "Assigner"}
          </button>
          {onEditTitle && (
            <button type="button" onClick={() => { onEditTitle(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Modifier le titre
            </button>
          )}
          {onEditPrice && (
            <button type="button" onClick={() => { onEditPrice(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h12"/><path d="M4 14h9"/><path d="M17 5a8 8 0 1 0 0 14"/></svg>
              {item.price != null ? "Modifier le prix" : "Ajouter un prix"}
            </button>
          )}
          <div className="my-1 border-t border-black/5" />
          <button type="button" onClick={() => { onDelete(); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Supprimer
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
