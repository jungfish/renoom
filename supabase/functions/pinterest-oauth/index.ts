import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest } from "../_shared/_supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });

  const { code, redirectUri } = await req.json();
  if (!code || !redirectUri) return corsResponse(400, { error: "code et redirectUri requis." });

  const clientId = Deno.env.get("PINTEREST_CLIENT_ID");
  const clientSecret = Deno.env.get("PINTEREST_CLIENT_SECRET");
  if (!clientId || !clientSecret) return corsResponse(500, { error: "Pinterest non configuré côté serveur." });

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({})) as Record<string, unknown>;
      return corsResponse(400, { error: (err.error_description as string) || "Échec de l'authentification Pinterest." });
    }

    const tokenData = await tokenRes.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Fetch user's boards (up to 25)
    const boardsRes = await fetch("https://api.pinterest.com/v5/boards?page_size=25", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    type PinterestBoard = {
      id: string;
      name: string;
      pin_count?: number;
      media?: { image_cover_url?: string };
    };
    type BoardsResponse = { items?: PinterestBoard[] };

    const boardsData = await boardsRes.json() as BoardsResponse;
    const boards = (boardsData.items || []).map((b) => ({
      id: b.id,
      name: b.name,
      pinCount: b.pin_count || 0,
      coverUrl: b.media?.image_cover_url || null,
    }));

    return corsResponse(200, { accessToken, boards });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur Pinterest." });
  }
});
