const CHAT_MODEL = Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-4.1";
const IMAGE_PROMPT_MARKER = "|||IMAGE_PROMPT|||";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const BASE_TOOLS = [
  { type: "web_search_preview" },
  {
    type: "function",
    name: "generate_image",
    description: "Génère une visualisation d'une suggestion décorative concrète et actionnable. N'utilise que si la suggestion est clairement visuelle et précise.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Instruction en anglais pour édition d'image, 2-3 phrases, avec couleurs hex et style rétro." },
      },
      required: ["prompt"],
      strict: true,
    },
  },
];

const ROOM_TOOLS = [
  ...BASE_TOOLS,
  {
    type: "function",
    name: "add_to_shopping_list",
    description: "Ajoute des articles concrets à la liste de courses de la pièce active. Utilise si l'utilisateur demande des produits spécifiques ou valide des articles.",
    parameters: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "string" }, description: "Noms d'articles à ajouter (ex: 'Applique murale vintage cuivre')." },
      },
      required: ["items"],
      strict: true,
    },
  },
  {
    type: "function",
    name: "add_to_todo_list",
    description: "Ajoute des tâches à la liste de todos de la pièce active. Utilise si l'utilisateur mentionne quelque chose à faire, une action à réaliser ou une décision à ne pas oublier.",
    parameters: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "string" }, description: "Tâches à ajouter (ex: 'Mesurer l\\'espace entre les deux fenêtres')." },
      },
      required: ["items"],
      strict: true,
    },
  },
  {
    type: "function",
    name: "save_room_note",
    description: "Met à jour la note de design de la pièce active. Utilise si l'utilisateur valide une décision importante à retenir.",
    parameters: {
      type: "object",
      properties: {
        note: { type: "string", description: "Note de design à sauvegarder pour cette pièce." },
      },
      required: ["note"],
      strict: true,
    },
  },
  {
    type: "function",
    name: "update_item",
    description: "Modifie la due date, le responsable ou le prix d'un todo ou d'une envie existant. Utilise l'ID exact fourni dans le contexte. N'inclus que les champs à modifier.",
    parameters: {
      type: "object",
      properties: {
        list_type: { type: "string", enum: ["todos", "shopping"], description: "'todos' pour les tâches, 'shopping' pour les envies" },
        item_id: { type: "string", description: "ID exact de l'item tel qu'il apparaît dans le contexte entre crochets" },
        due_date: { type: "string", description: "Date d'échéance au format YYYY-MM-DD, ou chaîne vide '' pour supprimer l'échéance" },
        assignee: { type: "string", description: "Nom exact du responsable (doit figurer dans la liste des personnes), ou chaîne vide '' pour retirer" },
        price: { type: "number", description: "Nouveau prix de l'article (uniquement pour les envies/achats)" },
        price_currency: { type: "string", description: "Devise du prix, ex: EUR, USD. Par défaut EUR." },
      },
      required: ["list_type", "item_id"],
    },
  },
  {
    type: "function",
    name: "add_test_color",
    description: "Ajoute une ou plusieurs couleurs Farrow & Ball à tester (achat de pot d'essai) pour la pièce active.",
    parameters: {
      type: "object",
      properties: {
        names: { type: "array", items: { type: "string" }, description: "Noms exacts des couleurs Farrow & Ball (ex: 'Pointing', 'Skimming Stone')." },
      },
      required: ["names"],
      strict: true,
    },
  },
  {
    type: "function",
    name: "mark_color_chosen",
    description: "Marque une couleur test comme choisie (ou non choisie) pour la pièce active. Utilise l'ID exact fourni dans le contexte.",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "ID exact de la couleur test tel qu'il apparaît dans le contexte entre crochets" },
        chosen: { type: "boolean", description: "true pour marquer choisie, false pour retirer" },
      },
      required: ["item_id", "chosen"],
      strict: true,
    },
  },
];

