const IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-2";
const IMAGE_PERSONA = "Tu es un designer d'intérieur professionnel et créatif. ";
const ANALYSIS_MODEL = Deno.env.get("OPENAI_ANALYSIS_MODEL") ?? "gpt-4.1-mini";

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Image invalide: data URL attendue.");
  const [, mimeType, base64] = match;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function parseMetadata(text: string, section?: string) {
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
    return { type: section || "reference", style: "", inspiration: text, materials: [], colors: [], details: [] };
  }
}

export async function analyzeImage({ image, context, section }: { image: string; context?: string; section?: string }) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw Object.assign(new Error("OPENAI_API_KEY manquante."), { status: 500 });
  if (!image) throw Object.assign(new Error("Image requise."), { status: 400 });

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
                'Schéma exact: {"type":"photo | dessin architecte | plan | croquis | moodboard | matériau | référence produit","style":"string court","inspiration":"string court","materials":["..."],"colors":["..."],"details":["..."]}.',
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
    throw Object.assign(new Error(payload.error?.message || "Analyse OpenAI échouée."), { status: openaiResponse.status });
  }
  return parseMetadata(payload.output_text || "", section);
}

export async function generateImage({ image, prompt }: { image: string; prompt: string }) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw Object.assign(new Error("OPENAI_API_KEY manquante."), { status: 500 });
  if (!image || !prompt) throw Object.assign(new Error("Image et prompt sont requis."), { status: 400 });

  const blob = dataUrlToBlob(image);
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", IMAGE_PERSONA + prompt);
  form.append("size", "1024x1024");
  form.append("quality", "medium");
  form.append("output_format", "webp");
  form.append("output_compression", "82");
  form.append("image", blob, `source.${blob.type.split("/")[1] || "png"}`);

  const openaiResponse = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const payload = await openaiResponse.json();
  if (!openaiResponse.ok) {
    throw Object.assign(new Error(payload.error?.message || "Génération OpenAI échouée."), { status: openaiResponse.status });
  }

  const imageData = payload.data?.[0];
  if (imageData?.b64_json) return `data:image/webp;base64,${imageData.b64_json}`;
  if (imageData?.url) return imageData.url;

  throw Object.assign(new Error("Réponse OpenAI sans image exploitable."), { status: 500 });
}
