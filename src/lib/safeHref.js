// Liens saisis par les membres du projet : React 18 laisse passer href="javascript:…",
// qui s'exécuterait dans la session de la personne qui clique.
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:", "blob:"]);

export function safeHref(url) {
  if (typeof url !== "string") return undefined;
  const value = url.trim();
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value, window.location.origin);
    if (protocol === "data:") return /^data:(image\/|application\/pdf)/i.test(value) ? value : undefined;
    return SAFE_PROTOCOLS.has(protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}
