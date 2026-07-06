import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin } from "../_shared/_supabase.ts";
import { isGodUser } from "../_shared/_god.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });
  if (!isGodUser(user.id)) return corsResponse(403, { error: "Accès refusé." });

  const { user_id: targetUserId, plan_id: planId } = await req.json();
  if (!targetUserId || !planId) return corsResponse(400, { error: "user_id et plan_id requis." });

  try {
    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("id")
      .eq("id", planId)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!plan) return corsResponse(400, { error: `plan_id inconnu: ${planId}` });

    const { data: previousProfile } = await supabaseAdmin
      .from("profiles")
      .select("plan_id")
      .eq("id", targetUserId)
      .maybeSingle();

    const now = new Date().toISOString();
    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: targetUserId,
          plan_id: planId,
          plan_status: "active",
          plan_activated_at: now,
          plan_activated_by: user.id,
          updated_at: now,
        },
        { onConflict: "id" },
      );
    if (upsertError) throw new Error(upsertError.message);

    return corsResponse(200, {
      user_id: targetUserId,
      previous_plan_id: previousProfile?.plan_id ?? null,
      new_plan_id: planId,
      plan_activated_at: now,
      plan_activated_by: user.id,
    });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de l'activation du plan." });
  }
});
