import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin, supabaseWithToken, writeChangeLog, stripBinaryData } from "../_shared/_supabase.ts";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user, token } = await getUserFromRequest(req);
  if (!user || !token) return corsResponse(401, { error: "Authentification requise." });

  const body = await req.json();
  const { state, id, snapshot, snapshotLabel, name } = body;

  if (!state) return corsResponse(400, { error: "state requis." });

  const projectId = id || generateId();
  const isNewProject = !id;

  try {
    const upsertData: Record<string, unknown> = {
      id: projectId,
      updated_at: new Date().toISOString(),
      active_room:       state.room             || null,
      global_accent:     state.globalAccent     || null,
      warmth:            typeof state.warmth === "number" ? state.warmth : null,
      general_context:   state.generalContext   || null,
      custom_rooms:      state.customRooms      || [],
      hidden_rooms:      state.hiddenRooms      || [],
      room_order:        state.roomOrder        || null,
      general_resources: state.generalResources || [],
    };

    if (isNewProject) {
      upsertData.owner_id = user.id;
      if (name) upsertData.name = name;
    } else {
      const { data: member } = await supabaseAdmin
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });
      if (name && member.role === "owner") upsertData.name = name;
    }

    const { error: upsertError } = await supabaseAdmin
      .from("projects")
      .upsert(upsertData, { onConflict: "id" });
    if (upsertError) throw new Error(upsertError.message);

    if (isNewProject) {
      await supabaseAdmin.from("project_members").upsert({
        project_id: projectId,
        user_id: user.id,
        role: "owner",
      }, { onConflict: "project_id,user_id" });
    }

    const supabaseUser = supabaseWithToken(token);

    const mediaData = {
      uploadedImages:      state.uploadedImages      || {},
      inspirationLinks:    state.inspirationLinks    || {},
      aiInspirations:      state.aiInspirations      || {},
      instagramItems:      state.instagramItems      || {},
      imageAnalysis:       state.imageAnalysis       || {},
      deletedImages:       state.deletedImages       || {},
      materialUploads:     state.materialUploads     || {},
      materialLinks:       state.materialLinks       || {},
      extraMaterialImages: state.extraMaterialImages || {},
      extraMaterialMeta:   state.extraMaterialMeta   || {},
      planUploads:         state.planUploads         || {},
      planLinks:           state.planLinks           || {},
      extraPlanImages:     state.extraPlanImages     || {},
    };
    supabaseUser.from("room_media")
      .upsert({ project_id: projectId, data: mediaData, updated_at: new Date().toISOString() }, { onConflict: "project_id" })
      .then(() => {}).catch(() => {});

    if (state.roomNuances && typeof state.roomNuances === "object") {
      const nuanceRows = Object.entries(state.roomNuances).map(([roomKey, n]) => ({
        project_id:      projectId,
        room_key:        roomKey,
        dominant:        (n as Record<string, unknown>).dominant        || null,
        secondary:       (n as Record<string, unknown>).secondary       || null,
        accent:          (n as Record<string, unknown>).accent          || null,
        dominant_color:  (n as Record<string, unknown>).dominantColor   || null,
        secondary_color: (n as Record<string, unknown>).secondaryColor  || null,
        updated_at:      new Date().toISOString(),
      }));
      if (nuanceRows.length) {
        supabaseUser.from("room_nuances")
          .upsert(nuanceRows, { onConflict: "project_id,room_key" })
          .then(() => {}).catch(() => {});
      }
    }

    await writeChangeLog(projectId, user.id, "save");

    if (snapshot) {
      await supabaseAdmin.rpc("save_snapshot", {
        p_project_id: projectId,
        p_user_id: user.id,
        p_state: stripBinaryData(state),
        p_label: snapshotLabel || "Sauvegarde",
      });
    }

    return corsResponse(200, { id: projectId });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de la sauvegarde." });
  }
});
