import { allowCors, sendJson } from "./_openai.js";
import { getUserFromRequest, supabaseAdmin } from "./_supabase.js";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  allowCors(res, req);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Méthode non supportée." });
    return;
  }

  const { user, token } = await getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: "Authentification requise." });
    return;
  }

  const projectId =
    req.query?.projectId ||
    new URL(req.url || "/", "http://localhost").searchParams.get("projectId");

  if (!projectId) {
    sendJson(res, 400, { error: "projectId requis." });
    return;
  }

  try {
    // Vérifier l'accès au projet via RLS
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

    // Récupérer les snapshots sans le state (trop lourd)
    const { data: snapshots, error } = await supabaseAdmin
      .from("project_snapshots")
      .select("id, saved_at, user_id, label")
      .eq("project_id", projectId)
      .order("saved_at", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);

    // Enrichir avec les emails/noms des auteurs
    const userIds = [...new Set(snapshots.map((s) => s.user_id).filter(Boolean))];
    const userMap = {};

    if (userIds.length) {
      for (const uid of userIds) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (u?.user) {
          userMap[uid] = u.user.user_metadata?.full_name || u.user.email || "Utilisateur";
        }
      }
    }

    const result = snapshots.map((s) => ({
      id: s.id,
      savedAt: s.saved_at,
      label: s.label,
      authorName: s.user_id ? (userMap[s.user_id] || "Utilisateur") : "Inconnu",
    }));

    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 200, { snapshots: result });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors du chargement des snapshots." });
  }
}
