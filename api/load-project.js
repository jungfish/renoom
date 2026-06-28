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
      .select("name, invite_code, owner_id, active_room, global_accent, warmth, general_context, custom_rooms, hidden_rooms, room_order, general_resources")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      sendJson(res, 404, { error: "Projet introuvable ou accès refusé." });
      return;
    }

    // Charge les données normalisées en parallèle
    const [{ data: roomItemsData }, { data: chatData }, { data: notesData }, { data: docsData }, { data: nuancesData }, { data: mediaRow }] = await Promise.all([
      supabaseUser
        .from("room_items")
        .select("id, room_key, list_key, text, done, url, image, preview_title, position")
        .eq("project_id", id)
        .order("position"),
      supabaseUser
        .from("chat_messages")
        .select("id, room_key, role, content, image_prompt, error, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
      supabaseUser
        .from("room_notes")
        .select("room_key, content")
        .eq("project_id", id),
      supabaseUser
        .from("room_documents")
        .select("id, room_key, name, url, type, size, uploaded_at")
        .eq("project_id", id)
        .order("uploaded_at"),
      supabaseUser
        .from("room_nuances")
        .select("room_key, dominant, secondary, accent, dominant_color, secondary_color")
        .eq("project_id", id),
      supabaseUser
        .from("room_media")
        .select("data")
        .eq("project_id", id)
        .maybeSingle(),
    ]);

    const chatMessages = (chatData || []).map((m) => ({
      id: m.id,
      roomKey: m.room_key,
      role: m.role,
      content: m.content,
      imagePrompt: m.image_prompt || undefined,
      error: m.error || undefined,
    }));

    const roomNotesNormalized = {};
    for (const n of (notesData || [])) roomNotesNormalized[n.room_key] = n.content;

    const roomDocumentsNormalized = {};
    for (const d of (docsData || [])) {
      if (!roomDocumentsNormalized[d.room_key]) roomDocumentsNormalized[d.room_key] = [];
      roomDocumentsNormalized[d.room_key].push({
        id: d.id, name: d.name, url: d.url, type: d.type, size: d.size, uploadedAt: d.uploaded_at,
      });
    }

    const projectConfig = {
      room:             data.active_room       || null,
      globalAccent:     data.global_accent     || null,
      warmth:           data.warmth            ?? null,
      generalContext:   data.general_context   || "",
      customRooms:      data.custom_rooms      || [],
      hiddenRooms:      data.hidden_rooms      || [],
      roomOrder:        data.room_order        || null,
      generalResources: data.general_resources || [],
    };

    res.setHeader("Cache-Control", "no-store");
    sendJson(res, 200, {
      projectConfig,
      name: data.name,
      inviteCode: data.invite_code,
      isOwner: data.owner_id === user.id,
      roomItems: roomItemsData || [],
      chatMessages,
      roomNotesNormalized: Object.keys(roomNotesNormalized).length ? roomNotesNormalized : null,
      roomDocumentsNormalized: Object.keys(roomDocumentsNormalized).length ? roomDocumentsNormalized : null,
      roomMediaNormalized: mediaRow?.data || null,
      roomNuancesNormalized: nuancesData?.length ? Object.fromEntries(nuancesData.map((n) => [n.room_key, {
        dominant: n.dominant, secondary: n.secondary, accent: n.accent,
        dominantColor: n.dominant_color, secondaryColor: n.secondary_color,
      }])) : null,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors du chargement." });
  }
}
