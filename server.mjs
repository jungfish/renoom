import { createServer } from "node:http";

const PORT = Number(process.env.API_PORT || 5175);
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4.1-mini";
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1";
const CHAT_IMAGE_PROMPT_MARKER = "|||IMAGE_PROMPT|||";
const MAX_BODY_BYTES = 30 * 1024 * 1024;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Image trop lourde pour cette requête locale."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("JSON invalide."));
      }
    });
    req.on("error", reject);
  });
}

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Image invalide: data URL attendue.");
  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  return new Blob([bytes], { type: mimeType });
}

function parseMetadata(text, section) {
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      type: parsed.type || section || "reference",
      style: parsed.style || "",
      inspiration: parsed.inspiration || "",
      materials: Array.isArray(parsed.materials) ? parsed.materials.slice(0, 5) : [],
      colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 5) : [],
      details: Array.isArray(parsed.details) ? parsed.details.slice(0, 5) : [],
    };
  } catch {
    return {
      type: section || "reference",
      style: "",
      inspiration: text,
      materials: [],
      colors: [],
      details: [],
    };
  }
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  // GET routes
  if (req.method === "GET") {
    if (req.url.startsWith("/api/load-project")) {
      const urlObj = new URL(req.url, "http://localhost");
      const id = urlObj.searchParams.get("id");
      if (!id || !/^[a-z0-9]{6,16}$/.test(id)) {
        sendJson(res, 400, { error: "ID invalide." });
        return;
      }
      const storeId = (process.env.BLOB_STORE_ID || "").replace("store_", "").toLowerCase();
      if (!storeId) {
        sendJson(res, 500, { error: "BLOB_STORE_ID manquant." });
        return;
      }
      try {
        const blobRes = await fetch(`https://${storeId}.public.blob.vercel-storage.com/projects/${id}.json`);
        if (!blobRes.ok) { sendJson(res, 404, { error: "Projet introuvable." }); return; }
        const state = await blobRes.json();
        sendJson(res, 200, { state });
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }
    sendJson(res, 404, { error: "Route inconnue." });
    return;
  }

  if (req.method !== "POST" || !["/api/generate-image", "/api/analyze-image", "/api/upload-image", "/api/chat", "/api/save-project"].includes(req.url)) {
    sendJson(res, 404, { error: "Route inconnue." });
    return;
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      sendJson(res, 500, { error: "OPENAI_API_KEY est manquante dans le serveur local." });
      return;
    }

    const body = await readJson(req);

    if (req.url === "/api/save-project") {
      const { state, id } = body;
      if (!state) { sendJson(res, 400, { error: "state requis." }); return; }
      if (!process.env.BLOB_READ_WRITE_TOKEN) { sendJson(res, 500, { error: "BLOB_READ_WRITE_TOKEN manquant." }); return; }
      const { put } = await import("@vercel/blob");
      const projectId = id || Math.random().toString(36).slice(2, 10);
      await put(`projects/${projectId}.json`, JSON.stringify(state), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
      });
      sendJson(res, 200, { id: projectId });
      return;
    }

    if (req.url === "/api/upload-image") {
      const { dataUrl, filename } = body;
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        sendJson(res, 200, { url: dataUrl });
        return;
      }
      const { put } = await import("@vercel/blob");
      const match = dataUrl?.match(/^data:(.+);base64,(.+)$/);
      if (!match) {
        sendJson(res, 400, { error: "dataUrl invalide." });
        return;
      }
      const [, mimeType, base64] = match;
      const buffer = Buffer.from(base64, "base64");
      const blob = await put(filename || `image-${Date.now()}`, buffer, {
        access: "public",
        contentType: mimeType,
      });
      sendJson(res, 200, { url: blob.url });
      return;
    }

    if (req.url === "/api/chat") {
      const { messages, roomContext } = body;
      if (!messages?.length) {
        sendJson(res, 400, { error: "Messages requis." });
        return;
      }
      const ctx = roomContext || {};
      const systemPrompt = [
        "Tu es un assistant de design intérieur expert en décoration française contemporaine et rétro.",
        "Tu aides l'utilisateur à prendre des décisions de design pour son appartement.",
        "",
        `Contexte de la pièce active — ${ctx.label || "pièce"}:`,
        `Ligne directrice: ${ctx.line || ""}`,
        `Palette: dominante ${ctx.dominantName || ""} (${ctx.dominantHex || ""}), secondaire ${ctx.secondaryName || ""} (${ctx.secondaryHex || ""}), accent ${ctx.accentName || ""} (${ctx.accentHex || ""})`,
        ctx.roomNote ? `Notes utilisateur: ${ctx.roomNote}` : null,
        ctx.imageMetadataSummary ? `Contexte visuel: ${ctx.imageMetadataSummary}` : null,
        "",
        "Règles:",
        "- Réponds en français, de façon concise et praticable (3-6 phrases max par réponse)",
        "- Reste dans l'univers rétro, coloré, doux — jamais d'accents rouges, pas de style minimaliste froid",
        `- Si tu suggères une modification visuelle concrète et précise, termine ta réponse par exactement ce bloc sur une nouvelle ligne: ${CHAT_IMAGE_PROMPT_MARKER}{"prompt":"<instruction en anglais pour édition d'image>"}${CHAT_IMAGE_PROMPT_MARKER}`,
        "- N'inclus ce bloc que si la suggestion est clairement visuelle et actionnable",
      ].filter(Boolean).join("\n");

      const historyToSend = messages.slice(-20);
      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          instructions: systemPrompt,
          input: historyToSend.map((m) => ({
            role: m.role,
            content: m.role === "user" && m.image
              ? [
                  ...(m.content ? [{ type: "input_text", text: m.content }] : []),
                  { type: "input_image", image_url: m.image },
                ]
              : [{ type: m.role === "user" ? "input_text" : "output_text", text: m.content }],
          })),
        }),
      });
      const chatPayload = await openaiResponse.json();
      if (!openaiResponse.ok) {
        sendJson(res, openaiResponse.status, { error: chatPayload.error?.message || "Le chat IA a échoué." });
        return;
      }
      const rawText = chatPayload.output_text ??
        chatPayload.output?.find(o => o.type === "message")?.content?.find(c => c.type === "output_text")?.text ??
        "";
      const markerStart = rawText.indexOf(CHAT_IMAGE_PROMPT_MARKER);
      let chatContent = rawText.trim();
      let imagePrompt = null;
      if (markerStart !== -1) {
        chatContent = rawText.slice(0, markerStart).trim();
        const afterFirst = rawText.slice(markerStart + CHAT_IMAGE_PROMPT_MARKER.length);
        const markerEnd = afterFirst.indexOf(CHAT_IMAGE_PROMPT_MARKER);
        const jsonPart = markerEnd !== -1 ? afterFirst.slice(0, markerEnd) : afterFirst;
        try { imagePrompt = JSON.parse(jsonPart.trim()).prompt || null; } catch { /* ignore */ }
      }
      sendJson(res, 200, { content: chatContent, imagePrompt: imagePrompt || undefined });
      return;
    }

    const { image, prompt, context, section } = body;
    if (req.url === "/api/analyze-image") {
      if (!image) {
        sendJson(res, 400, { error: "Image requise." });
        return;
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ANALYSIS_MODEL,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: [
                    "Analyse cette image pour créer des métadonnées courtes de design intérieur.",
                    `Contexte: ${context || "image d'inspiration appartement"}.`,
                    `Section de l'app: ${section || "reference"}.`,
                    "Réponds uniquement en JSON valide, sans markdown.",
                    "Schéma exact: {\"type\":\"photo | dessin architecte | plan | croquis | moodboard | matériau | référence produit\",\"style\":\"string court\",\"inspiration\":\"string court\",\"materials\":[\"...\"],\"colors\":[\"...\"],\"details\":[\"...\"]}.",
                    "Les champs doivent être courts, en français, orientés interior design. N'invente pas de marque.",
                  ].join("\n"),
                },
                { type: "input_image", image_url: image },
              ],
            },
          ],
        }),
      });

      const payload = await openaiResponse.json();
      if (!openaiResponse.ok) {
        sendJson(res, openaiResponse.status, { error: payload.error?.message || "L'analyse OpenAI a échoué." });
        return;
      }

      sendJson(res, 200, { analysis: parseMetadata(payload.output_text || "", section) });
      return;
    }

    if (!image || !prompt) {
      sendJson(res, 400, { error: "Image et prompt sont requis." });
      return;
    }

    const blob = dataUrlToBlob(image);
    const form = new FormData();
    form.append("model", MODEL);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("output_format", "webp");
    form.append("output_compression", "82");
    form.append("image", blob, `source.${blob.type.split("/")[1] || "png"}`);

    const openaiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });

    const payload = await openaiResponse.json();
    if (!openaiResponse.ok) {
      sendJson(res, openaiResponse.status, { error: payload.error?.message || "La génération OpenAI a échoué." });
      return;
    }

    const imageData = payload.data?.[0];
    if (imageData?.b64_json) {
      sendJson(res, 200, { image: `data:image/webp;base64,${imageData.b64_json}` });
      return;
    }

    if (imageData?.url) {
      sendJson(res, 200, { image: imageData.url });
      return;
    }

    sendJson(res, 500, { error: "Réponse OpenAI sans image exploitable." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur locale." });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Design Helper API ready on http://127.0.0.1:${PORT}`);
});
