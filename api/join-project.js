import { allowCors, sendJson, parseJsonBody } from "./_openai.js";
import { getUserFromRequest, supabaseAdmin, writeChangeLog } from "./_supabase.js";

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

  const { user } = await getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: "Authentification requise." });
    return;
  }

  const { inviteCode } = await parseJsonBody(req);

  if (!inviteCode || !/^[a-f0-9]{12}$/.test(inviteCode)) {
    sendJson(res, 400, { error: "Code d'invitation invalide." });
    return;
  }

  try {
    // Trouver le projet par invite_code (service role — pas de RLS sur cette lookup)
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (projectError) throw new Error(projectError.message);
    if (!project) {
      sendJson(res, 404, { error: "Code d'invitation introuvable." });
      return;
    }

    // Ne pas créer de doublon si déjà membre
    const { data: existing } = await supabaseAdmin
      .from("project_members")
      .select("role")
      .eq("project_id", project.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      sendJson(res, 200, { projectId: project.id, alreadyMember: true });
      return;
    }

    // Ajouter comme editor
    const { error: insertError } = await supabaseAdmin.from("project_members").insert({
      project_id: project.id,
      user_id: user.id,
      role: "editor",
    });

    if (insertError) throw new Error(insertError.message);

    await writeChangeLog(project.id, user.id, "join", { role: "editor" });

    sendJson(res, 200, { projectId: project.id });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors de la jonction." });
  }
}
