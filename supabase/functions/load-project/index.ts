import { corsResponse, optionsResponse, CORS_HEADERS } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseWithToken } from "../_shared/_supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET") return corsResponse(405, { error: "Méthode non supportée." });

  const { user, token } = await getUserFromRequest(req);
  if (!user || !token) return corsResponse(401, { error: "Authentification requise." });

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[a-z0-9-]{6,16}$/.test(id)) return corsResponse(400, { error: "ID invalide." });

  try {
    const supabaseUser = supabaseWithToken(token);

    const { data, error } = await supabaseUser
      .from("projects")
      .select("name, invite_code, owner_id, active_room, view_mode, general_mode, global_accent, warmth, general_context, custom_rooms, hidden_rooms, room_order, general_resources, persons")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return corsResponse(404, { error: "Projet introuvable ou accès refusé." });

    const [
      { data: roomItemsData },
      { data: chatData },
      { data: notesData },
      { data: docsData },
      { data: nuancesData },
      { data: mediaRow },
    ] = await Promise.all([
      supabaseUser.from("room_items").select("id, room_key, list_key, text, done, url, image, preview_title, position, due_date, assignee").eq("project_id", id).order("position"),
      supabaseUser.from("chat_messages").select("id, room_key, role, content, image_prompt, error, created_at").eq("project_id", id).order("created_at", { ascending: true }),
      supabaseUser.from("room_notes").select("room_key, content").eq("project_id", id),
      supabaseUser.from("room_documents").select("id, room_key, name, url, type, size, uploaded_at").eq("project_id", id).order("uploaded_at"),
      supabaseUser.from("room_nuances").select("room_key, dominant, secondary, accent, dominant_color, secondary_color").eq("project_id", id),
      supabaseUser.from("room_media").select("data").eq("project_id", id).maybeSingle(),
    ]);

    const chatMessages = (chatData || []).map((m) => ({
      id: m.id,
      roomKey: m.room_key,
      role: m.role,
      content: m.content,
      imagePrompt: m.image_prompt || undefined,
      error: m.error || undefined,
    }));

    const roomNotesNormalized: Record<string, string> = {};
    for (const n of (notesData || [])) roomNotesNormalized[n.room_key] = n.content;

    const roomDocumentsNormalized: Record<string, unknown[]> = {};
    for (const d of (docsData || [])) {
      if (!roomDocumentsNormalized[d.room_key]) roomDocumentsNormalized[d.room_key] = [];
      roomDocumentsNormalized[d.room_key].push({ id: d.id, name: d.name, url: d.url, type: d.type, size: d.size, uploadedAt: d.uploaded_at });
    }

    const projectConfig = {
      room:             data.active_room       || null,
      viewMode:         data.view_mode         || null,
      generalMode:      data.general_mode      || null,
      globalAccent:     data.global_accent     || null,
      warmth:           data.warmth            ?? null,
      generalContext:   data.general_context   || "",
      customRooms:      data.custom_rooms      || [],
      hiddenRooms:      data.hidden_rooms      || [],
      roomOrder:        data.room_order        || null,
      generalResources: data.general_resources || [],
      persons:          data.persons            || [],
    };

    const payload = {
      projectConfig,
      name: data.name,
      inviteCode: data.invite_code,
      isOwner: data.owner_id === user.id,
      roomItems: roomItemsData || [],
      chatMessages,
      roomNotesNormalized: Object.keys(roomNotesNormalized).length ? roomNotesNormalized : null,
      roomDocumentsNormalized: Object.keys(roomDocumentsNormalized).length ? roomDocumentsNormalized : null,
      roomMediaNormalized: (mediaRow as { data: unknown } | null)?.data || null,
      roomNuancesNormalized: nuancesData?.length ? Object.fromEntries(nuancesData.map((n) => [n.room_key, {
        dominant: n.dominant, secondary: n.secondary, accent: n.accent,
        dominantColor: n.dominant_color, secondaryColor: n.secondary_color,
      }])) : null,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors du chargement." });
  }
});
