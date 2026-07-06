import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { getUserFromRequest } from "../_shared/_supabase.ts";
import { getEntitlements, countActiveProjects, countAiMessages24h, countAiImages30d, countPdfExports30d } from "../_shared/_entitlements.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET") return corsResponse(405, { error: "Méthode non supportée." });

  const { user } = await getUserFromRequest(req);
  if (!user) return corsResponse(401, { error: "Authentification requise." });

  try {
    const entitlements = await getEntitlements(user.id);
    const [activeProjects, aiMessages24h, aiImages30d, pdfExports30d] = await Promise.all([
      countActiveProjects(user.id),
      countAiMessages24h(user.id),
      countAiImages30d(user.id),
      countPdfExports30d(user.id),
    ]);

    return corsResponse(200, {
      plan: { id: entitlements.planId, name: entitlements.planName },
      limits: entitlements.limits,
      usage: { activeProjects, aiMessages24h, aiImages30d, pdfExports30d },
    });
  } catch (err) {
    return corsResponse(500, { error: (err as Error).message || "Erreur lors du chargement des entitlements." });
  }
});
