import { allowCors, sendJson } from "./_openai.js";
import { getUserFromRequest } from "./_supabase.js";
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

  const id = req.query?.id || new URL(req.url || "/", "http://localhost").searchParams.get("id");

  if (!id || !/^[a-z0-9]{6,16}$/.test(id)) {
    sendJson(res, 400, { error: "ID invalide." });
    return;
  }

  try {
    // RLS vérifie que l'utilisateur est membre du projet
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    const { data, error } = await supabaseUser
      .from("projects")
      .select("state, name, invite_code, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      sendJson(res, 404, { error: "Projet introuvable ou accès refusé." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 200, {
      state: data.state,
      name: data.name,
      inviteCode: data.invite_code,
      isOwner: data.owner_id === user.id,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors du chargement." });
  }
}
