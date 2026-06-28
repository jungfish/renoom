import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// RLS-enforced client — opérations utilisateur
export function supabaseWithToken(userToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false },
  });
}

// Service role — contourne RLS (audit log, snapshots, join par code d'invitation)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Extrait et vérifie le JWT depuis le header Authorization
export async function getUserFromRequest(req) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { user: null, token: null };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { user: null, token: null };

  return { user: data.user, token };
}

// Écrit dans le change_log avec déduplication sur 'save' (< 5 min)
export async function writeChangeLog(projectId, userId, action, details = {}) {
  if (action === "save") {
    const { data } = await supabaseAdmin
      .from("change_log")
      .select("changed_at")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .eq("action", "save")
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && Date.now() - new Date(data.changed_at).getTime() < 5 * 60 * 1000) return;
  }

  await supabaseAdmin.from("change_log").insert({
    project_id: projectId,
    user_id: userId,
    action,
    details,
  });
}

// Remplace les data-URLs base64 par "[blob]" pour alléger les snapshots
export function stripBinaryData(obj) {
  if (typeof obj === "string") return obj.startsWith("data:") ? "[blob]" : obj;
  if (Array.isArray(obj)) return obj.map(stripBinaryData);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, stripBinaryData(v)]));
  }
  return obj;
}
