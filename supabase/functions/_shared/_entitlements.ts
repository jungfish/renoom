import { supabaseAdmin } from "./_supabase.ts";
import { isGodUser } from "./_god.ts";

export type PlanLimits = {
  max_active_projects: number;
  ai_messages_per_day: number;
  ai_images_per_month: number;
  max_members_per_project: number;
  pdf_exports_per_month: number;
};

export type Entitlements = {
  planId: string;
  planName: string;
  limits: PlanLimits;
};

const FREE_FALLBACK: Entitlements = {
  planId: "free",
  planName: "Gratuit",
  limits: { max_active_projects: 1, ai_messages_per_day: 5, ai_images_per_month: 3, max_members_per_project: 2, pdf_exports_per_month: 1 },
};

// Les comptes god bypassent tous les quotas (déjà le cas pour la suppression de
// projet et le comptage de conso IA) — sinon les comptes de dev/démo se retrouvent
// bloqués par les mêmes limites que les clients.
// Sentinelle finie (pas Infinity) car ces limites transitent en JSON — JSON.stringify(Infinity)
// devient `null`, ce qui casserait les comparaisons côté front.
const UNLIMITED = 1_000_000;
const GOD_ENTITLEMENTS: Entitlements = {
  planId: "god",
  planName: "Illimité (admin)",
  limits: { max_active_projects: UNLIMITED, ai_messages_per_day: UNLIMITED, ai_images_per_month: UNLIMITED, max_members_per_project: UNLIMITED, pdf_exports_per_month: UNLIMITED },
};

export async function getEntitlements(userId: string): Promise<Entitlements> {
  if (isGodUser(userId)) return GOD_ENTITLEMENTS;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan_id, plans(id, name, limits)")
    .eq("id", userId)
    .maybeSingle();

  const plan = data?.plans as { id: string; name: string; limits: PlanLimits } | null | undefined;
  if (!plan) return FREE_FALLBACK;

  return { planId: plan.id, planName: plan.name, limits: plan.limits };
}

export async function getProjectOwnerId(projectId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  return data?.owner_id ?? null;
}

export async function countActiveProjects(ownerId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("status", "active");
  return count ?? 0;
}

export async function countAiMessages24h(userId: string): Promise<number> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "chat_message")
    .gte("created_at", since24h);
  return count ?? 0;
}

// Compte les opérations IA liées à l'image (génération ET analyse) ensemble —
// c'est un seul quota partagé entre `image_generation` et `image_analysis`.
export async function countAiImages30d(userId: string): Promise<number> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("event_type", ["image_generation", "image_analysis"])
    .gte("created_at", since30d);
  return count ?? 0;
}

// Compté sur l'ensemble des projets du propriétaire, quel que soit le membre
// qui a déclenché chaque export — sinon un editor invité pourrait exporter
// sans jamais entamer le quota du propriétaire qui paie l'abonnement.
export async function countPdfExports30d(ownerId: string): Promise<number> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: ownedProjects } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("owner_id", ownerId);
  const projectIds = (ownedProjects || []).map((p) => p.id);
  if (!projectIds.length) return 0;

  const { count } = await supabaseAdmin
    .from("project_exports")
    .select("id", { count: "exact", head: true })
    .in("project_id", projectIds)
    .gte("created_at", since30d);
  return count ?? 0;
}

export async function countProjectMembers(projectId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("project_members")
    .select("user_id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}
