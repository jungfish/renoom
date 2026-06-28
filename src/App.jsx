import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@supabase/supabase-js";
import { RoomViewer3D } from "./RoomViewer3D";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

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
    const res = await fetch("/api/upload-image", {
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
    const res = await fetch("/api/upload-image", {
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
    const res = await fetch("/api/fetch-link-preview", {
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
  const res = await fetch("/api/fetch-link-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return { url, title: url, description: null, image: null };
  return res.json();
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
    const response = await fetch("/api/analyze-image", {
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

function AddUrlButton({ onUrl }) {
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
      const imageUrl = await extractImageFromUrl(url);
      if (!imageUrl) {
        setError("Aucune image trouvée à cette adresse.");
        setLoading(false);
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
              placeholder="Lien Pinterest…"
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
      title="Ajouter via un lien (Pinterest, etc.)"
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
      const response = await fetch("/api/generate-image", {
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

function Lightbox({ src, onClose }) {
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
      <img
        src={src}
        alt="Vue agrandie"
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
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
        onClick={() => { if (currentSrc && !isMissing && !isPdfUrl(currentSrc) && onImageClick) onImageClick(currentSrc); }}
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

function Inspirations({ room, label, uploadedImages, setUploadedImages, inspirationLinks, setInspirationLinks, aiContext, aiInspirations, addAiInspiration, imageAnalysis, setImageAnalysis, deletedImages, setDeletedImages, onImageClick }) {
  const items = [
    ...(roomInspirationImages[room] || []).map((src, i) => ({ src, cardKey: `${room}-${i}`, index: i })),
    ...(aiInspirations[room] || []).map((src, i) => ({ src, cardKey: `${room}-ai-${i}`, index: i })),
  ].filter((item) => !deletedImages[item.cardKey]);
  const [missingCards, setMissingCards] = useState({});
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
          <AddUrlButton onUrl={handleAddImageFromUrl} />
          <AddImageButton onFile={handleAddImage} />
        </div>
      </div>
      {(() => {
        const [item0, item1, item2, item3] = visibleItems;

        const renderCard = (item, extraStyle = {}) => {
          if (!item) return null;
          const { src, cardKey, displayIndex: i } = item;
          const imageSrc = uploadedImages[cardKey] || src;
          const linkValue = inspirationLinks[cardKey] || "";
          const isMissing = !!missingCards[cardKey];

          return (
            <div
              key={cardKey}
              className="group relative overflow-hidden rounded-xl bg-[#e8e4de]"
              style={{ cursor: isMissing ? "default" : "zoom-in", ...extraStyle }}
              onClick={() => { if (!isMissing && onImageClick) onImageClick(imageSrc); }}
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
                  setDeletedImages((prev) => ({ ...prev, [deleteConfirm]: true }));
                  setUploadedImages((prev) => removeObjectKey(prev, deleteConfirm));
                  setInspirationLinks((prev) => removeObjectKey(prev, deleteConfirm));
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

function EditMaterialModal({ cardKey, isLink, currentMeta, onSave, onClose }) {
  const [label, setLabel] = useState(currentMeta.label || "");
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
                    onImageClick(imageSrc);
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

function GeneralView({
  orderedActiveRooms, allRoomPresets, getRoomColors,
  generalContext, setGeneralContext,
  roomLists, setRoomLists,
  generalResources, setGeneralResources,
  onNavigateToRoom,
}) {
  return (
    <div className="space-y-6">
      <GeneralPaletteSection
        orderedActiveRooms={orderedActiveRooms}
        allRoomPresets={allRoomPresets}
        getRoomColors={getRoomColors}
        onNavigateToRoom={onNavigateToRoom}
      />
      <GeneralContextSection
        generalContext={generalContext}
        setGeneralContext={setGeneralContext}
      />
      <div className="rounded-xl border border-black/10 bg-white p-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Appartement</p>
        <h2 className="type-h2 mb-4">Todos globaux</h2>
        <ListeSection
          room="general"
          label="Appartement"
          roomLists={roomLists}
          setRoomLists={setRoomLists}
        />
      </div>
      <GeneralResourcesSection
        generalResources={generalResources}
        setGeneralResources={setGeneralResources}
      />
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

function ChatPanel({ room, aiContext, chatHistory, setChatHistory, roomImages, setRoomLists, setRoomNotes }) {
  const [input, setInput] = useState("");
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
    setIsLoading(true);

    const imageMetadataSummary = (aiContext.roomImageMetadata || [])
      .map((item) => {
        const m = item.metadata;
        return m ? [m.style, m.inspiration, ...(m.materials || [])].filter(Boolean).join(", ") : null;
      })
      .filter(Boolean)
      .slice(0, 6)
      .join("; ");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            materialSummary: aiContext.materialSummary,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur IA.");

      const assistantMsg = {
        id: `msg-${Date.now()}-a`,
        role: "assistant",
        content: data.content || "",
        imagePrompt: data.imagePrompt,
      };

      if (data.toolCalls?.length) {
        const notices = [];
        for (const call of data.toolCalls) {
          if (call.name === "add_to_shopping_list" && setRoomLists) {
            const newItems = (call.args.items || []).map((text) => ({
              id: `shopping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              text,
              done: false,
            }));
            setRoomLists((prev) => ({
              ...prev,
              [room]: {
                ...(prev[room] || {}),
                shopping: [...((prev[room] || {}).shopping || []), ...newItems],
              },
            }));
            notices.push(`${newItems.length} article${newItems.length > 1 ? "s" : ""} ajouté${newItems.length > 1 ? "s" : ""} à ta liste.`);
          } else if (call.name === "save_room_note" && setRoomNotes) {
            setRoomNotes((prev) => ({ ...prev, [room]: call.args.note }));
            notices.push("Note de pièce mise à jour.");
          }
        }
        if (notices.length) {
          assistantMsg.content = (assistantMsg.content ? assistantMsg.content + "\n\n" : "") + `_${notices.join(" ")}_`;
        }
      }

      setChatHistory((prev) => ({
        ...prev,
        [room]: [...nextHistory, assistantMsg],
      }));
    } catch (err) {
      setChatHistory((prev) => ({
        ...prev,
        [room]: [...nextHistory, { id: `msg-${Date.now()}-e`, role: "assistant", content: err.message, error: true }],
      }));
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
      const res = await fetch("/api/generate-image", {
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
    <div className="rounded-xl border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/10 p-4">
        <div>
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Assistant</p>
          <h3 className="type-h3">Chat IA — {aiContext.roomLabel}</h3>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={() => setChatHistory((prev) => ({ ...prev, [room]: [] }))}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Effacer
          </button>
        ) : null}
      </div>

      <div className="h-[420px] overflow-y-auto space-y-3 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-400">
            <span className="text-3xl">✦</span>
            <p>Pose une question sur la décoration de cette pièce.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {["Quelles couleurs pour les murs ?", "Comment choisir les matières ?", "Quelle ambiance lumineuse ?"].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-black/15 bg-[#f9f7f3] px-3 py-1.5 text-xs text-slate-600 hover:bg-[#fcf8d5]"
                >
                  {q}
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
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs">…</div>
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Pose une question… (Cmd+Entrée pour envoyer)"
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-md border border-black/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
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

function DocumentsSection({ room, roomDocuments, setRoomDocuments }) {
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

function ListeSection({ room, label, roomLists, setRoomLists }) {
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
    setRoomLists((prev) => ({
      ...prev,
      [room]: { ...(prev[room] || {}), [listKey]: [...((prev[room] || {})[listKey] || []), { id, text: text.trim(), url: url || undefined, done: false }] },
    }));
    setter("");
    if (url) {
      try {
        const preview = await fetchLinkPreview(url);
        if (preview.image) {
          setRoomLists((prev) => ({
            ...prev,
            [room]: {
              ...(prev[room] || {}),
              [listKey]: ((prev[room] || {})[listKey] || []).map((item) =>
                item.id === id ? { ...item, image: preview.image, previewTitle: preview.title } : item
              ),
            },
          }));
        }
      } catch {
        // pas de preview, pas grave
      }
    }
  };

  const toggleItem = (listKey, id) => {
    setRoomLists((prev) => ({
      ...prev,
      [room]: { ...(prev[room] || {}), [listKey]: ((prev[room] || {})[listKey] || []).map((item) => (item.id === id ? { ...item, done: !item.done } : item)) },
    }));
  };

  const removeItem = (listKey, id) => {
    setRoomLists((prev) => ({
      ...prev,
      [room]: { ...(prev[room] || {}), [listKey]: ((prev[room] || {})[listKey] || []).filter((item) => item.id !== id) },
    }));
  };

  const addLinkItem = async (listKey) => {
    const { label: lbl, url } = linkInput[listKey];
    if (!lbl.trim() || !url.trim()) return;
    const id = `${listKey}-${Date.now()}`;
    setLinkInput((prev) => ({ ...prev, [listKey]: { label: "", url: "" } }));
    setLinkMode((prev) => ({ ...prev, [listKey]: false }));
    setRoomLists((prev) => ({
      ...prev,
      [room]: { ...(prev[room] || {}), [listKey]: [...((prev[room] || {})[listKey] || []), { id, text: lbl.trim(), url: url.trim(), done: false }] },
    }));
    try {
      const preview = await fetchLinkPreview(url.trim());
      if (preview.image) {
        setRoomLists((prev) => ({
          ...prev,
          [room]: {
            ...(prev[room] || {}),
            [listKey]: ((prev[room] || {})[listKey] || []).map((item) =>
              item.id === id ? { ...item, image: preview.image, previewTitle: preview.title } : item
            ),
          },
        }));
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

export default function App() {
  const [room, setRoom] = useState("salon");
  const [globalAccent, setGlobalAccent] = useState("butter");
  const [warmth, setWarmth] = useState(60);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projectId, setProjectId] = useState(() => localStorage.getItem(PROJECT_ID_STORAGE_KEY) || null);
  const isApplyingRemoteUpdate = useRef(false);
  const autoSaveTimerRef = useRef(null);
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
  const lastRoomModeRef = useRef({});

  const handleSetRoomMode = (mode) => {
    lastRoomModeRef.current[room] = mode;
    setRoomMode(mode);
  };
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [show3D, setShow3D] = useState(false);
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

  const aiMaterialSummary = [
    ...(materialsByRoom[room] || []).map((m) => `${m.label}: ${m.value}`),
    ...(extraMaterialImages[room] || []).map((_, i) => {
      const meta = extraMaterialMeta[`${room}-extra-material-${i}`] || {};
      return meta.label || null;
    }).filter(Boolean),
  ].slice(0, 5);

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

  const saveProject = async () => {
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
      imageAnalysis,
      deletedImages,
      roomNuances,
      roomNotes,
      roomLists,
      roomDocuments,
      roomOrder,
      generalContext,
      generalResources,
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
    localStorage.setItem(LAST_SAVE_STORAGE_KEY, savedAt);
    setLastSavedAt(savedAt);

    try {
      setIsSavingToServer(true);
      const existingId = projectId || localStorage.getItem(PROJECT_ID_STORAGE_KEY);
      const res = await fetch("/api/save-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: projectState, id: existingId }),
      });
      const { id } = await res.json();
      if (id) {
        setProjectId(id);
        localStorage.setItem(PROJECT_ID_STORAGE_KEY, id);
      }
    } catch {
      // local save already succeeded
    } finally {
      setIsSavingToServer(false);
    }
  };

  const hydrateState = (saved) => {
    if (saved.room) setRoom(saved.room);
    if (saved.globalAccent) setGlobalAccent(saved.globalAccent);
    if (typeof saved.warmth === "number") setWarmth(saved.warmth);
    if (Array.isArray(saved.customRooms)) setCustomRooms(saved.customRooms);
    if (Array.isArray(saved.hiddenRooms)) setHiddenRooms(saved.hiddenRooms);
    if (saved.uploadedImages) setUploadedImages(saved.uploadedImages);
    if (saved.inspirationLinks) setInspirationLinks(saved.inspirationLinks);
    if (saved.materialUploads) setMaterialUploads(saved.materialUploads);
    if (saved.materialLinks) setMaterialLinks(saved.materialLinks);
    if (saved.planUploads) setPlanUploads(saved.planUploads);
    if (saved.planLinks) setPlanLinks(saved.planLinks);
    if (saved.extraPlanImages) setExtraPlanImages(saved.extraPlanImages);
    if (saved.extraMaterialImages) setExtraMaterialImages(saved.extraMaterialImages);
    if (saved.extraMaterialMeta) setExtraMaterialMeta(saved.extraMaterialMeta);
    if (saved.aiInspirations) setAiInspirations(saved.aiInspirations);
    if (saved.imageAnalysis) setImageAnalysis(saved.imageAnalysis);
    if (saved.deletedImages) setDeletedImages(saved.deletedImages);
    if (saved.roomNuances) setRoomNuances(saved.roomNuances);
    if (saved.roomNotes) setRoomNotes(saved.roomNotes);
    if (saved.roomLists) setRoomLists(saved.roomLists);
    if (saved.roomDocuments) setRoomDocuments(saved.roomDocuments);
    if (saved.roomOrder) setRoomOrder(saved.roomOrder);
    if (saved.savedAt) setLastSavedAt(saved.savedAt);
    if (typeof saved.generalContext === "string") setGeneralContext(saved.generalContext);
    if (Array.isArray(saved.generalResources)) setGeneralResources(saved.generalResources);
  };

  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get("p");
    if (!urlId) return;
    setLoadingFromUrl(true);
    fetch(`/api/load-project?id=${encodeURIComponent(urlId)}&t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(({ state }) => {
        if (state) {
          hydrateState(state);
          setProjectId(urlId);
          localStorage.setItem(PROJECT_ID_STORAGE_KEY, urlId);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFromUrl(false));
  }, []);

  // Realtime subscription — receive updates from other users on the same project
  useEffect(() => {
    if (!projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
        (payload) => {
          const remoteState = payload.new?.state;
          if (!remoteState) return;
          isApplyingRemoteUpdate.current = true;
          const { room: _ignoredRoom, ...remoteContent } = remoteState;
          hydrateState(remoteContent);
          setTimeout(() => { isApplyingRemoteUpdate.current = false; }, 200);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    aiInspirations, imageAnalysis, deletedImages,
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

  return (
    <div className="min-h-screen bg-creme text-slate-800">
      {loadingFromUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="rounded-xl border border-black/10 bg-white p-8 text-center shadow-lg">
            <p className="text-lg font-medium">Chargement du projet partagé…</p>
            <p className="mt-1 text-sm text-slate-500">Quelques secondes</p>
          </div>
        </div>
      ) : null}
      <div className="sticky top-0 z-40 border-b border-black/10 bg-white/95 px-3 py-2 backdrop-blur sm:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-label="Ouvrir la navigation des pièces"
            className="grid h-10 w-10 place-items-center rounded-md border border-black/15 bg-white shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{preset.label}</div>
            {lastSavedAt ? <div className="truncate text-[11px] text-slate-500">Sauvé: {new Date(lastSavedAt).toLocaleString("fr-FR")}</div> : null}
          </div>
          <button
            type="button"
            onClick={saveProject}
            className="rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm"
          >
            Enregistrer
          </button>
        </div>
        {mobileMenuOpen ? (
          <div className="mt-2 grid max-h-[60vh] gap-2 overflow-y-auto rounded-lg border border-black/10 bg-white p-2 shadow-lg">
            <button
              type="button"
              onClick={() => { setViewMode("general"); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`rounded-md border px-3 py-2 text-left text-sm font-medium ${viewMode === "general" ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"}`}
            >
              Général
            </button>
            <div className="my-1 h-px bg-black/10" />
            {orderedActiveRooms.map((key) => {
              const pending = roomPendingCount(key);
              return (
                <button
                  key={key}
                  draggable
                  onDragStart={() => setDraggingRoom(key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleRoomDrop(key)}
                  onDragEnd={() => setDraggingRoom(null)}
                  onClick={() => {
                    setRoom(key);
                    setViewMode("room");
                    setMobileMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-opacity ${
                    viewMode === "room" && room === key ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"
                  } ${draggingRoom === key ? "opacity-40" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" className="shrink-0 opacity-30">
                      <circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/>
                      <circle cx="3" cy="6" r="1.3"/><circle cx="7" cy="6" r="1.3"/>
                      <circle cx="3" cy="10" r="1.3"/><circle cx="7" cy="10" r="1.3"/>
                    </svg>
                    {allRoomPresets[key].label}
                  </span>
                  {pending > 0 ? (
                    <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-900">{pending}</span>
                  ) : null}
                </button>
              );
            })}
            <div className="my-1 h-px bg-black/10" />
            <button
              type="button"
              onClick={() => { setViewMode("palette"); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`rounded-md border px-3 py-2 text-left text-sm ${viewMode === "palette" ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"}`}
            >
              Palette globale
            </button>
            <button
              type="button"
              onClick={() => { setViewMode("todos-global"); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`rounded-md border px-3 py-2 text-left text-sm ${viewMode === "todos-global" ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"}`}
            >
              Tous les todos
            </button>
            <button
              type="button"
              onClick={addRoom}
              className="rounded-md border border-black/15 bg-white px-3 py-2 text-left text-sm font-medium"
            >
              + Ajouter une pièce
            </button>
          </div>
        ) : null}
      </div>

      <main className="mx-auto w-full max-w-7xl space-y-5 p-3 sm:p-4 md:space-y-6 md:p-8">
        <header className="rounded-xl border border-black/10 bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Palette appartement interactive</p>
              <h1 className="type-h1">Univers rétro, coloré, doux</h1>
              <p className="mt-2 text-sm text-slate-600">Projet de Violette et Matthieu Jungfer pour Botzaris.</p>
            </div>
            <div className="hidden w-full flex-col items-start gap-1 sm:flex sm:w-auto sm:items-end">
              <button
                type="button"
                onClick={saveProject}
                disabled={isSavingToServer}
                className="w-full rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-60 sm:w-auto"
              >
                {isSavingToServer ? "Enregistrement…" : "Enregistrer"}
              </button>
              {lastSavedAt ? <span className="text-xs text-slate-500">Sauvé: {new Date(lastSavedAt).toLocaleString("fr-FR")}</span> : null}
              {projectId ? (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?p=${projectId}`);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }}
                  className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-700"
                >
                  {copySuccess ? "Lien copié !" : "Copier le lien de partage"}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <section className="sticky top-2 z-30 hidden rounded-xl border border-black/10 bg-white/95 p-3 backdrop-blur sm:block md:top-4 md:p-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => { setViewMode("general"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium ${
                viewMode === "general" ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"
              }`}
            >
              Général
            </button>
            <div className="mx-1 h-6 w-px shrink-0 bg-black/10" />
            {orderedActiveRooms.map((key) => {
              const pending = roomPendingCount(key);
              return (
                <button
                  key={key}
                  draggable
                  onDragStart={() => setDraggingRoom(key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleRoomDrop(key)}
                  onDragEnd={() => setDraggingRoom(null)}
                  onClick={() => { setRoom(key); setViewMode("room"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  title="Glisser pour réorganiser"
                  className={`relative shrink-0 cursor-grab whitespace-nowrap rounded-lg border px-3 py-2 text-sm transition-opacity active:cursor-grabbing ${
                    viewMode === "room" && room === key ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"
                  } ${draggingRoom === key ? "opacity-40" : ""}`}
                >
                  {allRoomPresets[key].label}
                  {pending > 0 ? (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-900">{pending}</span>
                  ) : null}
                </button>
              );
            })}
            <div className="mx-1 h-6 w-px shrink-0 bg-black/10" />
            <button
              type="button"
              onClick={() => { setViewMode("palette"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-sm ${
                viewMode === "palette" ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"
              }`}
            >
              Palette
            </button>
            {(() => {
              const totalPending = orderedActiveRooms.reduce((acc, key) => {
                const list = roomLists[key] || {};
                return acc + [...(list.shopping || []), ...(list.todos || [])].filter((i) => !i.done).length;
              }, 0);
              return (
                <button
                  type="button"
                  onClick={() => { setViewMode("todos-global"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={`relative shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-sm ${
                    viewMode === "todos-global" ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"
                  }`}
                >
                  Todos
                  {totalPending > 0 ? (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-900">{totalPending}</span>
                  ) : null}
                </button>
              );
            })()}
            <button
              type="button"
              onClick={addRoom}
              title="Ajouter une pièce"
              aria-label="Ajouter une pièce"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/15 bg-white text-xl leading-none shadow-sm hover:bg-[#fcf8d5]"
            >
              +
            </button>
          </div>
        </section>

        {viewMode === "room" ? (
          <div className="flex gap-1 rounded-xl border border-black/10 bg-white p-1.5">
            {[
              { key: "inspirations", label: "Inspirations" },
              { key: "couleurs", label: "Couleurs" },
              { key: "liste", label: "Liste" },
              { key: "chat", label: "Chat IA" },
            ].map(({ key, label }) => {
              const pending = key === "liste" ? roomPendingCount(room) : 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSetRoomMode(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    roomMode === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                  {pending > 0 ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-900">{pending}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {viewMode === "general" ? (
          <GeneralView
            orderedActiveRooms={orderedActiveRooms}
            allRoomPresets={allRoomPresets}
            getRoomColors={getRoomColors}
            generalContext={generalContext}
            setGeneralContext={setGeneralContext}
            roomLists={roomLists}
            setRoomLists={setRoomLists}
            generalResources={generalResources}
            setGeneralResources={setGeneralResources}
            onNavigateToRoom={(key) => { setRoom(key); setViewMode("room"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          />
        ) : viewMode === "todos-global" ? (
          <TodosGlobalView
            orderedActiveRooms={orderedActiveRooms}
            allRoomPresets={allRoomPresets}
            roomLists={roomLists}
            setRoomLists={setRoomLists}
          />
        ) : viewMode === "palette" ? (
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
          </>
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
                    onChange={(e) => setRoomNotes((prev) => ({ ...prev, [room]: e.target.value }))}
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
              onImageClick={setLightboxSrc}
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
                onImageClick={setLightboxSrc}
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
                onImageClick={setLightboxSrc}
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
            />
            <DocumentsSection
              room={room}
              roomDocuments={roomDocuments}
              setRoomDocuments={setRoomDocuments}
            />
          </div>
        ) : (
          <ChatPanel
            room={room}
            aiContext={aiContext}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            setRoomLists={setRoomLists}
            setRoomNotes={setRoomNotes}
            roomImages={[
              ...(roomPlanImages[room] || []).map((src, i) => ({ src: planUploads[`${room}-plan-${i}`] || src, key: `${room}-plan-${i}` })),
              ...(extraPlanImages[room] || []).map((src, i) => ({ src, key: `${room}-plan-extra-${i}` })),
              ...(roomInspirationImages[room] || []).map((src, i) => ({ src: uploadedImages[`${room}-${i}`] || src, key: `${room}-${i}` })),
              ...(materialsByRoom[room] || []).map((m, i) => ({ src: materialUploads[`${room}-material-${i}`] || m.src, key: `${room}-material-${i}` })),
              ...(aiInspirations[room] || []).map((src, i) => ({ src, key: `${room}-ai-${i}` })),
            ].filter((img) => img.src && !deletedImages[img.key])}
          />
        )}

        {lightboxSrc ? <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} /> : null}
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
      </main>
    </div>
  );
}
