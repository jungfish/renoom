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

    // --- ai-usage (owner only) ---
    if (type === "ai-usage") {
      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member || member.role !== "owner") return corsResponse(403, { error: "Accès refusé." });

      const dailyLimitPerUser = Number(Deno.env.get("AI_DAILY_LIMIT_PER_USER") ?? "40");
      const dailyLimitGlobal = Number(Deno.env.get("AI_DAILY_LIMIT_GLOBAL") ?? "300");
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: globalCount } = await supabaseAdmin
        .from("ai_usage_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24h);

      const { data: projectEvents } = await supabaseAdmin
        .from("ai_usage_events")
        .select("user_id, input_tokens, output_tokens, web_search_calls")
        .eq("project_id", projectId)
        .gte("created_at", since24h);

      const { data: memberships } = await supabaseAdmin.from("project_members").select("user_id, role").eq("project_id", projectId);
      const perUser = await Promise.all((memberships || []).filter((m) => !isGodUser(m.user_id)).map(async (m) => {
        const events = (projectEvents || []).filter((e) => e.user_id === m.user_id);
        const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        return {
          id: m.user_id,
          name: data?.user?.user_metadata?.full_name || data?.user?.email || m.user_id,
          messages24h: events.length,
          tokens24h: events.reduce((sum, e) => sum + (e.input_tokens || 0) + (e.output_tokens || 0), 0),
          webSearch24h: events.reduce((sum, e) => sum + (e.web_search_calls || 0), 0),
        };
      }));

      return corsResponse(200, {
        global: { count: globalCount || 0, limit: dailyLimitGlobal },
        perUserLimit: dailyLimitPerUser,
        perUser: perUser.sort((a, b) => b.messages24h - a.messages24h),
      });
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

    // --- room items (défaut) ---
    const { data, error } = await supabase.from("room_items")
      .select("id, room_key, list_key, text, done, url, image, preview_title, position, due_date, assignee, price, price_currency, selected_for_purchase")
      .eq("project_id", projectId).order("position");
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ items: data || [] }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors du chargement." });
  }
});
