import { allowCors, sendJson, parseJsonBody } from "./_openai.js";
import { getUserFromRequest, supabaseWithToken } from "./_supabase.js";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

const CHAT_HISTORY_MAX = 50;

export default async function handler(req, res) {
  allowCors(res, req);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const { user, token } = await getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: "Authentification requise." });
    return;
  }

  const body = await parseJsonBody(req);
  const { action } = body;

  if (!action) {
    sendJson(res, 400, { error: "action requis." });
    return;
  }

  const supabase = supabaseWithToken(token);

  try {
    // --- items ---
    if (action === "items" && req.method === "POST") {
      const { projectId, roomKey, listKey, items } = body;
      if (!projectId || !roomKey || !listKey || !Array.isArray(items)) {
        sendJson(res, 400, { error: "projectId, roomKey, listKey et items requis." });
        return;
      }
      if (!["todos", "shopping"].includes(listKey)) {
        sendJson(res, 400, { error: "listKey doit être 'todos' ou 'shopping'." });
        return;
      }

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) { sendJson(res, 403, { error: "Accès refusé." }); return; }

      // Replace complet : delete all then insert
      const { error: deleteError } = await supabase
        .from("room_items")
        .delete()
        .eq("project_id", projectId)
        .eq("room_key", roomKey)
        .eq("list_key", listKey);
      if (deleteError) throw new Error(deleteError.message);

      if (items.length > 0) {
        const rows = items.map((item, idx) => ({
          id: item.id,
          project_id: projectId,
          room_key: roomKey,
          list_key: listKey,
          text: item.text || "",
          done: item.done || false,
          url: item.url || null,
          image: item.image && item.image.startsWith("data:") ? null : (item.image || null),
          preview_title: item.previewTitle || null,
          position: idx,
        }));
        const { error: insertError } = await supabase.from("room_items").insert(rows);
        if (insertError) throw new Error(insertError.message);
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- chat-message ---
    if (action === "chat-message" && req.method === "POST") {
      const { projectId, roomKey, message } = body;
      if (!projectId || !roomKey || !message?.id || !message?.role || !message?.content) {
        sendJson(res, 400, { error: "projectId, roomKey et message (id, role, content) requis." });
        return;
      }
      if (!["user", "assistant"].includes(message.role)) {
        sendJson(res, 400, { error: "role doit être 'user' ou 'assistant'." });
        return;
      }

      const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
      if (!member) { sendJson(res, 403, { error: "Accès refusé." }); return; }

      const { error: upsertError } = await supabase.from("chat_messages").upsert({
        id: message.id,
        project_id: projectId,
        room_key: roomKey,
        role: message.role,
        content: message.content || "",
        image_prompt: message.imagePrompt || null,
        error: message.error || false,
      }, { onConflict: "id" });
      if (upsertError) throw new Error(upsertError.message);

      const { data: oldest } = await supabase.from("chat_messages").select("id, created_at").eq("project_id", projectId).eq("room_key", roomKey).order("created_at", { ascending: true });
      if (oldest && oldest.length > CHAT_HISTORY_MAX) {
        const toDelete = oldest.slice(0, oldest.length - CHAT_HISTORY_MAX).map((m) => m.id);
        await supabase.from("chat_messages").delete().in("id", toDelete);
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- note ---
    if (action === "note" && req.method === "POST") {
      const { projectId, roomKey, content } = body;
      if (!projectId || !roomKey || typeof content !== "string") {
        sendJson(res, 400, { error: "projectId, roomKey et content requis." });
        return;
      }
      const { error } = await supabase.from("room_notes").upsert(
        { project_id: projectId, room_key: roomKey, content, updated_at: new Date().toISOString() },
        { onConflict: "project_id,room_key" }
      );
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- document POST ---
    if (action === "document" && req.method === "POST") {
      const { projectId, roomKey, document: doc } = body;
      if (!projectId || !roomKey || !doc?.id || !doc?.url || !doc?.name) {
        sendJson(res, 400, { error: "projectId, roomKey et document (id, url, name) requis." });
        return;
      }
      const { error } = await supabase.from("room_documents").upsert({
        id: doc.id,
        project_id: projectId,
        room_key: roomKey,
        name: doc.name,
        url: doc.url,
        type: doc.type || null,
        size: doc.size || null,
        uploaded_at: doc.uploadedAt || new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true });
      return;
    }

    // --- document DELETE ---
    if (action === "document" && req.method === "DELETE") {
      const { projectId, documentId } = body;
      if (!projectId || !documentId) {
        sendJson(res, 400, { error: "projectId et documentId requis." });
        return;
      }
      const { error } = await supabase.from("room_documents").delete().eq("id", documentId).eq("project_id", projectId);
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: "Méthode ou action non supportée." });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Erreur lors de la sauvegarde." });
  }
}
