import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin } from "../_shared/_supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });

  const { projectId } = await req.json();
  if (!projectId) return corsResponse(400, { error: "projectId requis." });

  try {
    const { data: project, error: findError } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!project) return corsResponse(404, { error: "Projet introuvable." });
    if (project.owner_id !== user.id) return corsResponse(403, { error: "Seul le propriétaire peut archiver ce projet." });

    const { error: updateError } = await supabaseAdmin
      .from("projects")
      .update({ status: "archived" })
      .eq("id", projectId);
    if (updateError) throw new Error(updateError.message);

    return corsResponse(200, { ok: true });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de l'archivage." });
  }
});
