import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { generateImage } from "../_shared/_openai.ts";
import { getUserFromRequest, supabaseAdmin } from "../_shared/_supabase.ts";
import { getEntitlements, countAiImages30d } from "../_shared/_entitlements.ts";

const IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non autorisée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return corsResponse(400, { error: "JSON invalide." });
  }

  const projectId = body.projectId as string | undefined;
  if (!projectId) return corsResponse(400, { error: "projectId requis." });

  const { data: member } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return corsResponse(403, { error: "Accès refusé." });

  const entitlements = await getEntitlements(user.id);
  const usedImages = await countAiImages30d(user.id);
  if (usedImages >= entitlements.limits.ai_images_per_month) {
    return corsResponse(403, {
      error: `Quota mensuel d'images IA atteint (${entitlements.limits.ai_images_per_month}/mois pour le plan ${entitlements.planName}). Contacte l'équipe pour en savoir plus.`,
    });
  }

  try {
    const image = await generateImage(body as { image: string; prompt: string });

    supabaseAdmin.from("ai_usage_events").insert({
      project_id: projectId,
      user_id: user.id,
      room_key: null,
      model: IMAGE_MODEL,
      event_type: "image_generation",
      input_tokens: 0,
      output_tokens: 0,
      web_search_calls: 0,
    }).then(() => {}).catch(() => {});

    return corsResponse(200, { image });
  } catch (error) {
    const err = error as { status?: number; message?: string };
    return corsResponse(err.status || 500, { error: err.message || "Erreur serveur." });
  }
});
