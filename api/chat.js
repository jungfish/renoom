import { allowCors, sendJson, parseJsonBody } from "./_openai.js";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1";
const IMAGE_PROMPT_MARKER = "|||IMAGE_PROMPT|||";

function buildSystemPrompt(ctx) {
  return [
    "Tu es un assistant de design intérieur expert en décoration française contemporaine et rétro.",
    "Tu aides l'utilisateur à prendre des décisions de design pour son appartement.",
    "",
    `Contexte de la pièce active — ${ctx.label}:`,
    `Ligne directrice: ${ctx.line}`,
    `Palette: dominante ${ctx.dominantName} (${ctx.dominantHex}), secondaire ${ctx.secondaryName} (${ctx.secondaryHex}), accent ${ctx.accentName} (${ctx.accentHex})`,
    ctx.roomNote ? `Notes utilisateur: ${ctx.roomNote}` : null,
    ctx.imageMetadataSummary ? `Contexte visuel: ${ctx.imageMetadataSummary}` : null,
    "",
    "Règles:",
    "- Réponds en français, de façon concise et praticable (3-6 phrases max par réponse)",
    "- Reste dans l'univers rétro, coloré, doux — jamais d'accents rouges, pas de style minimaliste froid",
    "- Si tu suggères une modification visuelle concrète et précise, termine ta réponse par exactement ce bloc sur une nouvelle ligne:",
    `  ${IMAGE_PROMPT_MARKER}{"prompt":"<instruction en anglais pour édition d'image, 2-3 phrases, précise les couleurs hex et le style rétro>"}${IMAGE_PROMPT_MARKER}`,
    "- N'inclus ce bloc que si la suggestion est clairement visuelle et actionnable — pas pour des conseils généraux",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function parseAssistantResponse(rawText) {
  const start = rawText.indexOf(IMAGE_PROMPT_MARKER);
  if (start === -1) return { content: rawText.trim(), imagePrompt: null };

  const content = rawText.slice(0, start).trim();
  const afterFirst = rawText.slice(start + IMAGE_PROMPT_MARKER.length);
  const end = afterFirst.indexOf(IMAGE_PROMPT_MARKER);
  const jsonPart = end !== -1 ? afterFirst.slice(0, end) : afterFirst;

  try {
    const { prompt } = JSON.parse(jsonPart.trim());
    return { content, imagePrompt: prompt || null };
  } catch {
    return { content, imagePrompt: null };
  }
}

export default async function handler(req, res) {
  allowCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Méthode non autorisée." });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 500, { error: "OPENAI_API_KEY est manquante." });
    return;
  }

  try {
    const { messages, roomContext } = await parseJsonBody(req);

    if (!messages?.length) {
      sendJson(res, 400, { error: "Messages requis." });
      return;
    }

    const historyToSend = messages.slice(-20);

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        system: buildSystemPrompt(roomContext || {}),
        input: historyToSend.map((m) => ({
          role: m.role,
          content: [
            {
              type: m.role === "user" ? "input_text" : "output_text",
              text: m.content,
            },
          ],
        })),
      }),
    });

    const payload = await openaiResponse.json();

    if (!openaiResponse.ok) {
      const error = new Error(payload.error?.message || "Le chat IA a échoué.");
      error.status = openaiResponse.status;
      throw error;
    }

    const { content, imagePrompt } = parseAssistantResponse(payload.output_text || "");
    sendJson(res, 200, { content, imagePrompt: imagePrompt || undefined });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Erreur serveur." });
  }
}