function buildGeneralTools(availableRooms: { key: string; label: string }[]) {
  const roomKeyDesc = availableRooms.map((r) => `"${r.key}" (${r.label})`).join(", ");
  return [
    ...BASE_TOOLS,
    {
      type: "function",
      name: "add_to_shopping_list",
      description: "Ajoute des articles à la liste de courses d'une pièce spécifique.",
      parameters: {
        type: "object",
        properties: {
          room_key: { type: "string", description: `Clé de la pièce cible. Valeurs possibles: ${roomKeyDesc}` },
          items: { type: "array", items: { type: "string" } },
        },
        required: ["room_key", "items"],
        strict: true,
      },
    },
    {
      type: "function",
      name: "add_to_todo_list",
      description: "Ajoute des tâches à la liste de todos d'une pièce spécifique.",
      parameters: {
        type: "object",
        properties: {
          room_key: { type: "string", description: `Clé de la pièce cible. Valeurs possibles: ${roomKeyDesc}` },
          items: { type: "array", items: { type: "string" } },
        },
        required: ["room_key", "items"],
        strict: true,
      },
    },
    {
      type: "function",
      name: "save_room_note",
      description: "Met à jour la note de design d'une pièce spécifique.",
      parameters: {
        type: "object",
        properties: {
          room_key: { type: "string", description: `Clé de la pièce cible. Valeurs possibles: ${roomKeyDesc}` },
          note: { type: "string" },
        },
        required: ["room_key", "note"],
        strict: true,
      },
    },
    {
      type: "function",
      name: "update_item",
      description: "Modifie la due date, le responsable ou le prix d'un todo ou d'une envie existant. Utilise l'ID exact fourni dans le contexte. N'inclus que les champs à modifier.",
      parameters: {
        type: "object",
        properties: {
          room_key: { type: "string", description: `Clé de la pièce cible. Valeurs possibles: ${roomKeyDesc}` },
          list_type: { type: "string", enum: ["todos", "shopping"], description: "'todos' pour les tâches, 'shopping' pour les envies" },
          item_id: { type: "string", description: "ID exact de l'item tel qu'il apparaît dans le contexte entre crochets" },
          due_date: { type: "string", description: "Date d'échéance au format YYYY-MM-DD, ou chaîne vide '' pour supprimer l'échéance" },
          assignee: { type: "string", description: "Nom exact du responsable (doit figurer dans la liste des personnes), ou chaîne vide '' pour retirer" },
          price: { type: "number", description: "Nouveau prix de l'article (uniquement pour les envies/achats)" },
          price_currency: { type: "string", description: "Devise du prix, ex: EUR, USD. Par défaut EUR." },
        },
        required: ["room_key", "list_type", "item_id"],
      },
    },
    {
      type: "function",
      name: "add_test_color",
      description: "Ajoute une ou plusieurs couleurs Farrow & Ball à tester (achat de pot d'essai) pour une pièce spécifique.",
      parameters: {
        type: "object",
        properties: {
          room_key: { type: "string", description: `Clé de la pièce cible. Valeurs possibles: ${roomKeyDesc}` },
          names: { type: "array", items: { type: "string" }, description: "Noms exacts des couleurs Farrow & Ball (ex: 'Pointing', 'Skimming Stone')." },
        },
        required: ["room_key", "names"],
        strict: true,
      },
    },
    {
      type: "function",
      name: "mark_color_chosen",
      description: "Marque une couleur test comme choisie (ou non choisie) pour une pièce spécifique. Utilise l'ID exact fourni dans le contexte.",
      parameters: {
        type: "object",
        properties: {
          room_key: { type: "string", description: `Clé de la pièce cible. Valeurs possibles: ${roomKeyDesc}` },
          item_id: { type: "string", description: "ID exact de la couleur test tel qu'il apparaît dans le contexte entre crochets" },
          chosen: { type: "boolean", description: "true pour marquer choisie, false pour retirer" },
        },
        required: ["room_key", "item_id", "chosen"],
        strict: true,
      },
    },
  ];
}

const SYSTEM_BASE = "Assistant design intérieur, style rétro français. Aide aux décisions déco.\nRègles: français, concis, 3-6 phrases max. Univers rétro, coloré, doux — pas d'accents rouges ni de minimalisme. Pour produits/liens, utilise web_search avec URLs directes. Écris TOUJOURS une réponse texte à l'utilisateur, même en appelant un outil : un appel d'outil seul (ex: save_room_note) ne remplace jamais une réponse conversationnelle qui traite réellement la demande.";

type ShoppingItemCtx = { id: string; text: string; reactions?: Record<string, string[]>; selectedBy?: string[]; price?: number; priceCurrency?: string };

