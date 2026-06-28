import { createServer } from "node:http";

const PORT = Number(process.env.API_PORT || 5175);
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4.1-mini";
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1";
const CHAT_IMAGE_PROMPT_MARKER = "|||IMAGE_PROMPT|||";

const CHAT_TOOLS = [
  { type: "web_search_preview" },
  {
    type: "function",
    name: "generate_image",
    description: "Génère une visualisation d'une suggestion décorative concrète et actionnable. N'utilise que si la suggestion est clairement visuelle et précise.",
    parameters: {
      type: "object",
      properties: { prompt: { type: "string", description: "Instruction en anglais pour édition d'image, 2-3 phrases, avec couleurs hex et style rétro." } },
      required: ["prompt"], strict: true,
    },
  },
  {
    type: "function",
    name: "add_to_shopping_list",
    description: "Ajoute des articles concrets à la liste de courses de la pièce active.",
    parameters: {
      type: "object",
      properties: { items: { type: "array", items: { type: "string" } } },
      required: ["items"], strict: true,
    },
  },
  {
    type: "function",
    name: "save_room_note",
    description: "Met à jour la note de design de la pièce active.",
    parameters: {
      type: "object",
      properties: { note: { type: "string" } },
      required: ["note"], strict: true,
    },
  },
];
const MAX_BODY_BYTES = 30 * 1024 * 1024;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(payload));
}

