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
      updated_at: new Date().toISOString(),
      active_room:       state.room       || null,
      global_accent:     state.globalAccent || null,
      warmth:            typeof state.warmth === "number" ? state.warmth : null,
      general_context:   state.generalContext || null,
      custom_rooms:      state.customRooms   || [],
      hidden_rooms:      state.hiddenRooms   || [],
      room_order:        state.roomOrder     || null,
      general_resources: state.generalResources || [],
    };

    if (isNewProject) {
      upsertData.owner_id = user.id;
    } else {
      // Vérification explicite de membership (remplace la vérification RLS)
      const { data: member } = await supabaseAdmin
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) {
        sendJson(res, 403, { error: "Accès refusé." });
        return;
      }
    }

    // Utiliser supabaseAdmin pour contourner le bug INSERT WITH CHECK sur upsert
    // (sans owner_id dans le payload, Postgres évalue owner_id = NULL ≠ auth.uid())
    const { error: upsertError } = await supabaseAdmin
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

    // Client user pour les writes soumis à RLS (room_media, room_nuances)
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    // Dual-write room_media (Phase 5) — fire-and-forget
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

    // Dual-write room_nuances (Phase 4) — fire-and-forget
    if (state.roomNuances && typeof state.roomNuances === "object") {
      const nuanceRows = Object.entries(state.roomNuances).map(([roomKey, n]) => ({
        project_id:      projectId,
        room_key:        roomKey,
        dominant:        n.dominant        || null,
        secondary:       n.secondary       || null,
        accent:          n.accent          || null,
        dominant_color:  n.dominantColor   || null,
        secondary_color: n.secondaryColor  || null,
        updated_at:      new Date().toISOString(),
      }));
      if (nuanceRows.length) {
        supabaseUser.from("room_nuances")
          .upsert(nuanceRows, { onConflict: "project_id,room_key" })
          .then(() => {}).catch(() => {});
      }
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
