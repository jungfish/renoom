import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { supabaseAdmin } from "../_shared/_supabase.ts";

const BUCKET = "images";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const body = await req.json();
  const { dataUrl, sourceUrl, filename } = body;

  let buffer: Uint8Array;
  let mimeType: string;

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
      if (!response.ok) return corsResponse(400, { error: "Impossible de récupérer l'image." });
      mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      buffer = new Uint8Array(await response.arrayBuffer());
    } catch (err) {
      return corsResponse(500, { error: (err as Error).message || "Erreur lors du téléchargement de l'image." });
    }
  } else {
    const match = dataUrl?.match(/^data:(.+);base64,(.+)$/);
    if (!match) return corsResponse(400, { error: "dataUrl invalide." });
    const [, mime, base64] = match;
    mimeType = mime;
    buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const finalFilename = filename || `image-${crypto.randomUUID()}.${ext}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(finalFilename, buffer, { contentType: mimeType, upsert: true });

    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);

    return corsResponse(200, { url: publicUrl });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de l'upload." });
  }
});
