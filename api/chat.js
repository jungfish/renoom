import { parseJsonBody } from "./_openai.js";

export const config = {
  api: { bodyParser: false, responseLimit: false },
};

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1";
const IMAGE_PROMPT_MARKER = "|||IMAGE_PROMPT|||";

const CHAT_TOOLS = [
  { type: "web_search_preview" },
  {
    type: "function",
    name: "generate_image",
    description: "Génère une visualisation d'une suggestion décorative concrète et actionnable. N'utilise que si la suggestion est clairement visuelle et précise.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Instruction en anglais pour édition d'image, 2-3 phrases, avec couleurs hex et style rétro." },
      },
      required: ["prompt"],
      strict: true,
    },
  },
  {
    type: "function",
    name: "add_to_shopping_list",
    description: "Ajoute des articles concrets à la liste de courses de la pièce active. Utilise si l'utilisateur demande des produits spécifiques ou valide des articles.",
    parameters: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "string" }, description: "Noms d'articles à ajouter (ex: 'Applique murale vintage cuivre')." },
      },
      required: ["items"],
      strict: true,
    },
  },
  {
    type: "function",
    name: "add_to_todo_list",
    description: "Ajoute des tâches à la liste de todos de la pièce active. Utilise si l'utilisateur mentionne quelque chose à faire, une action à réaliser ou une décision à ne pas oublier.",
    parameters: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "string" }, description: "Tâches à ajouter (ex: 'Mesurer l\\'espace entre les deux fenêtres')." },
      },
      required: ["items"],
      strict: true,
    },
  },
  {
    type: "function",
    name: "save_room_note",
    description: "Met à jour la note de design de la pièce active. Utilise si l'utilisateur valide une décision importante à retenir.",
    parameters: {
      type: "object",
      properties: {
        note: { type: "string", description: "Note de design à sauvegarder pour cette pièce." },
      },
      required: ["note"],
      strict: true,
    },
  },
];

function buildSystemPrompt(ctx) {
  return [
    "Tu es un assistant de design intérieur expert en décoration française contemporaine et rétro.",
    "Tu aides l'utilisateur à prendre des décisions de design pour son appartement.",
    "",
    ctx.generalContext ? `Goûts & contraintes de l'appartement: ${ctx.generalContext}` : null,
    ctx.generalContext ? "" : null,
    `Pièce active — ${ctx.label}: ${ctx.line}`,
    `Palette: dominante ${ctx.dominantName} (${ctx.dominantHex}), secondaire ${ctx.secondaryName} (${ctx.secondaryHex}), accent ${ctx.accentName} (${ctx.accentHex})`,
    ctx.roomNote ? `Notes: ${ctx.roomNote}` : null,
    ctx.imageMetadataSummary ? `Contexte visuel: ${ctx.imageMetadataSummary}` : null,
    ctx.todoItems?.length ? `Todos de la pièce: ${ctx.todoItems.join(", ")}` : null,
    ctx.shoppingItems?.length ? `En liste de courses: ${ctx.shoppingItems.join(", ")}` : null,
    ctx.materialSummary?.length ? `Matériaux choisis: ${ctx.materialSummary.join("; ")}` : null,
    ctx.allRoomsSummary ? `Autres pièces: ${ctx.allRoomsSummary}` : null,
    "",
    "Règles:",
    "- Réponds en français, de façon concise et praticable (3-6 phrases max par réponse)",
    "- Reste dans l'univers rétro, coloré, doux — jamais d'accents rouges, pas de style minimaliste froid",
    "- Si l'utilisateur demande des produits, des références ou des liens d'achat, utilise la recherche web pour trouver des résultats réels et inclus des URLs directes",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function parseImageMarker(text) {
  const start = text.indexOf(IMAGE_PROMPT_MARKER);
  if (start === -1) return { content: text.trim(), imagePrompt: null };
  const content = text.slice(0, start).trim();
  const afterFirst = text.slice(start + IMAGE_PROMPT_MARKER.length);
  const end = afterFirst.indexOf(IMAGE_PROMPT_MARKER);
  const jsonPart = end !== -1 ? afterFirst.slice(0, end) : afterFirst;
  try {
    const { prompt } = JSON.parse(jsonPart.trim());
    return { content, imagePrompt: prompt || null };
  } catch {
    return { content, imagePrompt: null };
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Méthode non autorisée." }));
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "OPENAI_API_KEY est manquante." }));
    return;
  }

  let messages, roomContext;
  try {
    const body = await parseJsonBody(req);
    messages = body.messages;
    roomContext = body.roomContext;
  } catch {
    res.writeHead(400, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "JSON invalide." }));
    return;
  }

  if (!messages?.length) {
    res.writeHead(400, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Messages requis." }));
    return;
  }

  // Switch to SSE streaming mode
  res.writeHead(200, {
    ...CORS_HEADERS,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const writeEvent = (event, data) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch { /* client disconnected */ }
  };

  try {
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
        instructions: buildSystemPrompt(roomContext || {}),
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
      writeEvent("error", { error: errPayload.error?.message || "Erreur IA." });
      res.end();
      return;
    }

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
              } catch { /* malformed tool call */ }
            }
          } catch { /* non-JSON SSE data */ }
        }
      }
    }

    // Parse legacy text marker as fallback for image generation
    const { imagePrompt } = parseImageMarker(fullText);
    writeEvent("done", { imagePrompt: imagePrompt || undefined });
  } catch (err) {
    writeEvent("error", { error: err.message || "Erreur serveur." });
  }

  res.end();
}
