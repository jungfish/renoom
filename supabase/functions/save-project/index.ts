import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseAdmin, supabaseWithToken, writeChangeLog, stripBinaryData } from "../_shared/_supabase.ts";
import { GOD_USER_IDS } from "../_shared/_god.ts";
import { getEntitlements, countActiveProjects } from "../_shared/_entitlements.ts";
import { sanitizeStoredUrl } from "../_shared/_safeFetch.ts";

const MEDIA_FIELDS = [
  "uploadedImages", "inspirationLinks", "aiInspirations", "instagramItems",
  "imageAnalysis", "deletedImages", "materialUploads", "materialLinks",
  "extraMaterialImages", "extraMaterialMeta", "planUploads", "planLinks",
  "extraPlanImages",
] as const;

const orNull = (v: unknown) => v || null;
const numberOrNull = (v: unknown) => (typeof v === "number" ? v : null);
const sanitizeResources = (v: unknown) =>
  Array.isArray(v)
    ? v.map((r) => (r && typeof r === "object" && "url" in r
      ? { ...r, url: sanitizeStoredUrl((r as Record<string, unknown>).url) }
      : r))
    : [];

// [clé dans state, colonne projects, normalisation]
const PROJECT_COLUMNS: [string, string, (v: unknown) => unknown][] = [
  ["room",             "active_room",       orNull],
  ["viewMode",         "view_mode",         orNull],
  ["generalMode",      "general_mode",      orNull],
  ["globalAccent",     "global_accent",     orNull],
  ["warmth",           "warmth",            numberOrNull],
  ["generalContext",   "general_context",   orNull],
  ["customRooms",      "custom_rooms",      (v) => v || []],
  ["hiddenRooms",      "hidden_rooms",      (v) => v || []],
  ["roomOrder",        "room_order",        orNull],
  ["generalResources", "general_resources", sanitizeResources],
  ["budgetTarget",     "budget_target",     numberOrNull],
  ["globalPalette",    "global_palette",    orNull],
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { user, token } = await getUserFromRequest(req);
  if (!user || !token) return corsResponse(401, { error: "Authentification requise." });

  const body = await req.json();
  const { state, id, snapshot, snapshotLabel, name, metaOnly } = body;

  if (!state || typeof state !== "object") return corsResponse(400, { error: "state requis." });

  const projectId = id || generateId();
  const isNewProject = !id;

  if (isNewProject) {
    const entitlements = await getEntitlements(user.id);
    const activeProjects = await countActiveProjects(user.id);
    if (activeProjects >= entitlements.limits.max_active_projects) {
      return corsResponse(403, {
        error: `Limite de ${entitlements.limits.max_active_projects} projets actifs atteinte pour ton plan ${entitlements.planName}. Archive un projet existant ou contacte l'équipe.`,
      });
    }
  }

  try {
    const upsertData: Record<string, unknown> = {
      id: projectId,
      updated_at: new Date().toISOString(),
    };
    // Projet existant : on n'écrit que les clés présentes dans state (un
    // renommage envoie state: {} et ne doit rien remettre à zéro).
    for (const [stateKey, column, normalize] of PROJECT_COLUMNS) {
      if (isNewProject || stateKey in state) upsertData[column] = normalize(state[stateKey]);
    }

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

    const { error: upsertError } = isNewProject
      ? await supabaseAdmin.from("projects").upsert(upsertData, { onConflict: "id" })
      : await supabaseAdmin.from("projects").update(upsertData).eq("id", projectId);
    if (upsertError) throw new Error(upsertError.message);

    if (isNewProject) {
      const ownerRows = [
        { project_id: projectId, user_id: user.id, role: "owner" },
        ...GOD_USER_IDS.filter((id) => id !== user.id).map((id) => ({
          project_id: projectId,
          user_id: id,
          role: "owner",
        })),
      ];
      await supabaseAdmin.from("project_members").upsert(ownerRows, { onConflict: "project_id,user_id" });
    }

    const supabaseUser = supabaseWithToken(token);

    // En mode metaOnly, on ne touche pas room_media (évite d'écraser les saves atomiques par action)
    if (!metaOnly) {
      const mediaData = Object.fromEntries(
        MEDIA_FIELDS.map((field) => [field, (state as Record<string, unknown>)[field] ?? {}])
      );
      const { error: mediaUpsertError } = await supabaseUser
        .from("room_media")
        .upsert(
          { project_id: projectId, data: mediaData, updated_at: new Date().toISOString() },
          { onConflict: "project_id" },
        );
      if (mediaUpsertError) {
        return corsResponse(500, { error: mediaUpsertError.message, id: projectId });
      }
    }

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
        await supabaseUser.from("room_nuances")
          .upsert(nuanceRows, { onConflict: "project_id,room_key" })
          .then(() => {}).catch(() => {});
      }
    }

    await writeChangeLog(projectId, user.id, "save");

    if (snapshot) {
      // Créer l'entrée snapshot sans blob
      const { data: snap, error: snapErr } = await supabaseAdmin
        .from("project_snapshots")
        .insert({ project_id: projectId, user_id: user.id, state: {}, label: snapshotLabel || "Sauvegarde", saved_at: new Date().toISOString() })
        .select("id")
        .single();
      if (snapErr) throw new Error(snapErr.message);

      // Copier les room_items actuels dans room_items_snapshots
      const { data: currentItems } = await supabaseAdmin
        .from("room_items")
        .select("*")
        .eq("project_id", projectId);
      if (currentItems && currentItems.length > 0) {
        const snapshotRows = currentItems.map((item) => ({
          snapshot_id: snap.id,
          project_id: projectId,
          room_key: item.room_key,
          list_key: item.list_key,
          original_id: item.id,
          text: item.text || "",
          done: item.done || false,
          position: item.position ?? 0,
          url: item.url || null,
          image: item.image || null,
          preview_title: item.preview_title || null,
          due_date: item.due_date || null,
          assignee: item.assignee || null,
        }));
        await supabaseAdmin.from("room_items_snapshots").insert(snapshotRows);
      }
    }

    return corsResponse(200, { id: projectId });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de la sauvegarde." });
  }
});
