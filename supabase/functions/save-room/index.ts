import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest, supabaseWithToken } from "../_shared/_supabase.ts";

const CHAT_HISTORY_MAX = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  const { user, token } = await getUserFromRequest(req);
  if (!user || !token) return corsResponse(401, { error: "Authentification requise." });

  const body = await req.json();
  const { action } = body;

  if (!action) return corsResponse(400, { error: "action requis." });

  const supabase = supabaseWithToken(token);

  try {
    // --- items ---
    if (action === "items" && req.method === "POST") {
      const { projectId, roomKey, listKey, items, allowClearAll } = body;
      if (!projectId || !roomKey || !listKey || !Array.isArray(items))
        return corsResponse(400, { error: "projectId, roomKey, listKey et items requis." });
      if (!["todos", "shopping"].includes(listKey))
        return corsResponse(400, { error: "listKey doit être 'todos' ou 'shopping'." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const rows = items.map((item: Record<string, unknown>, idx: number) => ({
        id: item.id,
        project_id: projectId,
        room_key: roomKey,
        list_key: listKey,
        text: item.text || "",
        done: item.done || false,
        url: item.url || null,
        image: typeof item.image === "string" && item.image.startsWith("data:") ? null : (item.image || null),
        preview_title: item.previewTitle || null,
        position: idx,
        due_date: item.dueDate || null,
        assignee: item.assignee || null,
      }));

      const ids = rows.map((r) => r.id).filter(Boolean) as string[];
      if (ids.length === 0) {
        // Garde absolue : ne jamais vider une liste sans intention explicite
        if (!allowClearAll) return corsResponse(200, { ok: true });
        const { error: delErr } = await supabase.from("room_items").delete().eq("project_id", projectId).eq("room_key", roomKey).eq("list_key", listKey);
        if (delErr) throw new Error(delErr.message);
      } else {
        // Supprimer uniquement les items qui ne sont plus dans la liste (évite la race condition DELETE+INSERT)
        const { error: delErr } = await supabase.from("room_items").delete().eq("project_id", projectId).eq("room_key", roomKey).eq("list_key", listKey).not("id", "in", `(${ids.join(",")})`);
        if (delErr) throw new Error(delErr.message);
        const { error: upsertErr } = await supabase.from("room_items").upsert(rows, { onConflict: "id" });
        if (upsertErr) throw new Error(upsertErr.message);
      }
      return corsResponse(200, { ok: true });
    }

    // --- selection ---
    if (action === "selection" && req.method === "POST") {
      const { projectId, itemId } = body;
      if (!projectId || !itemId) return corsResponse(400, { error: "projectId et itemId requis." });

      const { data: member } = await supabase.from("project_members").select("role")
        .eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { data: existing } = await supabase.from("item_selections")
        .select("id").eq("item_id", itemId).eq("user_id", user.id).maybeSingle();
      if (existing) {
        await supabase.from("item_selections").delete().eq("id", existing.id);
      } else {
        const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Membre";
        await supabase.from("item_selections").insert({ item_id: itemId, project_id: projectId, user_id: user.id, user_name: userName });
      }
      return corsResponse(200, { ok: true });
    }

    // --- save-persons ---
    if (action === "save-persons" && req.method === "POST") {
      const { projectId, persons } = body;
      if (!projectId || !Array.isArray(persons))
        return corsResponse(400, { error: "projectId et persons requis." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { error } = await supabase.from("projects").update({ persons }).eq("id", projectId);
      if (error) throw new Error(error.message);
      return corsResponse(200, { ok: true });
    }

    // --- chat-message ---
    if (action === "chat-message" && req.method === "POST") {
      const { projectId, roomKey, message } = body;
      if (!projectId || !roomKey || !message?.id || !message?.role || !message?.content)
        return corsResponse(400, { error: "projectId, roomKey et message (id, role, content) requis." });
      if (!["user", "assistant"].includes(message.role))
        return corsResponse(400, { error: "role doit être 'user' ou 'assistant'." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { error: upsertError } = await supabase.from("chat_messages").upsert({
        id: message.id, project_id: projectId, room_key: roomKey,
        role: message.role, content: message.content || "",
        image_prompt: message.imagePrompt || null, error: message.error || false,
      }, { onConflict: "id" });
      if (upsertError) throw new Error(upsertError.message);

      const { data: oldest } = await supabase.from("chat_messages").select("id, created_at").eq("project_id", projectId).eq("room_key", roomKey).order("created_at", { ascending: true });
      if (oldest && oldest.length > CHAT_HISTORY_MAX) {
        const toDelete = oldest.slice(0, oldest.length - CHAT_HISTORY_MAX).map((m) => m.id);
        await supabase.from("chat_messages").delete().in("id", toDelete);
      }
      return corsResponse(200, { ok: true });
    }

    // --- note ---
    if (action === "note" && req.method === "POST") {
      const { projectId, roomKey, content } = body;
      if (!projectId || !roomKey || typeof content !== "string")
        return corsResponse(400, { error: "projectId, roomKey et content requis." });
      const { error } = await supabase.from("room_notes").upsert(
        { project_id: projectId, room_key: roomKey, content, updated_at: new Date().toISOString() },
        { onConflict: "project_id,room_key" }
      );
      if (error) throw new Error(error.message);
      return corsResponse(200, { ok: true });
    }

    // --- document POST ---
    if (action === "document" && req.method === "POST") {
      const { projectId, roomKey, document: doc } = body;
      if (!projectId || !roomKey || !doc?.id || !doc?.url || !doc?.name)
        return corsResponse(400, { error: "projectId, roomKey et document (id, url, name) requis." });
      const { error } = await supabase.from("room_documents").upsert({
        id: doc.id, project_id: projectId, room_key: roomKey,
        name: doc.name, url: doc.url, type: doc.type || null,
        size: doc.size || null, uploaded_at: doc.uploadedAt || new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw new Error(error.message);
      return corsResponse(200, { ok: true });
    }

    // --- document DELETE ---
    if (action === "document" && req.method === "DELETE") {
      const { projectId, documentId } = body;
      if (!projectId || !documentId)
        return corsResponse(400, { error: "projectId et documentId requis." });
      const { error } = await supabase.from("room_documents").delete().eq("id", documentId).eq("project_id", projectId);
      if (error) throw new Error(error.message);
      return corsResponse(200, { ok: true });
    }

    // --- discussion-create ---
    if (action === "discussion-create" && req.method === "POST") {
      const { projectId, roomKey, title, linkedItemType, linkedItemRef } = body;
      if (!projectId || !roomKey || !title?.trim())
        return corsResponse(400, { error: "projectId, roomKey et title requis." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { data, error } = await supabase.from("discussions").insert({
        project_id: projectId, room_key: roomKey, title: title.trim(),
        created_by: user.id, linked_item_type: linkedItemType || null, linked_item_ref: linkedItemRef || null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return corsResponse(200, { ok: true, discussionId: data.id });
    }

    // --- discussion-message ---
    if (action === "discussion-message" && req.method === "POST") {
      const { projectId, discussionId, content, linkedImage, mentionedUserIds } = body;
      if (!projectId || !discussionId || !content?.trim())
        return corsResponse(400, { error: "projectId, discussionId et content requis." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const authorName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Inconnu";
      const authorAvatar = user.user_metadata?.avatar_url || null;

      const { data: msgData, error: msgError } = await supabase.from("discussion_messages").insert({
        discussion_id: discussionId, project_id: projectId,
        author_id: user.id, author_name: authorName, author_avatar: authorAvatar,
        content: content.trim(), linked_image: linkedImage || null,
      }).select("id").single();
      if (msgError) throw new Error(msgError.message);

      supabase.from("discussion_reads").upsert(
        { user_id: user.id, discussion_id: discussionId, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,discussion_id" }
      ).then(() => {}).catch(() => {});

      if (Array.isArray(mentionedUserIds) && mentionedUserIds.length > 0) {
        const notifRows = mentionedUserIds
          .filter((uid: string) => uid && uid !== user.id)
          .map((uid: string) => ({
            project_id: projectId, discussion_id: discussionId,
            message_id: msgData.id, user_id: uid, mentioned_by: user.id,
          }));
        if (notifRows.length > 0) {
          supabase.from("mention_notifications").insert(notifRows).then(() => {}).catch(() => {});
        }
      }
      return corsResponse(200, { ok: true, messageId: msgData.id });
    }

    // --- mark-mentions-read ---
    if (action === "mark-mentions-read" && req.method === "POST") {
      const { projectId, discussionIds } = body;
      if (!projectId || !Array.isArray(discussionIds) || discussionIds.length === 0)
        return corsResponse(400, { error: "projectId et discussionIds requis." });
      const { error } = await supabase.from("mention_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("project_id", projectId)
        .in("discussion_id", discussionIds).is("read_at", null);
      if (error) throw new Error(error.message);
      return corsResponse(200, { ok: true });
    }

    // --- discussion-update ---
    if (action === "discussion-update" && req.method === "POST") {
      const { projectId, discussionId, status, isPinned, title } = body;
      if (!projectId || !discussionId)
        return corsResponse(400, { error: "projectId et discussionId requis." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status !== undefined) patch.status = status;
      if (isPinned !== undefined) patch.is_pinned = isPinned;
      if (title?.trim()) patch.title = title.trim();

      const { error } = await supabase.from("discussions").update(patch).eq("id", discussionId).eq("project_id", projectId);
      if (error) throw new Error(error.message);
      return corsResponse(200, { ok: true });
    }

    // --- discussion-delete-message ---
    if (action === "discussion-delete-message" && req.method === "POST") {
      const { projectId, messageId } = body;
      if (!projectId || !messageId)
        return corsResponse(400, { error: "projectId et messageId requis." });

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const { error } = await supabase.from("discussion_messages")
        .update({ is_deleted: true }).eq("id", messageId).eq("author_id", user.id);
      if (error) throw new Error(error.message);
      return corsResponse(200, { ok: true });
    }

    // --- reaction (toggle) ---
    if (action === "reaction" && req.method === "POST") {
      const { projectId, itemId, emoji } = body;
      if (!projectId || !itemId || !emoji)
        return corsResponse(400, { error: "projectId, itemId et emoji requis." });
      if (emoji.length > 8)
        return corsResponse(400, { error: "emoji invalide." });

      const { data: member } = await supabase.from("project_members").select("role")
        .eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) return corsResponse(403, { error: "Accès refusé." });

      const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Inconnu";

      const { count: deletedCount } = await supabase.from("item_reactions")
        .delete({ count: "exact" })
        .eq("item_id", itemId).eq("user_id", user.id).eq("emoji", emoji).eq("project_id", projectId);

      if (deletedCount && deletedCount > 0)
        return corsResponse(200, { ok: true, toggled: "removed" });

      const { error: insErr } = await supabase.from("item_reactions")
        .insert({ item_id: itemId, project_id: projectId, user_id: user.id, user_name: userName, emoji });
      if (insErr) throw new Error(insErr.message);

      return corsResponse(200, { ok: true, toggled: "added" });
    }

    return corsResponse(405, { error: "Méthode ou action non supportée." });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors de la sauvegarde." });
  }
});
