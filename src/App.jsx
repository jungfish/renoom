import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RoomViewer3D } from "./RoomViewer3D";
import { supabase } from "./supabaseClient";
import { useAuth } from "./useAuth";
import { OnboardingWizard } from "./OnboardingWizard";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const baseColors = {
  creme: { name: "Crème chaud", light: "#FAF6F0", hex: "#F4F1EA", medium: "#E8DFD3", dark: "#D8CEC1" },
  bleu: { name: "Bleu clair grisé", light: "#DCE8ED", hex: "#b8c9d0", medium: "#9fb7bf", dark: "#7f9ea8" },
  vert: { name: "Vert sauge", light: "#C8D1C4", hex: "#A8B5A2", medium: "#7A8F7A", dark: "#5F7463" },
  bois: { name: "Chêne clair", light: "#E4C896", hex: "#D0AA6C", medium: "#B98945", dark: "#8B6232" },
};

const accents = {
  butter: { name: "Jaune beurre", hex: "#FCF8D5" },
  olive: { name: "Olive doux", hex: "#B7C3A5" },
  sky: { name: "Bleu ciel très pâle", hex: "#DCE8ED" },
  lin: { name: "Lin sable", hex: "#E9DFC8" },
};

const UPLOAD_STORAGE_KEY = "palette_upload_images_v1";
const LINK_STORAGE_KEY = "palette_inspiration_links_v1";
const MATERIAL_UPLOAD_STORAGE_KEY = "palette_material_upload_images_v1";
const MATERIAL_LINK_STORAGE_KEY = "palette_material_links_v1";
const ROOM_NUANCES_STORAGE_KEY = "palette_room_nuances_v1";
const ROOM_NOTES_STORAGE_KEY = "palette_room_notes_v1";
const PLAN_UPLOAD_STORAGE_KEY = "palette_plan_upload_images_v1";
const PLAN_LINK_STORAGE_KEY = "palette_plan_links_v1";
const AI_INSPIRATIONS_STORAGE_KEY = "palette_ai_inspirations_v1";
const IMAGE_ANALYSIS_STORAGE_KEY = "palette_image_analysis_v1";
const DELETED_IMAGES_STORAGE_KEY = "palette_deleted_images_v1";
const PLAN_EXTRA_STORAGE_KEY = "palette_plan_extra_images_v1";
const MATERIAL_EXTRA_STORAGE_KEY = "palette_material_extra_images_v1";
const MATERIAL_META_STORAGE_KEY = "palette_material_meta_v1";
const CUSTOM_ROOMS_STORAGE_KEY = "palette_custom_rooms_v1";
const HIDDEN_ROOMS_STORAGE_KEY = "palette_hidden_rooms_v1";
const PROJECT_STATE_STORAGE_KEY = "palette_project_state_v1";
const LAST_SAVE_STORAGE_KEY = "palette_last_save_v1";
const ROOM_LISTS_STORAGE_KEY = "palette_room_lists_v1";
const ROOM_DOCUMENTS_STORAGE_KEY = "palette_room_documents_v1";
const ROOM_ORDER_STORAGE_KEY = "palette_room_order_v1";
const PROJECT_ID_STORAGE_KEY = "palette_project_id_v1";
const GENERAL_CONTEXT_STORAGE_KEY = "palette_general_context_v1";
const GENERAL_RESOURCES_STORAGE_KEY = "palette_general_resources_v1";
const INSTAGRAM_STORAGE_KEY = "palette_instagram_v1";
const CHAT_HISTORY_MAX = 50;
const IMAGE_DB_NAME = "palette-appartement-images";
const IMAGE_DB_STORE = "records";

const rooms = [
  "salon",
  "cuisine",
  "entree",
  "parents",
  "enfant",
  "bureau",
  "sdb",
  "sanitaires",
  "vinyle",
  "cellier",
];

const roomPresets = {
  bureau: {
    label: "Bureau",
    dominant: "bleu",
    secondary: "bois",
    line: "Bureau calme et concentré : base claire, touches de bleu doux et bois chaleureux.",
    notes: ["Accent olive ou beurre en petite touche pour la personnalité."],
  },
  sdb: {
    label: "Salle de bain",
    dominant: "creme",
    secondary: "bleu",
    line: "Salle de bain douce et lumineuse : base claire, détails rétro et matières naturelles.",
    notes: ["Le chêne clair apporte une touche vintage chaleureuse."],
  },
  salon: {
    label: "Salon",
    dominant: "bleu",
    secondary: "creme",
    line: "Salon nord : base claire, bibliothèque colorée, ambiance rétro lumineuse.",
    notes: ["Le bleu clair fonctionne mieux sur la bibliothèque que sur tous les murs."],
  },
  cuisine: {
    label: "Cuisine",
    dominant: "bleu",
    secondary: "bois",
    line: "Cuisine rétro colorée : bleu clair grisé, chêne clair, accents beurre ou olive.",
    notes: ["Le jaune beurre est parfait en petite touche sur assise, luminaire ou détail."],
  },
  entree: {
    label: "Entrée",
    dominant: "vert",
    secondary: "bois",
    line: "Entrée signature : plus enveloppante, architecturée, avec menuiserie et niche fortes.",
    notes: ["Le vert sauge donne du caractère sans durcir l'entrée."],
  },
  parents: {
    label: "Chambre parents",
    dominant: "vert",
    secondary: "creme",
    line: "Chambre parent : calme, douce, colorée par touches structurées.",
    notes: ["Le reste des murs gagne à rester crème chaud."],
  },
  enfant: {
    label: "Chambre enfant",
    dominant: "vert",
    secondary: "bleu",
    line: "Chambre enfant : plus joueuse, rétro et graphique, mais toujours lisible.",
    notes: ["Le fond crème calme le jeu si vous ajoutez du motif ou des rayures."],
  },
  vinyle: {
    label: "Coin vinyle",
    dominant: "creme",
    secondary: "bois",
    line: "Coin vinyle : plus simple, chaleureux, avec les objets et pochettes comme décor.",
    notes: ["Le chêne clair donne tout de suite le côté vintage."],
  },
  cellier: {
    label: "Cellier",
    dominant: "vert",
    secondary: "creme",
    line: "Cellier : pièce parfaite pour un décor plus éditorial et des motifs discrets.",
    notes: ["Le jaune beurre est très juste pour donner une lumière vintage."],
  },
  sanitaires: {
    label: "Sanitaires",
    dominant: "clair",
    secondary: "clair",
    line: "Sanitaires : fonctionnel et soigné, avec des matières qui résistent bien à l'humidité.",
    notes: ["Le carrelage de métro blanc reste la valeur sûre."],
  },
};

const INITIAL_ROOM_NUANCES = {
  bureau: { dominant: "moyen", secondary: "moyen", accent: "olive", dominantColor: "bleu", secondaryColor: "bois" },
  sdb: { dominant: "clair", secondary: "clair", accent: "bois", dominantColor: "creme", secondaryColor: "bleu" },
  salon: { dominant: "moyen", secondary: "moyen", accent: "bois", dominantColor: "bleu", secondaryColor: "creme" },
  cuisine: { dominant: "moyen", secondary: "moyen", accent: "butter", dominantColor: "bleu", secondaryColor: "bois" },
  entree: { dominant: "moyen", secondary: "moyen", accent: "butter", dominantColor: "vert", secondaryColor: "bois" },
  parents: { dominant: "soutenu", secondary: "moyen", accent: "bois", dominantColor: "vert", secondaryColor: "creme" },
  enfant: { dominant: "moyen", secondary: "clair", accent: "butter", dominantColor: "vert", secondaryColor: "bleu" },
  vinyle: { dominant: "moyen", secondary: "moyen", accent: "olive", dominantColor: "creme", secondaryColor: "bois" },
  cellier: { dominant: "soutenu", secondary: "moyen", accent: "butter", dominantColor: "vert", secondaryColor: "creme" },
};

const roomInspirationImages = {
  salon: ["/images/salon/01.jpg", "/images/salon/02.jpg", "/images/salon/03.jpg"],
  cuisine: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/cuisine/01.webp", "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/cuisine/02.webp", "/images/cuisine/03.jpg"],
  entree: ["/images/entree/01.jpg", "/images/entree/02.jpg", "/images/entree/03.jpg"],
  parents: ["/images/parents/01.jpg", "/images/parents/02.jpg", "/images/parents/03.jpg"],
  enfant: ["/images/enfant/01.jpg", "/images/enfant/02.jpg", "/images/enfant/03.jpg"],
  bureau: ["/images/bureau/01.jpg", "/images/bureau/02.jpg", "/images/bureau/03.jpg"],
  sdb: ["/images/sdb/01.jpg", "/images/sdb/02.jpg", "/images/sdb/03.jpg"],
  vinyle: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/vinyle/01.webp", "/images/vinyle/02.jpg", "/images/vinyle/03.jpg"],
  cellier: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/cellier/01.webp", "/images/cellier/02.jpg", "/images/cellier/03.jpg"],
};

const roomPlanImages = {
  salon: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/plan/salon-bibliotheque.webp"],
  cuisine: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/plan/cuisine-plan.webp", "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/plan/cuisine-banquette-plan.webp"],
  entree: ["/images/plan/entree-01.jpg"],
  parents: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/plan/chambre.webp"],
  enfant: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/plan/chambre-enfant.webp"],
  bureau: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/plan/bureau-verriere.webp"],
  sdb: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/plan/toilette.webp"],
  vinyle: ["/images/plan/vinyle-01.jpg"],
  cellier: ["https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/plan/cellier-plan.webp"],
};


const materialsByRoom = {
  salon: [
    { label: "Sol", value: "Parquet bois clair", src: "/images/materials/salon-sol.jpg" },
    { label: "Menuiserie", value: "Chêne clair", src: "/images/materials/salon-menuiserie.jpg" },
    { label: "Textiles", value: "Lin / coton écru", src: "/images/materials/salon-textiles.jpg" },
  ],
  cuisine: [
    { label: "Sol", value: "Carrelage ou béton clair", src: "/images/materials/cuisine-sol.jpg" },
    {
      label: "Crédence",
      value: "Zellige beige Ivory brillant",
      src: "/images/materials/cuisine-credence.jpg",
      link: "https://www.parquet-carrelage.com/carrelage-mural-faience/2290-carrelage-mural-aspect-zellige-beige-ivory-brillant-8445583318005.html",
      cta: "Voir le produit",
    },
    { label: "Plan de travail", value: "Chêne clair ou pierre claire", src: "/images/materials/cuisine-plan-travail.jpg" },
  ],
  entree: [
    { label: "Sol", value: "Carrelage graphique", src: "/images/materials/entree-sol.jpg" },
    { label: "Menuiserie", value: "Bois + peinture", src: "/images/materials/entree-menuiserie.jpg" },
    { label: "Assise", value: "Textile rayé ou uni", src: "/images/materials/entree-assise.jpg" },
  ],
  parents: [
    { label: "Sol", value: "Parquet bois clair", src: "/images/materials/parents-sol.jpg" },
    { label: "Tête de lit", value: "Peinture ou tissu", src: "/images/materials/parents-tete-lit.jpg" },
    { label: "Textiles", value: "Lin naturel", src: "/images/materials/parents-textiles.jpg" },
  ],
  enfant: [
    { label: "Sol", value: "Parquet", src: "/images/materials/enfant-sol.jpg" },
    { label: "Mur", value: "Peinture + motifs", src: "/images/materials/enfant-mur.jpg" },
    { label: "Mobilier", value: "Bois + couleurs", src: "/images/materials/enfant-mobilier.jpg" },
  ],
  bureau: [
    { label: "Sol", value: "Parquet clair", src: "/images/materials/bureau-sol.jpg" },
    { label: "Bureau", value: "Chêne clair ou chêne", src: "/images/materials/bureau-bureau.jpg" },
    { label: "Mur", value: "Crème + bleu en accent", src: "/images/materials/bureau-mur.jpg" },
  ],
  sdb: [
    { label: "Carrelage", value: "Carrelage ou pierre claire", src: "/images/materials/sdb-carrelage.jpg" },
    {
      label: "Crédence",
      value: "Zellige Lavanda Blue",
      src: "/images/materials/sdb-credence.jpg",
      link: "https://www.parquet-carrelage.com/carrelage-mural-zellige/3663-carrelage-aspect-zellige-la-riviera-lavanda-blue-brillant-132x132-cm-8435404940003.html",
      cta: "Voir le produit",
    },
    { label: "Lavabo", value: "Céramique / vasque rétro", src: "/images/materials/sdb-lavabo.jpg" },
  ],
  vinyle: [
    { label: "Sol", value: "Parquet", src: "/images/materials/vinyle-sol.jpg" },
    { label: "Meuble", value: "Bois vintage", src: "/images/materials/vinyle-meuble.jpg" },
    { label: "Mur", value: "Crème chaud", src: "/images/materials/vinyle-mur.jpg" },
  ],
  cellier: [
    { label: "Sol", value: "Carrelage", src: "/images/materials/cellier-sol.jpg" },
    { label: "Mur", value: "Peinture + motif", src: "/images/materials/cellier-mur.jpg" },
    { label: "Évier", value: "Céramique", src: "/images/materials/cellier-evier.jpg" },
  ],
};

const shadeMap = { clair: "light", moyen: "hex", soutenu: "medium", fonce: "dark" };

function getShade(colorKey, level) {
  const color = baseColors[colorKey];
  if (!color) return "#ddd";
  const key = shadeMap[level] || "hex";
  return color[key] || color.hex;
}

function textColor(hex) {
  const c = hex.replace("#", "");
  const bigint = parseInt(c, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 165 ? "#24303a" : "#ffffff";
}

function slugifyRoomName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createUniqueRoomKey(label, existingKeys) {
  const base = slugifyRoomName(label) || "piece";
  let key = `custom-${base}`;
  let index = 2;
  while (existingKeys.includes(key)) {
    key = `custom-${base}-${index}`;
    index += 1;
  }
  return key;
}

function removeRoomData(object, roomKey) {
  return Object.fromEntries(Object.entries(object).filter(([key]) => key !== roomKey && !key.startsWith(`${roomKey}-`)));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function imageSrcToDataUrl(src) {
  if (src?.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("Impossible de charger l'image source.");
  const blob = await response.blob();
  return readFileAsDataUrl(blob);
}

function normalizeImageForAi(dataUrl, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxSize || h > maxSize) {
        if (w >= h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Impossible de normaliser l'image."));
    img.crossOrigin = "anonymous";
    img.src = dataUrl;
  });
}

function extFromDataUrl(dataUrl) {
  const mime = dataUrl.match(/^data:([^;]+)/)?.[1] || "image/jpeg";
  if (mime === "application/pdf") return "pdf";
  const ext = mime.split("/")[1] || "jpg";
  return ext === "jpeg" ? "jpg" : ext;
}

function isPdfUrl(url) {
  if (!url) return false;
  const clean = url.split("?")[0];
  return clean.endsWith(".pdf") || url.startsWith("data:application/pdf");
}

async function uploadToBlob(dataUrl, filename) {
  if (!dataUrl?.startsWith("data:")) return dataUrl;
  try {
    const res = await fetch(`${API_BASE}/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, filename }),
    });
    if (!res.ok) throw new Error();
    const { url } = await res.json();
    return url;
  } catch {
    return dataUrl;
  }
}

async function uploadUrlToBlob(sourceUrl, filename) {
  try {
    const res = await fetch(`${API_BASE}/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl, filename }),
    });
    if (!res.ok) throw new Error();
    const { url } = await res.json();
    return url;
  } catch {
    return null;
  }
}

async function extractImageFromUrl(url) {
  const isPinterest = /pinterest\.(com|fr|co\.uk|de|es|it|jp)|pin\.it/i.test(url);
  const isDirectImage = /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url);
  if (isDirectImage && !isPinterest) return url;
  try {
    const res = await fetch(`${API_BASE}/fetch-link-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.image || null;
  } catch {
    return null;
  }
}

async function fetchLinkPreview(url) {
  const res = await fetch(`${API_BASE}/fetch-link-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return { url, title: url, description: null, image: null };
  return res.json();
}

function parseInstagramUrl(url) {
  const match = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) return null;
  const rawType = match[1];
  const shortcode = match[2];
  const type = rawType === "p" ? "post" : "reel";
  const embedUrl = `https://www.instagram.com/${rawType}/${shortcode}/embed/`;
  return { type, shortcode, embedUrl, originalUrl: url };
}

function normalizeImageMetadata(metadata, fallbackType = "reference") {
  if (!metadata) return null;
  if (typeof metadata === "string") {
    return {
      type: fallbackType,
      style: "",
      inspiration: metadata,
      materials: [],
      colors: [],
      details: [],
    };
  }
  return {
    type: metadata.type || fallbackType,
    style: metadata.style || "",
    inspiration: metadata.inspiration || "",
    materials: Array.isArray(metadata.materials) ? metadata.materials : [],
    colors: Array.isArray(metadata.colors) ? metadata.colors : [],
    details: Array.isArray(metadata.details) ? metadata.details : [],
  };
}

function metadataToPrompt(metadata, fallbackType = "reference") {
  const data = normalizeImageMetadata(metadata, fallbackType);
  if (!data) return "";
  return [
    `type ${data.type}`,
    data.style ? `style: ${data.style}` : "",
    data.inspiration ? `inspiration: ${data.inspiration}` : "",
    data.materials.length ? `matières: ${data.materials.join(", ")}` : "",
    data.colors.length ? `couleurs: ${data.colors.join(", ")}` : "",
    data.details.length ? `détails: ${data.details.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function buildImagePrompt({ aiContext, imageKind, imageTitle }) {
  const currentMetadata = metadataToPrompt(aiContext.imageMetadata, imageKind);
  const roomMetadata = (aiContext.roomImageMetadata || [])
    .map((item) => metadataToPrompt(item.metadata, item.kind))
    .filter(Boolean)
    .slice(-8)
    .join("\n- ");

  return [
    `Propose une modification réaliste et éditoriale de cette image pour la pièce: ${aiContext.roomLabel}.`,
    `Type d'image: ${imageKind}. Élément: ${imageTitle}.`,
    `Ligne directrice: ${aiContext.line}`,
    `Nuances choisies: dominante ${aiContext.dominantName} (${aiContext.dominantHex}), secondaire ${aiContext.secondaryName} (${aiContext.secondaryHex}), accent ${aiContext.accentName} (${aiContext.accentHex}).`,
    aiContext.roomNote ? `Notes utilisateur: ${aiContext.roomNote}` : "Notes utilisateur: aucune note spécifique.",
    currentMetadata ? `Métadonnées de l'image source: ${currentMetadata}` : "Métadonnées de l'image source: utilise l'image visible comme référence de style, de composition et de matières.",
    roomMetadata ? `Contexte visuel des autres images de la pièce:\n- ${roomMetadata}` : "Contexte visuel des autres images de la pièce: aucun autre contexte indexé.",
    `Contraintes: univers rétro, coloré, doux, éditorial; aucun accent rouge; préserver la composition générale de l'image; proposer une version plus cohérente avec la palette de la pièce; rendu lumineux, habitable, naturel, pas de texte ajouté.`,
  ].join("\n");
}

function safelyStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Impossible de sauvegarder ${key}.`, error);
  }
}

function openImageStore() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB indisponible."));
      return;
    }
    const request = indexedDB.open(IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IMAGE_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLargeValue(key) {
  const db = await openImageStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_DB_STORE, "readonly");
    const request = tx.objectStore(IMAGE_DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function storeLargeValue(key, value) {
  const db = await openImageStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_DB_STORE, "readwrite");
    tx.objectStore(IMAGE_DB_STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function removeObjectKey(object, key) {
  const next = { ...object };
  delete next[key];
  return next;
}

async function analyzeImageForContext({ image, context, section }) {
  try {
    const response = await fetch(`${API_BASE}/analyze-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, context, section }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Analyse impossible.");
    return payload.analysis || "";
  } catch {
    return "";
  }
}

function Swatch({ title, hex, subtitle }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="h-16" style={{ backgroundColor: hex }} />
      <div className="space-y-1 p-3">
        <div className="text-xs text-slate-500">{subtitle}</div>
        <div className="text-sm font-medium">{title}</div>
        <div className="font-mono text-xs text-slate-500">{hex}</div>
      </div>
    </div>
  );
}

