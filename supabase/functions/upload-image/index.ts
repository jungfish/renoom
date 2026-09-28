import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin } from "../_shared/_supabase.ts";
import { readBodyLimited, safeFetch, UnsafeUrlError } from "../_shared/_safeFetch.ts";

const BUCKET = "images";
const MAX_BYTES = 15 * 1024 * 1024;

// Types acceptés (photos, plans PDF, documents du projet) → extension stockée.
// Pas de SVG ni d'HTML : ils seraient servis tels quels depuis le bucket public.
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/octet-stream": "bin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return corsResponse(400, { error: "JSON invalide." });
  }
  const { dataUrl, sourceUrl } = body as { dataUrl?: string; sourceUrl?: string };

  let buffer: Uint8Array;
  let mimeType: string;

  if (sourceUrl && !dataUrl) {
    try {
      const response = await safeFetch(sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DesignHelperBot/1.0)",
          Accept: "image/*,*/*",
        },
      }, { timeoutMs: 15000 });
      if (!response.ok) return corsResponse(400, { error: "Impossible de récupérer l'image." });
      mimeType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "image/jpeg";
      if (!ALLOWED_TYPES[mimeType]) {
        await response.body?.cancel();
        return corsResponse(415, { error: "Type de fichier non accepté." });
      }
      buffer = await readBodyLimited(response, MAX_BYTES);
    } catch (err) {
      if (err instanceof UnsafeUrlError) return corsResponse(400, { error: err.message });
      return corsResponse(500, { error: (err as Error).message || "Erreur lors du téléchargement de l'image." });
    }
  } else {
    const match = typeof dataUrl === "string" ? dataUrl.match(/^data:([^,]+);base64,(.+)$/) : null;
    if (!match) return corsResponse(400, { error: "dataUrl invalide." });
    const [, mimeParams, base64] = match;
    mimeType = mimeParams.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES[mimeType]) return corsResponse(415, { error: "Type de fichier non accepté." });
    if (base64.length * 0.75 > MAX_BYTES) return corsResponse(413, { error: "Fichier trop volumineux (15 Mo max)." });
    buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }

  // Nom choisi par le serveur : un appelant ne peut plus écraser le fichier d'un autre.
  const finalFilename = `${user.id}/${crypto.randomUUID()}.${ALLOWED_TYPES[mimeType]}`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(finalFilename, buffer, { contentType: mimeType, upsert: false });

    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);

    return corsResponse(200, { url: publicUrl });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de l'upload." });
  }
});
