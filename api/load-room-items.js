import { allowCors, sendJson } from "./_openai.js";
import { getUserFromRequest, supabaseWithToken, supabaseAdmin } from "./_supabase.js";

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

  const url = new URL(req.url || "/", "http://localhost");
  const projectId = req.query?.projectId || url.searchParams.get("projectId");
  const type = req.query?.type || url.searchParams.get("type");

  if (!projectId) {
    sendJson(res, 400, { error: "projectId requis." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const supabase = supabaseWithToken(token);

    // --- discussions : liste des fils pour une pièce ---
    if (type === "discussions") {
      const roomKey = req.query?.roomKey || url.searchParams.get("roomKey");
      if (!roomKey) {
        sendJson(res, 400, { error: "roomKey requis." });
        return;
      }

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) { sendJson(res, 403, { error: "Accès refusé." }); return; }

      const { data: discussions, error: disError } = await supabase
        .from("discussions")
        .select("id, title, status, is_pinned, message_count, last_message_preview, last_message_at, created_at, created_by, linked_item_type, linked_item_ref")
        .eq("project_id", projectId)
        .eq("room_key", roomKey)
        .order("is_pinned", { ascending: false })
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (disError) throw new Error(disError.message);

      const discussionIds = (discussions || []).map(d => d.id);
      let readMap = {};
      if (discussionIds.length > 0) {
        const { data: reads } = await supabase
          .from("discussion_reads")
          .select("discussion_id, last_read_at")
          .eq("user_id", user.id)
          .in("discussion_id", discussionIds);
        (reads || []).forEach(r => { readMap[r.discussion_id] = r.last_read_at; });
      }

      const discussionsWithUnread = await Promise.all((discussions || []).map(async (d) => {
        const lastRead = readMap[d.id];
        if (!lastRead) return { ...d, unread_count: d.message_count };
        const { count } = await supabase
          .from("discussion_messages")
          .select("id", { count: "exact", head: true })
          .eq("discussion_id", d.id)
          .eq("is_deleted", false)
          .gt("created_at", lastRead);
        return { ...d, unread_count: count || 0 };
      }));

      sendJson(res, 200, { discussions: discussionsWithUnread });
      return;
    }

    // --- messages d'un fil de discussion ---
    if (type === "discussion-messages") {
      const discussionId = req.query?.discussionId || url.searchParams.get("discussionId");
      if (!discussionId) {
        sendJson(res, 400, { error: "discussionId requis." });
        return;
      }

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) { sendJson(res, 403, { error: "Accès refusé." }); return; }

      const { data: messages, error } = await supabase
        .from("discussion_messages")
        .select("id, author_id, author_name, author_avatar, content, linked_image, created_at, edited_at, is_deleted")
        .eq("discussion_id", discussionId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);

      // Marquer comme lu (fire-and-forget)
      supabase.from("discussion_reads").upsert(
        { user_id: user.id, discussion_id: discussionId, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,discussion_id" }
      ).then(() => {}).catch(() => {});

      sendJson(res, 200, { messages: messages || [] });
      return;
    }

    // --- membres du projet avec profils (pour les @mentions) ---
    if (type === "members") {
      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) { sendJson(res, 403, { error: "Accès refusé." }); return; }

      const { data: memberships } = await supabase
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", projectId);

      const members = await Promise.all((memberships || []).map(async (m) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        return {
          id: m.user_id,
          role: m.role,
          name: data?.user?.user_metadata?.full_name || data?.user?.email || m.user_id,
          avatar: data?.user?.user_metadata?.avatar_url || null,
        };
      }));

      sendJson(res, 200, { members });
      return;
    }

    // --- room items (comportement existant inchangé) ---
    const { data, error } = await supabase
      .from("room_items")
      .select("id, room_key, list_key, text, done, url, image, preview_title, position")
      .eq("project_id", projectId)
      .order("position");

    if (error) throw new Error(error.message);

    sendJson(res, 200, { items: data || [] });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors du chargement." });
  }
}
