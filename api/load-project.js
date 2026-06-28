import { allowCors, sendJson } from "./_openai.js";

export default async function handler(req, res) {
  allowCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Méthode non supportée." });
    return;
  }

  const id = req.query?.id || new URL(req.url || "/", "http://localhost").searchParams.get("id");

  if (!id || !/^[a-z0-9]{6,16}$/.test(id)) {
    sendJson(res, 400, { error: "ID invalide." });
    return;
  }

  const storeId = (process.env.BLOB_STORE_ID || "").replace("store_", "").toLowerCase();
  if (!storeId) {
    sendJson(res, 500, { error: "BLOB_STORE_ID manquant." });
    return;
  }

  const blobUrl = `https://${storeId}.public.blob.vercel-storage.com/projects/${id}.json`;

  try {
    const response = await fetch(`${blobUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      sendJson(res, 404, { error: "Projet introuvable." });
      return;
    }
    const state = await response.json();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    sendJson(res, 200, { state });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors du chargement." });
  }
}
