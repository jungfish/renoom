import { allowCors, sendJson, parseJsonBody } from "./_openai.js";
import { getUserFromRequest, supabaseAdmin, writeChangeLog, stripBinaryData } from "./_supabase.js";

export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

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

  const body = await parseJsonBody(req);
  const { state, id, snapshot, snapshotLabel } = body;

  if (!state) {
    sendJson(res, 400, { error: "state requis." });
    return;
  }

  const projectId = id || generateId();
  const isNewProject = !id;

  try {
    // Upsert du state avec le client service role (contourne RLS pour les projets existants sans owner)
    // Pour les nouveaux projets, on set owner_id ; pour les existants, RLS vérifie les droits via token
    const upsertData = {
      id: projectId,
      state,
      updated_at: new Date().toISOString(),
    };

    if (isNewProject) {
      upsertData.owner_id = user.id;
    }

    // Utiliser le token utilisateur pour que RLS s'applique sur les projets existants
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    const { error: upsertError } = await supabaseUser
      .from("projects")
      .upsert(upsertData, { onConflict: "id" });

    if (upsertError) throw new Error(upsertError.message);

    // Si nouveau projet, s'ajouter comme owner dans project_members
    if (isNewProject) {
      await supabaseAdmin.from("project_members").upsert({
        project_id: projectId,
        user_id: user.id,
        role: "owner",
      }, { onConflict: "project_id,user_id" });
    }

    // Audit log (dédupliqué automatiquement si < 5 min)
    await writeChangeLog(projectId, user.id, "save");

    // Snapshot atomique uniquement si demandé explicitement (bouton "Point de sauvegarde")
    if (snapshot) {
      await supabaseAdmin.rpc("save_snapshot", {
        p_project_id: projectId,
        p_user_id: user.id,
        p_state: stripBinaryData(state),
        p_label: snapshotLabel || "Sauvegarde",
      });
    }

    sendJson(res, 200, { id: projectId });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors de la sauvegarde." });
  }
}
