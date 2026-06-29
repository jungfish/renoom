import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin, supabaseWithToken, writeChangeLog } from "../_shared/_supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user, token } = await getUserFromRequest(req);
  if (!user || !token) return corsResponse(401, { error: "Authentification requise." });

  const { projectId, snapshotId } = await req.json();
  if (!projectId || !snapshotId) return corsResponse(400, { error: "projectId et snapshotId requis." });

  try {
    const { data: project } = await supabaseWithToken(token)
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) return corsResponse(403, { error: "Accès refusé." });

    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from("project_snapshots")
      .select("state, label")
      .eq("id", snapshotId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (snapshotError) throw new Error(snapshotError.message);
    if (!snapshot) return corsResponse(404, { error: "Snapshot introuvable." });

    const { error: restoreError } = await supabaseAdmin
      .from("projects")
      .update({ state: snapshot.state, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (restoreError) throw new Error(restoreError.message);

    await writeChangeLog(projectId, user.id, "restore", { snapshotId, label: snapshot.label });

    return corsResponse(200, { state: snapshot.state });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de la restauration." });
  }
});
