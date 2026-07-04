import { createServer } from "node:http";

const PORT = Number(process.env.API_PORT || 5175);
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL || "gpt-4.1-mini";
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1";
const CHAT_IMAGE_PROMPT_MARKER = "|||IMAGE_PROMPT|||";

const CHAT_TOOLS = [
  { type: "web_search", search_context_size: "low" },
  {
    type: "function",
    name: "generate_image",
    description: "Génère une visualisation d'une suggestion décorative concrète et actionnable. N'utilise que si la suggestion est clairement visuelle et précise.",
    parameters: {
      type: "object",
      properties: { prompt: { type: "string", description: "Instruction en anglais pour édition d'image, 2-3 phrases, avec couleurs hex et style rétro." } },
      required: ["prompt"], strict: true,
    },
  },
  {
    type: "function",
    name: "add_to_shopping_list",
    description: "Ajoute des articles concrets à la liste de courses de la pièce active.",
    parameters: {
      type: "object",
      properties: { items: { type: "array", items: { type: "string" } } },
      required: ["items"], strict: true,
    },
  },
  {
    type: "function",
    name: "add_to_todo_list",
    description: "Ajoute des tâches à la liste de todos de la pièce active. Utilise si l'utilisateur mentionne quelque chose à faire, une action à réaliser ou une décision à ne pas oublier.",
    parameters: {
      type: "object",
      properties: { items: { type: "array", items: { type: "string" } } },
      required: ["items"], strict: true,
    },
  },
  {
    type: "function",
    name: "save_room_note",
    description: "Met à jour la note de design de la pièce active.",
    parameters: {
      type: "object",
      properties: { note: { type: "string" } },
      required: ["note"], strict: true,
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
      required: ["names"], strict: true,
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
      required: ["item_id", "chosen"], strict: true,
    },
  },
];
const MAX_BODY_BYTES = 30 * 1024 * 1024;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(payload));
}

function extractPrice(html) {
  const toNumber = (raw) => {
    const num = parseFloat(raw.replace(/[^\d.,]/g, "").replace(",", "."));
    return isNaN(num) ? null : num;
  };

  const ldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const jsonMatch = block.match(/>([\s\S]*?)<\/script>/i);
    if (!jsonMatch) continue;
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const nodes = Array.isArray(parsed) ? parsed : (parsed["@graph"] || [parsed]);
      for (const node of nodes) {
        const type = node?.["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct) continue;
        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        const rawPrice = offers?.price ?? offers?.priceSpecification?.price;
        if (rawPrice === undefined || rawPrice === null) continue;
        const price = toNumber(String(rawPrice));
        if (price !== null) {
          const currency = offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency ?? null;
          return { price, currency };
        }
      }
    } catch {
      // JSON-LD malformé, on ignore ce bloc
    }
  }

  const getMetaContent = (prop) => {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return m[1];
    }
    return null;
  };

  const metaAmount = getMetaContent("product:price:amount") || getMetaContent("og:price:amount");
  if (metaAmount) {
    const price = toNumber(metaAmount);
    if (price !== null) {
      const currency = getMetaContent("product:price:currency") || getMetaContent("og:price:currency");
      return { price, currency };
    }
  }

  const itemPropMatch =
    html.match(/<[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<[^>]+content=["']([^"']+)["'][^>]+itemprop=["']price["']/i);
  if (itemPropMatch?.[1]) {
    const price = toNumber(itemPropMatch[1]);
    if (price !== null) return { price, currency: null };
  }

  for (let i = 1; i <= 2; i++) {
    const label = getMetaContent(`twitter:label${i}`);
    if (label && /prix|price/i.test(label)) {
      const data = getMetaContent(`twitter:data${i}`);
      const priceMatch = data?.match(/[\d]+(?:[.,]\d{2})?/);
      if (priceMatch) {
        const price = toNumber(priceMatch[0]);
        if (price !== null) {
          const currency = /€/.test(data) ? "EUR" : /\$/.test(data) ? "USD" : /£/.test(data) ? "GBP" : null;
          return { price, currency };
        }
      }
    }
  }

  return { price: null, currency: null };
}

function getSupabaseHeaders(req, useServiceRole = false) {
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers["authorization"] || "";
  const userToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const key = useServiceRole ? (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY) : SUPABASE_ANON_KEY;
  const bearer = useServiceRole ? key : (userToken || SUPABASE_ANON_KEY);
  return { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${bearer}`, "Content-Type": "application/json" };
}

async function getAuthUser(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${token}` },
    });
    const data = await r.json();
    return data?.id ? data : null;
  } catch { return null; }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Image trop lourde pour cette requête locale."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("JSON invalide."));
      }
    });
    req.on("error", reject);
  });
}

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Image invalide: data URL attendue.");
  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  return new Blob([bytes], { type: mimeType });
}

