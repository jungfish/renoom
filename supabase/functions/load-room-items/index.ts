import { corsResponse, optionsResponse, CORS_HEADERS } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseWithToken, supabaseAdmin, writeChangeLog } from "../_shared/_supabase.ts";
import { isGodUser } from "../_shared/_god.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  const { user, token } = await getUserFromRequest(req);
  if (!user || !token) return corsResponse(401, { error: "Authentification requise." });

  // --- POST : suppression d'un membre (owner only) ---
  if (req.method === "POST") {
    const { projectId: pid, userId, action } = await req.json();
    if (action !== "remove-member" || !pid || !userId)
      return corsResponse(400, { error: "action, projectId et userId sont requis." });
    if (userId === user.id)
      return corsResponse(400, { error: "Vous ne pouvez pas vous supprimer vous-même." });
    try {
      const { data: caller } = await supabaseAdmin.from("project_members").select("role").eq("project_id", pid).eq("user_id", user.id).maybeSingle();
      if (!caller || caller.role !== "owner") return corsResponse(403, { error: "Seul l'owner peut supprimer des membres." });
      const { data: target } = await supabaseAdmin.from("project_members").select("role").eq("project_id", pid).eq("user_id", userId).maybeSingle();
      if (!target) return corsResponse(404, { error: "Membre introuvable." });
      if (target.role === "owner") return corsResponse(400, { error: "Impossible de supprimer un owner." });
      const { error: delError } = await supabaseAdmin.from("project_members").delete().eq("project_id", pid).eq("user_id", userId);
      if (delError) throw new Error(delError.message);
      await writeChangeLog(pid, user.id, "remove_member", { removed_user_id: userId });
      return corsResponse(200, { success: true });
    } catch (err) {
      return corsResponse(500, { error: (err as Error).message || "Erreur lors de la suppression." });
    }
  }

  if (req.method !== "GET") return corsResponse(405, { error: "Méthode non supportée." });

  const params = new URL(req.url).searchParams;
  const projectId = params.get("projectId");
  const type = params.get("type");

  if (!projectId) return corsResponse(400, { error: "projectId requis." });

  try {
    const supabase = supabaseWithToken(token);

    // --- discussions ---
    if (type === "discussions") {
      const roomKey = params.get("roomKey");
      if (!roomKey) return corsResponse(400, { error: "roomKey requis." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { data: discussions, error: disError } = await supabase
        .from("discussions")
        .select("id, title, status, is_pinned, message_count, last_message_preview, last_message_at, created_at, created_by, linked_item_type, linked_item_ref")
        .eq("project_id", projectId).eq("room_key", roomKey)
        .order("is_pinned", { ascending: false })
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (disError) throw new Error(disError.message);

      const discussionIds = (discussions || []).map((d) => d.id);
      const readMap: Record<string, string> = {};
      if (discussionIds.length > 0) {
        const { data: reads } = await supabase.from("discussion_reads")
          .select("discussion_id, last_read_at").eq("user_id", user.id).in("discussion_id", discussionIds);
        (reads || []).forEach((r) => { readMap[r.discussion_id] = r.last_read_at; });
      }

      const discussionsWithUnread = await Promise.all((discussions || []).map(async (d) => {
        const lastRead = readMap[d.id];
        if (!lastRead) return { ...d, unread_count: d.message_count };
        const { count } = await supabase.from("discussion_messages")
          .select("id", { count: "exact", head: true })
          .eq("discussion_id", d.id).eq("is_deleted", false).gt("created_at", lastRead);
        return { ...d, unread_count: count || 0 };
      }));

      return new Response(JSON.stringify({ discussions: discussionsWithUnread }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // --- messages d'un fil ---
    if (type === "discussion-messages") {
      const discussionId = params.get("discussionId");
      if (!discussionId) return corsResponse(400, { error: "discussionId requis." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { data: messages, error } = await supabase
        .from("discussion_messages")
        .select("id, author_id, author_name, author_avatar, content, linked_image, created_at, edited_at, is_deleted")
        .eq("discussion_id", discussionId).order("created_at", { ascending: true });
      if (error) throw new Error(error.message);

      supabase.from("discussion_reads").upsert(
        { user_id: user.id, discussion_id: discussionId, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,discussion_id" }
      ).then(() => {}).catch(() => {});

      return corsResponse(200, { messages: messages || [] });
    }

    // --- mention-notifications ---
    if (type === "mention-notifications") {
      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { data: notifications, error: notifError } = await supabase
        .from("mention_notifications")
        .select("id, discussion_id, message_id, mentioned_by, created_at, read_at, project_id")
        .eq("user_id", user.id).eq("project_id", projectId).order("created_at", { ascending: false });
      if (notifError) throw new Error(notifError.message);

      return corsResponse(200, { notifications: notifications || [] });
    }

    // --- members ---
    if (type === "members") {
      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { data: memberships } = await supabaseAdmin.from("project_members").select("user_id, role").eq("project_id", projectId);
      const members = await Promise.all((memberships || []).filter((m) => !isGodUser(m.user_id)).map(async (m) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        return {
          id: m.user_id, role: m.role,
          name: data?.user?.user_metadata?.full_name || data?.user?.email || m.user_id,
          avatar: data?.user?.user_metadata?.avatar_url || null,
        };
      }));
      return corsResponse(200, { members });
    }

    // --- reactions ---
    if (type === "reactions") {
      const { data: member } = await supabase.from("project_members").select("role")
        .eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { data: reactions, error: rErr } = await supabase
        .from("item_reactions")
        .select("id, item_id, user_id, user_name, emoji")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (rErr) throw new Error(rErr.message);
      return corsResponse(200, { reactions: reactions || [] });
    }

    // --- selections ---
    if (type === "selections") {
      const { data: member } = await supabase.from("project_members").select("role")
        .eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { data: selections, error: sErr } = await supabase
        .from("item_selections")
        .select("id, item_id, user_id, user_name")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (sErr) throw new Error(sErr.message);
      return corsResponse(200, { selections: selections || [] });
    }

    // --- room items (défaut) ---
    const { data, error } = await supabase.from("room_items")
      .select("id, room_key, list_key, text, done, url, image, preview_title, position, due_date, assignee")
      .eq("project_id", projectId).order("position");
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ items: data || [] }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors du chargement." });
  }
});