function formatShoppingItem(i: ShoppingItemCtx): string {
  const rx = i.reactions ? ` (${Object.entries(i.reactions).map(([e, u]) => `${e} ${u.join(", ")}`).join(" | ")})` : "";
  const sel = i.selectedBy?.length ? ` [achat: ${i.selectedBy.join(", ")}]` : "";
  const price = typeof i.price === "number" ? ` — ${i.price}${i.priceCurrency ? ` ${i.priceCurrency}` : ""}` : "";
  return (i.id ? `[${i.id}] ` : "") + i.text + price + rx + sel;
}

type TestColorCtx = { id: string; name: string; number?: string | null; hex: string; chosen?: boolean };

function formatTestColor(c: TestColorCtx): string {
  return `[${c.id}] ${c.name}${c.number ? ` N°${c.number}` : ""} (${c.hex})${c.chosen ? " — CHOISI" : ""}`;
}

function buildSystemPrompt(ctx: Record<string, unknown>): string {
  const total = ctx.mySelectedTotal as { amount: number; currency?: string | null } | null | undefined;
  return [
    SYSTEM_BASE,
    "",
    ctx.generalContext ? `Goûts & contraintes: ${ctx.generalContext}` : null,
    `Pièce: ${ctx.label} — ${ctx.line}`,
    `Palette: ${ctx.dominantName} (${ctx.dominantHex}) / ${ctx.secondaryName} (${ctx.secondaryHex}) / accent ${ctx.accentName} (${ctx.accentHex})`,
    ctx.roomNote ? `Notes: ${ctx.roomNote}` : null,
    ctx.imageMetadataSummary ? `Visuels: ${ctx.imageMetadataSummary}` : null,
    (ctx.todoItems as {id:string,text:string}[])?.length ? `Todos: ${(ctx.todoItems as {id:string,text:string}[]).map(i => i.id ? `[${i.id}] ${i.text}` : i.text).join(", ")}` : null,
    (ctx.shoppingItems as ShoppingItemCtx[])?.length ? `Courses: ${(ctx.shoppingItems as ShoppingItemCtx[]).map(formatShoppingItem).join(", ")}` : null,
    total ? `Total de mes achats sélectionnés: ${total.amount}${total.currency ? ` ${total.currency}` : ""}` : null,
    (ctx.testColors as TestColorCtx[])?.length ? `Couleurs testées: ${(ctx.testColors as TestColorCtx[]).map(formatTestColor).join(", ")}` : null,
    (ctx.persons as string[])?.length ? `Personnes: ${(ctx.persons as string[]).join(", ")}` : null,
    (ctx.materialSummary as string[])?.length ? `Matériaux: ${(ctx.materialSummary as string[]).join("; ")}` : null,
    ctx.allRoomsSummary ? `Autres pièces: ${ctx.allRoomsSummary}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function buildGeneralSystemPrompt(
  ctx: Record<string, unknown>,
  availableRooms: { key: string; label: string; line: string; roomNote?: string; todoItems?: {id:string,text:string}[]; shoppingItems?: ShoppingItemCtx[]; materialSummary?: string[]; testColors?: TestColorCtx[] }[],
  myGlobalSelectedTotal?: { amount: number; currency?: string | null } | null,
): string {
  const roomsDetail = availableRooms.map((r) => {
    const parts = [`${r.label}|${r.key}: ${r.line || ""}`];
    if (r.roomNote) parts.push(`  Note: ${r.roomNote}`);
    if (r.todoItems?.length) parts.push(`  Todos: ${r.todoItems.map(i => i.id ? `[${i.id}] ${i.text}` : i.text).join(", ")}`);
    if (r.shoppingItems?.length) parts.push(`  Courses: ${(r.shoppingItems as ShoppingItemCtx[]).map(formatShoppingItem).join(", ")}`);
    if (r.materialSummary?.length) parts.push(`  Matériaux: ${r.materialSummary.join("; ")}`);
    if (r.testColors?.length) parts.push(`  Couleurs testées: ${r.testColors.map(formatTestColor).join(", ")}`);
    return parts.join("\n");
  }).join("\n");

  return [
    SYSTEM_BASE,
    "",
    ctx.generalContext ? `Goûts & contraintes: ${ctx.generalContext}` : null,
    (ctx.persons as string[])?.length ? `Personnes: ${(ctx.persons as string[]).join(", ")}` : null,
    myGlobalSelectedTotal ? `Total de mes achats sélectionnés (toutes pièces): ${myGlobalSelectedTotal.amount}${myGlobalSelectedTotal.currency ? ` ${myGlobalSelectedTotal.currency}` : ""}` : null,
    "",
    "Mode Appartement — accès à toutes les pièces. Toujours spécifier room_key dans les outils.",
    "",
    "Pièces (label|key: description):",
    roomsDetail,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function parseImageMarker(text: string): { content: string; imagePrompt: string | null } {
  const start = text.indexOf(IMAGE_PROMPT_MARKER);
  if (start === -1) return { content: text.trim(), imagePrompt: null };
  const content = text.slice(0, start).trim();
  const afterFirst = text.slice(start + IMAGE_PROMPT_MARKER.length);
  const end = afterFirst.indexOf(IMAGE_PROMPT_MARKER);
  const jsonPart = end !== -1 ? afterFirst.slice(0, end) : afterFirst;
  try {
    const { prompt } = JSON.parse(jsonPart.trim());
    return { content, imagePrompt: prompt || null };
  } catch {
    return { content, imagePrompt: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: SSE_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
      status: 405,
      headers: { ...SSE_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY est manquante." }), {
      status: 500,
      headers: { ...SSE_HEADERS, "Content-Type": "application/json" },
    });
  }

  let messages: unknown[], roomContext: Record<string, unknown>, isGeneral: boolean, availableRooms: { key: string; label: string; line: string; roomNote?: string; todoItems?: string[]; shoppingItems?: string[]; materialSummary?: string[]; testColors?: TestColorCtx[] }[], myGlobalSelectedTotal: { amount: number; currency?: string | null } | null;
  try {
    const body = await req.json();
    messages = body.messages;
    roomContext = body.roomContext || {};
    isGeneral = !!body.isGeneral;
    availableRooms = Array.isArray(body.availableRooms) ? body.availableRooms : [];
    myGlobalSelectedTotal = body.myGlobalSelectedTotal || null;
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalide." }), {
      status: 400,
      headers: { ...SSE_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: "Messages requis." }), {
      status: 400,
      headers: { ...SSE_HEADERS, "Content-Type": "application/json" },
    });
  }

  const useGeneralMode = isGeneral && availableRooms.length > 0;
  const chatTools = useGeneralMode ? buildGeneralTools(availableRooms) : ROOM_TOOLS;
  const systemPrompt = useGeneralMode
    ? buildGeneralSystemPrompt(roomContext, availableRooms, myGlobalSelectedTotal)
    : buildSystemPrompt(roomContext);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        const historyToSend = (messages as Record<string, unknown>[]).slice(-20);
        const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: CHAT_MODEL,
            stream: true,
            tools: chatTools,
            instructions: systemPrompt,
            input: historyToSend.map((m) => {
              const imgList = Array.isArray(m.images) && m.images.length ? m.images : m.image ? [m.image] : [];
              if (m.role === "user" && imgList.length > 0) {
                return {
                  role: m.role,
                  content: [
                    ...(m.content ? [{ type: "input_text", text: m.content }] : []),
                    ...imgList.map((img) => ({ type: "input_image", image_url: img, detail: "low" })),
                  ],
                };
              }
              return {
                role: m.role,
                content: [{ type: m.role === "user" ? "input_text" : "output_text", text: m.content }],
              };
            }),
          }),
        });

        if (!openaiResponse.ok) {
          const errPayload = await openaiResponse.json().catch(() => ({}));
          write("error", { error: (errPayload as { error?: { message?: string } }).error?.message || "Erreur IA." });
          controller.close();
          return;
        }

        const reader = openaiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop()!;

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              if (dataStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (currentEvent === "response.output_text.delta" && parsed.delta) {
                  fullText += parsed.delta;
                  write("delta", { text: parsed.delta });
                } else if (currentEvent === "response.output_item.done" && parsed.item?.type === "function_call") {
                  try {
                    const args = JSON.parse(parsed.item.arguments);
                    write("tool_call", { name: parsed.item.name, args });
                  } catch { /* malformed tool call */ }
                }
              } catch { /* non-JSON SSE data */ }
            }
          }
        }

        const { imagePrompt } = parseImageMarker(fullText);
        write("done", { imagePrompt: imagePrompt || undefined });
      } catch (err) {
        try {
          controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message || "Erreur serveur." })}\n\n`));
        } catch { /* ignore */ }
      }

      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});
