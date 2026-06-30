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
      .select("id, label")
      .eq("id", snapshotId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (snapshotError) throw new Error(snapshotError.message);
    if (!snapshot) return corsResponse(404, { error: "Snapshot introuvable." });

    // Vérifier si ce snapshot a des room_items_snapshots (nouveau format)
    const { data: snapItems } = await supabaseAdmin
      .from("room_items_snapshots")
      .select("*")
      .eq("snapshot_id", snapshotId);

    if (snapItems && snapItems.length > 0) {
      // Nouveau format : restauration serveur depuis room_items_snapshots
      const { error: delErr } = await supabaseAdmin
        .from("room_items")
        .delete()
        .eq("project_id", projectId);
      if (delErr) throw new Error(delErr.message);

      const rows = snapItems.map((si) => ({
        id: si.original_id,
        project_id: projectId,
        room_key: si.room_key,
        list_key: si.list_key,
        text: si.text,
        done: si.done,
        position: si.position,
        url: si.url,
        image: si.image,
        preview_title: si.preview_title,
        due_date: si.due_date,
        assignee: si.assignee,
      }));
      const { error: insErr } = await supabaseAdmin.from("room_items").insert(rows);
      if (insErr) throw new Error(insErr.message);

      await writeChangeLog(projectId, user.id, "restore", { snapshotId, label: snapshot.label });
      return corsResponse(200, { ok: true });
    }

    // Ancien format blob (fallback pour les vieux snapshots)
    const { data: snapWithState } = await supabaseAdmin
      .from("project_snapshots")
      .select("state")
      .eq("id", snapshotId)
      .maybeSingle();

    if (!snapWithState?.state) return corsResponse(404, { error: "Snapshot vide." });

    await writeChangeLog(projectId, user.id, "restore", { snapshotId, label: snapshot.label });
    return corsResponse(200, { state: snapWithState.state });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de la restauration." });
  }
});