function parseMetadata(text, section) {
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      type: parsed.type || section || "reference",
      style: parsed.style || "",
      inspiration: parsed.inspiration || "",
      materials: Array.isArray(parsed.materials) ? parsed.materials.slice(0, 5) : [],
      colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 5) : [],
      details: Array.isArray(parsed.details) ? parsed.details.slice(0, 5) : [],
    };
  } catch {
    return {
      type: section || "reference",
      style: "",
      inspiration: text,
      materials: [],
      colors: [],
      details: [],
    };
  }
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  // GET routes
  if (req.method === "GET") {
    if (req.url.startsWith("/api/load-project")) {
      const urlObj = new URL(req.url, "http://localhost");
      const id = urlObj.searchParams.get("id");
      if (!id || !/^[a-z0-9-]{6,16}$/.test(id)) { sendJson(res, 400, { error: "ID invalide." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      if (!SUPABASE_URL) { sendJson(res, 500, { error: "Configuration Supabase manquante." }); return; }
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      try {
        const sbH = getSupabaseHeaders(req, true);
        const eid = encodeURIComponent(id);
        const [projRes, itemsRes, chatRes, notesRes, docsRes, nuancesRes, mediaRes, colorTestsRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${eid}&select=name,invite_code,owner_id,active_room,view_mode,general_mode,global_accent,warmth,general_context,custom_rooms,hidden_rooms,room_order,general_resources,persons,updated_at`, { headers: sbH }),
          fetch(`${SUPABASE_URL}/rest/v1/room_items?project_id=eq.${eid}&select=id,room_key,list_key,text,done,url,image,preview_title,position,due_date,assignee,price,price_currency&order=position.asc`, { headers: sbH }),
          fetch(`${SUPABASE_URL}/rest/v1/chat_messages?project_id=eq.${eid}&select=id,room_key,role,content,image_prompt,error,created_at&order=created_at.asc`, { headers: sbH }),
          fetch(`${SUPABASE_URL}/rest/v1/room_notes?project_id=eq.${eid}&select=room_key,content`, { headers: sbH }),
          fetch(`${SUPABASE_URL}/rest/v1/room_documents?project_id=eq.${eid}&select=id,room_key,name,url,type,size,uploaded_at&order=uploaded_at.asc`, { headers: sbH }),
          fetch(`${SUPABASE_URL}/rest/v1/room_nuances?project_id=eq.${eid}&select=room_key,dominant,secondary,accent,dominant_color,secondary_color`, { headers: sbH }),
          fetch(`${SUPABASE_URL}/rest/v1/room_media?project_id=eq.${eid}&select=data`, { headers: sbH }),
          fetch(`${SUPABASE_URL}/rest/v1/room_color_tests?project_id=eq.${eid}&select=id,room_key,hex,name,number,chosen,position&order=position.asc`, { headers: sbH }),
        ]);
        if (!projRes.ok) { sendJson(res, 404, { error: "Projet introuvable." }); return; }
        const rows = await projRes.json();
        if (!rows.length) { sendJson(res, 404, { error: "Projet introuvable." }); return; }
        const row = rows[0];

        const [roomItemsData, chatData, notesData, docsData, nuancesData, mediaRows, colorTestsData] = await Promise.all([
          itemsRes.json(), chatRes.json(), notesRes.json(), docsRes.json(), nuancesRes.json(), mediaRes.json(), colorTestsRes.json(),
        ]);

        const chatMessages = (chatData || []).map((m) => ({
          id: m.id, roomKey: m.room_key, role: m.role, content: m.content,
          imagePrompt: m.image_prompt || undefined, error: m.error || undefined,
        }));

        const roomNotesNormalized = {};
        for (const n of (notesData || [])) roomNotesNormalized[n.room_key] = n.content;

        const roomDocumentsNormalized = {};
        for (const d of (docsData || [])) {
          if (!roomDocumentsNormalized[d.room_key]) roomDocumentsNormalized[d.room_key] = [];
          roomDocumentsNormalized[d.room_key].push({ id: d.id, name: d.name, url: d.url, type: d.type, size: d.size, uploadedAt: d.uploaded_at });
        }

        const roomNuancesNormalized = {};
        for (const n of (nuancesData || [])) {
          roomNuancesNormalized[n.room_key] = { dominant: n.dominant, secondary: n.secondary, accent: n.accent, dominantColor: n.dominant_color, secondaryColor: n.secondary_color };
        }

        const roomColorTestsNormalized = {};
        for (const c of (colorTestsData || [])) {
          if (!roomColorTestsNormalized[c.room_key]) roomColorTestsNormalized[c.room_key] = [];
          roomColorTestsNormalized[c.room_key].push({ id: c.id, hex: c.hex, name: c.name, number: c.number, chosen: c.chosen });
        }

        const mediaRow = (mediaRows || [])[0];
        const projectConfig = {
          room: row.active_room || null,
          viewMode: row.view_mode || null,
          generalMode: row.general_mode || null,
          globalAccent: row.global_accent || null,
          warmth: typeof row.warmth === "number" ? row.warmth : null,
          generalContext: row.general_context || null,
          customRooms: row.custom_rooms || [],
          hiddenRooms: row.hidden_rooms || [],
          roomOrder: row.room_order || null,
          generalResources: row.general_resources || [],
          persons: row.persons || [],
          savedAt: row.updated_at || null,
        };
        sendJson(res, 200, {
          projectConfig,
          name: row.name,
          inviteCode: row.invite_code,
          isOwner: row.owner_id === user.id,
          roomItems: roomItemsData || [],
          chatMessages,
          roomNotesNormalized: Object.keys(roomNotesNormalized).length ? roomNotesNormalized : null,
          roomDocumentsNormalized: Object.keys(roomDocumentsNormalized).length ? roomDocumentsNormalized : null,
          roomMediaNormalized: mediaRow?.data || null,
          roomNuancesNormalized: Object.keys(roomNuancesNormalized).length ? roomNuancesNormalized : null,
          roomColorTestsNormalized: Object.keys(roomColorTestsNormalized).length ? roomColorTestsNormalized : null,
        });
      } catch (err) { sendJson(res, 500, { error: err.message }); }
      return;
    }

    if (req.url.startsWith("/api/list-snapshots")) {
      const urlObj = new URL(req.url, "http://localhost");
      const projectId = urlObj.searchParams.get("projectId");
      if (!projectId) { sendJson(res, 400, { error: "projectId requis." }); return; }
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      try {
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/project_snapshots?project_id=eq.${encodeURIComponent(projectId)}&select=id,saved_at,user_id,label&order=saved_at.desc&limit=10`,
          { headers: getSupabaseHeaders(req, true) }
        );
        const rows = await sbRes.json();
        sendJson(res, 200, { snapshots: (rows || []).map(s => ({ id: s.id, savedAt: s.saved_at, label: s.label, authorName: s.user_id === user.id ? "Moi" : "Autre" })) });
      } catch (err) { sendJson(res, 500, { error: err.message }); }
      return;
    }

    if (req.url.startsWith("/api/load-room-items")) {
      const urlObj = new URL(req.url, "http://localhost");
      const projectId = urlObj.searchParams.get("projectId");
      if (!projectId) { sendJson(res, 400, { error: "projectId requis." }); return; }
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      try {
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/room_items?project_id=eq.${encodeURIComponent(projectId)}&select=id,room_key,list_key,text,done,url,image,preview_title,position,due_date,assignee,price,price_currency&order=position.asc`,
          { headers: getSupabaseHeaders(req, true) }
        );
        const items = await sbRes.json();
        sendJson(res, 200, { items: items || [] });
      } catch (err) { sendJson(res, 500, { error: err.message }); }
      return;
    }

    sendJson(res, 404, { error: "Route inconnue." });
    return;
  }

  const POST_ROUTES = ["/api/generate-image", "/api/analyze-image", "/api/upload-image", "/api/chat", "/api/fetch-link-preview", "/api/save-project", "/api/join-project", "/api/restore-snapshot", "/api/save-room"];
  if ((req.method !== "POST" && req.method !== "DELETE") || !POST_ROUTES.includes(req.url)) {
    sendJson(res, 404, { error: "Route inconnue." });
    return;
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      sendJson(res, 500, { error: "OPENAI_API_KEY est manquante dans le serveur local." });
      return;
    }

    const body = await readJson(req);

    if (req.url === "/api/save-project") {
      const { state, id, snapshot, snapshotLabel } = body;
      if (!state) { sendJson(res, 400, { error: "state requis." }); return; }
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      if (!SUPABASE_URL) { sendJson(res, 500, { error: "Configuration Supabase manquante." }); return; }
      const projectId = id || Math.random().toString(36).slice(2, 10);
      const isNew = !id;
      const upsertData = {
        id: projectId, updated_at: new Date().toISOString(),
        active_room:       state.room           || null,
        view_mode:         state.viewMode       || null,
        general_mode:      state.generalMode    || null,
        global_accent:     state.globalAccent   || null,
        warmth:            typeof state.warmth === "number" ? state.warmth : null,
        general_context:   state.generalContext || null,
        custom_rooms:      state.customRooms    || [],
        hidden_rooms:      state.hiddenRooms    || [],
        room_order:        state.roomOrder      || null,
        general_resources: state.generalResources || [],
        persons:           state.persons        || [],
      };
      if (isNew) upsertData.owner_id = user.id;
      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
        method: "POST",
        headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify(upsertData),
      });
      if (!sbRes.ok) { sendJson(res, 500, { error: await sbRes.text() }); return; }
      if (isNew) {
        await fetch(`${SUPABASE_URL}/rest/v1/project_members`, {
          method: "POST",
          headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
          body: JSON.stringify({ project_id: projectId, user_id: user.id, role: "owner" }),
        });
      }
      // Dual-write room_media — fire-and-forget, only if there's actual media content and not metaOnly
      const mediaData = {
        uploadedImages: state.uploadedImages || {}, inspirationLinks: state.inspirationLinks || {},
        aiInspirations: state.aiInspirations || {}, instagramItems: state.instagramItems || {},
        imageAnalysis: state.imageAnalysis || {}, deletedImages: state.deletedImages || {},
        materialUploads: state.materialUploads || {}, materialLinks: state.materialLinks || {},
        extraMaterialImages: state.extraMaterialImages || {}, extraMaterialMeta: state.extraMaterialMeta || {},
        planUploads: state.planUploads || {}, planLinks: state.planLinks || {}, extraPlanImages: state.extraPlanImages || {},
      };
      const hasMedia = !body.metaOnly && Object.values(mediaData).some(v => v && Object.keys(v).length > 0);
      if (hasMedia) {
        fetch(`${SUPABASE_URL}/rest/v1/room_media`, {
          method: "POST",
          headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
          body: JSON.stringify({ project_id: projectId, data: mediaData, updated_at: new Date().toISOString() }),
        }).catch(() => {});
      }
      // Dual-write room_nuances — fire-and-forget
      if (state.roomNuances && typeof state.roomNuances === "object") {
        const nuanceRows = Object.entries(state.roomNuances).map(([roomKey, n]) => ({
          project_id: projectId, room_key: roomKey, dominant: n.dominant || null,
          secondary: n.secondary || null, accent: n.accent || null,
          dominant_color: n.dominantColor || null, secondary_color: n.secondaryColor || null,
          updated_at: new Date().toISOString(),
        }));
        if (nuanceRows.length) {
          fetch(`${SUPABASE_URL}/rest/v1/room_nuances`, {
            method: "POST",
            headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify(nuanceRows),
          }).catch(() => {});
        }
      }
      if (snapshot) {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_snapshot`, {
          method: "POST",
          headers: getSupabaseHeaders(req, true),
          body: JSON.stringify({ p_project_id: projectId, p_user_id: user.id, p_state: state, p_label: snapshotLabel || "Sauvegarde" }),
        });
      }
      sendJson(res, 200, { id: projectId });
      return;
    }

    if (req.url === "/api/join-project") {
      const { inviteCode } = body;
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const projRes = await fetch(`${SUPABASE_URL}/rest/v1/projects?invite_code=eq.${encodeURIComponent(inviteCode)}&select=id,owner_id`, { headers: getSupabaseHeaders(req, true) });
      const projs = await projRes.json();
      if (!projs?.length) { sendJson(res, 404, { error: "Code invalide." }); return; }
      const project = projs[0];
      await fetch(`${SUPABASE_URL}/rest/v1/project_members`, {
        method: "POST",
        headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({ project_id: project.id, user_id: user.id, role: "editor" }),
      });
      sendJson(res, 200, { projectId: project.id });
      return;
    }

    if (req.url === "/api/restore-snapshot") {
      const { projectId, snapshotId } = body;
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const snapRes = await fetch(`${SUPABASE_URL}/rest/v1/project_snapshots?id=eq.${snapshotId}&project_id=eq.${encodeURIComponent(projectId)}&select=state,label`, { headers: getSupabaseHeaders(req, true) });
      const snaps = await snapRes.json();
      if (!snaps?.length) { sendJson(res, 404, { error: "Snapshot introuvable." }); return; }
      await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: getSupabaseHeaders(req, true),
        body: JSON.stringify({ state: snaps[0].state, updated_at: new Date().toISOString() }),
      });
      sendJson(res, 200, { state: snaps[0].state });
      return;
    }

    if (req.url === "/api/save-room") {
      const { action, projectId } = body;
      if (!action || !projectId) { sendJson(res, 400, { error: "action et projectId requis." }); return; }
      const user = await getAuthUser(req);
      if (!user) { sendJson(res, 401, { error: "Authentification requise." }); return; }
      const SUPABASE_URL = process.env.SUPABASE_URL;
      try {
        if (action === "items" && req.method === "POST") {
          const { roomKey, listKey, items } = body;
          if (!roomKey || !listKey || !Array.isArray(items)) { sendJson(res, 400, { error: "roomKey, listKey et items requis." }); return; }
          const now = new Date().toISOString();
          const eid = encodeURIComponent(projectId);
          if (items.length) {
            const rows = items.map((item, i) => ({ id: item.id, project_id: projectId, room_key: roomKey, list_key: listKey, text: item.text || "", done: item.done || false, url: item.url || null, image: item.image || null, preview_title: item.previewTitle || null, position: i, updated_at: now, due_date: item.dueDate || null, assignee: item.assignee || null, price: item.price ?? null, price_currency: item.priceCurrency || null }));
            const uRes = await fetch(`${SUPABASE_URL}/rest/v1/room_items`, { method: "POST", headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify(rows) });
            if (!uRes.ok) { sendJson(res, 500, { error: await uRes.text() }); return; }
          }
          const ids = items.map(i => i.id);
          const baseQ = `${SUPABASE_URL}/rest/v1/room_items?project_id=eq.${eid}&room_key=eq.${encodeURIComponent(roomKey)}&list_key=eq.${encodeURIComponent(listKey)}`;
          const delQ = ids.length ? `${baseQ}&id=not.in.(${ids.join(",")})` : baseQ;
          await fetch(delQ, { method: "DELETE", headers: getSupabaseHeaders(req, true) });
          sendJson(res, 200, { ok: true }); return;
        }
        if (action === "color-tests" && req.method === "POST") {
          const { roomKey, colors } = body;
          if (!roomKey || !Array.isArray(colors)) { sendJson(res, 400, { error: "roomKey et colors requis." }); return; }
          const now = new Date().toISOString();
          const eid = encodeURIComponent(projectId);
          if (colors.length) {
            const rows = colors.map((c, i) => ({ id: c.id, project_id: projectId, room_key: roomKey, hex: c.hex, name: c.name, number: c.number || null, chosen: c.chosen || false, position: i, updated_at: now }));
            const uRes = await fetch(`${SUPABASE_URL}/rest/v1/room_color_tests`, { method: "POST", headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify(rows) });
            if (!uRes.ok) { sendJson(res, 500, { error: await uRes.text() }); return; }
          }
          const ids = colors.map(c => c.id);
          const baseQ = `${SUPABASE_URL}/rest/v1/room_color_tests?project_id=eq.${eid}&room_key=eq.${encodeURIComponent(roomKey)}`;
          const delQ = ids.length ? `${baseQ}&id=not.in.(${ids.join(",")})` : baseQ;
          await fetch(delQ, { method: "DELETE", headers: getSupabaseHeaders(req, true) });
          sendJson(res, 200, { ok: true }); return;
        }
        if (action === "chat-message" && req.method === "POST") {
          const { roomKey, message } = body;
          if (!roomKey || !message?.id) { sendJson(res, 400, { error: "roomKey et message requis." }); return; }
          await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`, { method: "POST", headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ id: message.id, project_id: projectId, room_key: roomKey, role: message.role, content: message.content || "", image_prompt: message.imagePrompt || null, error: message.error || false }) });
          const cRes = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?project_id=eq.${encodeURIComponent(projectId)}&room_key=eq.${encodeURIComponent(roomKey)}&select=id,created_at&order=created_at.asc`, { headers: getSupabaseHeaders(req, true) });
          const allMsgs = await cRes.json();
          if (allMsgs.length > 50) { const toDelete = allMsgs.slice(0, allMsgs.length - 50).map(m => m.id); await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?id=in.(${toDelete.join(",")})`, { method: "DELETE", headers: getSupabaseHeaders(req, true) }); }
          sendJson(res, 200, { ok: true }); return;
        }
        if (action === "note" && req.method === "POST") {
          const { roomKey, content } = body;
          if (!roomKey) { sendJson(res, 400, { error: "roomKey requis." }); return; }
          await fetch(`${SUPABASE_URL}/rest/v1/room_notes`, { method: "POST", headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ project_id: projectId, room_key: roomKey, content: content || "", updated_at: new Date().toISOString() }) });
          sendJson(res, 200, { ok: true }); return;
        }
        if (action === "document" && req.method === "DELETE") {
          const { documentId } = body;
          if (!documentId) { sendJson(res, 400, { error: "documentId requis." }); return; }
          await fetch(`${SUPABASE_URL}/rest/v1/room_documents?id=eq.${encodeURIComponent(documentId)}&project_id=eq.${encodeURIComponent(projectId)}`, { method: "DELETE", headers: getSupabaseHeaders(req, true) });
          sendJson(res, 200, { ok: true }); return;
        }
        if (action === "chat-message" && req.method === "DELETE") {
          const { roomKey } = body;
          if (!roomKey) { sendJson(res, 400, { error: "roomKey requis." }); return; }
          await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?project_id=eq.${encodeURIComponent(projectId)}&room_key=eq.${encodeURIComponent(roomKey)}`, { method: "DELETE", headers: getSupabaseHeaders(req, true) });
          sendJson(res, 200, { ok: true }); return;
        }
        if (action === "document" && req.method === "POST") {
          const { roomKey, document: doc } = body;
          if (!roomKey || !doc?.id || !doc?.url || !doc?.name) { sendJson(res, 400, { error: "roomKey et document requis." }); return; }
          await fetch(`${SUPABASE_URL}/rest/v1/room_documents`, { method: "POST", headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ id: doc.id, project_id: projectId, room_key: roomKey, name: doc.name, url: doc.url, type: doc.type || null, size: doc.size || null, uploaded_at: doc.uploadedAt || new Date().toISOString() }) });
          sendJson(res, 200, { ok: true }); return;
        }
        if (action === "media-upsert" && req.method === "POST") {
          const { mediaType, key, value } = body;
          if (!mediaType || key === undefined) { sendJson(res, 400, { error: "mediaType et key requis." }); return; }
          const eid = encodeURIComponent(projectId);
          const existRes = await fetch(`${SUPABASE_URL}/rest/v1/room_media?project_id=eq.${eid}&select=data`, { headers: getSupabaseHeaders(req, true) });
          const existRows = await existRes.json();
          const currentData = (existRows[0]?.data) || {};
          let merged;
          if (value === null) {
            const { [key]: _removed, ...rest } = currentData[mediaType] || {};
            merged = { ...currentData, [mediaType]: rest };
          } else if (Array.isArray(value)) {
            merged = { ...currentData, [mediaType]: { ...(currentData[mediaType] || {}), [key]: value } };
          } else {
            merged = { ...currentData, [mediaType]: { ...(currentData[mediaType] || {}), [key]: value } };
          }
          const uRes = await fetch(`${SUPABASE_URL}/rest/v1/room_media`, {
            method: "POST",
            headers: { ...getSupabaseHeaders(req, true), "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({ project_id: projectId, data: merged, updated_at: new Date().toISOString() }),
          });
          if (!uRes.ok) { sendJson(res, 500, { error: await uRes.text() }); return; }
          sendJson(res, 200, { ok: true }); return;
        }
        sendJson(res, 400, { error: "action non reconnue." }); return;
      } catch (err) { sendJson(res, 500, { error: err.message }); return; }
    }

    if (req.url === "/api/fetch-link-preview") {
      const { url } = body;
      if (!url) { sendJson(res, 400, { error: "url requis." }); return; }
      try {
        const pageRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
        if (!pageRes.ok) {
          sendJson(res, 200, { url, ok: false, status: pageRes.status, title: null, description: null, image: null });
          return;
        }
        const html = await pageRes.text();
        const getMeta = (prop) => {
          const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
          return m?.[1] || null;
        };
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const { price, currency } = extractPrice(html);
        sendJson(res, 200, {
          url,
          ok: true,
          title: getMeta("og:title") || getMeta("twitter:title") || titleMatch?.[1]?.trim() || null,
          description: getMeta("og:description") || getMeta("twitter:description") || getMeta("description") || null,
          image: getMeta("og:image") || getMeta("twitter:image") || null,
          price,
          currency,
        });
      } catch { sendJson(res, 200, { url, ok: null, title: null, description: null, image: null, price: null, currency: null }); }
      return;
    }

    if (req.url === "/api/upload-image") {
      const { dataUrl, filename } = body;
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        sendJson(res, 200, { url: dataUrl });
        return;
      }
      const { put } = await import("@vercel/blob");
      const match = dataUrl?.match(/^data:(.+);base64,(.+)$/);
      if (!match) {
        sendJson(res, 400, { error: "dataUrl invalide." });
        return;
      }
      const [, mimeType, base64] = match;
      const buffer = Buffer.from(base64, "base64");
      const blob = await put(filename || `image-${Date.now()}`, buffer, {
        access: "public",
        contentType: mimeType,
      });
      sendJson(res, 200, { url: blob.url });
      return;
    }

    if (req.url === "/api/chat") {
      const { messages, roomContext, isGeneral, availableRooms } = body;
      if (!messages?.length) {
        sendJson(res, 400, { error: "Messages requis." });
        return;
      }
      const ctx = roomContext || {};

      let chatTools = CHAT_TOOLS;
      let systemPrompt;

      if (isGeneral && Array.isArray(availableRooms) && availableRooms.length) {
        const roomKeyDesc = availableRooms.map(r => `"${r.key}" (${r.label})`).join(", ");
        chatTools = [
          { type: "web_search", search_context_size: "low" },
          {
            type: "function",
            name: "generate_image",
            description: CHAT_TOOLS[1].description,
            parameters: CHAT_TOOLS[1].parameters,
          },
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
              required: ["room_key", "items"], strict: true,
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
              required: ["room_key", "items"], strict: true,
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
              required: ["room_key", "note"], strict: true,
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
                names: { type: "array", items: { type: "string" } },
              },
              required: ["room_key", "names"], strict: true,
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
                item_id: { type: "string" },
                chosen: { type: "boolean" },
              },
              required: ["room_key", "item_id", "chosen"], strict: true,
            },
          },
        ];

        const roomsDetail = availableRooms.map(r => {
          const parts = [`— ${r.label} (key: "${r.key}"): ${r.line || ""}`];
          if (r.roomNote) parts.push(`  Note: ${r.roomNote}`);
          if (r.todoItems?.length) parts.push(`  Todos: ${r.todoItems.join(", ")}`);
          if (r.shoppingItems?.length) parts.push(`  En liste: ${r.shoppingItems.join(", ")}`);
          if (r.materialSummary?.length) parts.push(`  Matériaux: ${r.materialSummary.join("; ")}`);
          if (r.testColors?.length) parts.push(`  Couleurs testées: ${r.testColors.map(c => `[${c.id}] ${c.name}${c.number ? ` N°${c.number}` : ""} (${c.hex})${c.chosen ? " — CHOISI" : ""}`).join(", ")}`);
          return parts.join("\n");
        }).join("\n");

        systemPrompt = [
          "Tu es un assistant de design intérieur expert en décoration française contemporaine et rétro.",
          "Tu aides l'utilisateur à prendre des décisions de design pour son appartement.",
          "",
          ctx.generalContext ? `Goûts & contraintes de l'appartement: ${ctx.generalContext}` : null,
          "",
          "Mode Appartement — tu as accès à toutes les pièces et peux agir sur chacune.",
          "Quand tu utilises un outil (add_to_shopping_list, add_to_todo_list, save_room_note), tu DOIS toujours spécifier room_key.",
          "",
          "Pièces disponibles:",
          roomsDetail,
          "",
          "Règles:",
          "- Réponds en français, de façon concise et praticable (3-6 phrases max par réponse)",
          "- Sois honnête : donne ton avis sincère même s'il diverge de celui de l'utilisateur, ne valide pas une idée par complaisance et signale les inconvénients ou risques d'un choix quand c'est pertinent",
          "- Reste dans l'univers rétro, coloré, doux — jamais d'accents rouges, pas de style minimaliste froid",
          "- N'utilise la recherche web que si l'utilisateur demande explicitement des produits, prix ou liens précis — jamais pour des conseils de design généraux — et limite-toi à une seule recherche par réponse",
          "- Écris TOUJOURS une réponse texte à l'utilisateur, même quand tu appelles un outil (save_room_note, add_to_shopping_list, etc.) : un appel d'outil ne remplace jamais une réponse conversationnelle qui traite réellement la demande",
          `- Si tu suggères une modification visuelle concrète et précise, termine ta réponse par exactement ce bloc sur une nouvelle ligne: ${CHAT_IMAGE_PROMPT_MARKER}{"prompt":"<instruction en anglais pour édition d'image>"}${CHAT_IMAGE_PROMPT_MARKER}`,
          "- N'inclus ce bloc que si la suggestion est clairement visuelle et actionnable",
        ].filter(Boolean).join("\n");
      } else {
        systemPrompt = [
          "Tu es un assistant de design intérieur expert en décoration française contemporaine et rétro.",
          "Tu aides l'utilisateur à prendre des décisions de design pour son appartement.",
          "",
          ctx.generalContext ? `Goûts & contraintes de l'appartement: ${ctx.generalContext}` : null,
          ctx.generalContext ? "" : null,
          `Pièce active — ${ctx.label || "pièce"}: ${ctx.line || ""}`,
          `Palette: dominante ${ctx.dominantName || ""} (${ctx.dominantHex || ""}), secondaire ${ctx.secondaryName || ""} (${ctx.secondaryHex || ""}), accent ${ctx.accentName || ""} (${ctx.accentHex || ""})`,
          ctx.roomNote ? `Notes: ${ctx.roomNote}` : null,
          ctx.imageMetadataSummary ? `Contexte visuel: ${ctx.imageMetadataSummary}` : null,
          ctx.todoItems?.length ? `Todos de la pièce: ${ctx.todoItems.join(", ")}` : null,
          ctx.shoppingItems?.length ? `En liste de courses: ${ctx.shoppingItems.join(", ")}` : null,
          ctx.materialSummary?.length ? `Matériaux choisis: ${ctx.materialSummary.join("; ")}` : null,
          ctx.testColors?.length ? `Couleurs testées: ${ctx.testColors.map(c => `[${c.id}] ${c.name}${c.number ? ` N°${c.number}` : ""} (${c.hex})${c.chosen ? " — CHOISI" : ""}`).join(", ")}` : null,
          ctx.allRoomsSummary ? `Autres pièces: ${ctx.allRoomsSummary}` : null,
          "",
          "Règles:",
          "- Réponds en français, de façon concise et praticable (3-6 phrases max par réponse)",
          "- Sois honnête : donne ton avis sincère même s'il diverge de celui de l'utilisateur, ne valide pas une idée par complaisance et signale les inconvénients ou risques d'un choix quand c'est pertinent",
          "- Reste dans l'univers rétro, coloré, doux — jamais d'accents rouges, pas de style minimaliste froid",
          "- N'utilise la recherche web que si l'utilisateur demande explicitement des produits, prix ou liens précis — jamais pour des conseils de design généraux — et limite-toi à une seule recherche par réponse",
          "- Écris TOUJOURS une réponse texte à l'utilisateur, même quand tu appelles un outil (save_room_note, add_to_shopping_list, etc.) : un appel d'outil ne remplace jamais une réponse conversationnelle qui traite réellement la demande",
          `- Si tu suggères une modification visuelle concrète et précise, termine ta réponse par exactement ce bloc sur une nouvelle ligne: ${CHAT_IMAGE_PROMPT_MARKER}{"prompt":"<instruction en anglais pour édition d'image>"}${CHAT_IMAGE_PROMPT_MARKER}`,
          "- N'inclus ce bloc que si la suggestion est clairement visuelle et actionnable",
        ].filter(Boolean).join("\n");
      }

      const historyToSend = messages.slice(-20);
      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          stream: true,
          tools: chatTools,
          instructions: systemPrompt,
          input: historyToSend.map((m) => {
            const imgList = m.images?.length ? m.images : m.image ? [m.image] : [];
            if (m.role === "user" && imgList.length > 0) {
              return {
                role: m.role,
                content: [
                  ...(m.content ? [{ type: "input_text", text: m.content }] : []),
                  ...imgList.map((img) => ({ type: "input_image", image_url: img })),
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
        sendJson(res, openaiResponse.status, { error: errPayload.error?.message || "Le chat IA a échoué." });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      const writeEvent = (event, data) => {
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* client disconnected */ }
      };

      const reader = openaiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
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
                writeEvent("delta", { text: parsed.delta });
              } else if (currentEvent === "response.output_item.done" && parsed.item?.type === "function_call") {
                try {
                  const args = JSON.parse(parsed.item.arguments);
                  writeEvent("tool_call", { name: parsed.item.name, args });
                } catch { /* malformed */ }
              }
            } catch { /* non-JSON */ }
          }
        }
      }

      const markerStart = fullText.indexOf(CHAT_IMAGE_PROMPT_MARKER);
      let imagePrompt = null;
      if (markerStart !== -1) {
        const afterFirst = fullText.slice(markerStart + CHAT_IMAGE_PROMPT_MARKER.length);
        const markerEnd = afterFirst.indexOf(CHAT_IMAGE_PROMPT_MARKER);
        const jsonPart = markerEnd !== -1 ? afterFirst.slice(0, markerEnd) : afterFirst;
        try { imagePrompt = JSON.parse(jsonPart.trim()).prompt || null; } catch { /* ignore */ }
      }
      writeEvent("done", { imagePrompt: imagePrompt || undefined });
      res.end();
      return;
    }

    const { image, prompt, context, section } = body;
    if (req.url === "/api/analyze-image") {
      if (!image) {
        sendJson(res, 400, { error: "Image requise." });
        return;
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ANALYSIS_MODEL,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: [
                    "Analyse cette image pour créer des métadonnées courtes de design intérieur.",
                    `Contexte: ${context || "image d'inspiration appartement"}.`,
                    `Section de l'app: ${section || "reference"}.`,
                    "Réponds uniquement en JSON valide, sans markdown.",
                    "Schéma exact: {\"type\":\"photo | dessin architecte | plan | croquis | moodboard | matériau | référence produit\",\"style\":\"string court\",\"inspiration\":\"string court\",\"materials\":[\"...\"],\"colors\":[\"...\"],\"details\":[\"...\"]}.",
                    "Les champs doivent être courts, en français, orientés interior design. N'invente pas de marque.",
                  ].join("\n"),
                },
                { type: "input_image", image_url: image },
              ],
            },
          ],
        }),
      });

      const payload = await openaiResponse.json();
      if (!openaiResponse.ok) {
        sendJson(res, openaiResponse.status, { error: payload.error?.message || "L'analyse OpenAI a échoué." });
        return;
      }

      sendJson(res, 200, { analysis: parseMetadata(payload.output_text || "", section) });
      return;
    }

    if (!image || !prompt) {
      sendJson(res, 400, { error: "Image et prompt sont requis." });
      return;
    }

    const blob = dataUrlToBlob(image);
    const form = new FormData();
    form.append("model", MODEL);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("output_format", "webp");
    form.append("output_compression", "82");
    form.append("image", blob, `source.${blob.type.split("/")[1] || "png"}`);

    const openaiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });

    const payload = await openaiResponse.json();
    if (!openaiResponse.ok) {
      sendJson(res, openaiResponse.status, { error: payload.error?.message || "La génération OpenAI a échoué." });
      return;
    }

    const imageData = payload.data?.[0];
    if (imageData?.b64_json) {
      sendJson(res, 200, { image: `data:image/webp;base64,${imageData.b64_json}` });
      return;
    }

    if (imageData?.url) {
      sendJson(res, 200, { image: imageData.url });
      return;
    }

    sendJson(res, 500, { error: "Réponse OpenAI sans image exploitable." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur locale." });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Design Helper API ready on http://127.0.0.1:${PORT}`);
});
