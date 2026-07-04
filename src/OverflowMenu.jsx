import { useEffect, useRef, useState } from "react";

// Regroupe les onglets secondaires sous un déclencheur "Plus" — évite d'afficher
// en permanence tous les onglets (divulgation progressive). Utilisé dans la
// sidebar et dans les deux barres d'onglets (générale et par pièce).
export function OverflowMenu({ items, activeKey, onSelect, variant = "topbar" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const isActive = items.some((i) => i.key === activeKey);
  const hasHiddenNotif = items.some((i) => (i.mention || 0) > 0 || (i.badge || 0) > 0);

  const triggerClass = variant === "sidebar"
    ? `group relative flex w-full items-center gap-1.5 rounded-md px-2 py-[6px] text-left text-[13px] transition-colors ${isActive ? "bg-black/[0.05] font-medium text-[#1C1A17]" : "text-[#4D4A47] hover:bg-black/[0.04] hover:text-[#1C1A17]"}`
    : `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? "bg-[#1C1A17] text-white" : "text-[#4D4A47] hover:bg-black/[0.06] hover:text-[#1C1A17]"}`;

  return (
    <div className={variant === "sidebar" ? "relative" : "relative shrink-0"} ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={triggerClass}>
        {variant === "sidebar" && isActive && (
          <span className="absolute -left-2 bottom-1 top-1 w-[2.5px] rounded-r bg-[#CDAA73]" />
        )}
        <span>Plus</span>
        {hasHiddenNotif && !isActive && (
          <span className="h-1.5 w-1.5 rounded-full bg-[#CDAA73]" />
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className={`absolute z-50 w-44 rounded-xl border border-black/10 bg-white py-1 shadow-xl ${variant === "sidebar" ? "left-0" : "right-0"}`} style={{ top: "calc(100% + 4px)" }}>
          {items.map(({ key, label, badge, mention }) => (
            <button key={key} type="button" onClick={() => { onSelect(key); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${activeKey === key ? "bg-slate-50 font-medium text-[#1C1A17]" : "text-slate-600 hover:bg-slate-50"}`}>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {mention > 0 ? (
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#CDAA73] px-1 text-[10px] font-bold text-white">{mention}</span>
              ) : badge > 0 ? (
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#EDE9E0] px-1 text-[10px] font-semibold text-[#8A8580]">{badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
