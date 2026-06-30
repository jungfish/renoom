import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { supabaseAdmin } from "../_shared/_supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET") return corsResponse(405, { error: "Méthode non supportée." });

  const invite = new URL(req.url).searchParams.get("invite") ?? "";

  if (!/^[a-f0-9]{12}$/.test(invite)) {
    return corsResponse(400, { error: "Code invalide." });
  }

  const { data } = await supabaseAdmin
    .from("projects")
    .select("name")
    .eq("invite_code", invite)
    .maybeSingle();

  if (!data) return corsResponse(404, { error: "Introuvable." });

  return corsResponse(200, { name: data.name });
});
