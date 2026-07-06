import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin } from "../_shared/_supabase.ts";
import { getEntitlements, countPdfExports30d } from "../_shared/_entitlements.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });

  const { projectId, roomKey } = await req.json();
  if (!projectId) return corsResponse(400, { error: "projectId requis." });

  try {
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project) return corsResponse(404, { error: "Projet introuvable." });

    const { data: member } = await supabaseAdmin
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return corsResponse(403, { error: "Accès refusé." });

    const ownerEntitlements = await getEntitlements(project.owner_id);
    const usedExports = await countPdfExports30d(project.owner_id);
    if (usedExports >= ownerEntitlements.limits.pdf_exports_per_month) {
      return corsResponse(403, {
        error: `Quota mensuel d'exports PDF atteint (${ownerEntitlements.limits.pdf_exports_per_month}/mois pour le plan ${ownerEntitlements.planName}). Contacte l'équipe pour en savoir plus.`,
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("project_exports")
      .insert({ project_id: projectId, room_key: roomKey || null, created_by: user.id });
    if (insertError) throw new Error(insertError.message);

    return corsResponse(200, { ok: true });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de l'enregistrement de l'export." });
  }
});