function getSupabaseHeaders(req, useServiceRole = false) {
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers["authorization"] || "";
  const userToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const key = useServiceRole ? (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY) : SUPABASE_ANON_KEY;
  const bearer = useServiceRole ? key : (userToken || SUPABASE_ANON_KEY);
  return { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${bearer}`, "Content-Type": "application/json" };
}

async function getAuthUser(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${token}` },
    });
    const data = await r.json();
    return data?.id ? data : null;
  } catch { return null; }
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
      if (!id || !/^[a-z0-9]{6,16}$/.test(id)) { sendJson(res, 400, { error: "ID invalide." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      if (!SUPABASE_URL) { sendJson(res, 500, { error: "Configuration Supabase manquante." }); return; }
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      try {
        // Utiliser service role pour local dev (contourne RLS)
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(id)}&select=state,name,invite_code,owner_id`,
          { headers: getSupabaseHeaders(req, true) }
        );
        if (!sbRes.ok) { sendJson(res, 404, { error: "Projet introuvable." }); return; }
        const rows = await sbRes.json();
        if (!rows.length) { sendJson(res, 404, { error: "Projet introuvable." }); return; }
        const row = rows[0];
        sendJson(res, 200, {
          state: row.state,
          name: row.name,
          inviteCode: row.invite_code,
          isOwner: row.owner_id === user.id,
        });
      } catch (err) { sendJson(res, 500, { error: err.message }); }
      return;
    }

    if (req.url.startsWith("/api/list-snapshots")) {
      const urlObj = new URL(req.url, "http://localhost");
      const projectId = urlObj.searchParams.get("projectId");
      if (!projectId) { sendJson(res, 400, { error: "projectId requis." }); return; }
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      try {
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/project_snapshots?project_id=eq.${encodeURIComponent(projectId)}&select=id,saved_at,user_id,label&order=saved_at.desc&limit=10`,
          { headers: getSupabaseHeaders(req, true) }
        );
        const rows = await sbRes.json();
        sendJson(res, 200, { snapshots: (rows || []).map(s => ({ id: s.id, savedAt: s.saved_at, label: s.label, authorName: s.user_id === user.id ? "Moi" : "Autre" })) });
      } catch (err) { sendJson(res, 500, { error: err.message }); }
      return;
    }

    sendJson(res, 404, { error: "Route inconnue." });
    return;
  }

  const POST_ROUTES = ["/api/generate-image", "/api/analyze-image", "/api/upload-image", "/api/chat", "/api/save-project", "/api/join-project", "/api/restore-snapshot"];
  if (req.method !== "POST" || !POST_ROUTES.includes(req.url)) {
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
      const { state, id, snapshot, snapshotLabel } = body;
      if (!state) { sendJson(res, 400, { error: "state requis." }); return; }
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      if (!SUPABASE_URL) { sendJson(res, 500, { error: "Configuration Supabase manquante." }); return; }
      const projectId = id || Math.random().toString(36).slice(2, 10);
      const isNew = !id;
      const upsertData = { id: projectId, state, updated_at: new Date().toISOString() };
      if (isNew) upsertData.owner_id = user.id;
      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
        method: "POST",
        headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify(upsertData),
      });
      if (!sbRes.ok) { sendJson(res, 500, { error: await sbRes.text() }); return; }
      if (isNew) {
        await fetch(`${SUPABASE_URL}/rest/v1/project_members`, {
          method: "POST",
          headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
          body: JSON.stringify({ project_id: projectId, user_id: user.id, role: "owner" }),
        });
      }
      if (snapshot) {
        // Snapshot via RPC
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_snapshot`, {
          method: "POST",
          headers: getSupabaseHeaders(req, true),
          body: JSON.stringify({ p_project_id: projectId, p_user_id: user.id, p_state: state, p_label: snapshotLabel || "Sauvegarde" }),
        });
      }
      sendJson(res, 200, { id: projectId });
      return;
    }

    if (req.url === "/api/join-project") {
      const { inviteCode } = body;
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const projRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?invite_code=eq.${encodeURIComponent(inviteCode)}&select=id,owner_id`, { headers: getSupabaseHeaders(req, true) });
      const projs = await projRes.json();
      if (!projs?.length) { sendJson(res, 404, { error: "Code invalide." }); return; }
      const project = projs[0];
      await fetch(`${SUPABASE_URL}/rest/v1/project_members`, {
        method: "POST",
        headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({ project_id: project.id, user_id: user.id, role: "editor" }),
      });
      sendJson(res, 200, { projectId: project.id });
      return;
    }

    if (req.url === "/api/restore-snapshot") {
      const { projectId, snapshotId } = body;
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const snapRes = await fetch(`${SUPABASE_URL}/rest/v1/project_snapshots?id=eq.${snapshotId}&project_id=eq.${encodeURIComponent(projectId)}&select=state,label`, { headers: getSupabaseHeaders(req, true) });
      const snaps = await snapRes.json();
      if (!snaps?.length) { sendJson(res, 404, { error: "Snapshot introuvable." }); return; }
      await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: getSupabaseHeaders(req, true),
        body: JSON.stringify({ state: snaps[0].state, updated_at: new Date().toISOString() }),
      });
      sendJson(res, 200, { state: snaps[0].state });
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
        ctx.generalContext ? `Goûts & contraintes de l'appartement: ${ctx.generalContext}` : null,
        ctx.generalContext ? "" : null,
        `Pièce active — ${ctx.label || "pièce"}: ${ctx.line || ""}`,
        `Palette: dominante ${ctx.dominantName || ""} (${ctx.dominantHex || ""}), secondaire ${ctx.secondaryName || ""} (${ctx.secondaryHex || ""}), accent ${ctx.accentName || ""} (${ctx.accentHex || ""})`,
        ctx.roomNote ? `Notes: ${ctx.roomNote}` : null,
        ctx.imageMetadataSummary ? `Contexte visuel: ${ctx.imageMetadataSummary}` : null,
        ctx.shoppingItems?.length ? `En liste de courses: ${ctx.shoppingItems.join(", ")}` : null,
        ctx.materialSummary?.length ? `Matériaux choisis: ${ctx.materialSummary.join("; ")}` : null,
        ctx.allRoomsSummary ? `Autres pièces: ${ctx.allRoomsSummary}` : null,
        "",
        "Règles:",
        "- Réponds en français, de façon concise et praticable (3-6 phrases max par réponse)",
        "- Reste dans l'univers rétro, coloré, doux — jamais d'accents rouges, pas de style minimaliste froid",
        "- Si l'utilisateur demande des produits, utilise la recherche web pour trouver des résultats réels et inclus des URLs directes",
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
          stream: true,
          tools: CHAT_TOOLS,
          instructions: systemPrompt,
          input: historyToSend.map((m) => {
            const imgList = m.images?.length ? m.images : m.image ? [m.image] : [];
            if (m.role === "user" && imgList.length > 0) {
              return {
                role: m.role,
                content: [
                  ...(m.content ? [{ type: "input_text", text: m.content }] : []),
                  ...imgList.map((img) => ({ type: "input_image", image_url: img })),
                ],
              };
            }
            return {
              role: m.role,
              content: [{ type: m.role === "user" ? "input_text" : "output_text", text: m.content }],
            };
          }),
        }),
      });

      if (!openaiResponse.ok) {
        const errPayload = await openaiResponse.json().catch(() => ({}));
        sendJson(res, openaiResponse.status, { error: errPayload.error?.message || "Le chat IA a échoué." });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      const writeEvent = (event, data) => {
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* client disconnected */ }
      };

      const reader = openaiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (currentEvent === "response.output_text.delta" && parsed.delta) {
                fullText += parsed.delta;
                writeEvent("delta", { text: parsed.delta });
              } else if (currentEvent === "response.output_item.done" && parsed.item?.type === "function_call") {
                try {
                  const args = JSON.parse(parsed.item.arguments);
                  writeEvent("tool_call", { name: parsed.item.name, args });
                } catch { /* malformed */ }
              }
            } catch { /* non-JSON */ }
          }
        }
      }

      const markerStart = fullText.indexOf(CHAT_IMAGE_PROMPT_MARKER);
      let imagePrompt = null;
      if (markerStart !== -1) {
        const afterFirst = fullText.slice(markerStart + CHAT_IMAGE_PROMPT_MARKER.length);
        const markerEnd = afterFirst.indexOf(CHAT_IMAGE_PROMPT_MARKER);
        const jsonPart = markerEnd !== -1 ? afterFirst.slice(0, markerEnd) : afterFirst;
        try { imagePrompt = JSON.parse(jsonPart.trim()).prompt || null; } catch { /* ignore */ }
      }
      writeEvent("done", { imagePrompt: imagePrompt || undefined });
      res.end();
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