function UploadDropzone({ onFile, compact = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={`rounded-md border border-dashed p-2 text-center ${isDragging ? "border-slate-900 bg-slate-100/70" : "border-black/20 bg-[#faf7f2]"} ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <div>Glisser-déposer une photo ici</div>
      <button
        type="button"
        className="mt-1 rounded border border-black/20 bg-white px-2 py-1 text-xs"
        onClick={() => inputRef.current?.click()}
      >
        Choisir un fichier
      </button>
    </div>
  );
}

function AddImageButton({ onFile, accept = "image/*" }) {
  const inputRef = useRef(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title="Ajouter une image"
        aria-label="Ajouter une image"
        onClick={() => inputRef.current?.click()}
        className="grid h-11 w-11 place-items-center rounded-full border border-black/15 bg-white text-lg leading-none shadow-sm hover:bg-[#fcf8d5]"
      >
        +
      </button>
    </>
  );
}

function AddUrlButton({ onUrl, onInstagram }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = value.trim();
    if (!url) return;

    setLoading(true);
    setError(null);
    try {
      if (onInstagram) {
        const igData = parseInstagramUrl(url);
        if (igData) {
          const preview = await fetchLinkPreview(url);
          const titleLower = `${preview?.title || ""} ${preview?.description || ""}`.toLowerCase();
          const type = titleLower.includes("reel") ? "reel" : igData.type;
          onInstagram({ ...igData, type, thumbnailUrl: preview?.image || null });
          setOpen(false);
          setValue("");
          return;
        }
      }
      const imageUrl = await extractImageFromUrl(url);
      if (!imageUrl) {
        setError("Aucune image trouvée à cette adresse.");
        return;
      }
      await onUrl(imageUrl);
      setOpen(false);
      setValue("");
    } catch {
      setError("Erreur lors du chargement de l'image.");
    } finally {
      setLoading(false);
    }
  };

  if (open) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="url"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              placeholder={onInstagram ? "Lien Pinterest ou Instagram…" : "Lien Pinterest…"}
              className="h-9 w-52 rounded-lg border border-black/20 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-black/30"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="grid h-9 w-9 place-items-center rounded-lg border border-black/15 bg-white text-sm shadow-sm hover:bg-[#fcf8d5] disabled:opacity-40"
              title="Ajouter"
            >
              {loading ? (
                <span className="block h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black/60" />
              ) : "✓"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-black/15 bg-white text-sm shadow-sm hover:bg-red-50"
              title="Annuler"
            >
              ×
            </button>
          </div>
          {error && <p className="mt-0.5 text-[10px] text-red-500">{error}</p>}
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      title="Ajouter via un lien (Pinterest, Instagram…)"
      aria-label="Ajouter une image via un lien"
      onClick={() => setOpen(true)}
      className="grid h-11 w-11 place-items-center rounded-full border border-black/15 bg-white shadow-sm hover:bg-[#fcf8d5]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </button>
  );
}

function LinkPreviewCard({ preview, onClick, overrideImage }) {
  const hostname = (() => {
    try {
      return new URL(preview.url).hostname.replace(/^www\./, "");
    } catch {
      return preview.url;
    }
  })();

  const imageSrc = overrideImage || preview.image;

  return (
    <div className="relative h-full cursor-pointer" onClick={onClick}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={preview.title || ""}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-slate-100">
          <span className="text-4xl">🔗</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 pb-3 pt-10">
        {preview.title && (
          <p className="line-clamp-2 text-xs font-semibold leading-tight text-white">
            {preview.title}
          </p>
        )}
        <p className="mt-0.5 truncate text-[11px] text-white/60">{hostname}</p>
      </div>
    </div>
  );
}

function AddMaterialButton({ onFile, onLink }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setMode(null);
        setLinkUrl("");
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleLinkSubmit = async () => {
    if (!linkUrl.trim()) return;
    setIsLoading(true);
    try {
      const preview = await fetchLinkPreview(linkUrl.trim());
      if (linkLabel.trim()) preview.title = linkLabel.trim();
      onLink(preview);
      setOpen(false);
      setMode(null);
      setLinkUrl("");
      setLinkLabel("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFile(file);
            setOpen(false);
          }
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title="Ajouter un matériau"
        aria-label="Ajouter un matériau"
        onClick={() => {
          setOpen((o) => !o);
          setMode(null);
          setLinkUrl("");
          setLinkLabel("");
        }}
        className="grid h-11 w-11 place-items-center rounded-full border border-black/15 bg-white text-lg leading-none shadow-sm hover:bg-[#fcf8d5]"
      >
        +
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-black/15 bg-white p-3 shadow-xl">
          {mode !== "link" ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>
                </svg>
                <span>Image</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("link")}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span>Lien</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                autoFocus
                placeholder="Nom (optionnel)…"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLinkSubmit()}
                className="w-full rounded border border-black/15 bg-white p-2 text-xs"
              />
              <input
                type="url"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLinkSubmit()}
                className="w-full rounded border border-black/15 bg-white p-2 text-xs"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setMode(null); setLinkLabel(""); setLinkUrl(""); }}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-black/15 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleLinkSubmit}
                  disabled={isLoading || !linkUrl.trim()}
                  className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  {isLoading ? "..." : "Ajouter"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinkAction({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        title="Ajouter un lien"
        aria-label="Ajouter un lien"
        onClick={() => setOpen((current) => !current)}
        className={`grid h-11 w-11 place-items-center rounded-md border border-black/15 bg-white/90 shadow-sm backdrop-blur hover:bg-white ${
          value ? "ring-2 ring-slate-900/20" : ""
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-md border border-black/15 bg-white p-2 shadow-xl">
          <input
            type="url"
            autoFocus
            placeholder="https://..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded border border-black/15 bg-white p-2 text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}

function RepoImage({ src, alt, onMissingChange, objectFit = "cover" }) {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
  }, [src]);

  if (missing) {
    return (
      <div className="grid min-h-36 place-items-center bg-[#f8f5ef] p-3 text-center text-xs text-slate-500">
        <span>
          Image manquante: <code className="break-all">{src}</code>
        </span>
      </div>
    );
  }

  const imgClass =
    objectFit === "natural"
      ? "block w-full h-auto"
      : `h-full w-full ${objectFit === "contain" ? "object-contain" : "object-cover"}`;

  return (
    <img
      src={src}
      alt={alt}
      className={imgClass}
      loading="lazy"
      onLoad={() => {
        setMissing(false);
        onMissingChange?.(false);
      }}
      onError={() => {
        setMissing(true);
        onMissingChange?.(true);
      }}
    />
  );
}

function AiImageEditor({ imageSrc, imageKind, imageTitle, aiContext, imageMetadata, onApply, onAddToInspirations }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState("");

  const openPanel = () => {
    setPrompt(buildImagePrompt({ aiContext: { ...aiContext, imageMetadata }, imageKind, imageTitle }));
    setGeneratedImage("");
    setError("");
    setOpen(true);
  };

  const closePanel = () => {
    setOpen(false);
    setGeneratedImage("");
    setError("");
  };

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") closePanel();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const generateImage = async () => {
    setError("");
    setIsGenerating(true);
    try {
      const raw = await imageSrcToDataUrl(imageSrc);
      const image = await normalizeImageForAi(raw);
      const response = await fetch(`${API_BASE}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, prompt }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "La génération a échoué.");
      setGeneratedImage(payload.image);
    } catch (err) {
      setError(err.message || "La génération a échoué.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        title="Générer une proposition IA"
        aria-label="Générer une proposition IA"
        onClick={openPanel}
        className="grid h-11 w-11 place-items-center rounded-md border border-black/15 bg-white/90 shadow-sm backdrop-blur hover:bg-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        </svg>
      </button>
      {open
        ? createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-black/10 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4 md:p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Génération IA</p>
                <h3 className="type-h3">{imageTitle}</h3>
                <p className="mt-1 text-sm text-slate-600">{aiContext.roomLabel} · {imageKind}</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Fermer la génération IA"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-black/15 bg-white text-lg shadow-sm hover:bg-[#f9f7f3]"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 p-4 md:grid-cols-[0.95fr_1.25fr] md:p-5">
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Instruction IA</span>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-72 w-full rounded-lg border border-black/15 bg-white p-3 text-sm leading-relaxed text-slate-800 md:min-h-[420px]"
                  />
                </label>
                <button
                  type="button"
                  onClick={generateImage}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full rounded-md border border-black/15 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm disabled:opacity-50 md:w-auto"
                >
                  {isGenerating ? "Génération en cours..." : "Générer une proposition"}
                </button>
                {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-700">Original</div>
                    <img src={imageSrc} alt="Original" className="h-64 w-full rounded-lg border border-black/10 object-cover md:h-[420px]" />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-700">Proposition IA</div>
                    {generatedImage ? (
                      <img src={generatedImage} alt="Proposition IA" className="h-64 w-full rounded-lg border border-black/10 object-cover md:h-[420px]" />
                    ) : isGenerating ? (
                      <div className="relative grid h-64 place-items-center overflow-hidden rounded-lg border border-black/10 bg-[#f9f7f3] md:h-[420px]">
                        <div
                          className="absolute inset-0"
                          style={{
                            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                            backgroundSize: "200% 100%",
                            animation: "shimmer 1.6s ease-in-out infinite",
                          }}
                        />
                        <div className="relative flex flex-col items-center gap-3 text-slate-500">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                          <span className="text-sm">Génération en cours…</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid h-64 place-items-center rounded-lg border border-dashed border-black/15 bg-[#f9f7f3] p-4 text-center text-sm text-slate-500 md:h-[420px]">
                        La proposition apparaîtra ici.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!generatedImage || isApplying}
                    onClick={async () => {
                      setIsApplying(true);
                      const url = await uploadToBlob(generatedImage, `ai-${Date.now()}.webp`);
                      onAddToInspirations(url);
                      setIsApplying(false);
                      closePanel();
                    }}
                    className="rounded-md border border-black/15 bg-[#fcf8d5] px-4 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    Ajouter aux inspirations
                  </button>
                  <button
                    type="button"
                    disabled={!generatedImage || isApplying}
                    onClick={async () => {
                      setIsApplying(true);
                      const url = await uploadToBlob(generatedImage, `ai-${Date.now()}.webp`);
                      onApply(url);
                      setIsApplying(false);
                      closePanel();
                    }}
                    className="rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    Remplacer cette image
                  </button>
                  <button type="button" onClick={closePanel} className="rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-medium">
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
          document.body,
        )
        : null}
    </>
  );
}

function Lightbox({ images, index: initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const total = images.length;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIndex((p) => Math.max(0, p - 1));
      else if (e.key === "ArrowRight") setIndex((p) => Math.min(total - 1, p + 1));
    };
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose, total]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-xl text-white hover:bg-white/30"
        aria-label="Fermer"
      >
        ×
      </button>
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIndex((p) => Math.max(0, p - 1)); }}
          disabled={index === 0}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/20 text-3xl text-white hover:bg-white/30 disabled:opacity-30"
          aria-label="Précédent"
        >
          ‹
        </button>
      )}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIndex((p) => Math.min(total - 1, p + 1)); }}
          disabled={index >= total - 1}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/20 text-3xl text-white hover:bg-white/30 disabled:opacity-30"
          aria-label="Suivant"
        >
          ›
        </button>
      )}
      <img
        src={images[index]}
        alt="Vue agrandie"
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-sm text-white">
          {index + 1} / {total}
        </div>
      )}
    </div>,
    document.body,
  );
}

function InstagramModal({ item, onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isReel = item.type === "reel";
  const width = isReel ? 340 : 400;
  const visibleHeight = isReel ? 544 : 424;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-4 -top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white text-lg text-slate-700 shadow-lg hover:bg-slate-100"
          aria-label="Fermer"
        >
          ×
        </button>
        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{ width, height: visibleHeight }}
        >
          <iframe
            src={item.embedUrl}
            width={width}
            height={visibleHeight + 56}
            frameBorder="0"
            scrolling="no"
            allowTransparency={true}
            style={{ marginTop: "-56px", display: "block" }}
            title={`Instagram ${item.type}`}
          />
        </div>
        <div className="mt-3 flex items-center justify-center">
          <a
            href={item.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/70 backdrop-blur hover:bg-white/20 hover:text-white"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Voir sur Instagram ↗
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PdfThumbnail({ url, className }) {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    pdfjsLib
      .getDocument({ url })
      .promise.then((pdf) => pdf.getPage(1))
      .then((page) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const viewport = page.getViewport({ scale: 0.3 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        return page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      })
      .then(() => {
        if (!cancelled) setRendered(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) {
    return <div className={`flex items-center justify-center bg-stone-100 text-xl ${className || ""}`}>📄</div>;
  }

  return (
    <div className={`overflow-hidden bg-stone-100 ${className || ""}`}>
      {!rendered && <div className="flex h-full w-full items-center justify-center text-xl">📄</div>}
      <canvas ref={canvasRef} style={{ display: rendered ? "block" : "none", width: "100%", height: "100%" }} />
    </div>
  );
}

function PlanPreview({
  room,
  label,
  planUploads,
  setPlanUploads,
  planLinks,
  setPlanLinks,
  extraPlanImages,
  setExtraPlanImages,
  aiContext,
  addAiInspiration,
  imageAnalysis,
  setImageAnalysis,
  deletedImages,
  setDeletedImages,
  onImageClick,
}) {
  const items = [
    ...(roomPlanImages[room] || []).map((src, i) => ({ src, key: `${room}-plan-${i}` })),
    ...(extraPlanImages[room] || []).map((src, i) => ({ src, key: `${room}-plan-extra-${i}` })),
  ].filter((item) => !deletedImages[item.key]);
  const [missingCards, setMissingCards] = useState({});
  const [index, setIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    setIndex(0);
  }, [room, items.length]);

  const pageCount = Math.max(1, items.length);
  const currentItem = items[index] || { src: "", key: `${room}-plan-empty` };
  const currentKey = currentItem.key;
  const currentSrc = planUploads[currentKey] || currentItem.src;
  const currentLink = planLinks[currentKey] || "";
  const isMissing = !!missingCards[currentKey];

  const handleUpload = async (file) => {
    if (!file) return;
    const data = await readFileAsDataUrl(file);
    if (typeof data === "string") {
      const url = await uploadToBlob(data, `${currentKey}-${Date.now()}.${extFromDataUrl(data)}`);
      setPlanUploads((prev) => ({ ...prev, [currentKey]: url }));
      if (!isPdfUrl(url)) {
        const analysis = await analyzeImageForContext({
          image: url,
          context: `Plan ${label}, pièce ${label}`,
          section: "plan",
        });
        if (analysis) setImageAnalysis((prev) => ({ ...prev, [currentKey]: analysis }));
      }
    }
  };

  const handleAddImage = async (file) => {
    if (!file) return;
    const data = await readFileAsDataUrl(file);
    if (typeof data === "string") {
      const nextIndex = (extraPlanImages[room] || []).length;
      const nextKey = `${room}-plan-extra-${nextIndex}`;
      const url = await uploadToBlob(data, `${nextKey}-${Date.now()}.${extFromDataUrl(data)}`);
      setExtraPlanImages((prev) => ({ ...prev, [room]: [...(prev[room] || []), url] }));
      if (!isPdfUrl(url)) {
        const analysis = await analyzeImageForContext({
          image: url,
          context: `Plan ajouté ${label}`,
          section: "plan",
        });
        if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
      }
    }
  };

  return (
    <div className="overflow-visible rounded-xl border border-black/10 bg-white">
      <div className="flex flex-col gap-3 border-b border-black/10 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Plan d'archi</p>
          <h3 className="type-h3">Plans & Photos</h3>
        </div>
        <div className="flex items-center gap-2">
          {pageCount > 1 ? (
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <button
                type="button"
                className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40"
                disabled={index === 0}
                onClick={() => setIndex((p) => Math.max(0, p - 1))}
              >
                Précédent
              </button>
              <span>
                {index + 1}/{pageCount}
              </span>
              <button
                type="button"
                className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40"
                disabled={index >= pageCount - 1}
                onClick={() => setIndex((p) => Math.min(pageCount - 1, p + 1))}
              >
                Suivant
              </button>
            </div>
          ) : null}
          <AddImageButton onFile={handleAddImage} accept="image/*,application/pdf" />
        </div>
      </div>
      <div
        className="group relative h-64 bg-[#efe7de] sm:h-80 lg:h-[360px]"
        style={{ cursor: currentSrc && !isMissing && !isPdfUrl(currentSrc) ? "zoom-in" : "default" }}
        onClick={() => {
          if (currentSrc && !isMissing && !isPdfUrl(currentSrc) && onImageClick) {
            const imageList = items.map((item) => planUploads[item.key] || item.src).filter((s) => s && !isPdfUrl(s));
            const clickedIdx = imageList.findIndex((s) => s === currentSrc);
            onImageClick(imageList, Math.max(0, clickedIdx));
          }
        }}
      >
        {currentSrc ? (
          isPdfUrl(currentSrc) ? (
            <div className="relative h-full w-full bg-[#f8f5ef]">
              <iframe
                src={currentSrc}
                title={`Plan ${label}`}
                className="h-full w-full border-0"
                onClick={(e) => e.stopPropagation()}
              />
              <a
                href={currentSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 z-10 rounded-md border border-black/15 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm backdrop-blur hover:bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                ↗ Plein écran
              </a>
            </div>
          ) : (
            <RepoImage src={currentSrc} alt={`Plan ${label}`} objectFit="contain" onMissingChange={(missing) => setMissingCards((prev) => ({ ...prev, [currentKey]: missing }))} />
          )
        ) : (
          <div className="grid h-full place-items-center bg-[#f8f5ef] p-4 text-center text-sm text-slate-500">Ajoute une image ou un PDF de plan.</div>
        )}
        {pageCount > 1 && index > 0 && !isPdfUrl(currentSrc) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIndex((p) => Math.max(0, p - 1)); }}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-2xl text-slate-800 shadow-md backdrop-blur hover:bg-white"
            aria-label="Précédent"
          >
            ‹
          </button>
        )}
        {pageCount > 1 && index < pageCount - 1 && !isPdfUrl(currentSrc) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIndex((p) => Math.min(pageCount - 1, p + 1)); }}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-2xl text-slate-800 shadow-md backdrop-blur hover:bg-white"
            aria-label="Suivant"
          >
            ›
          </button>
        )}
        {currentSrc ? (
          <div
            className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <AiImageEditor
              imageSrc={currentSrc}
              imageKind="plan"
              imageTitle={`Plan ${label}`}
              aiContext={aiContext}
              imageMetadata={imageAnalysis[currentKey]}
              onApply={(image) => setPlanUploads((prev) => ({ ...prev, [currentKey]: image }))}
              onAddToInspirations={(image) => addAiInspiration(room, image)}
            />
            <LinkAction
              value={currentLink}
              onChange={(value) =>
                setPlanLinks((prev) => ({
                  ...prev,
                  [currentKey]: value,
                }))
              }
            />
            <button
              type="button"
              title="Supprimer l'image"
              aria-label="Supprimer l'image"
              className="grid h-11 w-11 place-items-center rounded-md border border-black/15 bg-white/90 text-base font-bold text-slate-950 shadow-sm backdrop-blur hover:bg-white"
              onClick={() => setDeleteConfirm(currentKey)}
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        {pageCount > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((item, i) => {
              const thumbKey = item.key;
              const thumbSrc = planUploads[thumbKey] || item.src;
              return (
                <button
                  key={thumbKey}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded border ${index === i ? "border-slate-900" : "border-black/15"}`}
                >
                  {isPdfUrl(thumbSrc) ? (
                    <PdfThumbnail url={thumbSrc} className="h-full w-full" />
                  ) : (
                    <img src={thumbSrc} alt={`Miniature plan ${i + 1}`} className="h-full w-full object-cover" />
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
        {isMissing ? <div className="text-xs text-slate-500">Image manquante: ajoute une image avec le bouton +.</div> : null}
        {currentLink ? (
          <a href={currentLink} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2">
            Voir l'objet de cette vue
          </a>
        ) : null}
      </div>
      {deleteConfirm !== null && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-black/10 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-base font-semibold text-slate-900">Supprimer l'image ?</h2>
            <p className="mb-5 text-sm text-slate-500">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded-md border border-black/15 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeletedImages((prev) => ({ ...prev, [deleteConfirm]: true }));
                  setPlanUploads((prev) => removeObjectKey(prev, deleteConfirm));
                  setPlanLinks((prev) => removeObjectKey(prev, deleteConfirm));
                  setImageAnalysis((prev) => removeObjectKey(prev, deleteConfirm));
                  setDeleteConfirm(null);
                }}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function Inspirations({ room, label, uploadedImages, setUploadedImages, inspirationLinks, setInspirationLinks, aiContext, aiInspirations, addAiInspiration, imageAnalysis, setImageAnalysis, deletedImages, setDeletedImages, onImageClick, instagramItems, setInstagramItems }) {
  const items = [
    ...(roomInspirationImages[room] || []).map((src, i) => ({ src, cardKey: `${room}-${i}`, index: i })),
    ...(aiInspirations[room] || []).map((src, i) => ({ src, cardKey: `${room}-ai-${i}`, index: i })),
    ...(instagramItems[room] || []).map((ig) => ({ ...ig, cardKey: `${room}-ig-${ig.id}`, itemType: "instagram" })),
  ].filter((item) => !deletedImages[item.cardKey]);
  const [missingCards, setMissingCards] = useState({});
  const [instagramModal, setInstagramModal] = useState(null);
  const [page, setPage] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(0);
  }, [room, items.length]);

  const handleMissingChange = (cardKey, isMissing) => {
    setMissingCards((prev) => ({ ...prev, [cardKey]: isMissing }));
  };

  const handleUpload = async (cardKey, file) => {
    if (!file) return;
    const data = await readFileAsDataUrl(file);
    if (typeof data === "string") {
      const url = await uploadToBlob(data, `${cardKey}-${Date.now()}.${extFromDataUrl(data)}`);
      setUploadedImages((prev) => ({ ...prev, [cardKey]: url }));
      const analysis = await analyzeImageForContext({
        image: url,
        context: `Inspiration ${label}, pièce ${label}`,
        section: "inspiration",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [cardKey]: analysis }));
    }
  };

  const handleAddImage = async (file) => {
    if (!file) return;
    const data = await readFileAsDataUrl(file);
    if (typeof data === "string") {
      const nextIndex = (aiInspirations[room] || []).length;
      const nextKey = `${room}-ai-${nextIndex}`;
      const url = await uploadToBlob(data, `${nextKey}-${Date.now()}.${extFromDataUrl(data)}`);
      addAiInspiration(room, url);
      const analysis = await analyzeImageForContext({
        image: url,
        context: `Inspiration ajoutée ${label}`,
        section: "inspiration",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
    }
  };

  const handleAddImageFromUrl = async (imageUrl) => {
    const nextIndex = (aiInspirations[room] || []).length;
    const nextKey = `${room}-ai-${nextIndex}`;
    const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext) ? ext : "jpg";
    const url = await uploadUrlToBlob(imageUrl, `${nextKey}-${Date.now()}.${safeExt}`);
    if (!url) return;
    addAiInspiration(room, url);
    const analysis = await analyzeImageForContext({
      image: url,
      context: `Inspiration ajoutée ${label}`,
      section: "inspiration",
    });
    if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
  };

  const handleAddInstagram = (igData) => {
    const id = `${Date.now()}`;
    setInstagramItems((prev) => ({
      ...prev,
      [room]: [...(prev[room] || []), { id, ...igData }],
    }));
  };

  const visibleItems = items
    .slice(page * pageSize, page * pageSize + pageSize)
    .map((item, offset) => ({ ...item, displayIndex: page * pageSize + offset }));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Moodboard</p>
          <h3 className="type-h3">Inspirations</h3>
        </div>
        <div className="flex items-center gap-2">
          {pageCount > 1 ? (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Précédent
              </button>
              <span>
                {page + 1}/{pageCount}
              </span>
              <button
                type="button"
                className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Suivant
              </button>
            </div>
          ) : null}
          <AddUrlButton onUrl={handleAddImageFromUrl} onInstagram={handleAddInstagram} />
          <AddImageButton onFile={handleAddImage} />
        </div>
      </div>
      {(() => {
        const [item0, item1, item2, item3] = visibleItems;

        const renderCard = (item, extraStyle = {}) => {
          if (!item) return null;
          const { src, cardKey, displayIndex: i } = item;

          if (item.itemType === "instagram") {
            const isReel = item.type === "reel";
            const hasThumbnail = !!item.thumbnailUrl;
            return (
              <div
                key={cardKey}
                className="group relative overflow-hidden rounded-xl cursor-pointer"
                style={extraStyle}
                onClick={() => setInstagramModal(item)}
              >
                {hasThumbnail ? (
                  <img src={item.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <iframe
                    src={item.embedUrl}
                    style={{
                      position: "absolute",
                      top: "-56px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "540px",
                      height: "756px",
                      border: "none",
                      pointerEvents: "none",
                    }}
                    scrolling="no"
                    allowTransparency={true}
                    title="Instagram preview"
                  />
                )}
                {/* Click capture overlay + gradient for badges */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute inset-0 flex flex-col items-end justify-end p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
                      {isReel ? "Reel" : "Carrousel"}
                    </span>
                    {isReel ? (
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute inset-x-2 top-2 z-20 flex items-start justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    title="Supprimer"
                    className="grid h-11 w-11 place-items-center rounded-md border border-white/30 bg-black/40 text-base font-bold text-white backdrop-blur hover:bg-black/60"
                    onClick={() => setDeleteConfirm(cardKey)}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          }

          const imageSrc = uploadedImages[cardKey] || src;
          const linkValue = inspirationLinks[cardKey] || "";
          const isMissing = !!missingCards[cardKey];

          return (
            <div
              key={cardKey}
              className="group relative overflow-hidden rounded-xl bg-[#e8e4de]"
              style={{ cursor: isMissing ? "default" : "zoom-in", ...extraStyle }}
              onClick={() => {
                if (!isMissing && onImageClick) {
                  const imageList = items.map((it) => uploadedImages[it.cardKey] || it.src).filter(Boolean);
                  const clickedIdx = items.findIndex((it) => it.cardKey === cardKey);
                  onImageClick(imageList, Math.max(0, clickedIdx));
                }
              }}
            >
              <RepoImage src={imageSrc} alt={`${label} inspiration ${i + 1}`} objectFit="cover" onMissingChange={(missing) => handleMissingChange(cardKey, missing)} />
              {isMissing ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[#f8f5ef] p-3 text-center text-xs text-slate-500">
                  Image manquante : ajoute une image avec le bouton +.
                </div>
              ) : null}
              <div className="absolute inset-x-2 top-2 z-20 flex flex-wrap items-start justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                <AiImageEditor
                  imageSrc={imageSrc}
                  imageKind="inspiration"
                  imageTitle={`${label} inspiration ${i + 1}`}
                  aiContext={aiContext}
                  imageMetadata={imageAnalysis[cardKey]}
                  onApply={(image) => setUploadedImages((prev) => ({ ...prev, [cardKey]: image }))}
                  onAddToInspirations={(image) => addAiInspiration(room, image)}
                />
                <LinkAction
                  value={linkValue}
                  onChange={(value) =>
                    setInspirationLinks((prev) => ({
                      ...prev,
                      [cardKey]: value,
                    }))
                  }
                />
                <button
                  type="button"
                  title="Supprimer l'image"
                  aria-label="Supprimer l'image"
                  className="grid h-11 w-11 place-items-center rounded-md border border-black/15 bg-white/90 text-base font-bold text-slate-950 shadow-sm backdrop-blur hover:bg-white"
                  onClick={() => setDeleteConfirm(cardKey)}
                >
                  ×
                </button>
              </div>
              {linkValue ? (
                <div className="absolute bottom-2 left-2 z-10 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <a href={linkValue} target="_blank" rel="noreferrer" className="rounded-md border border-white/30 bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur hover:bg-black/70">
                    Voir l'objet
                  </a>
                </div>
              ) : null}
            </div>
          );
        };

        if (!item1) {
          return renderCard(item0, { aspectRatio: "16/9" });
        }

        const hasBottom = !!(item2 || item3);

        return (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "1fr 1fr 1fr",
              gridTemplateAreas: hasBottom ? '"hero hero tall" "bottom bottom tall"' : '"hero hero tall"',
            }}
          >
            {renderCard(item0, { gridArea: "hero", aspectRatio: "16/9" })}
            {renderCard(item1, { gridArea: "tall" })}
            {hasBottom ? (
              <div style={{ gridArea: "bottom", display: "grid", gridTemplateColumns: item3 ? "1fr 1fr" : "1fr", gap: "12px" }}>
                {renderCard(item2, { aspectRatio: "4/3" })}
                {renderCard(item3, { aspectRatio: "4/3" })}
              </div>
            ) : null}
          </div>
        );
      })()}
      {deleteConfirm !== null && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-black/10 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-base font-semibold text-slate-900">Supprimer l'image ?</h2>
            <p className="mb-5 text-sm text-slate-500">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded-md border border-black/15 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.startsWith(`${room}-ig-`)) {
                    setInstagramItems((prev) => ({
                      ...prev,
                      [room]: (prev[room] || []).filter((ig) => `${room}-ig-${ig.id}` !== deleteConfirm),
                    }));
                  } else {
                    setDeletedImages((prev) => ({ ...prev, [deleteConfirm]: true }));
                    setUploadedImages((prev) => removeObjectKey(prev, deleteConfirm));
                    setInspirationLinks((prev) => removeObjectKey(prev, deleteConfirm));
                    setImageAnalysis((prev) => removeObjectKey(prev, deleteConfirm));
                  }
                  setDeleteConfirm(null);
                }}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {instagramModal ? <InstagramModal item={instagramModal} onClose={() => setInstagramModal(null)} /> : null}
    </div>
  );
}

function EditMaterialModal({ cardKey, isLink, currentMeta, onSave, onClose }) {
  const [label, setLabel] = useState(currentMeta.label || "");
  const [category, setCategory] = useState(currentMeta.category || "");
  const [uploading, setUploading] = useState(false);
  const [customImage, setCustomImage] = useState(currentMeta.customImage || "");
  const fileInputRef = useRef(null);

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const data = await readFileAsDataUrl(file);
      if (typeof data === "string") {
        const url = await uploadToBlob(data, `${cardKey}-custom-${Date.now()}.${extFromDataUrl(data)}`);
        setCustomImage(url);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    const meta = {};
    if (label.trim()) meta.label = label.trim();
    if (category) meta.category = category;
    if (customImage) meta.customImage = customImage;
    onSave(meta);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold">Modifier la carte</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Surface</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
            >
              <option value="">— Choisir une surface —</option>
              <option>Sol</option>
              <option>Mur</option>
              <option>Plafond</option>
              <option>Crédence</option>
              <option>Plan de travail</option>
              <option>Menuiserie</option>
              <option>Textile</option>
              <option>Mobilier</option>
              <option>Autre</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {isLink ? "Titre" : "Nom du matériau"}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={isLink ? "Titre du produit" : "Ex : Parquet chêne naturel"}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
              autoFocus
            />
          </div>
          {isLink && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Remplacer l'image
              </label>
              {customImage ? (
                <div className="relative">
                  <img src={customImage} alt="" className="h-32 w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-sm font-bold shadow"
                    onClick={() => setCustomImage("")}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-black/20 py-3 text-sm text-slate-500 hover:bg-slate-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Chargement…" : (
                    <span className="flex items-center gap-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>
                      </svg>
                      Ajouter une photo
                    </span>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files?.[0])}
              />
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-slate-50"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
            onClick={handleSave}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialsSection({
  room,
  materialUploads,
  setMaterialUploads,
  materialLinks,
  setMaterialLinks,
  extraMaterialImages,
  setExtraMaterialImages,
  extraMaterialMeta,
  setExtraMaterialMeta,
  aiContext,
  addAiInspiration,
  imageAnalysis,
  setImageAnalysis,
  deletedImages,
  setDeletedImages,
  onImageClick,
}) {
  const items = [
    ...(materialsByRoom[room] || []).map((item, i) => ({ item, cardKey: `${room}-material-${i}`, index: i })),
    ...(extraMaterialImages[room] || []).map((entry, i) => {
      const isLink = entry && typeof entry === "object" && entry.type === "link";
      const cardKey = `${room}-material-extra-${i}`;
      const meta = extraMaterialMeta[cardKey] || {};
      return {
        item: {
          label: isLink ? "Lien produit" : "Ajout",
          value: meta.label || (isLink ? (entry.title || entry.url) : "Matériau ajouté"),
          src: isLink ? (meta.customImage || entry.image || "") : entry,
          linkPreview: isLink ? entry : null,
        },
        cardKey,
        index: i,
        isExtra: true,
      };
    }),
  ]
    .filter(({ cardKey }) => !deletedImages[cardKey]);
  const [missingCards, setMissingCards] = useState({});
  const [page, setPage] = useState(0);
  const [editingCard, setEditingCard] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(0);
  }, [room, items.length]);

  const handleMissingChange = (cardKey, isMissing) => {
    setMissingCards((prev) => ({ ...prev, [cardKey]: isMissing }));
  };

  const handleUpload = async (cardKey, file) => {
    if (!file) return;
    const data = await readFileAsDataUrl(file);
    if (typeof data === "string") {
      const url = await uploadToBlob(data, `${cardKey}-${Date.now()}.${extFromDataUrl(data)}`);
      setMaterialUploads((prev) => ({ ...prev, [cardKey]: url }));
      const analysis = await analyzeImageForContext({
        image: url,
        context: `Matériau ${room}, ${cardKey}`,
        section: "matériau",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [cardKey]: analysis }));
    }
  };

  const handleAddImage = async (file) => {
    if (!file) return;
    const data = await readFileAsDataUrl(file);
    if (typeof data === "string") {
      const nextIndex = (extraMaterialImages[room] || []).length;
      const nextKey = `${room}-material-extra-${nextIndex}`;
      const url = await uploadToBlob(data, `${nextKey}-${Date.now()}.${extFromDataUrl(data)}`);
      setExtraMaterialImages((prev) => ({ ...prev, [room]: [...(prev[room] || []), url] }));
      const analysis = await analyzeImageForContext({
        image: url,
        context: `Matériau ajouté ${room}`,
        section: "matériau",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
    }
  };

  const handleAddLink = (preview) => {
    setExtraMaterialImages((prev) => ({
      ...prev,
      [room]: [...(prev[room] || []), { type: "link", ...preview }],
    }));
  };

  const visibleItems = items
    .slice(page * pageSize, page * pageSize + pageSize)
    .map((entry, offset) => ({ ...entry, displayIndex: page * pageSize + offset }));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Finitions & matières</p>
          <h3 className="type-h3">Matériaux</h3>
        </div>
        <div className="flex items-center gap-2">
          {pageCount > 1 ? (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Précédent
              </button>
              <span>
                {page + 1}/{pageCount}
              </span>
              <button
                type="button"
                className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Suivant
              </button>
            </div>
          ) : null}
          <AddMaterialButton onFile={handleAddImage} onLink={handleAddLink} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map(({ item, cardKey, displayIndex: index, isExtra }) => {
          const isLinkPreview = !!item.linkPreview;
          const imageSrc = materialUploads[cardKey] || item.src;
          const linkValue = materialLinks[cardKey] ?? item.link ?? "";
          const isMissing = !!missingCards[cardKey];
          return (
            <div key={cardKey} className="overflow-visible rounded-xl border border-black/10 bg-white">
              <div
                className={`group relative overflow-hidden rounded-t-xl${isLinkPreview ? " h-52 sm:h-48" : ""}`}
                onClick={() => {
                  if (isLinkPreview) {
                    window.open(item.linkPreview.url, "_blank", "noreferrer");
                  } else if (onImageClick && imageSrc) {
                    const nonLinkItems = items.filter(({ item: it }) => !it.linkPreview);
                    const imageList = nonLinkItems.map(({ item: it, cardKey: ck }) => materialUploads[ck] || it.src).filter(Boolean);
                    const clickedIdx = nonLinkItems.findIndex(({ cardKey: ck }) => ck === cardKey);
                    onImageClick(imageList, Math.max(0, clickedIdx));
                  }
                }}
                style={{ cursor: isLinkPreview ? "pointer" : "zoom-in" }}
              >
                {isLinkPreview ? (
                  <LinkPreviewCard
                    preview={item.linkPreview}
                    onClick={() => {}}
                    overrideImage={item.src || undefined}
                  />
                ) : (
                  <RepoImage
                    src={imageSrc}
                    alt={`${item.label} ${item.value}`}
                    onMissingChange={(missing) => handleMissingChange(cardKey, missing)}
                    objectFit="natural"
                  />
                )}
                <div
                  className="absolute inset-x-2 top-2 z-20 flex flex-wrap items-start justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!isLinkPreview && (
                    <AiImageEditor
                      imageSrc={imageSrc}
                      imageKind="matériau"
                      imageTitle={`${item.label} - ${item.value}`}
                      aiContext={aiContext}
                      imageMetadata={imageAnalysis[cardKey]}
                      onApply={(image) => setMaterialUploads((prev) => ({ ...prev, [cardKey]: image }))}
                      onAddToInspirations={(image) => addAiInspiration(room, image)}
                    />
                  )}
                  {!isLinkPreview && (
                    <LinkAction
                      value={linkValue}
                      onChange={(value) =>
                        setMaterialLinks((prev) => ({
                          ...prev,
                          [cardKey]: value,
                        }))
                      }
                    />
                  )}
                  {isExtra && (
                    <button
                      type="button"
                      title="Modifier"
                      aria-label="Modifier"
                      className="grid h-11 w-11 place-items-center rounded-md border border-black/15 bg-white/90 text-base text-slate-950 shadow-sm backdrop-blur hover:bg-white"
                      onClick={() => setEditingCard(cardKey)}
                    >
                      ✏
                    </button>
                  )}
                  <button
                    type="button"
                    title="Supprimer"
                    aria-label="Supprimer"
                    className="grid h-11 w-11 place-items-center rounded-md border border-black/15 bg-white/90 text-base font-bold text-slate-950 shadow-sm backdrop-blur hover:bg-white"
                    onClick={() => setDeleteConfirm(cardKey)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="space-y-2 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
                <div className="text-sm font-medium line-clamp-2">{item.value}</div>
                {isLinkPreview && item.linkPreview?.description ? (
                  <p className="text-xs text-slate-500 line-clamp-2">{item.linkPreview.description}</p>
                ) : null}
                {!isLinkPreview && isMissing ? (
                  <div className="text-xs text-slate-500">Image manquante: ajoute une image avec le bouton +.</div>
                ) : null}
                {isLinkPreview ? (
                  <a
                    className="text-sm underline underline-offset-2"
                    href={item.linkPreview.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Voir le produit →
                  </a>
                ) : linkValue ? (
                  <a className="text-sm underline underline-offset-2" href={linkValue} target="_blank" rel="noreferrer">
                    {item.cta || "Voir le produit"}
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {editingCard && (() => {
        const editEntry = items.find((e) => e.cardKey === editingCard);
        if (!editEntry) return null;
        return (
          <EditMaterialModal
            cardKey={editingCard}
            isLink={!!editEntry.item.linkPreview}
            currentMeta={extraMaterialMeta[editingCard] || {}}
            onSave={(newMeta) => {
              setExtraMaterialMeta((prev) => ({ ...prev, [editingCard]: newMeta }));
              setEditingCard(null);
            }}
            onClose={() => setEditingCard(null)}
          />
        );
      })()}
      {deleteConfirm !== null && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-black/10 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-base font-semibold text-slate-900">Supprimer l'image ?</h2>
            <p className="mb-5 text-sm text-slate-500">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded-md border border-black/15 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeletedImages((prev) => ({ ...prev, [deleteConfirm]: true }));
                  setMaterialUploads((prev) => removeObjectKey(prev, deleteConfirm));
                  setMaterialLinks((prev) => removeObjectKey(prev, deleteConfirm));
                  setImageAnalysis((prev) => removeObjectKey(prev, deleteConfirm));
                  setExtraMaterialMeta((prev) => removeObjectKey(prev, deleteConfirm));
                  setDeleteConfirm(null);
                }}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function GeneralPaletteSection({ orderedActiveRooms, allRoomPresets, getRoomColors, onNavigateToRoom }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue d'ensemble</p>
        <h2 className="type-h2">Palette de l'appartement</h2>
        <p className="mt-1 text-sm text-slate-600">Toutes les pièces et leurs couleurs. Cliquer pour accéder à une pièce.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {orderedActiveRooms.map((key) => {
          const p = allRoomPresets[key];
          const colors = getRoomColors(key);
          if (!colors || !p) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigateToRoom(key)}
              className="group rounded-xl border border-black/10 bg-white p-4 text-left transition-all hover:border-slate-400/40 hover:shadow-md"
            >
              <div className="mb-3 h-2 w-full rounded-full" style={{ backgroundColor: colors.dominant.hex }} />
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="font-medium text-slate-900">{p.label}</div>
                <span className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500">→</span>
              </div>
              <div className="flex gap-2">
                {[
                  { ...colors.dominant, sublabel: "Dom." },
                  { ...colors.secondary, sublabel: "Sec." },
                  { ...colors.accent, sublabel: "Acc." },
                ].map(({ hex, sublabel }) => (
                  <div key={sublabel} className="min-w-0 flex-1">
                    <div className="mb-1 h-7 rounded border border-black/10" style={{ backgroundColor: hex }} />
                    <div className="truncate text-[10px] text-slate-400">{sublabel}</div>
                    <div className="truncate font-mono text-[10px] text-slate-600">{hex}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 line-clamp-1 text-xs text-slate-400">{p.line}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GeneralContextSection({ generalContext, setGeneralContext }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Appartement</p>
      <h2 className="type-h2">Contexte & goûts de design</h2>
      <p className="mt-1 mb-3 text-sm text-slate-600">
        Style général, contraintes, coups de cœur, choses à éviter…
        Ce texte est transmis à l'IA dans chaque conversation pièce.
      </p>
      <textarea
        className="min-h-36 w-full rounded-md border border-black/15 bg-white p-3 text-sm focus:outline-none focus:ring-1 focus:ring-black/30"
        placeholder="Ex : Style rétro années 70, coloré mais doux. On aime le bois clair, les plantes, les textiles en lin. On évite le minimalisme froid et les accents rouges. Budget peinture prioritaire…"
        value={generalContext}
        onChange={(e) => setGeneralContext(e.target.value)}
      />
      <p className="mt-1 text-right text-[10px] text-slate-400">{generalContext.length}/400 recommandés</p>
    </div>
  );
}

function GeneralResourcesSection({ generalResources, setGeneralResources }) {
  const [urlInput, setUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const preview = await fetchLinkPreview(url);
      setGeneralResources((prev) => [
        { id: `res-${Date.now()}`, url: preview.url || url, title: preview.title || url, description: preview.description || null, image: preview.image || null },
        ...prev,
      ]);
      setUrlInput("");
    } catch {
      setError("Impossible de charger ce lien.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Appartement</p>
      <h2 className="type-h2">Ressources</h2>
      <p className="mt-1 mb-3 text-sm text-slate-600">
        Pinterest, boutiques, blogs design — références valables pour tout l'appartement.
      </p>
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => { setUrlInput(e.target.value); setError(null); }}
          placeholder="https://pinterest.fr/…"
          className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black/30"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !urlInput.trim()}
          className="rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {isLoading ? "…" : "Ajouter"}
        </button>
      </form>
      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
      {generalResources.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {generalResources.map((resource) => {
            const hostname = (() => {
              try { return new URL(resource.url).hostname.replace(/^www\./, ""); } catch { return resource.url; }
            })();
            return (
              <div key={resource.id} className="group relative overflow-hidden rounded-xl border border-black/10 bg-white">
                {resource.image ? (
                  <div className="h-36 overflow-hidden bg-slate-100">
                    <img src={resource.image} alt={resource.title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="flex h-20 items-center justify-center bg-[#f9f7f3] text-2xl">🔗</div>
                )}
                <div className="p-3">
                  <p className="mb-0.5 text-[10px] text-slate-400">{hostname}</p>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm font-medium text-slate-900 hover:underline"
                  >
                    {resource.title}
                  </a>
                  {resource.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{resource.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setGeneralResources((prev) => prev.filter((r) => r.id !== resource.id))}
                  aria-label="Supprimer"
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-slate-500 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Aucune ressource ajoutée.</p>
      )}
    </div>
  );
}

function DocumentsGlobalView({ orderedActiveRooms, allRoomPresets, roomDocuments }) {
  const docIcon = (type) => {
    if (type?.includes("pdf")) return "📄";
    if (type?.includes("word") || type?.includes("document")) return "📝";
    if (type?.includes("sheet") || type?.includes("excel") || type?.includes("spreadsheet")) return "📊";
    if (type?.startsWith("image/")) return "🖼";
    return "📎";
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const roomsWithDocs = orderedActiveRooms.filter((key) => (roomDocuments[key] || []).length > 0);

  return (
    <>
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue d'ensemble</p>
        <h2 className="type-h2">Documents par pièce</h2>
        <p className="mt-1 text-sm text-slate-600">Devis, plans et fichiers uploadés dans chaque pièce.</p>
      </div>
      {roomsWithDocs.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-8 text-center text-sm text-slate-400">
          Aucun document uploadé pour l'instant. Ouvre une pièce et ajoute des fichiers dans la section "Devis & documents".
        </div>
      ) : (
        roomsWithDocs.map((key) => {
          const p = allRoomPresets[key];
          const docs = roomDocuments[key] || [];
          return (
            <div key={key} className="rounded-xl border border-black/10 bg-white p-4">
              <h3 className="mb-3 font-medium text-slate-900">{p?.label || key}</h3>
              <ul className="space-y-1.5">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2">
                    {doc.type?.includes("pdf") ? (
                      <PdfThumbnail url={doc.url} className="h-12 w-9 shrink-0 rounded" />
                    ) : (
                      <span className="text-xl leading-none">{docIcon(doc.type)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium text-slate-800 hover:underline"
                      >
                        {doc.name}
                      </a>
                      <span className="text-xs text-slate-400">
                        {formatSize(doc.size)}
                        {doc.size && doc.uploadedAt ? " · " : ""}
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString("fr-FR") : ""}
                      </span>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded border border-black/10 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      Ouvrir
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </>
  );
}

function DiscussionsGlobalView({ orderedActiveRooms, allRoomPresets, discussionsCache, onOpenThread, mentionNotifications }) {
  const [filter, setFilter] = useState("open");

  const allRooms = ["general", ...orderedActiveRooms];

  const totalOpen = allRooms.reduce((acc, key) => {
    return acc + (discussionsCache[key] || []).filter((d) => d.status === "open").length;
  }, 0);

  const unreadMentionIds = new Set((mentionNotifications || []).filter(n => !n.read_at).map(n => n.discussion_id));
  const unreadMentionsCount = unreadMentionIds.size;

  const isEmpty = allRooms.every((key) => {
    const discs = discussionsCache?.[key] || [];
    if (filter === "mentions") return discs.filter(d => unreadMentionIds.has(d.id)).length === 0;
    return discs.filter(d => filter === "all" || d.status === filter).length === 0;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue d'ensemble</p>
        <h2 className="type-h2">Toutes les discussions</h2>
        <p className="mt-1 text-sm text-slate-600">
          {totalOpen > 0 ? `${totalOpen} fil${totalOpen > 1 ? "s" : ""} ouvert${totalOpen > 1 ? "s" : ""} dans toutes les pièces.` : "Aucun fil ouvert pour l'instant."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[{ key: "all", label: "Tout" }, { key: "open", label: "Ouverts" }, { key: "resolved", label: "Résolus" }, { key: "mentions", label: "Mes mentions", badge: unreadMentionsCount }].map(({ key, label, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${filter === key ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-white"}`}
            >
              {label}
              {badge > 0 && (
                <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${filter === key ? "bg-red-400 text-white" : "bg-red-500 text-white"}`}>{badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">
            {filter === "mentions" ? "Aucune mention non lue." : filter === "all" ? "Aucune discussion pour l'instant." : `Aucun fil ${filter === "open" ? "ouvert" : "résolu"} pour l'instant.`}
          </p>
        </div>
      ) : allRooms.map((roomKey) => {
        const discussions = (discussionsCache?.[roomKey] || []).filter((d) => {
          if (filter === "mentions") return unreadMentionIds.has(d.id);
          return filter === "all" || d.status === filter;
        });
        if (discussions.length === 0) return null;
        return (
          <div key={roomKey} className="rounded-xl border border-black/10 bg-white p-4">
            <h3 className="mb-3 font-medium text-slate-900">
              {roomKey === "general" ? "Appartement" : allRoomPresets[roomKey]?.label}
            </h3>
            <div className="space-y-2">
              {discussions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onOpenThread(d.id, d)}
                  className="group w-full rounded-xl border border-black/10 bg-white p-3 text-left transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {d.is_pinned && <span className="text-xs">📌</span>}
                        <span className="truncate font-medium text-slate-900">{d.title}</span>
                        {d.status === "resolved" && (
                          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">Résolu</span>
                        )}
                      </div>
                      {d.last_message_preview && (
                        <p className="mt-1 truncate text-xs text-slate-400">{d.last_message_preview}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-300">
                        <span>{d.message_count} message{d.message_count !== 1 ? "s" : ""}</span>
                        {d.last_message_at && (
                          <span>· {new Date(d.last_message_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                        )}
                      </div>
                    </div>
                    {(d.unread_count || 0) > 0 && (
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-900">{d.unread_count}</span>
                    )}
                    <span className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderMessageContent(content) {
  const tokenRegex = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const lines = content.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = [];
    let lastIndex = 0;
    let match;
    tokenRegex.lastIndex = 0;
    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
      if (match[1] !== undefined) {
        parts.push(<strong key={match.index}>{match[1]}</strong>);
      } else if (match[2] !== undefined) {
        parts.push(<em key={match.index}>{match[2]}</em>);
      } else {
        parts.push(
          <a key={match.index} href={match[4]} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-white border border-black/15 px-2 py-0.5 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3 shrink-0 opacity-60"><path d="M6.22 8.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v1.69a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72Z"/><path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z"/></svg>
            {match[3]}
          </a>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return (
      <span key={lineIdx}>
        {parts.length > 0 ? parts : line}
        {lineIdx < lines.length - 1 ? '\n' : null}
      </span>
    );
  });
}

// ── Collaborative Discussions ─────────────────────────────────────────────

function renderDiscussionContent(content, allRoomPresets, onNavigateToRoom) {
  if (!content) return null;
  const parts = content.split(/(@\w+|#[\w-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="inline-block rounded bg-amber-100 px-1 text-sm font-medium text-amber-800">{part}</span>;
    }
    if (part.startsWith('#')) {
      const key = part.slice(1);
      if (allRoomPresets?.[key]) {
        return (
          <button key={i} type="button" onClick={() => onNavigateToRoom?.(key)}
            className="inline-block rounded bg-slate-100 px-1 text-sm font-medium text-slate-700 underline hover:bg-slate-200">
            {part}
          </button>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

function DiscussionThread({ discussionId, discussion, projectId, user, isOwner, authedFetch, projectMembers, orderedActiveRooms, allRoomPresets, onClose, onDiscussionUpdate, onNavigateToRoom, onMarkMentionsRead }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mention, setMention] = useState(null);
  const [linkedImage, setLinkedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState([]);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    authedFetch(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(projectId)}&type=discussion-messages&discussionId=${discussionId}`)
      .then(r => r.json())
      .then(({ messages: msgs }) => setMessages(msgs || []))
      .catch(() => {});
    onMarkMentionsRead?.([discussionId]);
  }, [discussionId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase.channel(`thread-${discussionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussion_messages', filter: `discussion_id=eq.${discussionId}` },
        (payload) => {
          if (payload.new.author_id !== user?.id) {
            setMessages(prev => [...prev, payload.new]);
            supabase.from('discussion_reads')
              .upsert({ user_id: user.id, discussion_id: discussionId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,discussion_id' })
              .then(() => {}).catch(() => {});
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [discussionId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    const hashMatch = textBefore.match(/#([\w-]*)$/);
    if (atMatch) {
      setMention({ type: '@', query: atMatch[1], start: cursor - atMatch[0].length });
    } else if (hashMatch) {
      setMention({ type: '#', query: hashMatch[1], start: cursor - hashMatch[0].length });
    } else {
      setMention(null);
    }
  };

  const handleInsertMention = (display, memberId = null) => {
    if (!mention || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const beforeMention = input.slice(0, mention.start);
    const afterCursor = input.slice(cursor);
    setInput(`${beforeMention}${mention.type}${display} ${afterCursor}`);
    if (memberId) setMentionedUserIds(prev => [...prev, memberId]);
    setMention(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    const toMention = [...mentionedUserIds];
    const tempId = `temp-${Date.now()}`;
    const authorName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Moi';
    const authorAvatar = user?.user_metadata?.avatar_url || null;
    setMessages(prev => [...prev, { id: tempId, author_id: user?.id, author_name: authorName, author_avatar: authorAvatar, content, linked_image: linkedImage, created_at: new Date().toISOString(), is_deleted: false }]);
    setInput('');
    setLinkedImage(null);
    setMentionedUserIds([]);
    setSending(true);
    try {
      const r = await authedFetch(`/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-message', projectId, discussionId, content, linkedImage, mentionedUserIds: toMention }) });
      const { messageId } = await r.json();
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: messageId } : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/upload-image`, { method: 'POST', body: fd });
      const { url } = await r.json();
      setLinkedImage(url);
    } catch {
      // ignore upload errors
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleDeleteMessage = async (messageId) => {
    await authedFetch(`/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-delete-message', projectId, messageId }) }).catch(() => {});
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true } : m));
  };

  const groupedMessages = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const sameAuthor = prev && prev.author_id === msg.author_id;
    const within5min = prev && (new Date(msg.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000;
    if (sameAuthor && within5min) {
      acc[acc.length - 1].msgs.push(msg);
    } else {
      acc.push({ author_id: msg.author_id, author_name: msg.author_name, author_avatar: msg.author_avatar, msgs: [msg] });
    }
    return acc;
  }, []);

  const isResolved = discussion?.status === 'resolved';
  const isPinned = discussion?.is_pinned;
  const canModerate = isOwner || discussion?.created_by === user?.id;

  const handleToggleResolve = async () => {
    const newStatus = isResolved ? 'open' : 'resolved';
    await authedFetch(`/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-update', projectId, discussionId, status: newStatus }) }).catch(() => {});
    onDiscussionUpdate?.({ status: newStatus });
  };

  const handleTogglePin = async () => {
    const newPinned = !isPinned;
    await authedFetch(`/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-update', projectId, discussionId, isPinned: newPinned }) }).catch(() => {});
    onDiscussionUpdate?.({ is_pinned: newPinned });
  };

  const mentionOptions = mention
    ? mention.type === '@'
      ? (projectMembers || []).filter(m => m.name.toLowerCase().includes((mention.query || '').toLowerCase()))
      : (orderedActiveRooms || []).filter(r => r.includes(mention.query || '')).map(r => ({ id: r, name: allRoomPresets?.[r]?.label || r }))
    : [];

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white" style={{ minHeight: '520px' }}>
      <div className="flex shrink-0 items-center gap-3 border-b border-black/10 px-4 py-3">
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border border-black/10 hover:bg-slate-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isPinned && <span className="text-xs">📌</span>}
            <span className="truncate font-medium text-slate-900">{discussion?.title}</span>
            {isResolved && <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">Résolu</span>}
          </div>
        </div>
        {canModerate && (
          <div className="flex gap-1.5">
            {isOwner && (
              <button type="button" onClick={handleTogglePin} title={isPinned ? "Désépingler" : "Épingler"}
                className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm hover:bg-slate-50 ${isPinned ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-black/10 text-slate-400'}`}>
                📌
              </button>
            )}
            <button type="button" onClick={handleToggleResolve}
              className={`flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium hover:bg-slate-50 ${isResolved ? 'border-slate-300 text-slate-600' : 'border-green-300 bg-green-50 text-green-700'}`}>
              {isResolved ? 'Rouvrir' : 'Résoudre'}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">Aucun message. Soyez le premier à écrire !</div>
        )}
        {groupedMessages.map((group, gi) => {
          const isOwn = group.author_id === user?.id;
          return (
            <div key={gi} className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isOwn && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-slate-100 text-xs font-medium text-slate-500">
                  {group.author_avatar
                    ? <img src={group.author_avatar} alt={group.author_name} className="h-full w-full object-cover" />
                    : (group.author_name?.[0] || '?').toUpperCase()}
                </div>
              )}
              <div className={`flex max-w-[75%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                {!isOwn && <div className="text-[11px] font-medium text-slate-400">{group.author_name}</div>}
                {group.msgs.map((msg) => (
                  <div key={msg.id} className="group relative">
                    {msg.is_deleted
                      ? <div className="rounded-xl border border-black/5 bg-slate-50 px-3 py-2 text-sm italic text-slate-400">Message supprimé</div>
                      : (
                        <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${isOwn ? 'rounded-br-sm bg-slate-900 text-white' : 'rounded-bl-sm border border-black/10 bg-[#f9f7f3] text-slate-800'}`}>
                          {msg.linked_image && <img src={msg.linked_image} alt="" className="mb-2 max-h-48 w-full rounded-lg object-cover" />}
                          <div className="whitespace-pre-wrap">{renderDiscussionContent(msg.content, allRoomPresets, onNavigateToRoom)}</div>
                          <div className={`mt-1 text-[10px] ${isOwn ? 'text-slate-500' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      )
                    }
                    {!msg.is_deleted && msg.author_id === user?.id && (
                      <button type="button" onClick={() => handleDeleteMessage(msg.id)}
                        className={`absolute top-1 hidden h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-red-500 group-hover:flex ${isOwn ? '-left-6' : '-right-6'}`}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative shrink-0">
        {mention && mentionOptions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 z-10 mx-4 mb-1 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
            {mentionOptions.slice(0, 5).map((opt) => (
              <button key={opt.id} type="button" onClick={() => handleInsertMention(opt.name, mention.type === '@' ? opt.id : null)}
                className="flex w-full items-center gap-2 border-b border-black/5 px-3 py-2.5 text-sm last:border-0 hover:bg-slate-50">
                {mention.type === '@' && (opt.avatar
                  ? <img src={opt.avatar} alt="" className="h-5 w-5 rounded-full" />
                  : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium">{opt.name[0]}</span>)}
                {mention.type === '#' && <span className="text-xs text-slate-400">#</span>}
                <span>{opt.name}</span>
              </button>
            ))}
          </div>
        )}
        {linkedImage && (
          <div className="relative mx-4 mb-2 mt-2">
            <img src={linkedImage} alt="" className="h-24 rounded-lg object-cover" />
            <button type="button" onClick={() => setLinkedImage(null)} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs leading-none text-white">×</button>
          </div>
        )}
        <div className="border-t border-black/10 px-4 py-3">
          <div className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              {uploadingImage ? <span className="text-xs">…</span> : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              )}
            </button>
            <textarea ref={textareaRef} value={input} onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } if (e.key === 'Escape') setMention(null); }}
              placeholder="Écrire un message… @prénom #pièce"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-black/10 bg-[#f9f7f3] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            />
            <button type="button" onClick={handleSend} disabled={!input.trim() || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscussionsPanel({ room, projectId, user, isOwner, discussions, onDiscussionsChange, authedFetch, projectMembers, allRoomPresets, orderedActiveRooms, onNavigateToRoom, onDiscussionUpdate, onMarkMentionsRead }) {
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openThread, setOpenThread] = useState(null);

  useEffect(() => {
    if (!projectId || !room) return;
    setLoading(true);
    authedFetch(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(projectId)}&type=discussions&roomKey=${encodeURIComponent(room)}`)
      .then(r => r.json())
      .then(({ discussions: discs }) => onDiscussionsChange(room, discs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, room]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const r = await authedFetch(`/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-create', projectId, roomKey: room, title: newTitle }) });
      const { discussionId } = await r.json();
      const newDisc = { id: discussionId, title: newTitle.trim(), status: 'open', is_pinned: false, message_count: 0, last_message_preview: null, last_message_at: null, created_at: new Date().toISOString(), created_by: user?.id, unread_count: 0 };
      onDiscussionsChange(room, [newDisc, ...(discussions || [])]);
      setNewTitle('');
      setShowCreate(false);
      setOpenThread({ discussionId, discussion: newDisc });
    } catch {
      // ignore creation errors
    } finally {
      setCreating(false);
    }
  };

  if (openThread) {
    return (
      <DiscussionThread
        discussionId={openThread.discussionId}
        discussion={openThread.discussion}
        projectId={projectId}
        user={user}
        isOwner={isOwner}
        authedFetch={authedFetch}
        projectMembers={projectMembers}
        orderedActiveRooms={orderedActiveRooms}
        allRoomPresets={allRoomPresets}
        onClose={() => setOpenThread(null)}
        onDiscussionUpdate={(patch) => {
          setOpenThread(prev => prev ? { ...prev, discussion: { ...prev.discussion, ...patch } } : prev);
          onDiscussionUpdate?.(openThread.discussionId, patch);
        }}
        onNavigateToRoom={onNavigateToRoom}
        onMarkMentionsRead={onMarkMentionsRead}
      />
    );
  }

  const filteredDiscussions = (discussions || []).filter(d => filter === 'all' || d.status === filter);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Discussions</p>
            <h2 className="type-h2">Échanges</h2>
          </div>
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Nouveau fil
          </button>
        </div>
        <div className="flex gap-1 rounded-lg border border-black/10 bg-[#f9f7f3] p-1">
          {[['all', 'Tous'], ['open', 'Ouverts'], ['resolved', 'Résolus']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${filter === key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-medium text-amber-900">Nouveau fil</p>
          <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
            placeholder="Ex: Canapé, Couleur des murs, Budget…"
            autoFocus
            className="mb-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowCreate(false); setNewTitle(''); }}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white">
              Annuler
            </button>
            <button type="button" onClick={handleCreate} disabled={!newTitle.trim() || creating}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40">
              {creating ? 'Création…' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {loading && (discussions || []).length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-6 text-center text-sm text-slate-400">Chargement…</div>
      ) : filteredDiscussions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">{filter === 'all' ? "Aucune discussion pour l'instant." : 'Aucun fil dans cette catégorie.'}</p>
          {filter === 'all' && <p className="mt-1 text-xs text-slate-300">Créez un fil pour commencer à échanger.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDiscussions.map((d) => (
            <button key={d.id} type="button" onClick={() => setOpenThread({ discussionId: d.id, discussion: d })}
              className="group w-full rounded-xl border border-black/10 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-sm">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {d.is_pinned && <span className="text-xs">📌</span>}
                    <span className="truncate font-medium text-slate-900">{d.title}</span>
                    {d.status === 'resolved' && <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">Résolu</span>}
                  </div>
                  {d.last_message_preview && <p className="mt-1 truncate text-xs text-slate-400">{d.last_message_preview}</p>}
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-300">
                    <span>{d.message_count} message{d.message_count !== 1 ? 's' : ''}</span>
                    {d.last_message_at && <span>· {new Date(d.last_message_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                </div>
                {(d.unread_count || 0) > 0 && (
                  <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-900">{d.unread_count}</span>
                )}
                <span className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500">→</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatPanel({ room, aiContext, chatHistory, setChatHistory, roomImages, setRoomLists, setRoomNotes, projectId, saveMessageFn, saveNoteFn, saveRoomItemsFn, onClose, draft = "", onDraftChange }) {
  const [input, setInput] = useState(draft);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [generatingFor, setGeneratingFor] = useState(null);
  const [pendingImages, setPendingImages] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const messages = chatHistory[room] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current && input) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
    }
  }, []);

  const handleImagePick = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    Promise.all(files.map(readFileAsDataUrl)).then((dataUrls) => {
      setPendingImages((prev) => [...prev, ...dataUrls]);
    });
    e.target.value = "";
  };

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if ((!trimmed && !pendingImages.length) || isLoading) return;

    const userMsg = { id: `msg-${Date.now()}`, role: "user", content: trimmed, ...(pendingImages.length > 0 ? { images: pendingImages } : {}) };
    const nextHistory = [...messages, userMsg];
    setPendingImages([]);
    setChatHistory((prev) => ({ ...prev, [room]: nextHistory }));
    setInput("");
    onDraftChange?.("");
    if (inputRef.current) inputRef.current.style.height = "36px";
    setIsLoading(true);
    if (saveMessageFn && projectId) saveMessageFn(projectId, room, userMsg);

    const imageMetadataSummary = (aiContext.roomImageMetadata || [])
      .map((item) => {
        const m = item.metadata;
        return m ? [m.style, m.inspiration, ...(m.materials || [])].filter(Boolean).join(", ") : null;
      })
      .filter(Boolean)
      .slice(0, 6)
      .join("; ");

    const requestBody = JSON.stringify({
      messages: nextHistory.slice(-20).map(({ role, content, image, images }, i, arr) => {
        const imgList = images?.length ? images : image ? [image] : [];
        return {
          role,
          content,
          ...(imgList.length > 0 && i >= arr.length - 4 ? { images: imgList } : {}),
        };
      }),
      roomContext: {
        label: aiContext.roomLabel,
        line: aiContext.line,
        dominantName: aiContext.dominantName,
        dominantHex: aiContext.dominantHex,
        secondaryName: aiContext.secondaryName,
        secondaryHex: aiContext.secondaryHex,
        accentName: aiContext.accentName,
        accentHex: aiContext.accentHex,
        roomNote: aiContext.roomNote,
        imageMetadataSummary,
        generalContext: aiContext.generalContext,
        allRoomsSummary: aiContext.allRoomsSummary,
        shoppingItems: aiContext.shoppingItems,
        todoItems: aiContext.todoItems,
        materialSummary: aiContext.materialSummary,
      },
    });

    const applyToolCalls = (toolCalls, msg) => {
      const notices = [];
      for (const call of toolCalls) {
        if (call.name === "add_to_shopping_list" && setRoomLists) {
          const newItems = (call.args.items || []).map((itemText) => ({
            id: `shopping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: itemText,
            done: false,
          }));
          setRoomLists((prev) => {
            const updated = [...((prev[room] || {}).shopping || []), ...newItems];
            if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, "shopping", updated);
            return { ...prev, [room]: { ...(prev[room] || {}), shopping: updated } };
          });
          notices.push(`${newItems.length} article${newItems.length > 1 ? "s" : ""} ajouté${newItems.length > 1 ? "s" : ""} à ta liste.`);
        } else if (call.name === "add_to_todo_list" && setRoomLists) {
          const newItems = (call.args.items || []).map((itemText) => ({
            id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: itemText,
            done: false,
          }));
          setRoomLists((prev) => {
            const updated = [...((prev[room] || {}).todos || []), ...newItems];
            if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, "todos", updated);
            return { ...prev, [room]: { ...(prev[room] || {}), todos: updated } };
          });
          notices.push(`${newItems.length} tâche${newItems.length > 1 ? "s" : ""} ajoutée${newItems.length > 1 ? "s" : ""} aux todos.`);
        } else if (call.name === "save_room_note" && setRoomNotes) {
          setRoomNotes((prev) => ({ ...prev, [room]: call.args.note }));
          if (saveNoteFn && projectId) saveNoteFn(projectId, room, call.args.note);
          notices.push("Note de pièce mise à jour.");
        }
      }
      if (notices.length) {
        msg.content = (msg.content ? msg.content + "\n\n" : "") + `*${notices.join(" ")}*`;
      }
    };

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      const isSSE = res.headers.get("content-type")?.includes("text/event-stream");

      if (!isSSE) {
        // Fallback to non-streaming JSON response
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur IA.");
        const assistantMsg = { id: `msg-${Date.now()}-a`, role: "assistant", content: data.content || "", imagePrompt: data.imagePrompt };
        if (data.toolCalls?.length) applyToolCalls(data.toolCalls, assistantMsg);
        setChatHistory((prev) => ({ ...prev, [room]: [...nextHistory, assistantMsg] }));
        if (saveMessageFn && projectId) saveMessageFn(projectId, room, assistantMsg);
        return;
      }

      // SSE streaming path
      const placeholderId = `msg-${Date.now()}-a`;
      setChatHistory((prev) => ({
        ...prev,
        [room]: [...nextHistory, { id: placeholderId, role: "assistant", content: "" }],
      }));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";
      let streamedText = "";
      const pendingToolCalls = [];

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
            try {
              const parsed = JSON.parse(line.slice(6));
              if (currentEvent === "delta" && parsed.text) {
                streamedText += parsed.text;
                setChatHistory((prev) => ({
                  ...prev,
                  [room]: (prev[room] || []).map((m) =>
                    m.id === placeholderId ? { ...m, content: streamedText } : m
                  ),
                }));
              } else if (currentEvent === "tool_call") {
                pendingToolCalls.push(parsed);
              } else if (currentEvent === "error") {
                throw new Error(parsed.error || "Erreur IA.");
              } else if (currentEvent === "done") {
                const finalMsg = { id: placeholderId, role: "assistant", content: streamedText, imagePrompt: parsed.imagePrompt };
                const nonImageCalls = pendingToolCalls.filter((c) => c.name !== "generate_image");
                if (nonImageCalls.length) applyToolCalls(nonImageCalls, finalMsg);
                const imageCalls = pendingToolCalls.filter((c) => c.name === "generate_image");
                if (imageCalls[0]?.args?.prompt) finalMsg.imagePrompt = imageCalls[0].args.prompt;
                setChatHistory((prev) => ({
                  ...prev,
                  [room]: (prev[room] || []).map((m) => m.id === placeholderId ? finalMsg : m),
                }));
                if (saveMessageFn && projectId) saveMessageFn(projectId, room, finalMsg);
              }
            } catch (parseErr) {
              if (currentEvent === "error") throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      setChatHistory((prev) => {
        const current = prev[room] || [];
        const withoutPlaceholder = current.filter((m) => !m.id?.endsWith("-a") || m.content);
        return { ...prev, [room]: [...(withoutPlaceholder.length < current.length ? withoutPlaceholder : nextHistory), { id: `msg-${Date.now()}-e`, role: "assistant", content: err.message, error: true }] };
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateFromPrompt = async (imageSrc, imagePrompt) => {
    setGeneratingFor(imageSrc);
    setPendingPrompt(null);
    try {
      const raw = await imageSrcToDataUrl(imageSrc);
      const dataUrl = await normalizeImageForAi(raw);
      const res = await fetch(`${API_BASE}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, prompt: imagePrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur génération.");
      const url = await uploadToBlob(data.image, `chat-gen-${Date.now()}.webp`);
      setChatHistory((prev) => ({
        ...prev,
        [room]: [
          ...(prev[room] || []),
          {
            id: `msg-${Date.now()}-img`,
            role: "assistant",
            content: "Voici la modification proposée :",
            generatedImage: url,
          },
        ],
      }));
    } catch (err) {
      setChatHistory((prev) => ({
        ...prev,
        [room]: [
          ...(prev[room] || []),
          { id: `msg-${Date.now()}-e`, role: "assistant", content: `Erreur génération: ${err.message}`, error: true },
        ],
      }));
    } finally {
      setGeneratingFor(null);
    }
  };

  const visibleImages = (roomImages || []).filter((img) => img.src && !isPdfUrl(img.src));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between border-b border-black/10 p-4">
        <div>
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Assistant</p>
          <h3 className="type-h3">Chat IA — {aiContext.roomLabel}</h3>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={() => setChatHistory((prev) => ({ ...prev, [room]: [] }))}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Effacer
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-400">
            <span className="text-3xl">✦</span>
            <p className="text-slate-500">Posez une question ou demandez-moi de créer des listes pour cette pièce.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { label: "Créer une liste de courses", icon: "🛒" },
                { label: "Ajouter des tâches à faire", icon: "✓" },
                { label: "Quelles couleurs pour les murs ?", icon: null },
                { label: "Quelle ambiance lumineuse ?", icon: null },
              ].map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendMessage(icon ? `${label}` : label)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    icon
                      ? "border-slate-900/20 bg-slate-900 text-white hover:bg-slate-700"
                      : "border-black/15 bg-[#f9f7f3] text-slate-600 hover:bg-[#fcf8d5]"
                  }`}
                >
                  {icon && <span className="mr-1">{icon}</span>}{label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "rounded-br-sm bg-slate-900 text-white"
                  : msg.error
                  ? "rounded-bl-sm bg-red-50 text-red-700 border border-red-100"
                  : "rounded-bl-sm bg-[#f9f7f3] border border-black/10 text-slate-800"
              }`}>
                {(msg.images?.length > 0 || msg.image) ? (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {(msg.images || [msg.image]).map((img, i) => (
                      <img key={i} src={img} alt="" className="max-h-40 max-w-full rounded-lg object-contain" />
                    ))}
                  </div>
                ) : null}
                {msg.content ? <p className="whitespace-pre-wrap leading-relaxed">{renderMessageContent(msg.content)}</p> : null}
                {msg.generatedImage ? (
                  <img src={msg.generatedImage} alt="Image générée" className="mt-2 w-full rounded-lg" />
                ) : null}
                {msg.imagePrompt && visibleImages.length > 0 ? (
                  <div className="mt-2">
                    {pendingPrompt === msg.imagePrompt ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-600">Choisir une image à modifier :</p>
                        <div className="flex flex-wrap gap-2">
                          {visibleImages.map((img) => (
                            <button
                              key={img.key}
                              type="button"
                              disabled={!!generatingFor}
                              onClick={() => generateFromPrompt(img.src, msg.imagePrompt)}
                              className="relative h-16 w-24 overflow-hidden rounded border border-black/15 hover:border-slate-900 disabled:opacity-50"
                            >
                              {generatingFor === img.src ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                                  <svg className="animate-spin h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 12h-4z" />
                                  </svg>
                                </div>
                              ) : null}
                              <img src={img.src} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingPrompt(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingPrompt(msg.imagePrompt)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/20 bg-[#fcf8d5] px-3 py-1 text-xs font-medium text-slate-700 hover:bg-[#f5efb0]"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                        </svg>
                        Visualiser sur une image
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        {isLoading ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-black/10 bg-[#f9f7f3] px-4 py-3 text-sm text-slate-500">
              <span className="animate-pulse">…</span>
            </div>
          </div>
        ) : null}
        {generatingFor ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-black/10 bg-[#f9f7f3] px-4 py-3 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 12h-4z" />
                </svg>
                <span>Génération de l'image en cours…</span>
              </div>
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-black/10 p-3">
        {pendingImages.length > 0 ? (
          <div className="mb-2 flex flex-wrap items-end gap-2">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt="preview" className="h-16 w-16 rounded-lg object-cover border border-black/10" />
                <button
                  type="button"
                  onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-slate-900 text-[9px] text-white leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            {pendingImages.length > 1 ? (
              <button
                type="button"
                onClick={() => setPendingImages([])}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Tout retirer
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImagePick}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="shrink-0 self-end rounded-md border border-black/15 bg-[#f9f7f3] px-3 py-2 text-slate-500 hover:bg-[#f0ebe0] disabled:opacity-40"
            title="Joindre des photos"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              onDraftChange?.(val);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Pose une question… (Cmd+Entrée pour envoyer)"
            rows={1}
            style={{ height: input ? undefined : "36px" }}
            className="min-w-0 flex-1 resize-none rounded-md border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 overflow-hidden"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !pendingImages.length) || isLoading}
            className="shrink-0 self-end rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

function TodosGlobalView({ orderedActiveRooms, allRoomPresets, roomLists, setRoomLists }) {
  const [filter, setFilter] = useState("all");
  const [hideDone, setHideDone] = useState(false);

  const toggleItem = (roomKey, listKey, id) => {
    setRoomLists((prev) => ({
      ...prev,
      [roomKey]: {
        ...(prev[roomKey] || {}),
        [listKey]: ((prev[roomKey] || {})[listKey] || []).map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
      },
    }));
  };

  const totalPending = orderedActiveRooms.reduce((acc, key) => {
    const list = roomLists[key] || {};
    return acc + [...(list.shopping || []), ...(list.todos || [])].filter((i) => !i.done).length;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue d'ensemble</p>
        <h2 className="type-h2">Tous les todos</h2>
        {totalPending > 0 ? (
          <p className="mt-1 text-sm text-slate-600">{totalPending} élément{totalPending > 1 ? "s" : ""} en attente dans toutes les pièces.</p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">Tout est fait — rien en attente.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {[{ key: "all", label: "Tout" }, { key: "todos", label: "À faire" }, { key: "shopping", label: "Courses" }].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${filter === key ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-white"}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setHideDone((v) => !v)}
            className={`ml-auto rounded-lg border px-3 py-1.5 text-sm ${hideDone ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-white"}`}
          >
            {hideDone ? "Afficher terminés" : "Masquer terminés"}
          </button>
        </div>
      </div>
      {orderedActiveRooms.map((key) => {
        const preset = allRoomPresets[key];
        const list = roomLists[key] || {};
        const shoppingItems = filter !== "todos" ? (list.shopping || []) : [];
        const todoItems = filter !== "shopping" ? (list.todos || []) : [];
        const allItems = [...shoppingItems.map((i) => ({ ...i, listKey: "shopping" })), ...todoItems.map((i) => ({ ...i, listKey: "todos" }))];
        const visibleItems = hideDone ? allItems.filter((i) => !i.done) : allItems;
        if (visibleItems.length === 0) return null;
        return (
          <div key={key} className="rounded-xl border border-black/10 bg-white p-4">
            <h3 className="mb-3 font-medium text-slate-900">{preset?.label}</h3>
            <ul className="space-y-1.5">
              {[...visibleItems.filter((i) => !i.done), ...visibleItems.filter((i) => i.done)].map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${item.done ? "border-black/5 bg-white opacity-50" : "border-black/10 bg-white"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(key, item.listKey, item.id)}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${item.done ? "border-slate-300 bg-slate-100 text-slate-500" : "border-black/20 bg-white hover:bg-slate-50"}`}
                  >
                    {item.done ? "✓" : ""}
                  </button>
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.previewTitle || item.text}
                      className="h-10 w-10 shrink-0 rounded-md object-cover border border-black/10"
                    />
                  )}
                  <span className={`min-w-0 flex-1 text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {renderItemText(item.text, item.url)}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{item.listKey === "shopping" ? "courses" : "à faire"}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function renderItemText(text, url) {
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70">
        {text}
      </a>
    );
  }
  const urlRegex = /https?:\/\/[^\s]+/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={match.index} href={match[0]} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70 break-all">
        {match[0]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

function DocumentsSection({ room, roomDocuments, setRoomDocuments, projectId, saveDocFn, deleteDocFn }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const docs = roomDocuments[room] || [];

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await readFileAsDataUrl(file);
        const ext = file.name.split(".").pop() || "bin";
        const filename = `doc-${room}-${Date.now()}.${ext}`;
        const url = await uploadToBlob(dataUrl, filename);
        const doc = {
          id: `doc-${room}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          url,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        };
        setRoomDocuments((prev) => ({
          ...prev,
          [room]: [...(prev[room] || []), doc],
        }));
        if (saveDocFn && projectId) saveDocFn(projectId, room, doc);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeDoc = (id) => {
    setRoomDocuments((prev) => ({
      ...prev,
      [room]: (prev[room] || []).filter((d) => d.id !== id),
    }));
    if (deleteDocFn && projectId) deleteDocFn(projectId, id);
  };

  const docIcon = (type) => {
    if (type?.includes("pdf")) return "📄";
    if (type?.includes("word") || type?.includes("document")) return "📝";
    if (type?.includes("sheet") || type?.includes("excel") || type?.includes("spreadsheet")) return "📊";
    if (type?.startsWith("image/")) return "🖼";
    return "📎";
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="col-span-full rounded-xl border border-black/10 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Documents</p>
          <h3 className="type-h3">Devis & documents</h3>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Envoi…" : "+ Document"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {docs.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">Aucun document pour l'instant.</div>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2">
              {doc.type?.includes("pdf") ? (
                <PdfThumbnail url={doc.url} className="h-12 w-9 shrink-0 rounded" />
              ) : (
                <span className="text-xl leading-none">{docIcon(doc.type)}</span>
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium text-slate-800 hover:underline"
                >
                  {doc.name}
                </a>
                <span className="text-xs text-slate-400">
                  {formatSize(doc.size)}
                  {doc.size && doc.uploadedAt ? " · " : ""}
                  {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString("fr-FR") : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeDoc(doc.id)}
                className="shrink-0 px-1 text-slate-300 hover:text-slate-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListeSection({ room, label, roomLists, setRoomLists, projectId, saveRoomItemsFn }) {
  const [shopInput, setShopInput] = useState("");
  const [todoInput, setTodoInput] = useState("");
  const [linkMode, setLinkMode] = useState({ shopping: false, todos: false });
  const [linkInput, setLinkInput] = useState({ shopping: { label: "", url: "" }, todos: { label: "", url: "" } });

  const list = roomLists[room] || {};
  const shopping = list.shopping || [];
  const todos = list.todos || [];

  const addItem = async (listKey, text, setter) => {
    if (!text.trim()) return;
    const id = `${listKey}-${Date.now()}`;
    const urlMatch = text.trim().match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : null;
    const newItem = { id, text: text.trim(), url: url || undefined, done: false };
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItems = [...currentItems, newItem];
    setRoomLists((prev) => ({
      ...prev,
      [room]: { ...(prev[room] || {}), [listKey]: newItems },
    }));
    setter("");
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
    if (url) {
      try {
        const preview = await fetchLinkPreview(url);
        if (preview.image) {
          setRoomLists((prev) => {
            const updatedItems = ((prev[room] || {})[listKey] || []).map((item) =>
              item.id === id ? { ...item, image: preview.image, previewTitle: preview.title } : item
            );
            if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, updatedItems);
            return { ...prev, [room]: { ...(prev[room] || {}), [listKey]: updatedItems } };
          });
        }
      } catch {
        // pas de preview, pas grave
      }
    }
  };

  const toggleItem = (listKey, id) => {
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItems = currentItems.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
    setRoomLists((prev) => ({
      ...prev,
      [room]: { ...(prev[room] || {}), [listKey]: newItems },
    }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
  };

  const removeItem = (listKey, id) => {
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItems = currentItems.filter((item) => item.id !== id);
    setRoomLists((prev) => ({
      ...prev,
      [room]: { ...(prev[room] || {}), [listKey]: newItems },
    }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
  };

  const addLinkItem = async (listKey) => {
    const { label: lbl, url } = linkInput[listKey];
    if (!lbl.trim() || !url.trim()) return;
    const id = `${listKey}-${Date.now()}`;
    setLinkInput((prev) => ({ ...prev, [listKey]: { label: "", url: "" } }));
    setLinkMode((prev) => ({ ...prev, [listKey]: false }));
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItem = { id, text: lbl.trim(), url: url.trim(), done: false };
    const newItems = [...currentItems, newItem];
    setRoomLists((prev) => ({
      ...prev,
      [room]: { ...(prev[room] || {}), [listKey]: newItems },
    }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
    try {
      const preview = await fetchLinkPreview(url.trim());
      if (preview.image) {
        setRoomLists((prev) => {
          const updatedItems = ((prev[room] || {})[listKey] || []).map((item) =>
            item.id === id ? { ...item, image: preview.image, previewTitle: preview.title } : item
          );
          if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, updatedItems);
          return { ...prev, [room]: { ...(prev[room] || {}), [listKey]: updatedItems } };
        });
      }
    } catch {
      // pas de preview, pas grave
    }
  };

  const renderList = (listKey, items, input, setInput, title, eyebrow, placeholder) => {
    const pending = items.filter((i) => !i.done);
    const done = items.filter((i) => i.done);
    return (
      <div className="space-y-3">
        <div>
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</p>
          <h3 className="type-h3">{title}</h3>
        </div>
        {linkMode[listKey] ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={linkInput[listKey].label}
                onChange={(e) => setLinkInput((prev) => ({ ...prev, [listKey]: { ...prev[listKey], label: e.target.value } }))}
                onKeyDown={(e) => { if (e.key === "Enter") addLinkItem(listKey); }}
                placeholder="Nom du lien…"
                className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm"
              />
              <input
                type="url"
                value={linkInput[listKey].url}
                onChange={(e) => setLinkInput((prev) => ({ ...prev, [listKey]: { ...prev[listKey], url: e.target.value } }))}
                onKeyDown={(e) => { if (e.key === "Enter") addLinkItem(listKey); }}
                placeholder="https://…"
                className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => addLinkItem(listKey)}
                className="shrink-0 rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Ajouter
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLinkMode((prev) => ({ ...prev, [listKey]: false }))}
              className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Texte libre
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(listKey, input, setInput); }}
              placeholder={placeholder}
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setLinkMode((prev) => ({ ...prev, [listKey]: true }))}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-black/15 bg-white text-slate-500 hover:bg-slate-50"
              title="Ajouter un lien avec un nom"
              aria-label="Ajouter un lien avec un nom"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => addItem(listKey, input, setInput)}
              className="shrink-0 rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Ajouter
            </button>
          </div>
        )}
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">Aucun élément pour l'instant.</div>
        ) : (
          <ul className="space-y-1.5">
            {[...pending, ...done].map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${item.done ? "border-black/5 bg-white opacity-50" : "border-black/10 bg-white"}`}
              >
                <button
                  type="button"
                  onClick={() => toggleItem(listKey, item.id)}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${item.done ? "border-slate-300 bg-slate-100 text-slate-500" : "border-black/20 bg-white hover:bg-slate-50"}`}
                >
                  {item.done ? "✓" : ""}
                </button>
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.previewTitle || item.text}
                    className="h-10 w-10 shrink-0 rounded-md object-cover border border-black/10"
                  />
                )}
                <span className={`min-w-0 flex-1 text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{renderItemText(item.text, item.url)}</span>
                <button
                  type="button"
                  onClick={() => removeItem(listKey, item.id)}
                  className="shrink-0 px-1 text-slate-300 hover:text-slate-600"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-xl border border-black/10 bg-white p-4">
        {renderList("shopping", shopping, shopInput, setShopInput, "Liste des courses", label, "Ajouter un article…")}
      </div>
      <div className="rounded-xl border border-black/10 bg-white p-4">
        {renderList("todos", todos, todoInput, setTodoInput, "À faire", "Tâches", "Ajouter une tâche…")}
      </div>
    </div>
  );
}

// ─── Écran de connexion SSO ──────────────────────────────────────────────────

const LOGIN_SLIDES = [
  {
    id: "palette",
    title: "Palette par pièce",
    description: "Coordonnez les couleurs de chaque pièce avec des palettes sur mesure.",
  },
  {
    id: "inspirations",
    title: "Board d'inspirations",
    description: "Rassemblez vos images Pinterest, Instagram et photos en un seul endroit.",
  },
  {
    id: "materiaux",
    title: "Matériaux & surfaces",
    description: "Retrouvez toutes vos références de matières et liens produits.",
  },
  {
    id: "ia",
    title: "Propositions IA",
    description: "L'IA adapte visuellement vos photos à votre palette de couleurs.",
  },
];

function AppMockupContent({ id }) {
  if (id === "palette") {
    return (
      <div className="p-4">
        <div className="mb-3 flex gap-1.5 overflow-hidden">
          {["Salon", "Cuisine", "Bureau", "Entrée", "SdB"].map((tab, i) => (
            <div
              key={tab}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                i === 0 ? "bg-slate-900 text-white" : "border border-black/8 bg-white text-slate-400"
              }`}
            >
              {tab}
            </div>
          ))}
        </div>
        <div className="mb-2.5 rounded-xl border border-black/8 bg-white p-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Palette de couleurs</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: "Bleu clair grisé", hex: "#b8c9d0", shade: "Moyen" },
              { label: "Crème chaud", hex: "#F4F1EA", shade: "Clair" },
              { label: "Chêne clair", hex: "#D0AA6C", shade: "Moyen" },
              { label: "Vert sauge", hex: "#A8B5A2", shade: "Moyen" },
              { label: "Jaune beurre", hex: "#FCF8D5", shade: "Accent" },
              { label: "Olive doux", hex: "#B7C3A5", shade: "Accent" },
            ].map((s) => (
              <div key={s.hex} className="overflow-hidden rounded-lg border border-black/8">
                <div className="h-7" style={{ backgroundColor: s.hex }} />
                <div className="bg-white p-1">
                  <div className="truncate text-[8px] font-medium text-slate-700">{s.label}</div>
                  <div className="text-[7px] text-slate-400">{s.shade}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-black/8 bg-white p-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Note</p>
          <p className="text-[10px] leading-relaxed text-slate-600">
            Salon nord : base claire, bibliothèque colorée, ambiance rétro lumineuse.
          </p>
        </div>
      </div>
    );
  }

  if (id === "inspirations") {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Salon</p>
            <p className="text-sm font-semibold text-slate-900">Inspirations</p>
          </div>
          <div className="flex gap-1">
            {["+ Photo", "+ Lien"].map((label) => (
              <div key={label} className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-500">
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {[
            [
              { h: "h-24", from: "#b8c9d0", to: "#7f9ea8", ai: true },
              { h: "h-16", from: "#F4F1EA", to: "#D8CEC1" },
            ],
            [
              { h: "h-16", from: "#D0AA6C", to: "#B98945" },
              { h: "h-24", from: "#A8B5A2", to: "#5F7463" },
            ],
            [
              { h: "h-20", from: "#FCF8D5", to: "#E8DFD3" },
              { h: "h-20", from: "#C8D1C4", to: "#7A8F7A" },
            ],
          ].map((col, ci) => (
            <div key={ci} className="flex flex-1 flex-col gap-2">
              {col.map((item, ii) => (
                <div
                  key={ii}
                  className={`relative overflow-hidden rounded-xl ${item.h}`}
                  style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
                >
                  {item.ai && (
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[7px] font-medium text-white backdrop-blur-sm">
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                      </svg>
                      IA
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === "materiaux") {
    return (
      <div className="p-4">
        <div className="mb-3">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Cuisine</p>
          <p className="text-sm font-semibold text-slate-900">Matériaux & surfaces</p>
        </div>
        <div className="space-y-2">
          {[
            { label: "Sol", value: "Parquet bois clair", hex: "#D0AA6C" },
            { label: "Crédence", value: "Zellige beige Ivory brillant", hex: "#F4F1EA", link: true },
            { label: "Plan de travail", value: "Chêne clair ou pierre claire", hex: "#B98945" },
            { label: "Textiles", value: "Lin naturel / coton écru", hex: "#E8DFD3" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2.5 rounded-xl border border-black/8 bg-white p-2">
              <div className="h-9 w-9 shrink-0 rounded-lg border border-black/8" style={{ backgroundColor: m.hex }} />
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-400">{m.label}</p>
                <p className="truncate text-[10px] font-medium text-slate-800">{m.value}</p>
              </div>
              {m.link && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-300">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === "ia") {
    return (
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Génération IA</p>
            <p className="text-sm font-semibold text-slate-900">Salon · Inspiration</p>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[9px] font-medium text-slate-400">Original</p>
            <div className="h-28 rounded-xl" style={{ background: "linear-gradient(135deg, #b8c9d0, #7f9ea8)" }} />
          </div>
          <div>
            <p className="mb-1 text-[9px] font-medium text-slate-400">Proposition IA</p>
            <div className="relative h-28 overflow-hidden rounded-xl" style={{ background: "linear-gradient(135deg, #A8B5A2, #5F7463)" }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1 rounded-lg border border-black/8 bg-[#fcf8d5] px-2 py-1.5 text-center text-[9px] font-medium text-slate-700">
            Ajouter aux inspirations
          </div>
          <div className="flex-1 rounded-lg bg-slate-900 px-2 py-1.5 text-center text-[9px] font-medium text-white">
            Remplacer l'image
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function LoginScreen({ onSignIn }) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((p) => (p + 1) % LOGIN_SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#FAF6F0]">
      {/* ── Left: Login form ──────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center p-8 lg:w-[440px] lg:shrink-0 lg:p-14">
        <div className="w-full max-w-[300px]">
          {/* Brand */}
          <div className="mb-10">
            <div className="mb-3 flex items-center gap-2.5">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="15" height="15" rx="3" fill="#b8c9d0"/>
                <rect x="19" y="0" width="15" height="15" rx="3" fill="#A8B5A2"/>
                <rect x="0" y="19" width="15" height="15" rx="3" fill="#D0AA6C"/>
                <rect x="19" y="19" width="15" height="15" rx="3" fill="#FAF6F0" stroke="rgba(0,0,0,0.12)" strokeWidth="1"/>
              </svg>
              <span className="text-[26px] font-bold tracking-[-0.02em] text-slate-900">renoom</span>
            </div>
            <p className="mb-6 text-sm text-slate-400">Co-créez votre intérieur.</p>
            <h1 className="text-[26px] font-semibold leading-snug text-slate-900">
              Votre projet déco,<br />organisé pièce par pièce.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Palette de couleurs, inspirations, matériaux et plans — tout au même endroit.
            </p>
          </div>

          {/* Feature list */}
          <div className="mb-8 space-y-3">
            {[
              {
                svg: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                  </svg>
                ),
                text: "Palette de couleurs par pièce",
              },
              {
                svg: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                  </svg>
                ),
                text: "Propositions IA sur vos photos",
              },
              {
                svg: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                ),
                text: "Inspirations, matériaux & plans",
              },
            ].map(({ svg, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-slate-600">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/10 bg-white text-slate-400 shadow-sm">
                  {svg}
                </div>
                {text}
              </div>
            ))}
          </div>

          {/* Google CTA */}
          <button
            type="button"
            onClick={onSignIn}
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-black/12 bg-white px-5 py-3.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec Google
          </button>
          <p className="mt-4 text-center text-xs text-slate-400">Accès réservé aux membres du projet.</p>
        </div>
      </div>

      {/* ── Right: App mockup (desktop only) ──────────────────── */}
      <div
        className="relative hidden flex-1 flex-col items-center justify-center p-10 lg:flex"
        style={{ background: "linear-gradient(135deg, #1c1814 0%, #241e18 100%)" }}
      >
        {/* App window */}
        <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#faf7f2] shadow-2xl ring-1 ring-white/8">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 border-b border-black/8 bg-[#f2ede6] px-4 py-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-black/15" />
            <div className="h-2.5 w-2.5 rounded-full bg-black/15" />
            <div className="h-2.5 w-2.5 rounded-full bg-black/15" />
            <div className="mx-auto rounded-md bg-black/8 px-8 py-0.5 text-[9px] text-slate-400">renoom.io</div>
          </div>
          {/* Animated slide content */}
          <div className="relative overflow-hidden" style={{ height: 320 }}>
            {LOGIN_SLIDES.map((s, i) => (
              <div
                key={s.id}
                className="absolute inset-0"
                style={{
                  opacity: i === slide ? 1 : 0,
                  transform: i === slide ? "translateX(0)" : i < slide ? "translateX(-8px)" : "translateX(8px)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                  pointerEvents: i === slide ? "auto" : "none",
                }}
              >
                <AppMockupContent id={s.id} />
              </div>
            ))}
          </div>
        </div>

        {/* Caption + indicators */}
        <div className="mt-7 flex w-full max-w-sm items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{LOGIN_SLIDES[slide].title}</p>
            <p className="mt-0.5 max-w-[220px] text-xs leading-relaxed text-white/45">
              {LOGIN_SLIDES[slide].description}
            </p>
          </div>
          <div className="flex gap-1.5 pb-0.5">
            {LOGIN_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={`Voir ${LOGIN_SLIDES[i].title}`}
                className={`cursor-pointer rounded-full transition-all duration-300 ${
                  i === slide ? "h-1.5 w-5 bg-white" : "h-1.5 w-1.5 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Écran rejoindre ou créer un appartement ─────────────────────────────────

function JoinOrCreateScreen({ user, onJoin, onCreateNew, signOut }) {
  const inviteParam = new URLSearchParams(window.location.search).get("invite") || "";
  const [code, setCode] = useState(inviteParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async (overrideCode) => {
    const cleaned = (overrideCode ?? code).trim().toLowerCase();
    if (!cleaned) return;
    setLoading(true);
    setError("");
    try {
      const result = await onJoin(cleaned);
      if (!result?.ok) setError(result?.error || "Code invalide.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inviteParam) handleJoin(inviteParam);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="mb-6 text-center">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-3">Renoom</p>
          <h1 className="text-2xl font-semibold text-slate-900">Quel appartement ?</h1>
          <p className="mt-2 text-sm text-slate-500">Rejoignez un projet existant ou créez le vôtre.</p>
        </div>

        {/* Rejoindre par code */}
        <div className="rounded-xl border border-black/10 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Rejoindre avec un code</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="abc123"
              maxLength={12}
              className="flex-1 rounded-lg border border-black/15 bg-[#fafaf8] px-3 py-2 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
            <button
              onClick={() => handleJoin()}
              disabled={loading || !code.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "…" : "Rejoindre"}
            </button>
          </div>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
        </div>

        {/* Créer un nouveau projet */}
        <div className="rounded-xl border border-black/10 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Nouveau projet</h2>
          <button
            onClick={onCreateNew}
            className="w-full rounded-lg border border-black/15 bg-[#fafaf8] px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            + Créer un appartement vide
          </button>
        </div>

        <button onClick={signOut} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-2">
          Se déconnecter ({user?.email})
        </button>
      </div>
    </div>
  );
}

// ─── Modale point de sauvegarde ──────────────────────────────────────────────

function SnapshotModal({ onConfirm, onCancel, saving }) {
  const defaultLabel = `Sauvegarde du ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  const [label, setLabel] = useState(defaultLabel);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Point de sauvegarde</h2>
        <p className="text-sm text-slate-500 mb-4">Nommez ce point pour le retrouver facilement dans l'historique.</p>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm(label)}
          className="w-full rounded-xl border border-black/15 bg-[#fafaf8] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 mb-4"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(label)}
            disabled={saving || !label.trim()}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Sauvegarde…" : "Créer"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Panneau historique des snapshots ────────────────────────────────────────

function SnapshotHistoryPanel({ snapshots, loading, onRestore, onClose, restoringId }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Historique</h2>
            <p className="text-xs text-slate-400 mt-0.5">10 derniers points de sauvegarde</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-16 text-sm text-slate-400">
              <p className="text-2xl mb-3">📭</p>
              Aucun point de sauvegarde encore créé.
            </div>
          ) : (
            snapshots.map((snap) => (
              <div key={snap.id} className="rounded-xl border border-black/10 bg-[#fafaf8] p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{snap.label || "Sauvegarde"}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(snap.savedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    {snap.authorName ? ` · ${snap.authorName}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onRestore(snap.id)}
                  disabled={restoringId === snap.id}
                  className="shrink-0 rounded-lg border border-black/12 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {restoringId === snap.id ? "…" : "Restaurer"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { user, session, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  // ── État snapshot / historique ────────────────────────────────────────────
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [copyInviteSuccess, setCopyInviteSuccess] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const projectPickerRef = useRef(null);

  // ── Projet ────────────────────────────────────────────────────────────────
  const [room, setRoom] = useState("salon");
  const [globalAccent, setGlobalAccent] = useState("butter");
  const [warmth, setWarmth] = useState(60);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectId, setProjectId] = useState(() => {
    if (new URLSearchParams(window.location.search).get("invite")) return null;
    const urlId = new URLSearchParams(window.location.search).get("p");
    if (urlId) {
      localStorage.setItem(PROJECT_ID_STORAGE_KEY, urlId);
      return urlId;
    }
    return localStorage.getItem(PROJECT_ID_STORAGE_KEY) || null;
  });
  const isApplyingRemoteUpdate = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const roomNoteTimerRef = useRef(null);
  const [isSavingToServer, setIsSavingToServer] = useState(false);
  const [loadingFromUrl, setLoadingFromUrl] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [customRooms, setCustomRooms] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_ROOMS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [hiddenRooms, setHiddenRooms] = useState(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_ROOMS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [lastSavedAt, setLastSavedAt] = useState(() => {
    try {
      return localStorage.getItem(LAST_SAVE_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [uploadedImages, setUploadedImages] = useState(() => {
    try {
      const raw = localStorage.getItem(UPLOAD_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [inspirationLinks, setInspirationLinks] = useState(() => {
    try {
      const raw = localStorage.getItem(LINK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [materialUploads, setMaterialUploads] = useState(() => {
    try {
      const raw = localStorage.getItem(MATERIAL_UPLOAD_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [materialLinks, setMaterialLinks] = useState(() => {
    try {
      const raw = localStorage.getItem(MATERIAL_LINK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [planUploads, setPlanUploads] = useState(() => {
    try {
      const raw = localStorage.getItem(PLAN_UPLOAD_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [planLinks, setPlanLinks] = useState(() => {
    try {
      const raw = localStorage.getItem(PLAN_LINK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [extraPlanImages, setExtraPlanImages] = useState(() => {
    try {
      const raw = localStorage.getItem(PLAN_EXTRA_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [extraMaterialImages, setExtraMaterialImages] = useState(() => {
    try {
      const raw = localStorage.getItem(MATERIAL_EXTRA_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [extraMaterialMeta, setExtraMaterialMeta] = useState(() => {
    try {
      const raw = localStorage.getItem(MATERIAL_META_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [aiInspirations, setAiInspirations] = useState(() => {
    try {
      const raw = localStorage.getItem(AI_INSPIRATIONS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [aiInspirationsLoaded, setAiInspirationsLoaded] = useState(false);
  const [instagramItems, setInstagramItems] = useState(() => {
    try {
      const raw = localStorage.getItem(INSTAGRAM_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [imageAnalysis, setImageAnalysis] = useState(() => {
    try {
      const raw = localStorage.getItem(IMAGE_ANALYSIS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [deletedImages, setDeletedImages] = useState(() => {
    try {
      const raw = localStorage.getItem(DELETED_IMAGES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [roomNuances, setRoomNuances] = useState(() => {
    try {
      const raw = localStorage.getItem(ROOM_NUANCES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : INITIAL_ROOM_NUANCES;
    } catch {
      return INITIAL_ROOM_NUANCES;
    }
  });
  const [roomNotes, setRoomNotes] = useState(() => {
    try {
      const raw = localStorage.getItem(ROOM_NOTES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [viewMode, setViewMode] = useState("room");
  const [roomMode, setRoomMode] = useState("inspirations");
  const [generalMode, setGeneralMode] = useState("todos");
  const lastRoomModeRef = useRef({});

  const handleSetRoomMode = (mode) => {
    lastRoomModeRef.current[room] = mode;
    setRoomMode(mode);
  };
  const [lightbox, setLightbox] = useState(null);
  const [show3D, setShow3D] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatBubbleDismissed, setChatBubbleDismissed] = useState(false);
  const [chatDrafts, setChatDrafts] = useState({});
  const [discussionsCache, setDiscussionsCache] = useState({});
  const [projectMembers, setProjectMembers] = useState([]);
  const [mentionNotifications, setMentionNotifications] = useState([]);
  const [openThread, setOpenThread] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(null);
  const [userProjectCount, setUserProjectCount] = useState(1);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [userProjects, setUserProjects] = useState([]);
  const [renamingProjectId, setRenamingProjectId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(null); // null=detecting, true=show, false=skip
  const [roomLists, setRoomLists] = useState(() => {
    try {
      const raw = localStorage.getItem(ROOM_LISTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [roomDocuments, setRoomDocuments] = useState(() => {
    try {
      const raw = localStorage.getItem(ROOM_DOCUMENTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [roomOrder, setRoomOrder] = useState(() => {
    try {
      const raw = localStorage.getItem(ROOM_ORDER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [draggingRoom, setDraggingRoom] = useState(null);
  const [chatHistory, setChatHistory] = useState({});
  const [generalContext, setGeneralContext] = useState(
    () => localStorage.getItem(GENERAL_CONTEXT_STORAGE_KEY) || ""
  );
  const [generalResources, setGeneralResources] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GENERAL_RESOURCES_STORAGE_KEY) || "[]"); }
    catch { return []; }
  });

  const customRoomPresets = Object.fromEntries(
    customRooms.map((customRoom) => [
      customRoom.key,
      {
        label: customRoom.label,
        dominant: customRoom.dominant || "creme",
        secondary: customRoom.secondary || "bois",
        line: customRoom.line || `${customRoom.label} : base douce, nuances à ajuster selon les inspirations ajoutées.`,
        notes: customRoom.notes || ["Ajoute des images pour construire la direction de cette pièce."],
      },
    ]),
  );
  const allRoomPresets = { ...roomPresets, ...customRoomPresets };
  const activeRooms = [...rooms.filter((key) => !hiddenRooms.includes(key)), ...customRooms.map((customRoom) => customRoom.key)].filter(
    (key) => allRoomPresets[key],
  );
  const orderedActiveRooms = roomOrder
    ? [
        ...roomOrder.filter((key) => activeRooms.includes(key)),
        ...activeRooms.filter((key) => !roomOrder.includes(key)),
      ]
    : activeRooms;

  const handleRoomDrop = (dropKey) => {
    if (!draggingRoom || draggingRoom === dropKey) return;
    const newOrder = [...orderedActiveRooms];
    const fromIndex = newOrder.indexOf(draggingRoom);
    const toIndex = newOrder.indexOf(dropKey);
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggingRoom);
    setRoomOrder(newOrder);
    setDraggingRoom(null);
  };

  const preset = allRoomPresets[room] || allRoomPresets[orderedActiveRooms[0]] || roomPresets.salon;
  const activeNuance = roomNuances[room] || INITIAL_ROOM_NUANCES[room] || { dominant: "moyen", secondary: "moyen", accent: globalAccent };
  const activeDominantColor = activeNuance.dominantColor || preset.dominant;
  const activeSecondaryColor = activeNuance.secondaryColor || preset.secondary;
  const dominantHex = getShade(activeDominantColor, activeNuance.dominant);
  const secondaryHex = getShade(activeSecondaryColor, activeNuance.secondary);
  const accentHex = activeNuance.accent === "bois" ? baseColors.bois.hex : accents[activeNuance.accent]?.hex || accents[globalAccent].hex;
  const accentName = activeNuance.accent === "bois" ? "Chêne clair" : accents[activeNuance.accent]?.name || accents[globalAccent].name;

  const roomPhotosFor3D = [
    ...(materialsByRoom[room] || []).map((m, i) => ({
      url: materialUploads[`${room}-material-${i}`] || m.src,
      label: m.label || `Matériau ${i + 1}`,
    })),
    ...(extraMaterialImages[room] || []).map((entry, i) => ({
      url: typeof entry === "string" ? entry : entry.src,
      label: `Extra ${i + 1}`,
    })),
    ...[0, 1, 2].map((i) => ({ url: uploadedImages[`${room}-${i}`], label: `Inspiration ${i + 1}` })),
    ...(aiInspirations[room] || []).map((url, i) => ({ url, label: `IA ${i + 1}` })),
  ].filter((p) => p.url && !deletedImages[p.url]);

  const previewSecondaryHex = warmth < 40 ? baseColors.bleu.light : warmth > 70 ? baseColors.bois.light : secondaryHex;
  const previewAccentHex = warmth < 40 ? accents.sky.hex : warmth > 70 ? accents.butter.hex : accentHex;
  const roomImageMetadata = Object.entries(imageAnalysis)
    .filter(([key, metadata]) => key.startsWith(`${room}-`) && normalizeImageMetadata(metadata))
    .map(([key, metadata]) => ({
      key,
      kind: key.includes("-plan-") ? "plan" : key.includes("-material-") ? "matériau" : "inspiration",
      metadata,
    }));
  const allRoomsSummary = orderedActiveRooms.map((key) => {
    const p = allRoomPresets[key];
    const nuance = roomNuances[key] || INITIAL_ROOM_NUANCES[key] || {};
    const dHex = getShade(nuance.dominantColor || p?.dominant || "creme", nuance.dominant || "moyen");
    return p ? `${p.label}: ${dHex}` : null;
  }).filter(Boolean).join(" | ");

  const aiShoppingItems = (roomLists[room]?.shopping || [])
    .filter((i) => !i.done).slice(0, 5).map((i) => i.text);

  const aiTodoItems = (roomLists[room]?.todos || [])
    .filter((i) => !i.done).slice(0, 8).map((i) => i.text);

  const aiMaterialSummary = [
    ...(materialsByRoom[room] || []).map((m) => `${m.label}: ${m.value}`),
    ...(extraMaterialImages[room] || []).map((_, i) => {
      const cardKey = `${room}-material-extra-${i}`;
      const meta = extraMaterialMeta[cardKey] || {};
      const surface = meta.category || meta.label;
      return surface || null;
    }).filter(Boolean),
  ];

  const aiContext = {
    roomLabel: preset.label,
    line: preset.line,
    dominantName: baseColors[activeDominantColor].name,
    dominantHex,
    secondaryName: baseColors[activeSecondaryColor].name,
    secondaryHex,
    accentName,
    accentHex,
    roomNote: roomNotes[room] || "",
    roomImageMetadata,
    generalContext: generalContext.slice(0, 400),
    allRoomsSummary,
    shoppingItems: aiShoppingItems,
    todoItems: aiTodoItems,
    materialSummary: aiMaterialSummary,
  };

  const updateRoomNuance = (key, value) => {
    setRoomNuances((prev) => ({ ...prev, [room]: { ...prev[room], [key]: value } }));
  };

  const addRoom = () => {
    const label = window.prompt("Nom de la nouvelle pièce ?");
    if (!label?.trim()) return;

    const key = createUniqueRoomKey(label.trim(), [...rooms, ...customRooms.map((customRoom) => customRoom.key)]);
    const newRoom = {
      key,
      label: label.trim(),
      dominant: "creme",
      secondary: "bois",
      line: `${label.trim()} : base douce, nuances à ajuster selon les inspirations ajoutées.`,
      notes: ["Ajoute des images pour construire la direction de cette pièce."],
    };

    setCustomRooms((prev) => [...prev, newRoom]);
    setRoomNuances((prev) => ({ ...prev, [key]: { dominant: "moyen", secondary: "moyen", accent: globalAccent } }));
    setRoomNotes((prev) => ({ ...prev, [key]: "" }));
    setRoom(key);
    setMobileMenuOpen(false);
  };

  const deleteRoom = () => {
    if (orderedActiveRooms.length <= 1) return;
    const roomLabel = allRoomPresets[room]?.label || "cette pièce";
    if (!window.confirm(`Supprimer ${roomLabel} de l'app ?`)) return;

    const nextRoom = orderedActiveRooms.find((key) => key !== room) || "salon";
    if (rooms.includes(room)) {
      setHiddenRooms((prev) => [...new Set([...prev, room])]);
    } else {
      setCustomRooms((prev) => prev.filter((customRoom) => customRoom.key !== room));
    }

    setUploadedImages((prev) => removeRoomData(prev, room));
    setInspirationLinks((prev) => removeRoomData(prev, room));
    setMaterialUploads((prev) => removeRoomData(prev, room));
    setMaterialLinks((prev) => removeRoomData(prev, room));
    setPlanUploads((prev) => removeRoomData(prev, room));
    setPlanLinks((prev) => removeRoomData(prev, room));
    setExtraPlanImages((prev) => removeRoomData(prev, room));
    setExtraMaterialImages((prev) => removeRoomData(prev, room));
    setAiInspirations((prev) => removeRoomData(prev, room));
    setInstagramItems((prev) => removeRoomData(prev, room));
    setImageAnalysis((prev) => removeRoomData(prev, room));
    setDeletedImages((prev) => removeRoomData(prev, room));
    setRoomNuances((prev) => removeRoomData(prev, room));
    setRoomNotes((prev) => removeRoomData(prev, room));
    setRoomLists((prev) => removeRoomData(prev, room));
    setRoomDocuments((prev) => removeRoomData(prev, room));
    setRoom(nextRoom);
    setMobileMenuOpen(false);
  };

  const addAiInspiration = (targetRoom, image) => {
    setAiInspirations((prev) => ({
      ...prev,
      [targetRoom]: [...(prev[targetRoom] || []), image],
    }));
  };

  const authedFetch = (url, options = {}) => {
    const token = session?.access_token;
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const saveRoomNoteToServer = (pid, roomKey, content) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "note", projectId: pid, roomKey, content }),
    }).catch(() => {});
  };

  const saveRoomDocumentToServer = (pid, roomKey, doc) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "document", projectId: pid, roomKey, document: doc }),
    }).catch(() => {});
  };

  const deleteRoomDocumentFromServer = (pid, documentId) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "document", projectId: pid, documentId }),
    }).catch(() => {});
  };

  const saveChatMessageToServer = (pid, roomKey, message) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat-message", projectId: pid, roomKey, message }),
    }).catch(() => {});
  };

  const saveRoomItemsToServer = (pid, roomKey, listKey, items) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "items", projectId: pid, roomKey, listKey, items }),
    }).catch(() => {});
  };

  const updateDiscussionsCache = (roomKey, discussions) => {
    setDiscussionsCache(prev => ({ ...prev, [roomKey]: discussions }));
  };

  const loadProjectMembers = (pid) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(pid)}&type=members`)
      .then(r => r.json())
      .then(({ members }) => setProjectMembers(members || []))
      .catch(() => {});
  };

  const loadMentionNotifications = (pid) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(pid)}&type=mention-notifications`)
      .then(r => r.json())
      .then(({ notifications }) => setMentionNotifications(notifications || []))
      .catch(() => {});
  };

  const markMentionsRead = (discussionIds) => {
    if (!discussionIds?.length || !projectId) return;
    setMentionNotifications(prev => prev.map(n =>
      discussionIds.includes(n.discussion_id) && !n.read_at
        ? { ...n, read_at: new Date().toISOString() }
        : n
    ));
    authedFetch(`/save-room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-mentions-read', projectId, discussionIds }),
    }).catch(() => {});
  };

  const removeMember = async (userId) => {
    if (!projectId) return;
    try {
      await authedFetch(`${API_BASE}/load-room-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-member", projectId, userId }),
      });
      setConfirmRemoveMember(null);
      loadProjectMembers(projectId);
    } catch {
      // silently ignore
    }
  };

  // snapshot=true uniquement via le bouton "Point de sauvegarde", pas l'auto-save
  const saveProject = async ({ snapshot = false, snapshotLabel = "" } = {}) => {
    const savedAt = new Date().toISOString();
    const projectState = {
      version: 1,
      savedAt,
      room,
      globalAccent,
      warmth,
      customRooms,
      hiddenRooms,
      uploadedImages,
      inspirationLinks,
      materialUploads,
      materialLinks,
      planUploads,
      planLinks,
      extraPlanImages,
      extraMaterialImages,
      extraMaterialMeta,
      aiInspirations,
      instagramItems,
      imageAnalysis,
      deletedImages,
      roomNuances,
      roomNotes,
      roomLists,
      roomDocuments,
      roomOrder,
      generalContext,
      generalResources,
      chatHistory: Object.fromEntries(
        Object.entries(chatHistory).map(([k, msgs]) => [
          k,
          (msgs || []).slice(-CHAT_HISTORY_MAX).map(({ images, image, ...rest }) => rest),
        ])
      ),
    };

    await storeLargeValue(PROJECT_STATE_STORAGE_KEY, projectState);
    safelyStore(CUSTOM_ROOMS_STORAGE_KEY, customRooms);
    safelyStore(HIDDEN_ROOMS_STORAGE_KEY, hiddenRooms);
    safelyStore(UPLOAD_STORAGE_KEY, uploadedImages);
    safelyStore(LINK_STORAGE_KEY, inspirationLinks);
    safelyStore(MATERIAL_UPLOAD_STORAGE_KEY, materialUploads);
    safelyStore(MATERIAL_LINK_STORAGE_KEY, materialLinks);
    safelyStore(ROOM_NUANCES_STORAGE_KEY, roomNuances);
    safelyStore(ROOM_NOTES_STORAGE_KEY, roomNotes);
    safelyStore(PLAN_UPLOAD_STORAGE_KEY, planUploads);
    safelyStore(PLAN_LINK_STORAGE_KEY, planLinks);
    safelyStore(PLAN_EXTRA_STORAGE_KEY, extraPlanImages);
    safelyStore(MATERIAL_EXTRA_STORAGE_KEY, extraMaterialImages);
    safelyStore(IMAGE_ANALYSIS_STORAGE_KEY, imageAnalysis);
    safelyStore(DELETED_IMAGES_STORAGE_KEY, deletedImages);
    safelyStore(INSTAGRAM_STORAGE_KEY, instagramItems);
    localStorage.setItem(LAST_SAVE_STORAGE_KEY, savedAt);
    setLastSavedAt(savedAt);

    try {
      setIsSavingToServer(true);
      const existingId = projectId || localStorage.getItem(PROJECT_ID_STORAGE_KEY);
      const res = await authedFetch(`${API_BASE}/save-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: projectState, id: existingId, snapshot, snapshotLabel }),
      });
      const { id } = await res.json();
      const savedProjectId = id || existingId;
      if (id) {
        setProjectId(id);
        localStorage.setItem(PROJECT_ID_STORAGE_KEY, id);
      }
      // Dual-write : synchro room_items dans la table normalisée
      if (savedProjectId) {
        for (const [rk, lists] of Object.entries(roomLists)) {
          for (const [lk, items] of Object.entries(lists)) {
            if (Array.isArray(items)) saveRoomItemsToServer(savedProjectId, rk, lk, items);
          }
        }
      }
    } catch {
      // local save already succeeded
    } finally {
      setIsSavingToServer(false);
    }
  };

  const hydrateState = (saved) => {
    // Scalaires projet — priorité projectConfig (load-project normalisé) puis blob (snapshot restore / localStorage)
    const cfg = saved.projectConfig || saved;
    if (cfg.room) setRoom(cfg.room);
    if (cfg.globalAccent) setGlobalAccent(cfg.globalAccent);
    if (typeof cfg.warmth === "number") setWarmth(cfg.warmth);
    if (Array.isArray(cfg.customRooms)) setCustomRooms(cfg.customRooms);
    if (Array.isArray(cfg.hiddenRooms)) setHiddenRooms(cfg.hiddenRooms);
    if (cfg.roomOrder) setRoomOrder(cfg.roomOrder);
    if (typeof cfg.generalContext === "string") setGeneralContext(cfg.generalContext);
    if (Array.isArray(cfg.generalResources)) setGeneralResources(cfg.generalResources);
    if (cfg.savedAt) setLastSavedAt(cfg.savedAt);

    // Médias — source normalisée (room_media) ou blob (snapshot restore)
    const media = saved.roomMediaNormalized || saved;
    if (media.uploadedImages      && Object.keys(media.uploadedImages).length)      setUploadedImages(media.uploadedImages);
    if (media.inspirationLinks    && Object.keys(media.inspirationLinks).length)    setInspirationLinks(media.inspirationLinks);
    if (media.materialUploads     && Object.keys(media.materialUploads).length)     setMaterialUploads(media.materialUploads);
    if (media.materialLinks       && Object.keys(media.materialLinks).length)       setMaterialLinks(media.materialLinks);
    if (media.planUploads         && Object.keys(media.planUploads).length)         setPlanUploads(media.planUploads);
    if (media.planLinks           && Object.keys(media.planLinks).length)           setPlanLinks(media.planLinks);
    if (media.extraPlanImages     && Object.keys(media.extraPlanImages).length)     setExtraPlanImages(media.extraPlanImages);
    if (media.extraMaterialImages && Object.keys(media.extraMaterialImages).length) setExtraMaterialImages(media.extraMaterialImages);
    if (media.extraMaterialMeta   && Object.keys(media.extraMaterialMeta).length)   setExtraMaterialMeta(media.extraMaterialMeta);
    if (media.aiInspirations      && Object.keys(media.aiInspirations).length)      setAiInspirations(media.aiInspirations);
    if (media.instagramItems      && Object.keys(media.instagramItems).length)      setInstagramItems(media.instagramItems);
    if (media.imageAnalysis       && Object.keys(media.imageAnalysis).length)       setImageAnalysis(media.imageAnalysis);
    if (media.deletedImages       && Object.keys(media.deletedImages).length)       setDeletedImages(media.deletedImages);

    // Nuances — source normalisée ou blob (snapshot)
    if (saved.roomNuancesNormalized) setRoomNuances(saved.roomNuancesNormalized);
    else if (saved.roomNuances) setRoomNuances(saved.roomNuances);

    // Notes — source normalisée ou blob (snapshot)
    if (saved.roomNotesNormalized) setRoomNotes(saved.roomNotesNormalized);
    else if (saved.roomNotes) setRoomNotes(saved.roomNotes);

    // Listes (todos + shopping) — source normalisée ou blob (snapshot)
    if (Array.isArray(saved.roomItems) && saved.roomItems.length > 0) {
      const built = {};
      for (const item of saved.roomItems) {
        if (!built[item.room_key]) built[item.room_key] = {};
        if (!built[item.room_key][item.list_key]) built[item.room_key][item.list_key] = [];
        built[item.room_key][item.list_key].push({
          id: item.id,
          text: item.text,
          done: item.done,
          url: item.url || undefined,
          image: item.image || undefined,
          previewTitle: item.preview_title || undefined,
        });
      }
      setRoomLists(built);
    } else if (saved.roomLists) {
      setRoomLists(saved.roomLists);
    }

    // Documents — source normalisée ou blob (snapshot)
    if (saved.roomDocumentsNormalized) setRoomDocuments(saved.roomDocumentsNormalized);
    else if (saved.roomDocuments) setRoomDocuments(saved.roomDocuments);

    // Chat — source normalisée ou blob (snapshot)
    if (Array.isArray(saved.chatMessages) && saved.chatMessages.length > 0) {
      const built = {};
      for (const m of saved.chatMessages) {
        if (!built[m.roomKey]) built[m.roomKey] = [];
        built[m.roomKey].push({ id: m.id, role: m.role, content: m.content, imagePrompt: m.imagePrompt, error: m.error });
      }
      setChatHistory(built);
    } else if (saved.chatHistory && typeof saved.chatHistory === "object") {
      setChatHistory(saved.chatHistory);
    }
  };

  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get("p");
    const idToLoad = urlId || projectId;
    if (!idToLoad || !session) return;
    setLoadingFromUrl(true);
    authedFetch(`${API_BASE}/load-project?id=${encodeURIComponent(idToLoad)}&t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(({ projectConfig, isOwner: owner, inviteCode: code, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomMediaNormalized }) => {
        if (projectConfig) {
          hydrateState({ projectConfig, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomMediaNormalized });
          setProjectId(idToLoad);
          localStorage.setItem(PROJECT_ID_STORAGE_KEY, idToLoad);
        }
        if (typeof owner === "boolean") setIsOwner(owner);
        if (code) setInviteCode(code);
      })
      .catch(() => {})
      .finally(() => setLoadingFromUrl(false));
  }, [session]);

  // Charger la liste des snapshots quand le panneau s'ouvre
  useEffect(() => {
    if (!showSnapshotHistory || !projectId || !session) return;
    setLoadingSnapshots(true);
    authedFetch(`${API_BASE}/list-snapshots?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then(({ snapshots: list }) => setSnapshots(list || []))
      .catch(() => {})
      .finally(() => setLoadingSnapshots(false));
  }, [showSnapshotHistory]);

  const handleRestoreSnapshot = async (snapshotId) => {
    if (!window.confirm("Restaurer ce point ? Les changements non-sauvegardés seront perdus.")) return;
    setRestoringSnapshotId(snapshotId);
    try {
      const res = await authedFetch(`${API_BASE}/restore-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, snapshotId }),
      });
      const { state } = await res.json();
      if (state) {
        hydrateState(state);
        setShowSnapshotHistory(false);
      }
    } catch {
      // ignore
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  const switchProject = (id) => {
    [
      UPLOAD_STORAGE_KEY, LINK_STORAGE_KEY, MATERIAL_UPLOAD_STORAGE_KEY,
      MATERIAL_LINK_STORAGE_KEY, PLAN_UPLOAD_STORAGE_KEY, PLAN_LINK_STORAGE_KEY,
      PLAN_EXTRA_STORAGE_KEY, MATERIAL_EXTRA_STORAGE_KEY, MATERIAL_META_STORAGE_KEY,
      AI_INSPIRATIONS_STORAGE_KEY, IMAGE_ANALYSIS_STORAGE_KEY, DELETED_IMAGES_STORAGE_KEY,
      INSTAGRAM_STORAGE_KEY, ROOM_LISTS_STORAGE_KEY, ROOM_DOCUMENTS_STORAGE_KEY,
      ROOM_NUANCES_STORAGE_KEY, ROOM_NOTES_STORAGE_KEY, PROJECT_STATE_STORAGE_KEY,
      HIDDEN_ROOMS_STORAGE_KEY, CUSTOM_ROOMS_STORAGE_KEY,
    ].forEach(k => localStorage.removeItem(k));
    setUploadedImages({});
    setInspirationLinks({});
    setMaterialUploads({});
    setMaterialLinks({});
    setPlanUploads({});
    setPlanLinks({});
    setExtraPlanImages({});
    setExtraMaterialImages({});
    setExtraMaterialMeta({});
    setAiInspirations({});
    setInstagramItems({});
    setImageAnalysis({});
    setDeletedImages({});
    setRoomNuances({});
    setRoomNotes({});
    setRoomLists({});
    setRoomDocuments({});
    setHiddenRooms([]);
    setCustomRooms([]);
    setProjectId(id);
    localStorage.setItem(PROJECT_ID_STORAGE_KEY, id);
    window.history.replaceState({}, "", `/?p=${id}`);
    setShowProjectPicker(false);
    setLoadingFromUrl(true);
    authedFetch(`${API_BASE}/load-project?id=${encodeURIComponent(id)}&t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(({ projectConfig, isOwner: owner, inviteCode: code, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomMediaNormalized }) => {
        if (projectConfig) hydrateState({ projectConfig, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomMediaNormalized });
        if (typeof owner === "boolean") setIsOwner(owner);
        if (code) setInviteCode(code);
      })
      .catch(() => {})
      .finally(() => setLoadingFromUrl(false));
  };

  const handleCreateSnapshot = async (label) => {
    setIsSavingSnapshot(true);
    await saveProject({ snapshot: true, snapshotLabel: label });
    setIsSavingSnapshot(false);
    setShowSnapshotModal(false);
  };

  const handleJoinProject = async (inviteCode) => {
    const res = await authedFetch(`${API_BASE}/join-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    if (data.projectId) {
      setProjectId(data.projectId);
      localStorage.setItem(PROJECT_ID_STORAGE_KEY, data.projectId);
      window.history.replaceState({}, "", `/?p=${data.projectId}`);
      // Charger le projet
      const loaded = await authedFetch(`${API_BASE}/load-project?id=${data.projectId}`).then((r) => r.json());
      if (loaded.state) {
        hydrateState(loaded.roomItems?.length ? { ...loaded.state, roomItems: loaded.roomItems } : loaded.state);
        if (typeof loaded.isOwner === "boolean") setIsOwner(loaded.isOwner);
        if (loaded.inviteCode) setInviteCode(loaded.inviteCode);
      }
    }
    return { ok: true, projectId: data.projectId };
  };

  // Realtime subscription — receive updates from other users on the same project
  useEffect(() => {
    if (!projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
        () => {
          if (isApplyingRemoteUpdate.current) return;
          isApplyingRemoteUpdate.current = true;
          authedFetch(`${API_BASE}/load-project?id=${encodeURIComponent(projectId)}&t=${Date.now()}`, { cache: "no-store" })
            .then((r) => r.json())
            .then(({ projectConfig, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomMediaNormalized }) => {
              if (projectConfig) {
                hydrateState({ projectConfig, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomMediaNormalized });
              }
            })
            .catch(() => {})
            .finally(() => { setTimeout(() => { isApplyingRemoteUpdate.current = false; }, 200); });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime room_items — sync granulaire des todos/shopping entre utilisateurs
  useEffect(() => {
    if (!projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    let reloadTimer;
    const roomItemsChannel = supabase
      .channel(`room-items-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_items", filter: `project_id=eq.${projectId}` },
        () => {
          // Debounce : un seul rechargement même si plusieurs events arrivent en rafale (ex: delete+insert)
          clearTimeout(reloadTimer);
          reloadTimer = setTimeout(() => {
            if (isApplyingRemoteUpdate.current) return;
            authedFetch(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(projectId)}`)
              .then((r) => r.json())
              .then(({ items }) => {
                if (!Array.isArray(items) || items.length === 0) return;
                isApplyingRemoteUpdate.current = true;
                hydrateState({ roomItems: items });
                setTimeout(() => { isApplyingRemoteUpdate.current = false; }, 200);
              })
              .catch(() => {});
          }, 300);
        }
      )
      .subscribe();
    return () => {
      clearTimeout(reloadTimer);
      supabase.removeChannel(roomItemsChannel);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime discussions — notifie les membres des nouveaux fils et statuts
  useEffect(() => {
    if (!projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    let reloadTimer;
    const discussionsChannel = supabase
      .channel(`discussions-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discussions", filter: `project_id=eq.${projectId}` },
        () => {
          clearTimeout(reloadTimer);
          reloadTimer = setTimeout(() => {
            setDiscussionsCache(cache => {
              Object.keys(cache).forEach(roomKey => {
                authedFetch(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(projectId)}&type=discussions&roomKey=${encodeURIComponent(roomKey)}`)
                  .then(r => r.json())
                  .then(({ discussions }) => setDiscussionsCache(prev => ({ ...prev, [roomKey]: discussions || [] })))
                  .catch(() => {});
              });
              return cache;
            });
          }, 300);
        }
      )
      .subscribe();
    return () => {
      clearTimeout(reloadTimer);
      supabase.removeChannel(discussionsChannel);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger le nombre de projets de l'utilisateur (pour le project switcher)
  useEffect(() => {
    if (!user?.id || !import.meta.env.VITE_SUPABASE_URL) return;
    supabase.from("project_members").select("project_id", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => { if (count !== null) setUserProjectCount(count); });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserProjects = async () => {
    if (!user?.id || !import.meta.env.VITE_SUPABASE_URL) return;
    const { data } = await supabase
      .from("project_members")
      .select("project_id, role, projects(id, name)")
      .eq("user_id", user.id);
    if (data) setUserProjects(data.map(r => ({ id: r.projects.id, name: r.projects.name, role: r.role })));
  };

  // Détecter si l'utilisateur est nouveau (pas encore de projets) → afficher l'onboarding
  useEffect(() => {
    if (!user?.id || projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    supabase.from("project_members").select("project_id", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setShowOnboarding(count === 0));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les membres du projet pour les @mentions
  useEffect(() => {
    if (projectId && user) loadProjectMembers(projectId);
  }, [projectId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les notifications de mention
  useEffect(() => {
    if (projectId && user) loadMentionNotifications(projectId);
  }, [projectId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Demander la permission pour les notifications desktop (une seule fois)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime — nouvelles mentions pour l'utilisateur courant
  useEffect(() => {
    if (!projectId || !user?.id || !import.meta.env.VITE_SUPABASE_URL) return;
    const channel = supabase
      .channel(`mentions-${projectId}-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mention_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setMentionNotifications(prev => [payload.new, ...prev]);
          if (document.visibilityState !== 'visible' && Notification.permission === 'granted') {
            const notif = new Notification('Vous avez été mentionné', {
              body: 'Quelqu\'un vous a tagué dans une discussion.',
              icon: '/vite.svg',
              tag: `mention-${payload.new.id}`,
            });
            notif.onclick = () => { window.focus(); notif.close(); };
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [projectId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save debounce — silently push changes to Supabase for real-time sharing
  useEffect(() => {
    if (!projectId || isApplyingRemoteUpdate.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { saveProject(); }, 5000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    projectId, room, globalAccent, warmth, customRooms, hiddenRooms,
    uploadedImages, inspirationLinks, materialUploads, materialLinks,
    planUploads, planLinks, extraPlanImages, extraMaterialImages, extraMaterialMeta,
    aiInspirations, instagramItems, imageAnalysis, deletedImages,
    roomNuances, roomNotes, roomLists, roomDocuments, roomOrder,
    generalContext, generalResources, chatHistory,
  ]);

  useEffect(() => {
    let isMounted = true;
    readLargeValue(AI_INSPIRATIONS_STORAGE_KEY)
      .then((stored) => {
        if (isMounted && stored) setAiInspirations(stored);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setAiInspirationsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("p")) return;
    let isMounted = true;
    readLargeValue(PROJECT_STATE_STORAGE_KEY)
      .then((saved) => {
        if (!isMounted || !saved) return;
        if (saved.room) setRoom(saved.room);
        if (saved.globalAccent) setGlobalAccent(saved.globalAccent);
        if (typeof saved.warmth === "number") setWarmth(saved.warmth);
        if (Array.isArray(saved.customRooms)) setCustomRooms(saved.customRooms);
        if (Array.isArray(saved.hiddenRooms)) setHiddenRooms(saved.hiddenRooms);
        // For image states: prefer localStorage (loaded by useState) if it already has data,
        // since auto-sync effects keep it more current than IndexedDB (only updated on explicit save).
        if (saved.uploadedImages) setUploadedImages(prev => Object.keys(prev).length ? { ...saved.uploadedImages, ...prev } : saved.uploadedImages);
        if (saved.inspirationLinks) setInspirationLinks(saved.inspirationLinks);
        if (saved.materialUploads) setMaterialUploads(prev => Object.keys(prev).length ? { ...saved.materialUploads, ...prev } : saved.materialUploads);
        if (saved.materialLinks) setMaterialLinks(saved.materialLinks);
        if (saved.planUploads) setPlanUploads(prev => Object.keys(prev).length ? { ...saved.planUploads, ...prev } : saved.planUploads);
        if (saved.planLinks) setPlanLinks(saved.planLinks);
        if (saved.extraPlanImages) setExtraPlanImages(prev => Object.keys(prev).length ? { ...saved.extraPlanImages, ...prev } : saved.extraPlanImages);
        if (saved.extraMaterialImages) setExtraMaterialImages(prev => Object.keys(prev).length ? { ...saved.extraMaterialImages, ...prev } : saved.extraMaterialImages);
        if (saved.extraMaterialMeta) setExtraMaterialMeta(prev => Object.keys(prev).length ? { ...saved.extraMaterialMeta, ...prev } : saved.extraMaterialMeta);
        if (saved.aiInspirations) setAiInspirations(prev => Object.keys(prev).length ? { ...saved.aiInspirations, ...prev } : saved.aiInspirations);
        if (saved.imageAnalysis) setImageAnalysis(prev => Object.keys(prev).length ? { ...saved.imageAnalysis, ...prev } : saved.imageAnalysis);
        if (saved.deletedImages) setDeletedImages(saved.deletedImages);
        if (saved.roomNuances) setRoomNuances(saved.roomNuances);
        if (saved.roomNotes) setRoomNotes(saved.roomNotes);
        if (saved.roomLists) setRoomLists(saved.roomLists);
        if (saved.roomDocuments) setRoomDocuments(prev => Object.keys(prev).length ? { ...saved.roomDocuments, ...prev } : saved.roomDocuments);
        if (saved.roomOrder) setRoomOrder(saved.roomOrder);
        if (saved.savedAt) setLastSavedAt(saved.savedAt);
        if (typeof saved.generalContext === "string") setGeneralContext(saved.generalContext);
        if (Array.isArray(saved.generalResources)) setGeneralResources(saved.generalResources);
        if (saved.chatHistory && typeof saved.chatHistory === "object") setChatHistory(saved.chatHistory);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (orderedActiveRooms.length && !orderedActiveRooms.includes(room)) {
      setRoom(orderedActiveRooms[0]);
    }
  }, [orderedActiveRooms, room]);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  useEffect(() => {
    if (!showProjectPicker) return;
    const handler = (e) => {
      if (projectPickerRef.current && !projectPickerRef.current.contains(e.target)) setShowProjectPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProjectPicker]);

  useEffect(() => {
    safelyStore(CUSTOM_ROOMS_STORAGE_KEY, customRooms);
  }, [customRooms]);

  useEffect(() => {
    safelyStore(HIDDEN_ROOMS_STORAGE_KEY, hiddenRooms);
  }, [hiddenRooms]);

  useEffect(() => {
    safelyStore(UPLOAD_STORAGE_KEY, uploadedImages);
  }, [uploadedImages]);

  useEffect(() => {
    safelyStore(LINK_STORAGE_KEY, inspirationLinks);
  }, [inspirationLinks]);

  useEffect(() => {
    safelyStore(MATERIAL_UPLOAD_STORAGE_KEY, materialUploads);
  }, [materialUploads]);

  useEffect(() => {
    safelyStore(MATERIAL_LINK_STORAGE_KEY, materialLinks);
  }, [materialLinks]);

  useEffect(() => {
    safelyStore(ROOM_NUANCES_STORAGE_KEY, roomNuances);
  }, [roomNuances]);

  useEffect(() => {
    safelyStore(ROOM_NOTES_STORAGE_KEY, roomNotes);
  }, [roomNotes]);

  useEffect(() => {
    safelyStore(PLAN_UPLOAD_STORAGE_KEY, planUploads);
  }, [planUploads]);

  useEffect(() => {
    safelyStore(PLAN_LINK_STORAGE_KEY, planLinks);
  }, [planLinks]);

  useEffect(() => {
    safelyStore(PLAN_EXTRA_STORAGE_KEY, extraPlanImages);
  }, [extraPlanImages]);

  useEffect(() => {
    safelyStore(MATERIAL_EXTRA_STORAGE_KEY, extraMaterialImages);
  }, [extraMaterialImages]);

  useEffect(() => {
    safelyStore(MATERIAL_META_STORAGE_KEY, extraMaterialMeta);
  }, [extraMaterialMeta]);

  useEffect(() => {
    if (!aiInspirationsLoaded) return;
    storeLargeValue(AI_INSPIRATIONS_STORAGE_KEY, aiInspirations).catch(() => {
      safelyStore(AI_INSPIRATIONS_STORAGE_KEY, aiInspirations);
    });
  }, [aiInspirations, aiInspirationsLoaded]);

  useEffect(() => {
    safelyStore(IMAGE_ANALYSIS_STORAGE_KEY, imageAnalysis);
  }, [imageAnalysis]);

  useEffect(() => {
    safelyStore(DELETED_IMAGES_STORAGE_KEY, deletedImages);
  }, [deletedImages]);

  useEffect(() => {
    safelyStore(INSTAGRAM_STORAGE_KEY, instagramItems);
  }, [instagramItems]);

  useEffect(() => {
    safelyStore(ROOM_LISTS_STORAGE_KEY, roomLists);
  }, [roomLists]);

  useEffect(() => {
    safelyStore(ROOM_DOCUMENTS_STORAGE_KEY, roomDocuments);
  }, [roomDocuments]);

  useEffect(() => {
    if (roomOrder) safelyStore(ROOM_ORDER_STORAGE_KEY, roomOrder);
  }, [roomOrder]);

  useEffect(() => {
    try { localStorage.setItem(GENERAL_CONTEXT_STORAGE_KEY, generalContext); } catch {}
  }, [generalContext]);

  useEffect(() => {
    safelyStore(GENERAL_RESOURCES_STORAGE_KEY, generalResources);
  }, [generalResources]);

  useEffect(() => {
    setRoomMode(lastRoomModeRef.current[room] || "inspirations");
  }, [room]);

  const getRoomColors = (roomKey) => {
    const p = allRoomPresets[roomKey];
    if (!p) return null;
    const nuance = roomNuances[roomKey] || INITIAL_ROOM_NUANCES[roomKey] || { dominant: "moyen", secondary: "moyen", accent: globalAccent };
    const dColor = nuance.dominantColor || p.dominant;
    const sColor = nuance.secondaryColor || p.secondary;
    const dHex = getShade(dColor, nuance.dominant);
    const sHex = getShade(sColor, nuance.secondary);
    const aHex = nuance.accent === "bois" ? baseColors.bois.hex : accents[nuance.accent]?.hex || accents[globalAccent].hex;
    const aName = nuance.accent === "bois" ? "Chêne clair" : accents[nuance.accent]?.name || accents[globalAccent].name;
    return { dominant: { name: baseColors[dColor].name, hex: dHex }, secondary: { name: baseColors[sColor].name, hex: sHex }, accent: { name: aName, hex: aHex } };
  };

  const roomPendingCount = (key) => {
    const list = roomLists[key] || {};
    return [...(list.shopping || []), ...(list.todos || [])].filter((item) => !item.done).length;
  };

  // ── Guards auth ──────────────────────────────────────────────────────────
  if (authLoading) return <div className="min-h-screen bg-[#FAF6F0]" />;
  if (!user) return <LoginScreen onSignIn={signInWithGoogle} />;
  if (!projectId) {
    if (showOnboarding === null) return <div className="min-h-screen bg-[#FAF6F0]" />;
    if (showOnboarding) {
      return (
        <OnboardingWizard
          user={user}
          session={session}
          onComplete={(id) => {
            // Vider l'état et le localStorage pour ne pas polluer le nouveau projet
            [
              UPLOAD_STORAGE_KEY, LINK_STORAGE_KEY, MATERIAL_UPLOAD_STORAGE_KEY,
              MATERIAL_LINK_STORAGE_KEY, PLAN_UPLOAD_STORAGE_KEY, PLAN_LINK_STORAGE_KEY,
              PLAN_EXTRA_STORAGE_KEY, MATERIAL_EXTRA_STORAGE_KEY, MATERIAL_META_STORAGE_KEY,
              AI_INSPIRATIONS_STORAGE_KEY, IMAGE_ANALYSIS_STORAGE_KEY, DELETED_IMAGES_STORAGE_KEY,
              INSTAGRAM_STORAGE_KEY, ROOM_LISTS_STORAGE_KEY, ROOM_DOCUMENTS_STORAGE_KEY,
              ROOM_NUANCES_STORAGE_KEY, ROOM_NOTES_STORAGE_KEY, PROJECT_STATE_STORAGE_KEY,
              HIDDEN_ROOMS_STORAGE_KEY, CUSTOM_ROOMS_STORAGE_KEY,
            ].forEach(k => localStorage.removeItem(k));
            setUploadedImages({});
            setInspirationLinks({});
            setMaterialUploads({});
            setMaterialLinks({});
            setPlanUploads({});
            setPlanLinks({});
            setExtraPlanImages({});
            setExtraMaterialImages({});
            setExtraMaterialMeta({});
            setAiInspirations({});
            setInstagramItems({});
            setImageAnalysis({});
            setDeletedImages({});
            setRoomNuances({});
            setRoomNotes({});
            setRoomLists({});
            setRoomDocuments({});
            setHiddenRooms([]);
            setCustomRooms([]);
            setProjectId(id);
            localStorage.setItem(PROJECT_ID_STORAGE_KEY, id);
            window.history.replaceState({}, "", `/?p=${id}`);
            setShowOnboarding(false);
          }}
          onJoinProject={handleJoinProject}
          onSkip={() => setShowOnboarding(false)}
          signOut={signOut}
        />
      );
    }
    return (
      <JoinOrCreateScreen
        user={user}
        onJoin={handleJoinProject}
        onCreateNew={() => saveProject()}
        signOut={signOut}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F1EA] text-slate-800">
      {/* Modales */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowMembersModal(false); setConfirmRemoveMember(null); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
              <h2 className="text-sm font-semibold text-slate-800">Membres de l'espace</h2>
              <button onClick={() => { setShowMembersModal(false); setConfirmRemoveMember(null); }} className="text-slate-400 hover:text-slate-700 text-lg leading-none">×</button>
            </div>
            <ul className="divide-y divide-black/6 max-h-80 overflow-y-auto">
              {projectMembers.map(member => (
                <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                  {member.avatar ? (
                    <img src={member.avatar} alt="" className="h-8 w-8 rounded-full border border-black/10 shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                      {(member.name || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{member.name || "Utilisateur"}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{member.role}</p>
                  </div>
                  {member.role !== "owner" && (
                    confirmRemoveMember === member.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => removeMember(member.id)} className="text-[11px] font-medium text-red-600 hover:text-red-700">Confirmer</button>
                        <button onClick={() => setConfirmRemoveMember(null)} className="text-[11px] text-slate-400 hover:text-slate-600">Annuler</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmRemoveMember(member.id)} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Retirer ce membre">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )
                  )}
                </li>
              ))}
              {projectMembers.length === 0 && (
                <li className="px-5 py-6 text-center text-sm text-slate-400">Aucun membre</li>
              )}
            </ul>
          </div>
        </div>
      )}
      {showSnapshotModal && (
        <SnapshotModal
          onConfirm={handleCreateSnapshot}
          onCancel={() => setShowSnapshotModal(false)}
          saving={isSavingSnapshot}
        />
      )}
      {showSnapshotHistory && (
        <SnapshotHistoryPanel
          snapshots={snapshots}
          loading={loadingSnapshots}
          onRestore={handleRestoreSnapshot}
          onClose={() => setShowSnapshotHistory(false)}
          restoringId={restoringSnapshotId}
        />
      )}
      {loadingFromUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="rounded-xl border border-black/10 bg-white p-8 text-center shadow-lg">
            <p className="text-lg font-medium">Chargement du projet partagé…</p>
            <p className="mt-1 text-sm text-slate-500">Quelques secondes</p>
          </div>
        </div>
      ) : null}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-30 flex h-full w-60 flex-shrink-0 flex-col border-r border-black/[0.08] bg-[#F9F7F3] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-black/[0.08] bg-[#F2EFE7] px-3.5">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <rect x="0" y="0" width="9.5" height="9.5" rx="2" fill="#b8c9d0"/>
            <rect x="12.5" y="0" width="9.5" height="9.5" rx="2" fill="#A8B5A2"/>
            <rect x="0" y="12.5" width="9.5" height="9.5" rx="2" fill="#D0AA6C"/>
            <rect x="12.5" y="12.5" width="9.5" height="9.5" rx="2" fill="#FAF6F0" stroke="rgba(0,0,0,0.12)" strokeWidth="0.75"/>
          </svg>
          <span className="text-[15px] font-bold tracking-[-0.02em] text-[#1C1A17]">renoom</span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2.5">
          <div className="mb-5">
            <span className="mb-1 block px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7A7773]">
              Vue générale
            </span>
            {(() => {
              const tPending = orderedActiveRooms.reduce((acc, k) => {
                const l = roomLists[k] || {};
                return acc + [...(l.shopping || []), ...(l.todos || [])].filter((i) => !i.done).length;
              }, 0);
              const tUnread = ["general", ...orderedActiveRooms].reduce(
                (acc, k) => acc + (discussionsCache[k] || []).reduce((s, d) => s + (d.unread_count || 0), 0),
                0
              );
              const tDocs = orderedActiveRooms.reduce((acc, k) => acc + (roomDocuments[k] || []).length, 0);
              const tMention = (mentionNotifications || []).filter((n) => !n.read_at).length;
              return [
                { key: "todos", label: "Todos", badge: tPending, mention: 0 },
                { key: "couleurs", label: "Couleurs", badge: 0, mention: 0 },
                { key: "discussions", label: "Discussions", badge: tUnread, mention: tMention },
                { key: "ressources", label: "Ressources", badge: tDocs, mention: 0 },
              ].map(({ key, label, badge, mention }) => {
                const active = viewMode === "general" && generalMode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setViewMode("general");
                      setGeneralMode(key);
                      setSidebarOpen(false);
                    }}
                    className={`group relative flex w-full items-center gap-1.5 rounded-md px-2 py-[6px] text-left text-[13px] transition-colors ${
                      active
                        ? "bg-black/[0.05] font-medium text-[#1C1A17]"
                        : "text-[#4D4A47] hover:bg-black/[0.04] hover:text-[#1C1A17]"
                    }`}
                  >
                    {active && (
                      <span className="absolute -left-2 bottom-1 top-1 w-[2.5px] rounded-r bg-[#CDAA73]" />
                    )}
                    <span className="flex-1 truncate">{label}</span>
                    {mention > 0 ? (
                      <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#CDAA73] px-1 text-[10px] font-bold text-white">
                        {mention}
                      </span>
                    ) : badge > 0 ? (
                      <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#EDE9E0] px-1 text-[10px] font-semibold text-[#8A8580]">
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              });
            })()}
          </div>
          <div>
            <span className="mb-1 block px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7A7773]">
              Pièces
            </span>
            {orderedActiveRooms.map((key) => {
              const active = viewMode === "room" && room === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setRoom(key);
                    setViewMode("room");
                    setSidebarOpen(false);
                  }}
                  className={`group relative flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-left text-[13px] transition-colors ${
                    active
                      ? "bg-black/[0.05] font-medium text-[#1C1A17]"
                      : "text-[#4D4A47] hover:bg-black/[0.04] hover:text-[#1C1A17]"
                  }`}
                >
                  {active && (
                    <span className="absolute -left-2 bottom-1 top-1 w-[2.5px] rounded-r bg-[#CDAA73]" />
                  )}
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current ${
                      active ? "opacity-70" : "opacity-30 group-hover:opacity-50"
                    }`}
                  />
                  <span className="flex-1 truncate">{allRoomPresets[key].label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={addRoom}
              className="flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-left text-[12.5px] text-[#8A8680] transition-colors hover:text-[#4D4A47]"
            >
              <svg
                className="h-3.5 w-3.5 flex-shrink-0"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M7 2v10M2 7h10" />
              </svg>
              Ajouter une pièce
            </button>
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-black/[0.08] bg-[#F2EFE7]">
          {/* Project switcher */}
          <div className="relative border-b border-black/[0.06] px-2 py-1.5" ref={projectPickerRef}>
            <button
              type="button"
              onClick={() => {
                if (userProjectCount > 1) {
                  loadUserProjects();
                  setShowProjectPicker(v => !v);
                }
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-[7px] text-left transition-colors hover:bg-black/[0.04]"
            >
              <div
                className="h-[18px] w-[18px] flex-shrink-0 rounded-[4px]"
                style={{ background: "linear-gradient(135deg,#CDAA73 10%,#A8B5A2 90%)" }}
              />
              <span className="flex-1 truncate text-[12.5px] font-semibold text-[#1C1A17]">{userProjects.find(p => p.id === projectId)?.name || "Appartement"}</span>
              {userProjectCount > 1 && (
                <svg className="h-3.5 w-3.5 flex-shrink-0 text-[#8A8680]" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5.5L7 2.5L10 5.5M4 8.5L7 11.5L10 8.5" />
                </svg>
              )}
            </button>
            {showProjectPicker && userProjects.length > 0 && (
              <div className="absolute bottom-full left-2 right-2 mb-1 overflow-hidden rounded-lg border border-black/[0.08] bg-white shadow-lg">
                {userProjects.map(p => (
                  <div key={p.id} className="group flex items-center gap-2 px-3 py-2.5 text-[12.5px] transition-colors hover:bg-[#F5F3EE]">
                    <div
                      className="h-4 w-4 flex-shrink-0 rounded-[3px]"
                      style={{ background: p.id === projectId ? "linear-gradient(135deg,#CDAA73 10%,#A8B5A2 90%)" : "#E0DDD7" }}
                    />
                    {renamingProjectId === p.id ? (
                      <form
                        className="flex flex-1 items-center gap-1"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const newName = renameValue.trim();
                          if (!newName) return;
                          await authedFetch(`${API_BASE}/save-project`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ state: {}, id: p.id, name: newName }),
                          });
                          setUserProjects(prev => prev.map(pr => pr.id === p.id ? { ...pr, name: newName } : pr));
                          setRenamingProjectId(null);
                        }}
                      >
                        <input
                          autoFocus
                          className="flex-1 rounded border border-[#CDAA73] bg-white px-1.5 py-0.5 text-[12.5px] text-[#1C1A17] outline-none"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Escape") setRenamingProjectId(null); }}
                          onBlur={() => setRenamingProjectId(null)}
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchProject(p.id)}
                        className={`flex-1 truncate text-left ${p.id === projectId ? "font-semibold text-[#1C1A17]" : "text-[#4D4A47]"}`}
                      >
                        {p.name || "Sans titre"}
                      </button>
                    )}
                    {renamingProjectId !== p.id && (p.role === "owner" || p.id === projectId) && (
                      <button
                        type="button"
                        title="Renommer"
                        onClick={e => { e.stopPropagation(); setRenameValue(p.name || ""); setRenamingProjectId(p.id); }}
                        className="flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/[0.06]"
                      >
                        <svg className="h-3 w-3 text-[#8A8680]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8.5 1.5l2 2L3 11H1v-2L8.5 1.5z" />
                        </svg>
                      </button>
                    )}
                    {p.id === projectId && renamingProjectId !== p.id && (
                      <svg className="h-3 w-3 flex-shrink-0 text-[#A8B5A2]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Membres */}
          <div className="border-b border-black/[0.06] px-2 py-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setShowMembersModal(true); setSidebarOpen(false); }}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-[7px] text-[13px] text-[#4D4A47] transition-colors hover:bg-black/[0.04] hover:text-[#1C1A17]"
              >
                <svg className="h-3.5 w-3.5 flex-shrink-0 opacity-55" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="5" cy="4.5" r="2.5" />
                  <path d="M.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
                  <circle cx="11" cy="4.5" r="2" />
                  <path d="M13.5 13c0-2-1.5-3.5-3-3.5" />
                </svg>
                <span className="flex-1 truncate">Membres</span>
                {projectMembers.length > 0 && (
                  <div className="flex">
                    {projectMembers.slice(0, 3).map((member, i) => (
                      <div
                        key={member.id}
                        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] border-[#F2EFE7] text-[8.5px] font-bold text-white"
                        style={{ background: ["#A8B5A2", "#b8c9d0", "#CDAA73"][i % 3], marginLeft: i === 0 ? 0 : -4 }}
                      >
                        {(member.name || "?")[0].toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}
              </button>
              {isOwner && inviteCode && (
                <button
                  type="button"
                  title="Inviter quelqu'un"
                  onClick={() => {
                    const inviteUrl = `${window.location.origin}/?invite=${inviteCode}`;
                    navigator.clipboard.writeText(inviteUrl);
                    setCopyInviteSuccess(true);
                    setTimeout(() => setCopyInviteSuccess(false), 2000);
                  }}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[#4D4A47] transition-colors hover:bg-black/[0.05] hover:text-[#1C1A17]"
                >
                  {copyInviteSuccess ? (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#A8B5A2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 7l3.5 3.5L12 3" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="5.5" cy="4" r="2.5" />
                      <path d="M.5 12.5c0-2.2 2-3.5 5-3.5" />
                      <path d="M11 8v4M9 10h4" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
          {/* User profile + Snapshot/Historique */}
          <div className="relative px-2 py-1.5" ref={userMenuRef}>
            {showUserMenu && (
              <div className="absolute bottom-full left-2 right-2 z-50 mb-1 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
                <div className="border-b border-black/8 px-3 py-2.5">
                  <p className="truncate text-xs font-medium text-slate-800">
                    {user?.user_metadata?.full_name || "Utilisateur"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowSnapshotHistory(true); setShowUserMenu(false); }}
                  className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-400">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span className="text-sm text-slate-700">Historique</span>
                </button>
                <button
                  onClick={() => { setShowSnapshotModal(true); setShowUserMenu(false); }}
                  disabled={isSavingSnapshot}
                  className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50 flex items-center gap-2.5 disabled:opacity-60"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span className="text-sm text-slate-700">{isSavingSnapshot ? "Sauvegarde…" : "Snapshot"}</span>
                </button>
                <button
                  onClick={signOut}
                  className="w-full border-t border-black/8 px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50"
                >
                  Se déconnecter
                </button>
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-[7px] text-left transition-colors hover:bg-black/[0.04]"
              >
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="h-[22px] w-[22px] flex-shrink-0 rounded-full border border-black/10" />
                ) : (
                  <div className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                    {(user?.email || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium leading-tight text-[#1C1A17]">
                    {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Moi"}
                  </p>
                  {lastSavedAt ? (
                    <p className="truncate text-[10.5px] leading-tight text-[#B0ADA6]">
                      Sauvé à {new Date(lastSavedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  ) : (
                    <p className="truncate text-[10.5px] leading-tight text-[#B0ADA6]">{user?.email}</p>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-black/[0.07] bg-[#FAFAF8] px-5" style={{display:'none'}}>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-black/[0.1] text-slate-500 hover:bg-slate-50 lg:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 3h12M1 7h12M1 11h12" />
            </svg>
          </button>
          <span className="flex-1 truncate text-sm font-semibold tracking-tight text-[#1C1A17]">
            {viewMode === "room" ? allRoomPresets[room]?.label : "Vue générale"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSnapshotHistory(true)}
              className="flex items-center gap-1.5 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="hidden sm:inline">Historique</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSnapshotModal(true)}
              disabled={isSavingSnapshot}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-60"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span className="hidden sm:inline">{isSavingSnapshot ? "Sauvegarde…" : "Snapshot"}</span>
            </button>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setShowUserMenu((v) => !v)}
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
              >
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  style={{ display: user?.user_metadata?.avatar_url ? "none" : "flex" }}
                  className="h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-slate-200 text-sm font-semibold text-slate-600"
                >
                  {(user?.email || "?")[0].toUpperCase()}
                </div>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
                  <div className="border-b border-black/8 px-3 py-2.5">
                    <p className="truncate text-xs font-medium text-slate-800">
                      {user?.user_metadata?.full_name || "Utilisateur"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{user?.email}</p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => { setShowMembersModal(true); setShowUserMenu(false); }}
                      className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Membres</p>
                      <p className="mt-0.5 text-sm text-slate-700">Gérer les membres →</p>
                    </button>
                  )}
                  {isOwner && inviteCode && (
                    <button
                      onClick={() => {
                        const inviteUrl = `${window.location.origin}/?invite=${inviteCode}`;
                        navigator.clipboard.writeText(inviteUrl);
                        setCopyInviteSuccess(true);
                        setTimeout(() => setCopyInviteSuccess(false), 2000);
                      }}
                      className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Lien d'invitation</p>
                      <p className="mt-0.5 text-sm text-slate-700">{copyInviteSuccess ? "✓ Lien copié !" : "Copier le lien →"}</p>
                    </button>
                  )}
                  <button
                    onClick={signOut}
                    className="w-full border-t border-black/8 px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50"
                  >
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
            {lastSavedAt && (
              <span className="hidden text-[11px] text-slate-400 md:inline">
                Auto-sauvé {new Date(lastSavedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </header>

        {viewMode === "room" ? (
          <div className="flex h-14 flex-shrink-0 items-center border-b border-black/[0.08] bg-[#FAFAF8] px-4">
            <button type="button" onClick={() => setSidebarOpen(true)} className="mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-black/[0.05] lg:hidden">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 3h12M1 7h12M1 11h12" /></svg>
            </button>
            <span className="mr-2 flex-shrink-0 text-sm font-semibold text-[#1C1A17] lg:hidden">{allRoomPresets[room]?.label}</span>
            <div className="mr-2 h-3.5 w-px flex-shrink-0 bg-black/10 lg:hidden" />
            <div className="flex gap-1">
              {[
                { key: "inspirations", label: "Inspirations" },
                { key: "couleurs", label: "Couleurs" },
                { key: "liste", label: "Liste" },
                { key: "discussions", label: "Discussions" },
              ].map(({ key, label }) => {
                const pending = key === "liste" ? roomPendingCount(room) : key === "discussions" ? (discussionsCache[room] || []).reduce((sum, d) => sum + (d.unread_count || 0), 0) : 0;
                const mentionBadge = key === "discussions"
                  ? (mentionNotifications || []).filter(n => !n.read_at && (discussionsCache[room] || []).some(d => d.id === n.discussion_id)).length
                  : 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSetRoomMode(key)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      roomMode === key ? "bg-[#1C1A17] text-white" : "text-[#4D4A47] hover:bg-black/[0.06] hover:text-[#1C1A17]"
                    }`}
                  >
                    {label}
                    {mentionBadge > 0 ? (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{mentionBadge}</span>
                    ) : pending > 0 ? (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-900">{pending}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {viewMode === "general" ? (
          <div className="flex h-14 flex-shrink-0 items-center border-b border-black/[0.08] bg-[#FAFAF8] px-4">
            <button type="button" onClick={() => setSidebarOpen(true)} className="mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-black/[0.05] lg:hidden">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 3h12M1 7h12M1 11h12" /></svg>
            </button>
            <span className="mr-2 flex-shrink-0 text-sm font-semibold text-[#1C1A17] lg:hidden">Vue générale</span>
            <div className="mr-2 h-3.5 w-px flex-shrink-0 bg-black/10 lg:hidden" />
            <div className="flex gap-1">
              {(() => {
                const totalPending = orderedActiveRooms.reduce((acc, key) => {
                  const list = roomLists[key] || {};
                  return acc + [...(list.shopping || []), ...(list.todos || [])].filter((i) => !i.done).length;
                }, 0);
                const totalUnread = ["general", ...orderedActiveRooms].reduce((acc, key) => {
                  return acc + (discussionsCache[key] || []).reduce((sum, d) => sum + (d.unread_count || 0), 0);
                }, 0);
                const totalDocs = orderedActiveRooms.reduce((acc, key) => acc + (roomDocuments[key] || []).length, 0);
                const totalMentionUnread = (mentionNotifications || []).filter(n => !n.read_at).length;
                return [
                  { key: "todos", label: "Todos", badge: totalPending },
                  { key: "couleurs", label: "Couleurs", badge: 0 },
                  { key: "discussions", label: "Discussions", badge: totalUnread, mentionBadge: totalMentionUnread },
                  { key: "ressources", label: "Ressources", badge: totalDocs },
                ].map(({ key, label, badge, mentionBadge }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGeneralMode(key)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      generalMode === key ? "bg-[#1C1A17] text-white" : "text-[#4D4A47] hover:bg-black/[0.06] hover:text-[#1C1A17]"
                    }`}
                  >
                    {label}
                    {mentionBadge > 0 ? (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{mentionBadge}</span>
                    ) : badge > 0 ? (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-900">{badge}</span>
                    ) : null}
                  </button>
                ));
              })()}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:space-y-6 md:p-6">
        {viewMode === "general" ? (
          generalMode === "todos" ? (
            <TodosGlobalView
              orderedActiveRooms={orderedActiveRooms}
              allRoomPresets={allRoomPresets}
              roomLists={roomLists}
              setRoomLists={setRoomLists}
            />
          ) : generalMode === "couleurs" ? (
            <>
              <div className="rounded-xl border border-black/10 bg-white p-4">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue d'ensemble</p>
                <h2 className="type-h2">Palette de l'appartement</h2>
                <p className="mt-1 text-sm text-slate-600">Toutes les pièces et leurs couleurs choisies.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {orderedActiveRooms.map((key) => {
                  const p = allRoomPresets[key];
                  const colors = getRoomColors(key);
                  if (!colors || !p) return null;
                  const pending = roomPendingCount(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setRoom(key); setViewMode("room"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="group rounded-xl border border-black/10 bg-white p-4 text-left transition-all hover:border-slate-400/40 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">{p.label}</div>
                          {pending > 0 ? (
                            <div className="mt-0.5 text-xs text-amber-700">{pending} élément{pending > 1 ? "s" : ""} en attente</div>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500">→</span>
                      </div>
                      <div className="mb-3 flex gap-2">
                        {[
                          { ...colors.dominant, sublabel: "Dom." },
                          { ...colors.secondary, sublabel: "Sec." },
                          { ...colors.accent, sublabel: "Acc." },
                        ].map(({ hex, sublabel }) => (
                          <div key={sublabel} className="min-w-0 flex-1">
                            <div className="mb-1 h-7 rounded border border-black/10" style={{ backgroundColor: hex }} />
                            <div className="truncate text-[10px] text-slate-400">{sublabel}</div>
                            <div className="truncate font-mono text-[10px] text-slate-600">{hex}</div>
                          </div>
                        ))}
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{p.line}</p>
                    </button>
                  );
                })}
              </div>
              <GeneralContextSection
                generalContext={generalContext}
                setGeneralContext={setGeneralContext}
              />
            </>
          ) : generalMode === "discussions" ? (
            <>
              {openThread ? (
                <DiscussionThread
                  discussionId={openThread.discussionId}
                  discussion={openThread.discussion}
                  projectId={projectId}
                  user={user}
                  isOwner={isOwner}
                  authedFetch={authedFetch}
                  projectMembers={projectMembers}
                  orderedActiveRooms={orderedActiveRooms}
                  allRoomPresets={allRoomPresets}
                  onClose={() => setOpenThread(null)}
                  onDiscussionUpdate={(patch) => {
                    setOpenThread(prev => prev ? { ...prev, discussion: { ...prev.discussion, ...patch } } : prev);
                    setDiscussionsCache(prev => {
                      const updated = { ...prev };
                      for (const rk of Object.keys(updated)) {
                        updated[rk] = (updated[rk] || []).map(d => d.id === openThread.discussionId ? { ...d, ...patch } : d);
                      }
                      return updated;
                    });
                  }}
                  onNavigateToRoom={(key) => { setRoom(key); setViewMode("room"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  onMarkMentionsRead={markMentionsRead}
                />
              ) : (
                <DiscussionsGlobalView
                  orderedActiveRooms={orderedActiveRooms}
                  allRoomPresets={allRoomPresets}
                  discussionsCache={discussionsCache}
                  onOpenThread={(id, disc) => setOpenThread({ discussionId: id, discussion: disc })}
                  mentionNotifications={mentionNotifications}
                />
              )}
            </>
          ) : (
            <DocumentsGlobalView
              orderedActiveRooms={orderedActiveRooms}
              allRoomPresets={allRoomPresets}
              roomDocuments={roomDocuments}
            />
          )
        ) : roomMode === "couleurs" ? (
          <>
            <section className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-black/10 bg-white p-4">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Palette globale</p>
                <h2 className="type-h2">Palette de l'appartement</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Swatch title="Crème chaud" subtitle="Base" hex={baseColors.creme.hex} />
                  <Swatch title="Bleu clair grisé" subtitle="Pilier" hex={baseColors.bleu.hex} />
                  <Swatch title="Vert sauge" subtitle="Pilier" hex={baseColors.vert.hex} />
                  <Swatch title="Chêne clair" subtitle="Fil conducteur" hex={baseColors.bois.hex} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Accents autorisés</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(accents).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => setGlobalAccent(key)}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-left ${
                          globalAccent === key ? "border-slate-900" : "border-black/15"
                        }`}
                      >
                        <span className="inline-block h-6 w-6 rounded-md border border-black/10" style={{ backgroundColor: value.hex }} />
                        <span className="text-sm">{value.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-black/10 bg-white p-4">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pièce active</p>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="type-h2">{preset.label}</h2>
                  {orderedActiveRooms.length > 1 ? (
                    <button
                      type="button"
                      onClick={deleteRoom}
                      title="Supprimer cette pièce"
                      aria-label="Supprimer cette pièce"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-red-200 bg-white text-base font-bold text-red-600 shadow-sm hover:bg-red-50"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <p className="text-sm text-slate-700">{preset.line}</p>
                <div className="space-y-4">
                  {[
                    { role: "dominantColor", nuanceRole: "dominant", label: "Couleur dominante" },
                    { role: "secondaryColor", nuanceRole: "secondary", label: "Couleur secondaire" },
                  ].map(({ role, nuanceRole, label }) => {
                    const selectedColor = activeNuance[role] || (role === "dominantColor" ? preset.dominant : preset.secondary);
                    const selectedNuance = activeNuance[nuanceRole];
                    return (
                      <div key={role}>
                        <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
                        <div className="flex gap-2">
                          {Object.entries(baseColors).map(([key, color]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => updateRoomNuance(role, key)}
                              title={color.name}
                              className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-1.5 transition-all ${
                                selectedColor === key ? "border-slate-900 shadow-sm" : "border-black/10 hover:border-black/30"
                              }`}
                            >
                              <span className="block h-6 w-full rounded-md" style={{ backgroundColor: color.hex }} />
                              <span className="text-[10px] leading-tight text-slate-500">{color.name.split(" ")[0]}</span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          {[["clair", "Clair"], ["moyen", "Moyen"], ["soutenu", "Soutenu"], ["fonce", "Foncé"]].map(([val, lbl]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateRoomNuance(nuanceRole, val)}
                              className={`flex-1 rounded-md border py-1 text-xs font-medium transition-all ${
                                selectedNuance === val
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-black/15 bg-white text-slate-600 hover:border-black/30"
                              }`}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-slate-700">Accent pièce</p>
                    <div className="flex gap-2">
                      {[["bois", "Chêne clair", baseColors.bois.hex], ...Object.entries(accents).map(([k, v]) => [k, v.name, v.hex])].map(([key, name, hex]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateRoomNuance("accent", key)}
                          title={name}
                          className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-1.5 transition-all ${
                            activeNuance.accent === key ? "border-slate-900 shadow-sm" : "border-black/10 hover:border-black/30"
                          }`}
                        >
                          <span className="block h-6 w-full rounded-md" style={{ backgroundColor: hex }} />
                          <span className="text-[10px] leading-tight text-slate-500">{name.split(" ")[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Swatch title={baseColors[activeDominantColor].name} subtitle="Dominante" hex={dominantHex} />
                  <Swatch title={baseColors[activeSecondaryColor].name} subtitle="Secondaire" hex={secondaryHex} />
                  <Swatch title={accentName} subtitle="Accent" hex={accentHex} />
                </div>
                <button
                  type="button"
                  onClick={() => setShow3D(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-black/15 bg-white py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[.98]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>
                  </svg>
                  Voir en 3D
                </button>
                <label className="block text-sm">
                  Note de la pièce
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-md border border-black/15 bg-white p-2"
                    placeholder="Ajouter une note sur cette pièce..."
                    value={roomNotes[room] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRoomNotes((prev) => ({ ...prev, [room]: val }));
                      if (projectId) {
                        clearTimeout(roomNoteTimerRef.current);
                        roomNoteTimerRef.current = setTimeout(() => saveRoomNoteToServer(projectId, room, val), 1000);
                      }
                    }}
                  />
                </label>
              </div>
            </section>

            <div className="rounded-xl border border-black/10 bg-white p-4">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Aperçu visuel</p>
              <h2 className="type-h2">Nuancier Recommandé</h2>
              <p className="mt-1 text-sm text-slate-600">Répartition visuelle pour garder un cap cohérent dans la pièce active.</p>
              <div className="mt-3 rounded-lg border border-black/10 bg-[#f9f6ef] p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium">Aperçu chaleur : {warmth}</label>
                  <span className="rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Aperçu seul</span>
                </div>
                <input type="range" min={0} max={100} step={1} value={warmth} onChange={(e) => setWarmth(Number(e.target.value))} className="w-full" />
                <p className="mt-1.5 text-xs text-slate-500">Plus frais vers les bleus · plus chaud vers chêne clair et beurre.</p>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-black/10">
                <div className="h-6" style={{ backgroundColor: baseColors.creme.hex }} />
                <div className="grid min-h-[220px] grid-cols-[1.2fr_0.8fr]">
                  <div className="relative" style={{ backgroundColor: previewSecondaryHex }}>
                    <div className="absolute inset-x-0 top-0 h-1/2" style={{ backgroundColor: baseColors.creme.hex }} />
                    <div className="absolute bottom-3 left-3 h-24 w-28 rounded-xl" style={{ backgroundColor: dominantHex }} />
                  </div>
                  <div className="p-4" style={{ backgroundColor: dominantHex, color: textColor(dominantHex) }}>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div
                          key={`square-${i}`}
                          className="aspect-square rounded-md"
                          style={{ backgroundColor: i % 3 === 0 ? previewAccentHex : i % 2 ? previewSecondaryHex : baseColors.creme.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {preset.notes.map((note) => (
                  <p key={note} className="rounded-lg bg-[#f9f6ef] p-3 text-sm">{note}</p>
                ))}
              </div>
            </div>
          </>
        ) : roomMode === "inspirations" ? (
          <>
            <PlanPreview
              room={room}
              label={preset.label}
              planUploads={planUploads}
              setPlanUploads={setPlanUploads}
              planLinks={planLinks}
              setPlanLinks={setPlanLinks}
              extraPlanImages={extraPlanImages}
              setExtraPlanImages={setExtraPlanImages}
              aiContext={aiContext}
              addAiInspiration={addAiInspiration}
              imageAnalysis={imageAnalysis}
              setImageAnalysis={setImageAnalysis}
              deletedImages={deletedImages}
              setDeletedImages={setDeletedImages}
              onImageClick={(images, idx) => setLightbox({ images, index: idx ?? 0 })}
            />
            <section className="rounded-xl border border-black/10 bg-white p-4">
              <Inspirations
                room={room}
                label={preset.label}
                uploadedImages={uploadedImages}
                setUploadedImages={setUploadedImages}
                inspirationLinks={inspirationLinks}
                setInspirationLinks={setInspirationLinks}
                aiContext={aiContext}
                aiInspirations={aiInspirations}
                addAiInspiration={addAiInspiration}
                imageAnalysis={imageAnalysis}
                setImageAnalysis={setImageAnalysis}
                deletedImages={deletedImages}
                setDeletedImages={setDeletedImages}
                onImageClick={(images, idx) => setLightbox({ images, index: idx ?? 0 })}
                instagramItems={instagramItems}
                setInstagramItems={setInstagramItems}
              />
            </section>
            <section className="rounded-xl border border-black/10 bg-white p-4">
              <MaterialsSection
                room={room}
                materialUploads={materialUploads}
                setMaterialUploads={setMaterialUploads}
                materialLinks={materialLinks}
                setMaterialLinks={setMaterialLinks}
                extraMaterialImages={extraMaterialImages}
                setExtraMaterialImages={setExtraMaterialImages}
                extraMaterialMeta={extraMaterialMeta}
                setExtraMaterialMeta={setExtraMaterialMeta}
                aiContext={aiContext}
                addAiInspiration={addAiInspiration}
                imageAnalysis={imageAnalysis}
                setImageAnalysis={setImageAnalysis}
                deletedImages={deletedImages}
                setDeletedImages={setDeletedImages}
                onImageClick={(images, idx) => setLightbox({ images, index: idx ?? 0 })}
              />
            </section>
          </>
        ) : roomMode === "liste" ? (
          <div className="space-y-6">
            <ListeSection
              room={room}
              label={preset.label}
              roomLists={roomLists}
              setRoomLists={setRoomLists}
              projectId={projectId}
              saveRoomItemsFn={saveRoomItemsToServer}
            />
            <DocumentsSection
              room={room}
              roomDocuments={roomDocuments}
              setRoomDocuments={setRoomDocuments}
              projectId={projectId}
              saveDocFn={saveRoomDocumentToServer}
              deleteDocFn={deleteRoomDocumentFromServer}
            />
          </div>
        ) : roomMode === "discussions" ? (
          <DiscussionsPanel
            room={room}
            projectId={projectId}
            user={user}
            isOwner={isOwner}
            discussions={discussionsCache[room]}
            onDiscussionsChange={updateDiscussionsCache}
            authedFetch={authedFetch}
            allRoomPresets={allRoomPresets}
            orderedActiveRooms={orderedActiveRooms}
            projectMembers={projectMembers}
            onNavigateToRoom={(key) => { setRoom(key); setViewMode("room"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            onDiscussionUpdate={(discussionId, patch) => {
              setDiscussionsCache(prev => {
                const updated = { ...prev };
                for (const rk of Object.keys(updated)) {
                  updated[rk] = (updated[rk] || []).map(d => d.id === discussionId ? { ...d, ...patch } : d);
                }
                return updated;
              });
            }}
            onMarkMentionsRead={markMentionsRead}
          />
        ) : null}

        {lightbox ? <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} /> : null}
        {show3D ? (
          <RoomViewer3D
            dominant={dominantHex}
            secondary={secondaryHex}
            accent={accentHex}
            roomLabel={preset.label}
            availablePhotos={roomPhotosFor3D}
            onClose={() => setShow3D(false)}
          />
        ) : null}
        </div>
        </div>
      </div>
      {createPortal(
        <>
          <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
            {!isChatOpen && !chatBubbleDismissed && (
              <div
                className="relative rounded-2xl bg-slate-900 px-4 py-2.5 shadow-xl max-w-[210px] text-right"
                style={{ animation: "chatBubbleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}
              >
                <button
                  type="button"
                  onClick={() => setChatBubbleDismissed(true)}
                  className="absolute -top-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-white hover:bg-slate-500"
                  style={{ fontSize: 9 }}
                  aria-label="Fermer"
                >✕</button>
                <p className="text-xs font-semibold text-white">Assistant IA ✦</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">Posez une question, créez des todos ou une liste de courses…</p>
                <div className="absolute -bottom-2 right-5 h-4 w-4 rotate-45 bg-slate-900" />
              </div>
            )}
            <button
              type="button"
              onClick={() => { setIsChatOpen((v) => !v); setChatBubbleDismissed(true); }}
              className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors ${
                isChatOpen ? "bg-slate-700 text-white" : "bg-slate-900 text-white hover:bg-slate-700"
              }`}
              aria-label="Chat IA"
            >
              {!isChatOpen && (
                <span className="absolute inset-0 rounded-full bg-slate-600 opacity-40" style={{ animation: "chatPing 2s cubic-bezier(0,0,0.2,1) infinite" }} />
              )}
              {isChatOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                </svg>
              )}
            </button>
          </div>
          {isChatOpen ? (
            <div className="fixed inset-0 z-50 flex items-start justify-end">
              <div className="absolute inset-0" onClick={() => setIsChatOpen(false)} />
              <div className="relative h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
                <ChatPanel
                  room={room}
                  aiContext={aiContext}
                  chatHistory={chatHistory}
                  setChatHistory={setChatHistory}
                  setRoomLists={setRoomLists}
                  setRoomNotes={setRoomNotes}
                  projectId={projectId}
                  saveMessageFn={saveChatMessageToServer}
                  saveNoteFn={saveRoomNoteToServer}
                  saveRoomItemsFn={saveRoomItemsToServer}
                  onClose={() => setIsChatOpen(false)}
                  draft={chatDrafts[room] || ""}
                  onDraftChange={(val) => setChatDrafts((prev) => ({ ...prev, [room]: val }))}
                  roomImages={[
                    ...(roomPlanImages[room] || []).map((src, i) => ({ src: planUploads[`${room}-plan-${i}`] || src, key: `${room}-plan-${i}` })),
                    ...(extraPlanImages[room] || []).map((src, i) => ({ src, key: `${room}-plan-extra-${i}` })),
                    ...(roomInspirationImages[room] || []).map((src, i) => ({ src: uploadedImages[`${room}-${i}`] || src, key: `${room}-${i}` })),
                    ...(materialsByRoom[room] || []).map((m, i) => ({ src: materialUploads[`${room}-material-${i}`] || m.src, key: `${room}-material-${i}` })),
                    ...(aiInspirations[room] || []).map((src, i) => ({ src, key: `${room}-ai-${i}` })),
                  ].filter((img) => img.src && !deletedImages[img.key])}
                />
              </div>
            </div>
          ) : null}
        </>,
        document.body
      )}
    </div>
  );
}
