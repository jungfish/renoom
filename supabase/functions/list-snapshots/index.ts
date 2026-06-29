import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin, supabaseWithToken } from "../_shared/_supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET") return corsResponse(405, { error: "Méthode non supportée." });

  const { user, token } = await getUserFromRequest(req);
  if (!user || !token) return corsResponse(401, { error: "Authentification requise." });

  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return corsResponse(400, { error: "projectId requis." });

  try {
    const { data: project } = await supabaseWithToken(token)
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) return corsResponse(403, { error: "Accès refusé." });

    const { data: snapshots, error } = await supabaseAdmin
      .from("project_snapshots")
      .select("id, saved_at, user_id, label")
      .eq("project_id", projectId)
      .order("saved_at", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);

    const userIds = [...new Set(snapshots.map((s) => s.user_id).filter(Boolean))] as string[];
    const userMap: Record<string, string> = {};

    for (const uid of userIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
      if (u?.user) {
        userMap[uid] = u.user.user_metadata?.full_name || u.user.email || "Utilisateur";
      }
    }

    const result = snapshots.map((s) => ({
      id: s.id,
      savedAt: s.saved_at,
      label: s.label,
      authorName: s.user_id ? (userMap[s.user_id] || "Utilisateur") : "Inconnu",
    }));

    return new Response(JSON.stringify({ snapshots: result }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors du chargement des snapshots." });
  }
});
