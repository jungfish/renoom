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
    sendJson(res, 200, { url: body.dataUrl || body.sourceUrl });
    return;
  }

  const { dataUrl, sourceUrl, filename } = body;

  let buffer, mimeType;

  if (sourceUrl && !dataUrl) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DesignHelperBot/1.0)",
          Accept: "image/*,*/*",
        },
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      });
      if (!response.ok) {
        sendJson(res, 400, { error: "Impossible de récupérer l'image." });
        return;
      }
      mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (err) {
      sendJson(res, 500, { error: err.message || "Erreur lors du téléchargement de l'image." });
      return;
    }
  } else {
    const match = dataUrl?.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      sendJson(res, 400, { error: "dataUrl invalide." });
      return;
    }
    const [, mime, base64] = match;
    mimeType = mime;
    buffer = Buffer.from(base64, "base64");
  }

  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const finalFilename = filename || `image-${Date.now()}.${ext}`;

  try {
    const blob = await put(finalFilename, buffer, {
      access: "public",
      contentType: mimeType,
    });
    sendJson(res, 200, { url: blob.url });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors de l'upload Blob." });
  }
}
