import { allowCors, sendJson, parseJsonBody } from "./_openai.js";
import { getUserFromRequest, supabaseAdmin, writeChangeLog } from "./_supabase.js";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  allowCors(res, req);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Méthode non supportée." });
    return;
  }

  const { user, token } = await getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: "Authentification requise." });
    return;
  }

  const { projectId, snapshotId } = await parseJsonBody(req);

  if (!projectId || !snapshotId) {
    sendJson(res, 400, { error: "projectId et snapshotId requis." });
    return;
  }

  try {
    // Vérifier que l'utilisateur est bien membre du projet (via RLS)
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    const { data: project } = await supabaseUser
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      sendJson(res, 403, { error: "Accès refusé." });
      return;
    }

    // Charger le snapshot (service role pour contourner la RLS sur project_snapshots)
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from("project_snapshots")
      .select("state, label")
      .eq("id", snapshotId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (snapshotError) throw new Error(snapshotError.message);
    if (!snapshot) {
      sendJson(res, 404, { error: "Snapshot introuvable." });
      return;
    }

    // Restaurer le state dans projects
    const { error: restoreError } = await supabaseAdmin
      .from("projects")
      .update({ state: snapshot.state, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    if (restoreError) throw new Error(restoreError.message);

    await writeChangeLog(projectId, user.id, "restore", {
      snapshotId,
      label: snapshot.label,
    });

    sendJson(res, 200, { state: snapshot.state });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors de la restauration." });
  }
}
