import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin, writeChangeLog } from "../_shared/_supabase.ts";
import { getEntitlements, countProjectMembers } from "../_shared/_entitlements.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });

  const { inviteCode } = await req.json();

  if (!inviteCode || !/^[a-f0-9]{12}$/.test(inviteCode)) {
    return corsResponse(400, { error: "Code d'invitation invalide." });
  }

  try {
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (projectError) throw new Error(projectError.message);
    if (!project) return corsResponse(404, { error: "Code d'invitation introuvable." });

    const { data: existing } = await supabaseAdmin
      .from("project_members")
      .select("role")
      .eq("project_id", project.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) return corsResponse(200, { projectId: project.id, alreadyMember: true });

    const ownerEntitlements = await getEntitlements(project.owner_id);
    const currentMembers = await countProjectMembers(project.id);
    if (currentMembers >= ownerEntitlements.limits.max_members_per_project) {
      return corsResponse(403, {
        error: `Ce projet a atteint la limite de ${ownerEntitlements.limits.max_members_per_project} membres incluse dans le plan du propriétaire.`,
      });
    }

    const { error: insertError } = await supabaseAdmin.from("project_members").insert({
      project_id: project.id,
      user_id: user.id,
      role: "editor",
    });

    if (insertError) throw new Error(insertError.message);

    await writeChangeLog(project.id, user.id, "join", { role: "editor" });

    const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Inconnu";
    await supabaseAdmin.from("activity_log").insert({
      project_id: project.id,
      user_id: user.id,
      user_name: userName,
      action_type: "member_joined",
      room_key: null,
      metadata: {},
    });

    return corsResponse(200, { projectId: project.id });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de la jonction." });
  }
});
