import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function supabaseWithToken(userToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false },
  });
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { user: null, token: null };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { user: null, token: null };

  return { user: data.user, token };
}

export async function writeChangeLog(
  projectId: string,
  userId: string,
  action: string,
  details: Record<string, unknown> = {},
) {
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

  await supabaseAdmin.from("change_log").insert({ project_id: projectId, user_id: userId, action, details });
}

export function stripBinaryData(obj: unknown): unknown {
  if (typeof obj === "string") return obj.startsWith("data:") ? "[blob]" : obj;
  if (Array.isArray(obj)) return obj.map(stripBinaryData);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripBinaryData(v)]));
  }
  return obj;
}
