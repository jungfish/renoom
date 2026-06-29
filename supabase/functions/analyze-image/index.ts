import { corsResponse, optionsResponse } from "../_shared/_cors.ts";
import { analyzeImage } from "../_shared/_openai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non autorisée." });

  try {
    const body = await req.json();
    const analysis = await analyzeImage(body);
    return corsResponse(200, { analysis });
  } catch (error) {
    const err = error as { status?: number; message?: string };
    return corsResponse(err.status || 500, { error: err.message || "Erreur serveur." });
  }
});
