import { put } from "@vercel/blob";
import { allowCors, sendJson, parseJsonBody } from "./_openai.js";

export const config = {
  api: { bodyParser: { sizeLimit: "15mb" } },
};

export default async function handler(req, res) {
  allowCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Méthode non supportée." });
    return;
  }

  const body = await parseJsonBody(req);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    sendJson(res, 200, { url: body.dataUrl });
    return;
  }

  const { dataUrl, filename } = body;
  const match = dataUrl?.match(/^data:(.+);base64,(.+)$/);

  if (!match) {
    sendJson(res, 400, { error: "dataUrl invalide." });
    return;
  }

  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, "base64");

  try {
    const blob = await put(filename || `image-${Date.now()}`, buffer, {
      access: "public",
      contentType: mimeType,
    });
    sendJson(res, 200, { url: blob.url });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors de l'upload Blob." });
  }
}
