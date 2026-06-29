import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin } from "../_shared/_supabase.ts";

const BUCKET = "images";
const MAX_PINS_PER_BOARD = 12;

type PinterestPin = {
  id: string;
  media?: {
    images?: {
      "1200x"?: { url: string };
      "600x"?: { url: string };
      "400x"?: { url: string };
    };
  };
};
type PinsResponse = { items?: PinterestPin[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });

  const { accessToken, boardIds } = await req.json() as {
    accessToken: string;
    boardIds: string[];
  };

  if (!accessToken || !boardIds?.length) {
    return corsResponse(400, { error: "accessToken et boardIds requis." });
  }

  const urls: string[] = [];

  for (const boardId of boardIds.slice(0, 3)) {
    try {
      const pinsRes = await fetch(
        `https://api.pinterest.com/v5/boards/${boardId}/pins?page_size=${MAX_PINS_PER_BOARD}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!pinsRes.ok) continue;

      const pinsData = await pinsRes.json() as PinsResponse;
      const pins = (pinsData.items || []).slice(0, MAX_PINS_PER_BOARD);

      for (const pin of pins) {
        const imageUrl =
          pin.media?.images?.["1200x"]?.url ||
          pin.media?.images?.["600x"]?.url ||
          pin.media?.images?.["400x"]?.url;
        if (!imageUrl) continue;

        try {
          const imgRes = await fetch(imageUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; RenoomBot/1.0)" },
            signal: AbortSignal.timeout(15000),
            redirect: "follow",
          });
          if (!imgRes.ok) continue;

          const mimeType = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
          const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
          const buffer = new Uint8Array(await imgRes.arrayBuffer());
          const filename = `pinterest/${pin.id}.${ext}`;

          const { data, error } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(filename, buffer, { contentType: mimeType, upsert: true });

          if (!error) {
            const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);
            urls.push(publicUrl);
          }
        } catch {
          // Skip failed pins silently
        }
      }
    } catch {
      // Skip failed boards silently
    }
  }

  return corsResponse(200, { urls, imported: urls.length });
});
