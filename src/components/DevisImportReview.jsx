import { useEffect, useState } from "react";
import { extractPdfText } from "../lib/pdfText.js";
import { STATUSES, deriveFlagsFromStatus } from "../lib/itemStatus.js";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const MIN_TEXT_LENGTH = 40;

// Écran de relecture obligatoire entre l'extraction IA d'un devis PDF et son
// ajout aux courses — aucune ligne n'est importée sans validation explicite.
// Deux points d'entrée : soit un document déjà uploadé (documentUrl, extrait
// ici), soit un texte déjà extrait ailleurs (initialText, ex: pièce jointe
// de chat) — dans ce cas la phase d'extraction est sautée.
export function DevisImportReview({ documentUrl, documentName, initialText, projectId, roomKey, authedFetch, roomLists, setRoomLists, saveRoomItemsFn, orderedActiveRooms, allRoomPresets, onClose }) {
  const [phase, setPhase] = useState(initialText ? "analyzing" : "extracting"); // extracting | analyzing | review | error | scanned
  const [error, setError] = useState("");
  const [lines, setLines] = useState([]);
  const [importing, setImporting] = useState(false);

  const roomOptions = ["general", ...(orderedActiveRooms || [])];
  const roomLabel = (key) => (key === "general" ? "Appartement" : allRoomPresets?.[key]?.label || key);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let text = initialText;
        if (!text) {
          const extracted = await extractPdfText(documentUrl);
          if (cancelled) return;
          text = extracted.text;
          if (!text || text.replace(/\s/g, "").length < MIN_TEXT_LENGTH) {
            setPhase("scanned");
            return;
          }
          setPhase("analyzing");
        }
        const res = await authedFetch(`${API_BASE}/parse-devis`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, roomKey, documentName, text }),
        });
        const payload = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(payload.error || "Analyse impossible.");
        const initialLines = (payload.lines || []).map((l, idx) => ({
          localId: `devis-${idx}`,
          checked: true,
          description: l.description,
          quantity: l.quantity ?? 1,
          unitPrice: l.unitPrice ?? l.total ?? null,
          currency: l.currency || "EUR",
          roomKey: roomOptions.includes(l.suggestedRoom) ? l.suggestedRoom : roomKey || "general",
          status: "devis_fait",
        }));
        setLines(initialLines);
        setPhase("review");
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Une erreur est survenue.");
          setPhase("error");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentUrl, initialText]);

  const updateLine = (localId, patch) => {
    setLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));
  };

  const handleImport = () => {
    const accepted = lines.filter((l) => l.checked && l.description.trim());
    if (accepted.length === 0) { onClose(); return; }
    setImporting(true);
    const byRoom = new Map();
    for (const line of accepted) {
      if (!byRoom.has(line.roomKey)) byRoom.set(line.roomKey, []);
      byRoom.get(line.roomKey).push(line);
    }
    setRoomLists((prev) => {
      const next = { ...prev };
      for (const [targetRoom, roomLines] of byRoom) {
        const currentItems = (next[targetRoom] || {}).shopping || [];
        const newItems = roomLines.map((line, idx) => ({
          id: `shopping-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          text: line.description,
          done: false,
          price: typeof line.unitPrice === "number" ? line.unitPrice : undefined,
          priceCurrency: line.currency || "EUR",
          status: line.status,
          ...deriveFlagsFromStatus(line.status),
        }));
        const updated = [...currentItems, ...newItems];
        next[targetRoom] = { ...(next[targetRoom] || {}), shopping: updated };
        if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, targetRoom, "shopping", updated);
      }
      return next;
    });
    setImporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="type-h3">Analyser « {documentName || "le document"} »</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        {phase === "extracting" && <p className="text-sm text-slate-500">Extraction du texte du PDF…</p>}
        {phase === "analyzing" && <p className="text-sm text-slate-500">Analyse du devis par l'IA…</p>}
        {phase === "scanned" && (
          <p className="text-sm text-red-500">
            Ce PDF semble être une image scannée : l'extraction automatique du texte n'est pas possible pour ce document.
          </p>
        )}
        {phase === "error" && <p className="text-sm text-red-500">{error}</p>}

        {phase === "review" && (
          <>
            {lines.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune ligne d'article détectée dans ce devis.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => (
                  <div key={line.localId} className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 p-2">
                    <input type="checkbox" checked={line.checked}
                      onChange={(e) => updateLine(line.localId, { checked: e.target.checked })} />
                    <input type="text" value={line.description}
                      onChange={(e) => updateLine(line.localId, { description: e.target.value })}
                      className="min-w-0 flex-1 rounded-md border border-black/15 px-2 py-1 text-sm" />
                    <input type="number" min="1" value={line.quantity}
                      onChange={(e) => updateLine(line.localId, { quantity: parseInt(e.target.value, 10) || 1 })}
                      className="w-14 rounded-md border border-black/15 px-1 py-1 text-sm" title="Quantité" />
                    <input type="number" step="0.01" value={line.unitPrice ?? ""}
                      onChange={(e) => updateLine(line.localId, { unitPrice: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      placeholder="Prix" className="w-20 rounded-md border border-black/15 px-1 py-1 text-sm" />
                    <select value={line.roomKey} onChange={(e) => updateLine(line.localId, { roomKey: e.target.value })}
                      className="rounded-md border border-black/15 px-1 py-1 text-xs">
                      {roomOptions.map((r) => <option key={r} value={r}>{roomLabel(r)}</option>)}
                    </select>
                    <select value={line.status} onChange={(e) => updateLine(line.localId, { status: e.target.value })}
                      className="rounded-md border border-black/15 px-1 py-1 text-xs">
                      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-black/15 px-4 py-2 text-sm">Annuler</button>
              <button type="button" onClick={handleImport} disabled={importing}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                Importer {lines.filter((l) => l.checked).length > 0 ? `(${lines.filter((l) => l.checked).length})` : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
