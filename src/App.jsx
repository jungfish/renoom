import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RoomViewer3D } from "./RoomViewer3D";
import { OnboardingWizard } from "./OnboardingWizard.jsx";
import { ItemRowActions } from "./ItemRowActions.jsx";
import { OverflowMenu } from "./OverflowMenu.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { supabase } from "./supabaseClient";
import { useAuth } from "./useAuth";
import { useEntitlements } from "./hooks/useEntitlements";
import { SUPPORT_EMAIL } from "./config";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FB, fbLabel, describeColor, familyOfHex, FARROW_BALL_FAMILIES, FARROW_BALL_LIBRARY } from "./farrowBall.js";
import { STATUSES, effectiveStatus, deriveFlagsFromStatus, styleForStatus } from "./lib/itemStatus.js";
import { formatDueDate, isDueOverdue, isDueSoonDate, personColor, personInitials, linkItemTitle, PersonPicker } from "./lib/itemHelpers.jsx";
import { ShoppingKanban } from "./ShoppingKanban.jsx";
import { BudgetView } from "./BudgetView.jsx";
import { DevisImportReview } from "./components/DevisImportReview.jsx";
import { extractPdfText } from "./lib/pdfText.js";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// Comptes "god" : accès à tous les appartements + suppression depuis "Mon espace".
const GOD_EMAILS = ["matjungfer@gmail.com"];

const baseColors = {
  creme: { name: fbLabel(FB.string), light: FB.newWhite.hex, hex: FB.string.hex, medium: FB.slipperSatin.hex, dark: FB.oxfordStone.hex },
  bleu: { name: fbLabel(FB.parmaGray), light: FB.borrowedLight.hex, hex: FB.parmaGray.hex, medium: FB.stoneBlue.hex, dark: FB.ovalRoomBlue.hex },
  vert: { name: fbLabel(FB.vertDeTerre), light: FB.cookingAppleGreen.hex, hex: FB.vertDeTerre.hex, medium: FB.cardRoomGreen.hex, dark: FB.calkeGreen.hex },
  bois: { name: fbLabel(FB.printRoomYellow), light: FB.printRoomYellow.hex, hex: FB.yellowGround.hex, medium: FB.indiaYellow.hex, dark: FB.tannersBrown.hex },
};

const accents = {
  butter: { name: fbLabel(FB.farrowsCream), hex: FB.farrowsCream.hex },
  olive: { name: fbLabel(FB.yeabridgeGreen), hex: FB.yeabridgeGreen.hex },
  sky: { name: fbLabel(FB.borrowedLight), hex: FB.borrowedLight.hex },
  lin: { name: fbLabel(FB.oldWhite), hex: FB.oldWhite.hex },
};

const CHAT_HISTORY_MAX = 50;

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
    dominant: "dominante",
    secondary: "sol",
    line: "Bureau calme et concentré : base claire, touches de bleu doux et bois chaleureux.",
    notes: ["Accent olive ou beurre en petite touche pour la personnalité."],
  },
  sdb: {
    label: "Salle de bain",
    dominant: "secondaire",
    secondary: "dominante",
    line: "Salle de bain douce et lumineuse : base claire, détails rétro et matières naturelles.",
    notes: ["Le chêne clair apporte une touche vintage chaleureuse."],
  },
  salon: {
    label: "Salon",
    dominant: "dominante",
    secondary: "secondaire",
    line: "Salon nord : base claire, bibliothèque colorée, ambiance rétro lumineuse.",
    notes: ["La couleur dominante fonctionne mieux sur la bibliothèque que sur tous les murs."],
  },
  cuisine: {
    label: "Cuisine",
    dominant: "dominante",
    secondary: "sol",
    line: "Cuisine rétro colorée : couleur principale, sol chaleureux, accents vintage.",
    notes: ["Un accent beurre ou olive est parfait en petite touche sur assise ou luminaire."],
  },
  entree: {
    label: "Entrée",
    dominant: "dominante",
    secondary: "secondaire",
    line: "Entrée signature : plus enveloppante, architecturée, avec menuiserie et niche fortes.",
    notes: ["La couleur dominante donne du caractère sans durcir l'entrée."],
  },
  parents: {
    label: "Chambre parents",
    dominant: "dominante",
    secondary: "secondaire",
    line: "Chambre parent : calme, douce, colorée par touches structurées.",
    notes: ["Le reste des murs gagne à rester dans la couleur secondaire."],
  },
  enfant: {
    label: "Chambre enfant",
    dominant: "dominante",
    secondary: "secondaire",
    line: "Chambre enfant : plus joueuse, rétro et graphique, mais toujours lisible.",
    notes: ["La secondaire calme le jeu si vous ajoutez du motif ou des rayures."],
  },
  vinyle: {
    label: "Coin vinyle",
    dominant: "secondaire",
    secondary: "sol",
    line: "Coin vinyle : plus simple, chaleureux, avec les objets et pochettes comme décor.",
    notes: ["Le ton sol donne tout de suite le côté vintage."],
  },
  cellier: {
    label: "Cellier",
    dominant: "dominante",
    secondary: "secondaire",
    line: "Cellier : pièce parfaite pour un décor plus éditorial et des motifs discrets.",
    notes: ["Un accent clair est très juste pour donner une lumière vintage."],
  },
  sanitaires: {
    label: "Sanitaires",
    dominant: "secondaire",
    secondary: "dominante",
    line: "Sanitaires : fonctionnel et soigné, avec des matières qui résistent bien à l'humidité.",
    notes: ["Le carrelage de métro blanc reste la valeur sûre."],
  },
};

const INITIAL_ROOM_NUANCES = {
  bureau:     { dominantColor: "dominante", secondaryColor: "sol" },
  sdb:        { dominantColor: "secondaire", secondaryColor: "dominante" },
  salon:      { dominantColor: "dominante", secondaryColor: "secondaire" },
  cuisine:    { dominantColor: "dominante", secondaryColor: "sol" },
  entree:     { dominantColor: "dominante", secondaryColor: "secondaire" },
  parents:    { dominantColor: "dominante", secondaryColor: "secondaire" },
  enfant:     { dominantColor: "dominante", secondaryColor: "secondaire" },
  vinyle:     { dominantColor: "secondaire", secondaryColor: "sol" },
  cellier:    { dominantColor: "dominante", secondaryColor: "secondaire" },
  sanitaires: { dominantColor: "secondaire", secondaryColor: "dominante" },
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
    return null;
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

function removeObjectKey(object, key) {
  const next = { ...object };
  delete next[key];
  return next;
}

async function analyzeImageForContext({ image, context, section, authedFetch, projectId }) {
  try {
    const response = await authedFetch(`${API_BASE}/analyze-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, context, section, projectId }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Analyse impossible.");
    return payload.analysis || "";
  } catch {
    return "";
  }
}

function GlobalDragOverlay({ isActive, roomLabel }) {
  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-all duration-200 ${
        isActive ? "pointer-events-none opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{
        background: isActive ? "rgba(20,16,10,0.5)" : "transparent",
        backdropFilter: isActive ? "blur(6px)" : "none",
      }}
    >
      {isActive && (
        <div
          className="flex flex-col items-center gap-6 rounded-3xl bg-white px-20 py-16 shadow-2xl"
          style={{ animation: "dropFadeIn 0.15s ease-out both" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative flex h-28 w-28 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #FCF8D5 0%, #E9DFC8 100%)",
              outline: "2.5px dashed #CDAA73",
              outlineOffset: "4px",
            }}
          >
            <svg
              className="h-14 w-14"
              style={{ color: "#CDAA73", animation: "dropFloat 1.8s ease-in-out infinite" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-900">Lâchez vos photos ici</p>
            <p className="mt-1.5 text-sm text-slate-400">
              Inspirations ·{" "}
              <span className="font-medium text-slate-600">{roomLabel}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Swatch({ title, hex, subtitle }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="h-16" style={{ backgroundColor: hex }} />
      <div className="space-y-1 p-3">
        <div className="text-xs text-slate-500">{subtitle}</div>
        <div className="text-sm font-medium">{title}</div>
      </div>
    </div>
  );
}

function UploadDropzone({ onFile, onFiles, compact = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
  const dragCountRef = useRef(0);

  const processFiles = (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    if (onFiles) {
      onFiles(files);
    } else if (onFile) {
      files.forEach((f) => onFile(f));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCountRef.current += 1;
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        dragCountRef.current -= 1;
        if (dragCountRef.current <= 0) { dragCountRef.current = 0; setIsDragging(false); }
      }}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`group relative cursor-pointer select-none rounded-2xl border-2 border-dashed transition-all duration-150 ${
        isDragging
          ? "border-[#CDAA73] bg-[#FCF8D5]/60 scale-[1.01]"
          : "border-black/15 bg-[#faf7f2] hover:border-[#CDAA73]/60 hover:bg-[#faf7f2]"
      } ${compact ? "py-5 px-4" : "py-10 px-6"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) processFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
            isDragging ? "bg-[#CDAA73]/20" : "bg-black/5 group-hover:bg-[#CDAA73]/10"
          }`}
        >
          <svg
            className={`h-6 w-6 transition-colors ${isDragging ? "text-[#CDAA73]" : "text-slate-400 group-hover:text-[#CDAA73]"}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
        </div>
        <div>
          <p className={`font-medium ${isDragging ? "text-[#CDAA73]" : "text-slate-600"} ${compact ? "text-xs" : "text-sm"}`}>
            {isDragging ? "Lâchez pour ajouter" : "Glissez vos photos ici"}
          </p>
          {!compact && (
            <p className="mt-0.5 text-xs text-slate-400">ou cliquez pour choisir</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AddImageButton({ onFile, onFiles, accept = "image/*" }) {
  const inputRef = useRef(null);

  const processFiles = (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    if (onFiles) {
      onFiles(files);
    } else if (onFile) {
      files.forEach((f) => onFile(f));
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) processFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title="Ajouter des images"
        aria-label="Ajouter des images"
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

function AddMaterialModal({ onAdd, onClose }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [preview, setPreview] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [customImage, setCustomImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const doFetchPreview = async (rawUrl) => {
    if (!rawUrl.trim() || isFetching) return;
    setIsFetching(true);
    setFetched(false);
    try {
      const p = await fetchLinkPreview(rawUrl.trim());
      setPreview(p);
      if (!title.trim() && p.title) setTitle(p.title);
      setFetched(true);
    } finally {
      setIsFetching(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const data = await readFileAsDataUrl(file);
      if (typeof data === "string") {
        const uploaded = await uploadToBlob(data, `material-add-${Date.now()}.${extFromDataUrl(data)}`);
        setCustomImage(uploaded);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    const linkEntry = {
      type: "link",
      url: url.trim() || customImage,
      title: title.trim() || url.trim() || "Matériau",
      image: customImage || preview?.image || "",
      description: preview?.description || "",
    };
    const meta = {};
    if (title.trim()) meta.label = title.trim();
    if (category) meta.category = category;
    if (customImage) meta.customImage = customImage;
    onAdd(linkEntry, meta);
    onClose();
  };

  const displayImage = customImage || preview?.image;
  const canSave = url.trim() || customImage;
  const showAskImage = fetched && !preview?.image && !customImage;
  const showDirectUpload = !url.trim() && !customImage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-base font-semibold">Ajouter un matériau</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Lien</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://..."
                value={url}
                autoFocus
                onChange={(e) => { setUrl(e.target.value); setPreview(null); setFetched(false); setCustomImage(""); }}
                onBlur={() => url.trim() && doFetchPreview(url)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); url.trim() && doFetchPreview(url); } }}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
              />
              {isFetching && (
                <span className="shrink-0 self-center text-xs text-slate-400">...</span>
              )}
            </div>
          </div>

          {displayImage ? (
            <div className="relative">
              <img src={displayImage} alt="" className="h-32 w-full rounded-lg object-cover" />
              {customImage && (
                <button
                  type="button"
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-sm font-bold shadow"
                  onClick={() => setCustomImage("")}
                >
                  ×
                </button>
              )}
            </div>
          ) : showAskImage ? (
            <div>
              <p className="mb-2 text-xs text-slate-500">Aucune image trouvée. Voulez-vous en ajouter une ?</p>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-black/20 py-3 text-sm text-slate-500 hover:bg-slate-50"
              >
                {uploading ? "Chargement…" : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>
                    </svg>
                    Ajouter une photo
                  </>
                )}
              </button>
            </div>
          ) : showDirectUpload ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-black/20 py-2.5 text-sm text-slate-400 hover:bg-slate-50"
            >
              {uploading ? "Chargement…" : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>
                  </svg>
                  ou ajouter une image directement
                </>
              )}
            </button>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { handleImageUpload(e.target.files?.[0]); e.target.value = ""; }}
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Parquet chêne naturel"
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

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
            disabled={!canSave}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
            onClick={handleSave}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkAction({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <>
      <button
        type="button"
        title="Ajouter un lien"
        aria-label="Ajouter un lien"
        onClick={() => setOpen(true)}
        className={`grid h-11 w-11 place-items-center rounded-md border border-black/15 bg-white/90 shadow-sm backdrop-blur hover:bg-white ${
          value ? "ring-2 ring-slate-900/20" : ""
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </button>
      {open ? createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="mx-4 w-full max-w-xs rounded-xl border border-black/10 bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Lien source</h2>
            <input
              type="url"
              autoFocus
              placeholder="https://..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black/30"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-slate-50">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { onChange(draft); setOpen(false); }}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function AddInspirationModal({ onClose, onFiles, onUrl, onInstagram }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const igData = parseInstagramUrl(trimmed);
      if (igData) {
        const preview = await fetchLinkPreview(trimmed);
        const titleLower = `${preview?.title || ""} ${preview?.description || ""}`.toLowerCase();
        const type = titleLower.includes("reel") ? "reel" : igData.type;
        onInstagram({ ...igData, type, thumbnailUrl: preview?.image || null });
        onClose();
        return;
      }
      const imageUrl = await extractImageFromUrl(trimmed);
      if (!imageUrl) {
        setError("Aucune image trouvée à cette adresse.");
        return;
      }
      await onUrl(imageUrl);
      onClose();
    } catch {
      setError("Erreur lors du chargement de l'image.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-xl border border-black/10 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Ajouter une inspiration</h2>
          <button type="button" onClick={onClose} className="text-xl text-slate-400 hover:text-slate-700 leading-none">×</button>
        </div>
        <form onSubmit={handleUrlSubmit} className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">Lien Pinterest ou Instagram</label>
          <div className="flex gap-2">
            <input
              type="url"
              autoFocus
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="https://..."
              className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black/30"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {loading ? <span className="block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : "OK"}
            </button>
          </div>
          {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
        </form>
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <div className="h-px flex-1 bg-black/10" />
          <span>ou</span>
          <div className="h-px flex-1 bg-black/10" />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) { onFiles(Array.from(e.target.files)); onClose(); }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-black/20 py-3 text-sm text-slate-500 hover:bg-slate-50"
        >
          Importer des photos
        </button>
      </div>
    </div>,
    document.body
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

function AiImageEditor({ imageSrc, imageKind, imageTitle, aiContext, imageMetadata, onApply, onAddToInspirations, authedFetch, projectId }) {
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
      const response = await authedFetch(`${API_BASE}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, prompt, projectId }),
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
                      if (url) onAddToInspirations(url);
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
                      if (url) onApply(url);
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
  saveMediaKey,
  authedFetch,
  projectId,
}) {
  const items = [
    ...(roomPlanImages[room] || []).flatMap((src, i) => {
      const key = `${room}-plan-${i}`;
      return planUploads[key] ? [{ src, key }] : [];
    }),
    ...(extraPlanImages[room] || []).map((src, i) => ({ src, key: `${room}-plan-extra-${i}` })),
  ].filter((item) => !deletedImages[item.key]);
  const [missingCards, setMissingCards] = useState({});
  const [index, setIndex] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const addFileInputRef = useRef(null);

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
      if (!url) { await showAlert("Échec de l'upload. Réessaie."); return; }
      setPlanUploads((prev) => ({ ...prev, [currentKey]: url }));
      if (saveMediaKey) saveMediaKey("planUploads", currentKey, url);
      if (!isPdfUrl(url)) {
        const analysis = await analyzeImageForContext({
          image: url,
          context: `Plan ${label}, pièce ${label}`,
          section: "plan",
          authedFetch,
          projectId,
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
      if (!url) { await showAlert("Échec de l'upload. Réessaie."); return; }
      setExtraPlanImages((prev) => {
        const newList = [...(prev[room] || []), url];
        if (saveMediaKey) saveMediaKey("extraPlanImages", room, newList);
        return { ...prev, [room]: newList };
      });
      if (!isPdfUrl(url)) {
        const analysis = await analyzeImageForContext({
          image: url,
          context: `Plan ajouté ${label}`,
          section: "plan",
          authedFetch,
          projectId,
        });
        if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
      }
    }
  };

  return (
    <div className="overflow-visible rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6]">
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
          <input
            ref={addFileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleAddImage(e.target.files[0]); e.target.value = ""; }}
          />
          <button
            type="button"
            title="Ajouter un plan ou une photo"
            aria-label="Ajouter un plan ou une photo"
            onClick={() => addFileInputRef.current?.click()}
            className="grid h-11 w-11 place-items-center rounded-full border border-black/15 bg-white text-lg leading-none shadow-sm hover:bg-[#fcf8d5]"
          >
            +
          </button>
        </div>
      </div>
      <div
        className={`group relative bg-[#e8e1d6]/60${currentSrc ? " h-64 sm:h-80 lg:h-[360px]" : ""}`}
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
          <div className="grid h-full place-items-center p-6 text-center">
            <div
              className="flex flex-col items-center gap-3 rounded-xl border border-white/70 bg-white/40 px-8 py-10 shadow-sm backdrop-blur-md cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => addFileInputRef.current?.click()}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#b0a89a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 9 12 2 21 9"/>
                <path d="M3 9v11a2 2 0 002 2h14a2 2 0 002-2V9"/>
                <rect x="9" y="12" width="6" height="9"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-600">Pas encore de plan</p>
                <p className="mt-0.5 text-xs text-slate-400">Clique pour ajouter un plan, une photo ou un PDF.</p>
              </div>
            </div>
          </div>
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
              authedFetch={authedFetch}
              projectId={projectId}
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

function Inspirations({ room, label, uploadedImages, setUploadedImages, inspirationLinks, setInspirationLinks, aiContext, aiInspirations, addAiInspiration, imageAnalysis, setImageAnalysis, deletedImages, setDeletedImages, onImageClick, instagramItems, setInstagramItems, onLogActivity, saveMediaKey, authedFetch, projectId }) {
  const items = [
    ...(roomInspirationImages[room] || []).flatMap((src, i) => {
      const cardKey = `${room}-${i}`;
      return uploadedImages[cardKey] ? [{ src, cardKey, index: i }] : [];
    }),
    ...(aiInspirations[room] || []).map((src, i) => ({ src, cardKey: `${room}-ai-${i}`, index: i })),
    ...(instagramItems[room] || []).map((ig) => ({ ...ig, cardKey: `${room}-ig-${ig.id}`, itemType: "instagram" })),
  ].filter((item) => !deletedImages[item.cardKey]);
  const [missingCards, setMissingCards] = useState({});
  const [instagramModal, setInstagramModal] = useState(null);
  const [page, setPage] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
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
      if (!url) { await showAlert("Échec de l'upload. Réessaie."); return; }
      setUploadedImages((prev) => ({ ...prev, [cardKey]: url }));
      if (saveMediaKey) saveMediaKey("uploadedImages", cardKey, url);
      const analysis = await analyzeImageForContext({
        image: url,
        context: `Inspiration ${label}, pièce ${label}`,
        section: "inspiration",
        authedFetch,
        projectId,
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
      if (!url) { await showAlert("Échec de l'upload. Réessaie."); return; }
      addAiInspiration(room, url);  // addAiInspiration calls saveMediaKey internally
      if (onLogActivity) onLogActivity("inspiration_added", room, {});
      const analysis = await analyzeImageForContext({
        image: url,
        context: `Inspiration ajoutée ${label}`,
        section: "inspiration",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
    }
  };

  const handleAddImages = async (files) => {
    await Promise.all(Array.from(files).map((f) => handleAddImage(f)));
  };

  const handleAddImageFromUrl = async (imageUrl) => {
    const nextIndex = (aiInspirations[room] || []).length;
    const nextKey = `${room}-ai-${nextIndex}`;
    const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext) ? ext : "jpg";
    const url = await uploadUrlToBlob(imageUrl, `${nextKey}-${Date.now()}.${safeExt}`);
    if (!url) return;
    addAiInspiration(room, url);
    if (onLogActivity) onLogActivity("inspiration_added", room, {});
    const analysis = await analyzeImageForContext({
      image: url,
      context: `Inspiration ajoutée ${label}`,
      section: "inspiration",
      authedFetch,
      projectId,
    });
    if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
  };

  const handleAddInstagram = (igData) => {
    const id = `${Date.now()}`;
    setInstagramItems((prev) => {
      const newList = [...(prev[room] || []), { id, ...igData }];
      if (saveMediaKey) saveMediaKey("instagramItems", room, newList);
      return { ...prev, [room]: newList };
    });
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
          <button
            type="button"
            title="Ajouter une inspiration"
            aria-label="Ajouter une inspiration"
            onClick={() => setAddModalOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-full border border-black/15 bg-white text-lg leading-none shadow-sm hover:bg-[#fcf8d5]"
          >
            +
          </button>
        </div>
      </div>
      {(() => {
        const [item0, item1, item2, item3] = visibleItems;

        const renderCard = (item, extraStyle = {}, extraClassName = "") => {
          if (!item) return null;
          const { src, cardKey, displayIndex: i } = item;

          if (item.itemType === "instagram") {
            const isReel = item.type === "reel";
            const hasThumbnail = !!item.thumbnailUrl;
            return (
              <div
                key={cardKey}
                className={`group relative overflow-hidden rounded-xl cursor-pointer${extraClassName ? ` ${extraClassName}` : ""}`}
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
              className={`group relative overflow-hidden rounded-xl bg-[#e8e4de]${extraClassName ? ` ${extraClassName}` : ""}`}
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
                  onApply={(image) => { setUploadedImages((prev) => ({ ...prev, [cardKey]: image })); if (saveMediaKey) saveMediaKey("uploadedImages", cardKey, image); }}
                  onAddToInspirations={(image) => addAiInspiration(room, image)}
                  authedFetch={authedFetch}
                  projectId={projectId}
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

        if (!item0) {
          return (
            <div className="grid place-items-center py-6 text-center">
              <div
                className="flex flex-col items-center gap-3 rounded-xl border border-white/70 bg-white/40 px-8 py-10 shadow-sm backdrop-blur-md cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => setAddModalOpen(true)}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#b0a89a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="m21 15-5-5L5 21"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-slate-600">Pas encore d'inspirations</p>
                  <p className="mt-0.5 text-xs text-slate-400">Clique pour ajouter tes premières inspirations.</p>
                </div>
              </div>
            </div>
          );
        }

        if (!item1) {
          return renderCard(item0, { aspectRatio: "16/9" });
        }

        const hasBottom = !!(item2 || item3);

        return (
          <div className={`bento-grid${hasBottom ? "" : " no-bottom"}`}>
            {renderCard(item0, { gridArea: "hero", aspectRatio: "16/9" })}
            {renderCard(item1, { gridArea: "tall" }, "bento-tall")}
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
                    setInstagramItems((prev) => {
                      const newList = (prev[room] || []).filter((ig) => `${room}-ig-${ig.id}` !== deleteConfirm);
                      if (saveMediaKey) saveMediaKey("instagramItems", room, newList);
                      return { ...prev, [room]: newList };
                    });
                  } else {
                    setDeletedImages((prev) => { if (saveMediaKey) saveMediaKey("deletedImages", deleteConfirm, true); return { ...prev, [deleteConfirm]: true }; });
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
      {addModalOpen ? (
        <AddInspirationModal
          onClose={() => setAddModalOpen(false)}
          onFiles={handleAddImages}
          onUrl={handleAddImageFromUrl}
          onInstagram={handleAddInstagram}
        />
      ) : null}
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
  saveMediaKey,
  authedFetch,
  projectId,
}) {
  const items = [
    ...(materialsByRoom[room] || []).flatMap((item, i) => {
      const cardKey = `${room}-material-${i}`;
      return materialUploads[cardKey] ? [{ item, cardKey, index: i }] : [];
    }),
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
  const [addModalOpen, setAddModalOpen] = useState(false);
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
      if (!url) { await showAlert("Échec de l'upload. Réessaie."); return; }
      setMaterialUploads((prev) => ({ ...prev, [cardKey]: url }));
      if (saveMediaKey) saveMediaKey("materialUploads", cardKey, url);
      const analysis = await analyzeImageForContext({
        image: url,
        context: `Matériau ${room}, ${cardKey}`,
        section: "matériau",
        authedFetch,
        projectId,
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [cardKey]: analysis }));
    }
  };

  const handleAddFromModal = (linkEntry, meta) => {
    const nextIndex = (extraMaterialImages[room] || []).length;
    const nextKey = `${room}-material-extra-${nextIndex}`;
    setExtraMaterialImages((prev) => {
      const newList = [...(prev[room] || []), { type: "link", ...linkEntry }];
      if (saveMediaKey) saveMediaKey("extraMaterialImages", room, newList);
      return { ...prev, [room]: newList };
    });
    if (Object.keys(meta).length) {
      setExtraMaterialMeta((prev) => ({ ...prev, [nextKey]: meta }));
    }
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
          <button
            type="button"
            title="Ajouter un matériau"
            aria-label="Ajouter un matériau"
            onClick={() => setAddModalOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-full border border-black/15 bg-white text-lg leading-none shadow-sm hover:bg-[#fcf8d5]"
          >
            +
          </button>
        </div>
      </div>
      {visibleItems.length === 0 && (
        <div className="grid place-items-center py-6 text-center">
          <div
            className="flex flex-col items-center gap-3 rounded-xl border border-white/70 bg-white/40 px-8 py-10 shadow-sm backdrop-blur-md cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => setAddModalOpen(true)}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#b0a89a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2H2v10l9.29 9.29a1 1 0 001.42 0l6.58-6.58a1 1 0 000-1.42L12 2z"/>
              <circle cx="7" cy="7" r="1.5" fill="#b0a89a" stroke="none"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-slate-600">Pas encore de matériaux</p>
              <p className="mt-0.5 text-xs text-slate-400">Clique pour ajouter des matériaux, revêtements ou références produit.</p>
            </div>
          </div>
        </div>
      )}
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
                      onApply={(image) => { setMaterialUploads((prev) => ({ ...prev, [cardKey]: image })); if (saveMediaKey) saveMediaKey("materialUploads", cardKey, image); }}
                      onAddToInspirations={(image) => addAiInspiration(room, image)}
                      authedFetch={authedFetch}
                      projectId={projectId}
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
                  setDeletedImages((prev) => { if (saveMediaKey) saveMediaKey("deletedImages", deleteConfirm, true); return { ...prev, [deleteConfirm]: true }; });
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
      {addModalOpen && (
        <AddMaterialModal
          onAdd={handleAddFromModal}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
}

function GeneralPaletteSection({ orderedActiveRooms, allRoomPresets, getRoomColors, onNavigateToRoom }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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
                ].map(({ hex, name, sublabel }) => (
                  <div key={sublabel} className="min-w-0 flex-1">
                    <div className="mb-1 h-7 rounded border border-black/10" style={{ backgroundColor: hex }} />
                    <div className="truncate text-[10px] text-slate-400">{sublabel}</div>
                    <div className="truncate text-[10px] text-slate-600">{name}</div>
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
    <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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
    <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Appartement</p>
      <h2 className="type-h2">Documents</h2>
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
      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue d'ensemble</p>
        <h2 className="type-h2">Documents par pièce</h2>
        <p className="mt-1 text-sm text-slate-600">Devis, plans et fichiers uploadés dans chaque pièce.</p>
      </div>
      {roomsWithDocs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-black/15 bg-white p-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#fdf9f4] text-2xl shadow-sm">🗂️</span>
          <p className="text-sm font-medium text-slate-600">Aucun document uploadé pour l'instant</p>
          <p className="max-w-sm text-xs text-slate-400">
            Ouvre une pièce et ajoute des fichiers dans la section « Devis & documents » pour les retrouver ici.
          </p>
        </div>
      ) : (
        roomsWithDocs.map((key) => {
          const p = allRoomPresets[key];
          const docs = roomDocuments[key] || [];
          return (
            <div key={key} className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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
      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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
        <div className="grid place-items-center py-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-white/70 bg-white/40 px-8 py-10 shadow-sm backdrop-blur-md">
            <p className="text-sm text-slate-400">
              {filter === "mentions" ? "Aucune mention non lue." : filter === "all" ? "Aucune discussion pour l'instant." : `Aucun fil ${filter === "open" ? "ouvert" : "résolu"} pour l'instant.`}
            </p>
          </div>
        </div>
      ) : allRooms.map((roomKey) => {
        const discussions = (discussionsCache?.[roomKey] || []).filter((d) => {
          if (filter === "mentions") return unreadMentionIds.has(d.id);
          return filter === "all" || d.status === filter;
        });
        if (discussions.length === 0) return null;
        return (
          <div key={roomKey} className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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

function parseLinksFromContent(content) {
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({ title: match[1], url: match[2] });
  }
  return links;
}

function ProductCard({ title, url, onInvalid }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinkPreview(url)
      .then((data) => {
        if (data?.ok === false) { onInvalid?.(); return; }
        setPreview(data);
        setLoading(false);
      })
      .catch(() => { setPreview({ url, title, description: null, image: null }); setLoading(false); });
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-[148px] max-w-[148px] flex-col overflow-hidden rounded-xl border border-black/10 bg-white text-slate-800 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative h-[110px] w-full shrink-0 bg-slate-100">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-slate-200" />
        ) : preview?.image ? (
          <img src={preview.image} alt={preview.title || title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-slate-800">
          {loading ? <span className="inline-block h-3 w-3/4 animate-pulse rounded bg-slate-200" /> : (preview?.title || title)}
        </p>
        {!loading && preview?.description ? (
          <p className="line-clamp-2 text-[10px] leading-snug text-slate-500">{preview.description}</p>
        ) : null}
        <div className="mt-auto pt-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-2.5 text-slate-300">
            <path d="M6.22 8.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v1.69a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72Z"/><path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z"/>
          </svg>
        </div>
      </div>
    </a>
  );
}

function ProductCarousel({ links }) {
  const scrollRef = useRef(null);
  const [invalidUrls, setInvalidUrls] = useState(() => new Set());
  const markInvalid = (url) => {
    setInvalidUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
  };
  const scroll = (dir) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 160, behavior: "smooth" });
  };
  const visibleLinks = links.filter((link) => !invalidUrls.has(link.url));
  if (!visibleLinks.length) return null;
  return (
    <div className="relative -mx-4 mt-2">
      <div ref={scrollRef} className="flex gap-2.5 overflow-x-auto px-4 pb-1" style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {visibleLinks.map((link) => (
          <div key={link.url} style={{ scrollSnapAlign: "start" }}>
            <ProductCard title={link.title} url={link.url} onInvalid={() => markInvalid(link.url)} />
          </div>
        ))}
      </div>
      {visibleLinks.length > 2 && (
        <>
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="absolute -left-1 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-white shadow-md border border-black/10 text-slate-600 hover:bg-slate-50"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="absolute -right-1 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-white shadow-md border border-black/10 text-slate-600 hover:bg-slate-50"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </>
      )}
    </div>
  );
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
      const r = await authedFetch(`${API_BASE}/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-message', projectId, discussionId, content, linkedImage, mentionedUserIds: toMention }) });
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
      const r = await fetch(`${API_BASE}/upload-image`, { method: 'POST', body: fd });
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
    await authedFetch(`${API_BASE}/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-delete-message', projectId, messageId }) }).catch(() => {});
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
    await authedFetch(`${API_BASE}/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-update', projectId, discussionId, status: newStatus }) }).catch(() => {});
    onDiscussionUpdate?.({ status: newStatus });
  };

  const handleTogglePin = async () => {
    const newPinned = !isPinned;
    await authedFetch(`${API_BASE}/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-update', projectId, discussionId, isPinned: newPinned }) }).catch(() => {});
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

function DiscussionsPanel({ room, projectId, user, isOwner, discussions, onDiscussionsChange, authedFetch, projectMembers, allRoomPresets, orderedActiveRooms, onNavigateToRoom, onDiscussionUpdate, onMarkMentionsRead, onLogActivity }) {
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
      const r = await authedFetch(`${API_BASE}/save-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'discussion-create', projectId, roomKey: room, title: newTitle }) });
      const { discussionId } = await r.json();
      const newDisc = { id: discussionId, title: newTitle.trim(), status: 'open', is_pinned: false, message_count: 0, last_message_preview: null, last_message_at: null, created_at: new Date().toISOString(), created_by: user?.id, unread_count: 0 };
      onDiscussionsChange(room, [newDisc, ...(discussions || [])]);
      if (onLogActivity) onLogActivity("discussion_added", room, { title: newTitle.trim() });
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
      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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
        <div className="grid place-items-center py-6 text-center">
          <div
            className={`flex flex-col items-center gap-3 rounded-xl border border-white/70 bg-white/40 px-8 py-10 shadow-sm backdrop-blur-md transition-shadow ${filter === 'all' ? 'cursor-pointer hover:shadow-lg' : ''}`}
            onClick={filter === 'all' ? () => setShowCreate(true) : undefined}
          >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#b0a89a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-600">
                  {filter === 'all' ? "Pas encore de discussions" : 'Aucun fil dans cette catégorie.'}
                </p>
                {filter === 'all' && <p className="mt-0.5 text-xs text-slate-400">Clique pour créer le premier fil d'échange.</p>}
              </div>
            </div>
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

function ChatPanel({ room, isGeneral = false, availableRooms = [], globalSelectedTotal = null, aiContext, chatHistory, setChatHistory, roomImages, setRoomLists, setRoomNotes, setRoomColorTests, saveRoomColorTestsFn, projectId, authedFetch, saveMessageFn, clearChatFn, saveNoteFn, saveRoomItemsFn, onClose, isExpanded, onToggleExpand, draft = "", onDraftChange, addAiInspiration, addExtraPlanImage, orderedActiveRooms = [], allRoomPresets = {}, roomLists = {} }) {
  const [input, setInput] = useState(draft);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [generatingFor, setGeneratingFor] = useState(null);
  const [pendingImages, setPendingImages] = useState([]);
  const [pendingPreviews, setPendingPreviews] = useState([]);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [devisReviewFor, setDevisReviewFor] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [addingSectionFor, setAddingSectionFor] = useState(null);
  const [addedToSection, setAddedToSection] = useState(null);

  const messages = chatHistory[room] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current && input) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 240) + "px";
    }
  }, []);

  const handleImagePick = (e) => {
    const allFiles = Array.from(e.target.files);
    if (!allFiles.length) return;
    const pdfFiles = allFiles.filter((f) => f.type === "application/pdf");
    const imageFiles = allFiles.filter((f) => f.type !== "application/pdf");

    if (pdfFiles.length) {
      setUploadingCount((prev) => prev + pdfFiles.length);
      Promise.all(
        pdfFiles.map(async (file) => {
          const blobUrl = URL.createObjectURL(file);
          try {
            const { text } = await extractPdfText(blobUrl);
            return { name: file.name, text };
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        })
      ).then((docs) => {
        setPendingDocs((prev) => [...prev, ...docs]);
        setUploadingCount((prev) => prev - pdfFiles.length);
      }).catch(() => {
        setUploadingCount((prev) => prev - pdfFiles.length);
      });
    }

    if (imageFiles.length) {
      setUploadingCount((prev) => prev + imageFiles.length);
      Promise.all(
        imageFiles.map(async (file) => {
          const raw = await readFileAsDataUrl(file);
          const normalized = await normalizeImageForAi(raw);
          const url = await uploadToBlob(normalized, `chat-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
          return { url, preview: normalized };
        })
      ).then((results) => {
        setPendingImages((prev) => [...prev, ...results.map((r) => r.url)]);
        setPendingPreviews((prev) => [...prev, ...results.map((r) => r.preview)]);
        setUploadingCount((prev) => prev - imageFiles.length);
      }).catch(() => {
        setUploadingCount((prev) => prev - imageFiles.length);
      });
    }

    e.target.value = "";
  };

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if ((!trimmed && !pendingImages.length && !pendingDocs.length) || isLoading) return;

    const userMsg = {
      id: `msg-${Date.now()}`, role: "user", content: trimmed,
      ...(pendingImages.length > 0 ? { images: pendingImages } : {}),
      ...(pendingDocs.length > 0 ? { docs: pendingDocs } : {}),
    };
    const nextHistory = [...messages, userMsg];
    setPendingImages([]);
    setPendingPreviews([]);
    setPendingDocs([]);
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
      messages: nextHistory.slice(-20).map(({ role, content, image, images, docs }, i, arr) => {
        const imgList = images?.length ? images : image ? [image] : [];
        const inWindow = i >= arr.length - 4;
        return {
          role,
          content,
          ...(imgList.length > 0 && inWindow ? { images: imgList } : {}),
          ...(docs?.length > 0 && inWindow ? { docs: docs.map((d) => ({ name: d.name, text: d.text })) } : {}),
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
        selectedTotal: aiContext.selectedTotal,
        todoItems: aiContext.todoItems,
        materialSummary: aiContext.materialSummary,
        testColors: aiContext.roomTestColors,
      },
      projectId,
      ...(isGeneral ? { isGeneral: true, availableRooms, globalSelectedTotal } : {}),
    });

    const applyToolCalls = (toolCalls, msg) => {
      const notices = [];
      for (const call of toolCalls) {
        const targetRoom = isGeneral ? (call.args.room_key || null) : room;
        if (!targetRoom) continue;
        const targetLabel = isGeneral ? (availableRooms.find((r) => r.key === targetRoom)?.label || targetRoom) : null;
        const roomSuffix = targetLabel ? ` → ${targetLabel}` : "";

        if (call.name === "add_to_shopping_list" && setRoomLists) {
          const newItems = (call.args.items || []).map((itemText) => {
            const urlMatch = itemText.match(/https?:\/\/[^\s]+/);
            const url = urlMatch ? urlMatch[0] : null;
            return { id: `shopping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: itemText, done: false, ...(url ? { url, previewLoading: true } : {}) };
          });
          setRoomLists((prev) => {
            const updated = [...((prev[targetRoom] || {}).shopping || []), ...newItems];
            if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, targetRoom, "shopping", updated);
            return { ...prev, [targetRoom]: { ...(prev[targetRoom] || {}), shopping: updated } };
          });
          for (const item of newItems.filter((i) => i.url)) {
            fetchLinkPreview(item.url).then((preview) => {
              setRoomLists((prev) => {
                const updatedItems = ((prev[targetRoom] || {}).shopping || []).map((i) =>
                  i.id === item.id
                    ? { ...i, previewLoading: false, ...(preview.image ? { image: preview.image } : {}), ...(preview.title ? { previewTitle: preview.title } : {}), ...(preview.price != null ? { price: preview.price, priceCurrency: preview.currency || undefined } : {}) }
                    : i
                );
                if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, targetRoom, "shopping", updatedItems);
                return { ...prev, [targetRoom]: { ...(prev[targetRoom] || {}), shopping: updatedItems } };
              });
            }).catch(() => {
              setRoomLists((prev) => {
                const updatedItems = ((prev[targetRoom] || {}).shopping || []).map((i) => i.id === item.id ? { ...i, previewLoading: false } : i);
                return { ...prev, [targetRoom]: { ...(prev[targetRoom] || {}), shopping: updatedItems } };
              });
            });
          }
          notices.push(`${newItems.length} article${newItems.length > 1 ? "s" : ""} ajouté${newItems.length > 1 ? "s" : ""} à la liste${roomSuffix}.`);
        } else if (call.name === "add_to_todo_list" && setRoomLists) {
          const newItems = (call.args.items || []).map((itemText) => {
            const urlMatch = itemText.match(/https?:\/\/[^\s]+/);
            const url = urlMatch ? urlMatch[0] : null;
            return { id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: itemText, done: false, ...(url ? { url, previewLoading: true } : {}) };
          });
          setRoomLists((prev) => {
            const updated = [...((prev[targetRoom] || {}).todos || []), ...newItems];
            if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, targetRoom, "todos", updated);
            return { ...prev, [targetRoom]: { ...(prev[targetRoom] || {}), todos: updated } };
          });
          for (const item of newItems.filter((i) => i.url)) {
            fetchLinkPreview(item.url).then((preview) => {
              setRoomLists((prev) => {
                const updatedItems = ((prev[targetRoom] || {}).todos || []).map((i) =>
                  i.id === item.id
                    ? { ...i, previewLoading: false, ...(preview.image ? { image: preview.image } : {}), ...(preview.title ? { previewTitle: preview.title } : {}), ...(preview.price != null ? { price: preview.price, priceCurrency: preview.currency || undefined } : {}) }
                    : i
                );
                if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, targetRoom, "todos", updatedItems);
                return { ...prev, [targetRoom]: { ...(prev[targetRoom] || {}), todos: updatedItems } };
              });
            }).catch(() => {
              setRoomLists((prev) => {
                const updatedItems = ((prev[targetRoom] || {}).todos || []).map((i) => i.id === item.id ? { ...i, previewLoading: false } : i);
                return { ...prev, [targetRoom]: { ...(prev[targetRoom] || {}), todos: updatedItems } };
              });
            });
          }
          notices.push(`${newItems.length} tâche${newItems.length > 1 ? "s" : ""} ajoutée${newItems.length > 1 ? "s" : ""} aux todos${roomSuffix}.`);
        } else if (call.name === "save_room_note" && setRoomNotes) {
          setRoomNotes((prev) => ({ ...prev, [targetRoom]: call.args.note }));
          if (saveNoteFn && projectId) saveNoteFn(projectId, targetRoom, call.args.note);
          notices.push(`Note mise à jour${roomSuffix}.`);
        } else if (call.name === "update_item" && setRoomLists) {
          const { item_id, list_type, due_date, assignee, price, price_currency, selected_for_purchase } = call.args;
          const listKey = list_type === "shopping" ? "shopping" : "todos";
          setRoomLists((prev) => {
            const currentItems = (prev[targetRoom] || {})[listKey] || [];
            const patch = {};
            if ("due_date" in call.args) patch.dueDate = due_date || undefined;
            if ("assignee" in call.args) patch.assignee = assignee || undefined;
            if ("price" in call.args) {
              patch.price = typeof price === "number" ? price : undefined;
              patch.priceCurrency = typeof price === "number" ? (price_currency || "EUR") : undefined;
            }
            if ("selected_for_purchase" in call.args && listKey === "shopping") {
              const nextStatus = selected_for_purchase ? "selectionne" : "envie";
              patch.status = nextStatus;
              Object.assign(patch, deriveFlagsFromStatus(nextStatus));
            }
            const newItems = currentItems.map((item) => item.id === item_id ? { ...item, ...patch } : item);
            if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, targetRoom, listKey, newItems);
            return { ...prev, [targetRoom]: { ...(prev[targetRoom] || {}), [listKey]: newItems } };
          });
          const parts = [];
          if ("due_date" in call.args) parts.push(due_date ? `échéance ${due_date}` : "échéance supprimée");
          if ("assignee" in call.args) parts.push(assignee ? `assigné à ${assignee}` : "responsable retiré");
          if ("price" in call.args) parts.push(typeof price === "number" ? `prix ${formatPrice(price, price_currency)}` : "prix supprimé");
          if ("selected_for_purchase" in call.args) parts.push(selected_for_purchase ? "sélectionné pour l'achat" : "retiré des achats");
          if (parts.length) notices.push(`Item mis à jour (${parts.join(", ")})${roomSuffix}.`);
        } else if (call.name === "add_test_color" && setRoomColorTests) {
          const currentColors = isGeneral ? (availableRooms.find((r) => r.key === targetRoom)?.testColors || []) : (aiContext.roomTestColors || []);
          const matched = (call.args.names || [])
            .map((n) => FARROW_BALL_LIBRARY.find((c) => c.name.toLowerCase() === String(n).trim().toLowerCase()))
            .filter(Boolean)
            .filter((c) => !currentColors.some((existing) => existing.hex === c.hex));
          if (matched.length) {
            const updated = [...currentColors, ...matched.map((c) => ({ id: `color-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, hex: c.hex, name: c.name, number: c.number, chosen: false }))];
            setRoomColorTests((prev) => ({ ...prev, [targetRoom]: updated }));
            if (saveRoomColorTestsFn && projectId) saveRoomColorTestsFn(projectId, targetRoom, updated);
            notices.push(`${matched.length} couleur${matched.length > 1 ? "s" : ""} ajoutée${matched.length > 1 ? "s" : ""} en test${roomSuffix}.`);
          }
        } else if (call.name === "mark_color_chosen" && setRoomColorTests) {
          const currentColors = isGeneral ? (availableRooms.find((r) => r.key === targetRoom)?.testColors || []) : (aiContext.roomTestColors || []);
          const target = currentColors.find((c) => c.id === call.args.item_id);
          if (target) {
            const updated = currentColors.map((c) => c.id === call.args.item_id ? { ...c, chosen: !!call.args.chosen } : c);
            setRoomColorTests((prev) => ({ ...prev, [targetRoom]: updated }));
            if (saveRoomColorTestsFn && projectId) saveRoomColorTestsFn(projectId, targetRoom, updated);
            notices.push(`${target.name} marquée ${call.args.chosen ? "choisie" : "non choisie"}${roomSuffix}.`);
          }
        }
      }
      if (notices.length) {
        msg.content = (msg.content ? msg.content + "\n\n" : "") + `*${notices.join(" ")}*`;
      }
    };

    try {
      const res = await authedFetch(`${API_BASE}/chat`, {
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
      const res = await authedFetch(`${API_BASE}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, prompt: imagePrompt, projectId }),
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
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {isGeneral ? "Appartement" : aiContext.roomLabel}
          </span>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setChatHistory((prev) => ({ ...prev, [room]: [] }));
                if (clearChatFn && projectId) clearChatFn(projectId, room);
              }}
              className="text-xs text-slate-400 hover:text-slate-500 transition-colors"
            >
              Effacer
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {onToggleExpand ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label={isExpanded ? "Réduire" : "Élargir"}
              title={isExpanded ? "Réduire" : "Élargir"}
            >
              {isExpanded ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
                </svg>
              )}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Fermer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                </svg>
              </div>
              <p className="text-sm text-slate-500 leading-snug max-w-[200px]">{isGeneral ? "Que puis-je faire pour votre" : "Que puis-je faire pour"} <span className="font-medium text-slate-700">{isGeneral ? "appartement" : aiContext.roomLabel}</span> ?</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {[
                { label: "Liste de courses", icon: "🛒" },
                { label: "Tâches à faire", icon: "✓" },
                { label: "Couleurs pour les murs ?", icon: null },
                { label: "Ambiance lumineuse ?", icon: null },
              ].map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendMessage(label)}
                  className="rounded-full border border-black/12 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:border-black/20 transition-colors"
                >
                  {icon && <span className="mr-1">{icon}</span>}{label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 py-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="shrink-0 h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] mt-0.5">✦</div>
              )}
              <div className={`space-y-2 text-sm ${
                msg.role === "user"
                  ? "w-fit max-w-[80%] rounded-2xl px-4 py-2.5 bg-[#f4f4f4] text-slate-900"
                  : msg.error
                  ? "flex-1 min-w-0 rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-100"
                  : "flex-1 min-w-0 text-slate-800 leading-relaxed"
              }`}>
                {(msg.images?.length > 0 || msg.image) ? (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {(msg.images || [msg.image]).map((img, i) => (
                      <img key={i} src={img} alt="" className="max-h-40 max-w-full rounded-lg object-contain" />
                    ))}
                  </div>
                ) : null}
                {msg.docs?.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {msg.docs.map((doc, i) => (
                      <button key={i} type="button" onClick={() => setDevisReviewFor(doc)}
                        className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                        <span>📄</span>
                        <span className="max-w-[140px] truncate">{doc.name}</span>
                        <span className="text-slate-400">· Analyser ce devis</span>
                      </button>
                    ))}
                  </div>
                )}
                {msg.content ? <p className="whitespace-pre-wrap leading-relaxed">{renderMessageContent(msg.content)}</p> : null}
                {msg.role === "assistant" && !msg.error && msg.content && (() => {
                  const links = parseLinksFromContent(msg.content);
                  return links.length >= 2 ? <ProductCarousel links={links} /> : null;
                })()}
                {msg.generatedImage ? (
                  <div className="mt-2 space-y-2">
                    <img src={msg.generatedImage} alt="Image générée" className="w-full rounded-lg" />
                    {addedToSection === msg.generatedImage ? (
                      <p className="text-xs text-green-400 font-medium">Ajouté ✓</p>
                    ) : addingSectionFor === msg.generatedImage ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-500">Ajouter à :</p>
                        <div className="flex flex-wrap gap-1.5">
                          {addAiInspiration && (
                            <button
                              type="button"
                              onClick={() => {
                                addAiInspiration(room, msg.generatedImage);
                                setAddingSectionFor(null);
                                setAddedToSection(msg.generatedImage);
                                setTimeout(() => setAddedToSection(null), 2000);
                              }}
                              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
                            >
                              Inspirations
                            </button>
                          )}
                          {addExtraPlanImage && (
                            <button
                              type="button"
                              onClick={() => {
                                addExtraPlanImage(room, msg.generatedImage);
                                setAddingSectionFor(null);
                                setAddedToSection(msg.generatedImage);
                                setTimeout(() => setAddedToSection(null), 2000);
                              }}
                              className="rounded-full border border-black/20 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Plans
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setAddingSectionFor(null)}
                            className="px-1 text-xs text-slate-400 hover:text-slate-600"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingSectionFor(msg.generatedImage)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/20 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        Ajouter à une section
                      </button>
                    )}
                  </div>
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
          <div className="flex gap-3 justify-start py-1">
            <div className="shrink-0 h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] mt-0.5">✦</div>
            <div className="flex items-center gap-1 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]"/>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]"/>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]"/>
            </div>
          </div>
        ) : null}
        {generatingFor ? (
          <div className="flex gap-3 justify-start py-1">
            <div className="shrink-0 h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] mt-0.5">✦</div>
            <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
              <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 12h-4z" />
              </svg>
              <span>Génération de l'image en cours…</span>
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-black/8 p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleImagePick}
        />
        <div className="rounded-xl border border-black/12 bg-[#f9f7f3] overflow-hidden focus-within:border-slate-400 focus-within:bg-white transition-colors">
          {(pendingPreviews.length > 0 || pendingDocs.length > 0 || uploadingCount > 0) ? (
            <div className="flex flex-wrap items-end gap-2 px-3 pt-3">
              {pendingPreviews.map((preview, i) => (
                <div key={i} className="relative">
                  <img src={preview} alt="preview" className="h-14 w-14 rounded-lg object-cover border border-black/10" />
                  <button
                    type="button"
                    onClick={() => {
                      setPendingImages((prev) => prev.filter((_, j) => j !== i));
                      setPendingPreviews((prev) => prev.filter((_, j) => j !== i));
                    }}
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-slate-900 text-[9px] text-white leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
              {pendingDocs.map((doc, i) => (
                <div key={i} className="relative flex h-14 max-w-[140px] items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2">
                  <span className="text-lg leading-none">📄</span>
                  <span className="truncate text-xs text-slate-600">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingDocs((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-slate-900 text-[9px] text-white leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
              {uploadingCount > 0 && (
                <div className="h-14 w-14 rounded-lg border border-black/10 bg-slate-100 grid place-items-center">
                  <svg className="animate-spin text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                </div>
              )}
            </div>
          ) : null}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              onDraftChange?.(val);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 240) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Pose une question sur cette pièce…"
            rows={1}
            className="w-full resize-none bg-transparent px-3 pt-3 pb-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none overflow-hidden"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-black/5 disabled:opacity-40 transition-colors"
              title="Joindre des photos ou un PDF"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={(!input.trim() && !pendingImages.length && !pendingDocs.length) || isLoading || uploadingCount > 0}
              className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-white disabled:opacity-30 hover:bg-slate-700 transition-colors"
              title="Envoyer (Cmd+Entrée)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>
              </svg>
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">Cmd+Entrée pour envoyer</p>
      </div>
      {devisReviewFor && (
        <DevisImportReview
          documentName={devisReviewFor.name}
          initialText={devisReviewFor.text}
          projectId={projectId}
          roomKey={isGeneral ? "general" : room}
          authedFetch={authedFetch}
          roomLists={roomLists}
          setRoomLists={setRoomLists}
          saveRoomItemsFn={saveRoomItemsFn}
          orderedActiveRooms={orderedActiveRooms}
          allRoomPresets={allRoomPresets}
          onClose={() => setDevisReviewFor(null)}
        />
      )}
    </div>
  );
}

function TodosGlobalView({ orderedActiveRooms, allRoomPresets, roomLists, setRoomLists, projectId, saveRoomItemsFn, itemReactions = {}, currentUserId = null, onToggleReaction = null, persons = [], projectMembers = [], setPersons = null, savePersonsFn = null }) {
  const [filter, setFilter] = useState("all");
  const [hideDone, setHideDone] = useState(true);
  const [groupBy, setGroupBy] = useState("room"); // "room" | "week"
  const [roomInputs, setRoomInputs] = useState({}); // { [roomKey]: string }
  const [roomInputOpen, setRoomInputOpen] = useState({}); // { [roomKey]: bool }
  const [editingDate, setEditingDate] = useState(null); // `${roomKey}-${listKey}-${id}`
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [openPicker, setOpenPicker] = useState(null);

  const allPersons = [
    ...projectMembers.map(m => ({ id: m.id, name: m.name })),
    ...persons.map(p => ({ id: p.id, name: p.name })),
  ].filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i);

  const createPerson = (name) => {
    if (!setPersons) return;
    const newPerson = { id: `person-${Date.now()}`, name };
    const updated = [...persons, newPerson];
    setPersons(updated);
    if (savePersonsFn && projectId) savePersonsFn(projectId, updated);
  };

  const toggleItem = (roomKey, listKey, id) => {
    setRoomLists((prev) => {
      const updatedList = ((prev[roomKey] || {})[listKey] || []).map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      const next = { ...prev, [roomKey]: { ...(prev[roomKey] || {}), [listKey]: updatedList } };
      if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, roomKey, listKey, updatedList);
      return next;
    });
  };

  const deleteItem = (roomKey, listKey, id) => {
    setRoomLists((prev) => {
      const updatedList = ((prev[roomKey] || {})[listKey] || []).filter((item) => item.id !== id);
      const next = { ...prev, [roomKey]: { ...(prev[roomKey] || {}), [listKey]: updatedList } };
      if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, roomKey, listKey, updatedList);
      return next;
    });
  };

  const updateItemMeta = (roomKey, listKey, id, patch) => {
    setRoomLists((prev) => {
      const updatedList = ((prev[roomKey] || {})[listKey] || []).map((item) => item.id === id ? { ...item, ...patch } : item);
      const next = { ...prev, [roomKey]: { ...(prev[roomKey] || {}), [listKey]: updatedList } };
      if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, roomKey, listKey, updatedList);
      return next;
    });
  };

  const addItemToRoom = (roomKey, listKey, text) => {
    if (!text.trim()) return;
    const id = `${listKey}-${Date.now()}`;
    const newItem = { id, text: text.trim(), done: false };
    setRoomLists((prev) => {
      const currentItems = ((prev[roomKey] || {})[listKey] || []);
      const newItems = [...currentItems, newItem];
      if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, roomKey, listKey, newItems);
      return { ...prev, [roomKey]: { ...(prev[roomKey] || {}), [listKey]: newItems } };
    });
    setRoomInputs((prev) => ({ ...prev, [roomKey]: "" }));
    setRoomInputOpen((prev) => ({ ...prev, [roomKey]: false }));
  };

  const isSelectedForPurchase = (item) => !!item.selectedForPurchase;

  // Collect all items across all rooms + the room-agnostic "Appartement" bucket
  const allItemsFlat = ["general", ...orderedActiveRooms].flatMap((roomKey) => {
    const list = roomLists[roomKey] || {};
    const shopping = filter !== "todos"
      ? (list.shopping || [])
          .filter((i) => filter !== "courses" || isSelectedForPurchase(i))
          .map((i) => ({ ...i, listKey: "shopping", roomKey }))
      : [];
    const todos = filter === "all" || filter === "todos" ? (list.todos || []).map((i) => ({ ...i, listKey: "todos", roomKey })) : [];
    return [...shopping, ...todos];
  });

  const visibleItems = hideDone ? allItemsFlat.filter((i) => !i.done) : allItemsFlat;

  const totalPending = allItemsFlat.filter((i) => !i.done).length;

  // ── Week grouping helpers ────────────────────────────────────────────────
  const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const MONTHS_SHORT = ["jan","fév","mar","avr","mai","juin","juil","aoû","sep","oct","nov","déc"];
  const weekLabel = (monday) => {
    const todayMonday = getMonday(new Date());
    const diff = Math.round((monday - todayMonday) / (7 * 86400000));
    if (diff === 0) return "Cette semaine";
    if (diff === 1) return "Semaine prochaine";
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
    return `${monday.getDate()} – ${sunday.getDate()} ${MONTHS_SHORT[sunday.getMonth()]}`;
  };

  const buildWeekGroups = (items) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const overdue = [];
    const byWeek = {};
    const noDate = [];

    for (const item of items) {
      if (!item.dueDate) { noDate.push(item); continue; }
      if (item.dueDate < todayStr) { overdue.push(item); continue; }
      const monday = getMonday(new Date(item.dueDate + "T00:00:00"));
      const key = monday.toISOString().split("T")[0];
      if (!byWeek[key]) byWeek[key] = { monday, items: [] };
      byWeek[key].items.push(item);
    }

    const sortedWeeks = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b));
    return { overdue, weeks: sortedWeeks.map(([, v]) => v), noDate };
  };

  // ── Shared item row ──────────────────────────────────────────────────────
  const renderItemRow = (item, showRoom = false) => {
    const { roomKey, listKey, id } = item;
    const dateKey = `${roomKey}-${listKey}-${id}`;
    const pickerKey = `item-${id}`;
    const reactions = itemReactions[id] || [];
    return (
      <li key={id}
        className={`group flex flex-col gap-0.5 rounded-lg border px-3 py-2 ${
          item.done ? "border-black/5 bg-white opacity-50"
          : listKey === "shopping" && isSelectedForPurchase(item) ? "border-[#c9d3b6] bg-[#eef1e4]"
          : "border-black/10 bg-white"
        }`}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => toggleItem(roomKey, listKey, id)}
            className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${item.done ? "border-slate-300 bg-slate-100 text-slate-500" : "border-black/20 bg-white hover:bg-slate-50"}`}>
            {item.done ? "✓" : ""}
          </button>
          {item.url ? (
            <span className="min-w-0 flex-1" />
          ) : (
            <span className={`min-w-0 flex-1 break-words text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{item.text}</span>
          )}
          {showRoom && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              {roomKey === "general" ? "Appartement" : allRoomPresets[roomKey]?.label}
            </span>
          )}
          {filter === "all" && listKey === "shopping" && (
            isSelectedForPurchase(item) ? (
              <span className="shrink-0 rounded-full bg-[#e3e8d5] px-2 py-0.5 text-[10px] font-medium text-[#4f5d3a]" title="Sélectionné pour l'achat">
                🛒 Sélectionné
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400" title="Pas encore sélectionné pour l'achat">
                Envie
              </span>
            )
          )}
          {/* Due date */}
          {editingDate === dateKey ? (
            <input type="date" autoFocus value={item.dueDate || ""}
              onChange={e => updateItemMeta(roomKey, listKey, id, { dueDate: e.target.value || undefined })}
              onBlur={() => setEditingDate(null)}
              className="w-28 shrink-0 rounded border border-black/15 px-1 py-0.5 text-xs outline-none" />
          ) : item.dueDate ? (
            <button type="button" onClick={() => setEditingDate(dateKey)} title="Modifier l'échéance"
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isDueOverdue(item.dueDate) ? "bg-red-50 text-red-500" : isDueSoonDate(item.dueDate) ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
              {formatDueDate(item.dueDate)}
            </button>
          ) : null}
          {/* Assignee */}
          {item.assignee && (
            <div className="relative shrink-0">
              <button type="button"
                onClick={() => setOpenPicker(openPicker === pickerKey ? null : pickerKey)}
                className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white"
                style={{ background: personColor(item.assignee) }} title={item.assignee}>
                {personInitials(item.assignee)}
              </button>
              {openPicker === pickerKey && (
                <PersonPicker allPersons={allPersons} value={item.assignee || ""}
                  onSelect={name => { updateItemMeta(roomKey, listKey, id, { assignee: name || undefined }); setOpenPicker(null); }}
                  onCreatePerson={name => { createPerson(name); updateItemMeta(roomKey, listKey, id, { assignee: name }); setOpenPicker(null); }}
                  onClose={() => setOpenPicker(null)} />
              )}
            </div>
          )}
          <ItemRowActions
            item={item}
            onAddDueDate={() => setEditingDate(dateKey)}
            onAddAssignee={() => setOpenPicker(pickerKey)}
            onEditTitle={item.url ? () => { setEditingTitleId(id); setEditingTitleValue(linkItemTitle(item)); } : undefined}
            onEditPrice={item.url ? () => { setEditingPriceId(id); setEditingPriceValue(""); } : undefined}
            onDelete={() => deleteItem(roomKey, listKey, id)}
          />
        </div>
        {item.url && (
          <div className="pl-7">
            <LinkPreviewMini
              item={item}
              editingTitle={editingTitleId === id}
              editingValue={editingTitleValue}
              onChangeEditValue={setEditingTitleValue}
              onSaveEditTitle={() => {
                if (editingTitleValue.trim()) updateItemMeta(roomKey, listKey, id, { text: editingTitleValue.trim() });
                setEditingTitleId(null); setEditingTitleValue("");
              }}
              onCancelEditTitle={() => { setEditingTitleId(null); setEditingTitleValue(""); }}
              editingPrice={editingPriceId === id}
              editingPriceValue={editingPriceValue}
              onChangePriceValue={setEditingPriceValue}
              onStartEditPrice={(currentPrice) => { setEditingPriceId(id); setEditingPriceValue(currentPrice === "" ? "" : String(currentPrice)); }}
              onSaveEditPrice={() => {
                const parsed = parseFloat(editingPriceValue.replace(",", "."));
                updateItemMeta(roomKey, listKey, id, isNaN(parsed) ? { price: undefined, priceCurrency: undefined } : { price: parsed, priceCurrency: item.priceCurrency || "EUR" });
                setEditingPriceId(null); setEditingPriceValue("");
              }}
              onCancelEditPrice={() => { setEditingPriceId(null); setEditingPriceValue(""); }}
            />
          </div>
        )}
        {reactions.length > 0 && (
          <ReactionRow
            itemId={id}
            reactions={reactions}
            currentUserId={currentUserId}
            onToggle={onToggleReaction}
          />
        )}
      </li>
    );
  };

  useEffect(() => {
    if (filter !== "envies" && filter !== "courses" && groupBy === "site") setGroupBy("room");
  }, [filter, groupBy]);

  const weekGroups = groupBy === "week" ? buildWeekGroups(visibleItems) : null;

  // ── Site grouping helpers (Courses uniquement) ──────────────────────────
  const siteDomain = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  };
  const buildSiteGroups = (items) => {
    const groups = {};
    const noSite = [];
    for (const item of items) {
      const domain = item.url ? siteDomain(item.url) : null;
      if (!domain) { noSite.push(item); continue; }
      (groups[domain] = groups[domain] || []).push(item);
    }
    const subtotal = (list) => list.reduce((sum, i) => sum + (typeof i.price === "number" ? i.price : 0), 0);
    const sorted = Object.entries(groups)
      .map(([domain, list]) => ({ domain, items: list, total: subtotal(list), currency: list.find(i => i.priceCurrency)?.priceCurrency }))
      .sort((a, b) => b.total - a.total);
    return { sites: sorted, noSite: { items: noSite, total: subtotal(noSite), currency: noSite.find(i => i.priceCurrency)?.priceCurrency } };
  };
  const siteGroups = groupBy === "site"
    ? buildSiteGroups(visibleItems.filter((i) => i.listKey === "shopping"))
    : null;
  const siteGlobalTotal = siteGroups
    ? siteGroups.sites.reduce((sum, s) => sum + s.total, 0) + siteGroups.noSite.total
    : 0;
  const siteGlobalCurrency = siteGroups
    ? (siteGroups.sites.find((s) => s.currency)?.currency || siteGroups.noSite.currency)
    : undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue d'ensemble</p>
        <h2 className="type-h2">Tous les todos</h2>
        <p className="mt-1 text-sm text-slate-600">
          {totalPending > 0 ? `${totalPending} élément${totalPending > 1 ? "s" : ""} en attente.` : "Tout est fait — rien en attente."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[{ key: "all", label: "Tout" }, { key: "todos", label: "À faire" }, { key: "envies", label: "Envies" }, { key: "courses", label: "Courses" }].map(({ key, label }) => (
            <button key={key} type="button" onClick={() => { setFilter(key); if (key === "envies" || key === "courses") setGroupBy("site"); else if (groupBy === "site") setGroupBy("room"); }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${filter === key ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-white hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {/* Group by toggle */}
            <div className="flex overflow-hidden rounded-lg border border-black/15">
              <button type="button" onClick={() => setGroupBy("room")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${groupBy === "room" ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"}`}
                title="Grouper par pièce">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                Pièces
              </button>
              <button type="button" onClick={() => setGroupBy("week")}
                className={`flex items-center gap-1.5 border-l border-black/15 px-3 py-1.5 text-sm ${groupBy === "week" ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"}`}
                title="Grouper par semaine">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Semaine
              </button>
              {(filter === "envies" || filter === "courses") && (
                <button type="button" onClick={() => setGroupBy("site")}
                  className={`flex items-center gap-1.5 border-l border-black/15 px-3 py-1.5 text-sm ${groupBy === "site" ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"}`}
                  title="Grouper par site d'achat">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  Sites
                </button>
              )}
            </div>
            <button type="button" onClick={() => setHideDone((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${hideDone ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-white hover:bg-slate-50"}`}>
              {hideDone ? "Voir terminés" : "Masquer terminés"}
            </button>
          </div>
        </div>
      </div>

      {/* Vue par pièce (+ section "Appartement" pour les éléments non liés à une pièce) */}
      {groupBy === "room" && ["general", ...orderedActiveRooms].map((key) => {
        const preset = key === "general" ? { label: "Appartement" } : allRoomPresets[key];
        const list = roomLists[key] || {};
        const shopping = filter !== "todos"
          ? (list.shopping || [])
              .filter((i) => filter !== "courses" || isSelectedForPurchase(i))
              .map((i) => ({ ...i, listKey: "shopping", roomKey: key }))
          : [];
        const todos = filter === "all" || filter === "todos" ? (list.todos || []).map((i) => ({ ...i, listKey: "todos", roomKey: key })) : [];
        const allItems = [...shopping, ...todos];
        const visible = hideDone ? allItems.filter((i) => !i.done) : allItems;
        const sorted = [...visible.filter((i) => !i.done), ...visible.filter((i) => i.done)];
        const isOpen = roomInputOpen[key] || false;
        const inputVal = roomInputs[key] || "";
        const addListKey = (filter === "envies" || filter === "courses") ? "shopping" : "todos";
        return (
          <div key={key} className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium text-slate-900">{preset?.label}</h3>
              {!isOpen && (
                <button type="button"
                  onClick={() => setRoomInputOpen((prev) => ({ ...prev, [key]: true }))}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ajouter
                </button>
              )}
            </div>
            {sorted.length > 0 && (
              <ul className="mb-2 space-y-1.5">{sorted.map((item) => renderItemRow(item, false))}</ul>
            )}
            {isOpen ? (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addItemToRoom(key, addListKey, inputVal); }}>
                <input
                  type="text"
                  autoFocus
                  value={inputVal}
                  onChange={(e) => setRoomInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Escape") { setRoomInputOpen((prev) => ({ ...prev, [key]: false })); setRoomInputs((prev) => ({ ...prev, [key]: "" })); } }}
                  placeholder={addListKey === "shopping" ? "Ajouter aux courses…" : "Ajouter une tâche…"}
                  className="min-w-0 flex-1 rounded-md border border-black/15 bg-slate-50 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none" />
                <button type="submit"
                  className="shrink-0 rounded-md border border-black/15 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                  Ajouter
                </button>
                <button type="button"
                  onClick={() => { setRoomInputOpen((prev) => ({ ...prev, [key]: false })); setRoomInputs((prev) => ({ ...prev, [key]: "" })); }}
                  className="shrink-0 rounded-md border border-black/15 bg-white px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
                  Annuler
                </button>
              </form>
            ) : sorted.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucun élément — cliquez sur Ajouter pour commencer.</p>
            ) : null}
          </div>
        );
      })}

      {/* Vue par semaine */}
      {groupBy === "week" && weekGroups && (() => {
        const { overdue, weeks, noDate } = weekGroups;
        const sections = [
          ...(overdue.length ? [{ label: "En retard", items: overdue, accent: "text-red-600", bg: "bg-red-50 border-red-100" }] : []),
          ...weeks.map((w) => ({ label: weekLabel(w.monday), items: w.items, accent: "text-slate-900", bg: "bg-white border-black/10" })),
          ...(noDate.length ? [{ label: "Sans échéance", items: noDate, accent: "text-slate-500", bg: "bg-white border-black/10" }] : []),
        ];
        if (sections.length === 0) return <div className="py-12 text-center text-sm text-slate-400">Aucun élément à afficher.</div>;
        return sections.map(({ label, items, accent, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${accent}`}>{label}</h3>
            <ul className="space-y-1.5">
              {[...items.filter((i) => !i.done), ...items.filter((i) => i.done)].map((item) => renderItemRow(item, true))}
            </ul>
          </div>
        ));
      })()}

      {/* Vue par site d'achat */}
      {groupBy === "site" && siteGroups && (() => {
        const { sites, noSite } = siteGroups;
        if (sites.length === 0 && noSite.items.length === 0) {
          return (
            <div className="py-12 text-center text-sm text-slate-400">
              {filter === "courses"
                ? "Aucun article sélectionné pour l'achat — sélectionnez des articles depuis une pièce pour les voir ici."
                : "Aucune envie pour l'instant — ajoutez des articles depuis une pièce pour les voir ici."}
            </div>
          );
        }
        return (
          <>
            <div className="flex items-center justify-between rounded-xl border border-slate-900 bg-slate-900 p-4 text-white">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Budget global</p>
                <p className="text-lg font-semibold">{formatPrice(siteGlobalTotal, siteGlobalCurrency)}</p>
              </div>
              <p className="text-sm text-white/70">{sites.length} site{sites.length > 1 ? "s" : ""} d'achat</p>
            </div>
            {sites.map(({ domain, items, total, currency }) => (
              <div key={domain} className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900">{domain}</h3>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{formatPrice(total, currency)}</span>
                </div>
                <ul className="space-y-1.5">
                  {[...items.filter((i) => !i.done), ...items.filter((i) => i.done)].map((item) => renderItemRow(item, true))}
                </ul>
              </div>
            ))}
            {noSite.items.length > 0 && (
              <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900">Sans site</h3>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{formatPrice(noSite.total, noSite.currency)}</span>
                </div>
                <ul className="space-y-1.5">
                  {[...noSite.items.filter((i) => !i.done), ...noSite.items.filter((i) => i.done)].map((item) => renderItemRow(item, true))}
                </ul>
              </div>
            )}
          </>
        );
      })()}
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


function LinkPreviewMini({ item, editingTitle, editingValue, onChangeEditValue, onSaveEditTitle, onCancelEditTitle,
  editingPrice, editingPriceValue, onChangePriceValue, onSaveEditPrice, onCancelEditPrice, onStartEditPrice }) {
  const domain = (() => {
    try { return new URL(item.url).hostname.replace(/^www\./, ""); } catch { return ""; }
  })();
  const isCustomTitle = item.text && item.text !== item.url;
  const cardTitle = isCustomTitle ? item.text : (item.previewTitle || domain);

  const priceRow = editingPrice ? (
    <input
      type="number"
      step="0.01"
      autoFocus
      value={editingPriceValue}
      onClick={e => { e.preventDefault(); e.stopPropagation(); }}
      onChange={e => onChangePriceValue(e.target.value)}
      onBlur={() => onSaveEditPrice()}
      onKeyDown={e => { if (e.key === "Enter") onSaveEditPrice(); if (e.key === "Escape") onCancelEditPrice(); }}
      className="w-16 shrink-0 rounded border border-amber-300 bg-white px-1 py-0.5 text-[11px] outline-none"
      placeholder="Prix"
    />
  ) : item.price != null ? (
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); onStartEditPrice?.(item.price); }}
      className="shrink-0 text-[11px] font-semibold text-slate-600 hover:underline"
      title="Modifier le prix"
    >
      {formatPrice(item.price, item.priceCurrency)}
    </button>
  ) : null;

  const imageEl = item.image ? (
    <img src={item.image} alt={cardTitle} className="h-20 w-24 shrink-0 object-cover" />
  ) : (
    <div className="grid h-20 w-16 shrink-0 place-items-center bg-slate-200 text-slate-400">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    </div>
  );

  if (item.previewLoading) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-black/8 bg-slate-50">
        <div className="h-20 w-24 shrink-0 animate-pulse bg-slate-200" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-3">
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
        </div>
      </a>
    );
  }

  if (editingTitle) {
    return (
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-amber-300 bg-amber-50">
        {imageEl}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
          <input
            autoFocus
            value={editingValue}
            onChange={e => onChangeEditValue(e.target.value)}
            onBlur={() => onSaveEditTitle()}
            onKeyDown={e => { if (e.key === "Enter") onSaveEditTitle(); if (e.key === "Escape") onCancelEditTitle(); }}
            className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none"
            placeholder={cardTitle}
          />
          <div className="mt-1 flex items-center gap-2">
            {domain && <p className="truncate text-[11px] text-slate-400">{domain}</p>}
            {priceRow}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-w-0 flex-1">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-black/8 bg-slate-50 transition-colors hover:bg-slate-100"
      >
        {imageEl}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
          <p className="break-words text-sm font-medium leading-snug text-slate-800 md:line-clamp-2">{cardTitle}</p>
          <div className="mt-1 flex items-center gap-2">
            {domain && <p className="truncate text-[11px] text-slate-400">{domain}</p>}
            {priceRow}
          </div>
        </div>
      </a>
    </div>
  );
}

function DocumentsSection({ room, roomDocuments, setRoomDocuments, projectId, saveDocFn, deleteDocFn, authedFetch, roomLists, setRoomLists, saveRoomItemsFn, orderedActiveRooms, allRoomPresets }) {
  const [uploading, setUploading] = useState(false);
  const [docsDragging, setDocsDragging] = useState(false);
  const [devisReviewDoc, setDevisReviewDoc] = useState(null);
  const fileInputRef = useRef(null);
  const docsDragCountRef = useRef(0);

  const docs = roomDocuments[room] || [];

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await readFileAsDataUrl(file);
        const ext = extFromDataUrl(dataUrl);
        const filename = `doc-${room}-${Date.now()}.${ext}`;
        const url = await uploadToBlob(dataUrl, filename);
        if (!url) { await showAlert("Échec de l'upload. Réessaie."); continue; }
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
    <div
      className={`col-span-full rounded-xl border p-4 transition-colors ${
        docsDragging ? "border-[#CDAA73] bg-[#FCF8D5]/30" : "border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6]"
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => {
        e.preventDefault();
        docsDragCountRef.current += 1;
        setDocsDragging(true);
      }}
      onDragLeave={() => {
        docsDragCountRef.current -= 1;
        if (docsDragCountRef.current <= 0) { docsDragCountRef.current = 0; setDocsDragging(false); }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        docsDragCountRef.current = 0;
        setDocsDragging(false);
        if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
      }}
    >
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
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-black/15 bg-white/60 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-2xl shadow-sm">📄</span>
          <p className="text-sm font-medium text-slate-600">Aucun document pour l'instant</p>
          <p className="max-w-xs text-xs text-slate-400">
            Glisse-dépose un fichier ici ou clique sur « + Document » pour ajouter un devis, un plan ou une facture.
          </p>
        </div>
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
              {doc.type?.includes("pdf") && (
                <button
                  type="button"
                  onClick={() => setDevisReviewDoc(doc)}
                  className="shrink-0 rounded-md border border-black/15 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Analyser ce devis
                </button>
              )}
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
      {devisReviewDoc && (
        <DevisImportReview
          documentUrl={devisReviewDoc.url}
          documentName={devisReviewDoc.name}
          projectId={projectId}
          roomKey={room}
          authedFetch={authedFetch}
          roomLists={roomLists}
          setRoomLists={setRoomLists}
          saveRoomItemsFn={saveRoomItemsFn}
          orderedActiveRooms={orderedActiveRooms}
          allRoomPresets={allRoomPresets}
          onClose={() => setDevisReviewDoc(null)}
        />
      )}
    </div>
  );
}

// ─── Helpers personnes / dates ───────────────────────────────────────────────
// (personColor, personInitials, formatDueDate, isDueOverdue, isDueSoonDate,
// linkItemTitle, PersonPicker vivent dans ./lib/itemHelpers.jsx, partagés
// avec ShoppingKanban.jsx sans import circulaire)

function formatPrice(price, currency) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(price);
  } catch {
    return `${price} ${currency || ""}`.trim();
  }
}

const REACTION_EMOJIS = ["❤️","👍","😍","🔥","✨","💡","🎉","😂","😮","👏","🙏","💯","👎","😕","💔","🤮","😤","❌","🙅","💸","🪙"];

function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute z-50 flex flex-wrap gap-1 rounded-xl border border-black/10 bg-white p-2 shadow-xl"
      style={{ bottom: "calc(100% + 6px)", left: 0, width: "176px" }}>
      {REACTION_EMOJIS.map(emoji => (
        <button key={emoji} type="button"
          onClick={() => { onSelect(emoji); onClose(); }}
          className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-slate-100 transition-colors">
          {emoji}
        </button>
      ))}
    </div>
  );
}

function ReactionRow({ itemId, reactions, currentUserId, onToggle }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const groups = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r);
    return acc;
  }, {});
  return (
    <div className="relative flex flex-wrap items-center gap-1 pl-7">
      {Object.entries(groups).map(([emoji, reacted]) => {
        const iMine = reacted.some(r => r.userId === currentUserId);
        const names = reacted.map(r => r.userName).join(", ");
        return (
          <button key={emoji} type="button" onClick={() => onToggle && onToggle(itemId, emoji)}
            title={names}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors
              ${iMine ? "border-amber-400 bg-amber-50 text-amber-800" : "border-black/10 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
            <span>{emoji}</span>
            <span className="font-medium">{reacted.length}</span>
          </button>
        );
      })}
      <div className="relative">
        <button type="button" onClick={() => setPickerOpen(p => !p)}
          className="group inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-slate-300 hover:text-slate-700"
          title="Ajouter une réaction">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
            <circle cx="8.5" cy="8.5" r="7" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="6" cy="7" r="0.9" fill="currentColor" />
            <circle cx="11" cy="7" r="0.9" fill="currentColor" />
            <path d="M5.5 10.2c1 1.4 5 1.4 6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            <circle cx="14.5" cy="14.5" r="4.2" className="fill-slate-200 group-hover:fill-slate-300" stroke="currentColor" strokeWidth="1.2" />
            <path d="M14.5 12.7v3.6M12.7 14.5h3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        {pickerOpen && <EmojiPicker onSelect={(e) => { onToggle && onToggle(itemId, e); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
      </div>
    </div>
  );
}

// ─── Section listes (tâches + courses) ───────────────────────────────────────

function ListeSection({ room, label, roomLists, setRoomLists, projectId, saveRoomItemsFn, projectMembers = [], persons = [], setPersons, savePersonsFn, onLogActivity, itemReactions = {}, currentUserId = null, onToggleReaction = null }) {
  const [shopInput, setShopInput] = useState("");
  const [todoInput, setTodoInput] = useState("");
  const [linkMode, setLinkMode] = useState({ shopping: false, todos: false });
  const [linkInput, setLinkInput] = useState({ shopping: { label: "", url: "" }, todos: { label: "", url: "" } });
  const [newMeta, setNewMeta] = useState({ shopping: { dueDate: "", assignee: "" }, todos: { dueDate: "", assignee: "" } });
  const [openPicker, setOpenPicker] = useState(null);
  const [editingDate, setEditingDate] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const migratedItemIds = useRef(new Set());

  const list = roomLists[room] || {};
  const shopping = list.shopping || [];
  const todos = list.todos || [];

  useEffect(() => {
    const toMigrate = shopping.filter(item =>
      !migratedItemIds.current.has(item.id) &&
      !item.url &&
      /https?:\/\/[^\s]+/.test(item.text || '')
    );
    if (toMigrate.length === 0) return;
    toMigrate.forEach(item => migratedItemIds.current.add(item.id));
    const urlOf = text => (text || '').match(/https?:\/\/[^\s]+/)?.[0];
    setRoomLists(prev => {
      const items = ((prev[room] || {}).shopping || []).map(item =>
        toMigrate.some(m => m.id === item.id)
          ? { ...item, url: urlOf(item.text), previewLoading: true }
          : item
      );
      if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, 'shopping', items);
      return { ...prev, [room]: { ...(prev[room] || {}), shopping: items } };
    });
    toMigrate.forEach(async origItem => {
      const url = urlOf(origItem.text);
      try {
        const preview = await fetchLinkPreview(url);
        setRoomLists(prev => {
          const items = ((prev[room] || {}).shopping || []).map(item =>
            item.id === origItem.id
              ? { ...item, previewLoading: false, ...(preview.image ? { image: preview.image } : {}), ...(preview.title ? { previewTitle: preview.title } : {}) }
              : item
          );
          if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, 'shopping', items);
          return { ...prev, [room]: { ...(prev[room] || {}), shopping: items } };
        });
      } catch {
        setRoomLists(prev => {
          const items = ((prev[room] || {}).shopping || []).map(item =>
            item.id === origItem.id ? { ...item, previewLoading: false } : item
          );
          return { ...prev, [room]: { ...(prev[room] || {}), shopping: items } };
        });
      }
    });
  }, [room, shopping.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const allPersons = [
    ...(projectMembers).map(m => ({ id: m.id, name: m.name })),
    ...(persons).map(p => ({ id: p.id, name: p.name })),
  ].filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i);

  const createPerson = (name) => {
    const newPerson = { id: `person-${Date.now()}`, name };
    const updated = [...persons, newPerson];
    setPersons(updated);
    if (savePersonsFn && projectId) savePersonsFn(projectId, updated);
  };

  const addItem = async (listKey, text, setter) => {
    if (!text.trim()) return;
    const { dueDate, assignee } = newMeta[listKey];
    const id = `${listKey}-${Date.now()}`;
    const urlMatch = text.trim().match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : null;
    const newItem = { id, text: text.trim(), url: url || undefined, done: false,
      ...(url ? { previewLoading: true } : {}),
      ...(dueDate ? { dueDate } : {}), ...(assignee ? { assignee } : {}) };
    setNewMeta(prev => ({ ...prev, [listKey]: { dueDate: "", assignee: "" } }));
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItems = [...currentItems, newItem];
    setRoomLists((prev) => ({ ...prev, [room]: { ...(prev[room] || {}), [listKey]: newItems } }));
    setter("");
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
    if (onLogActivity) onLogActivity(listKey === 'todos' ? 'todo_added' : 'shopping_added', room, { text: text.trim() });
    if (url) {
      try {
        const preview = await fetchLinkPreview(url);
        setRoomLists((prev) => {
          const updatedItems = ((prev[room] || {})[listKey] || []).map((item) =>
            item.id === id
              ? { ...item, previewLoading: false, ...(preview.image ? { image: preview.image } : {}), ...(preview.title ? { previewTitle: preview.title } : {}), ...(preview.price != null ? { price: preview.price, priceCurrency: preview.currency || undefined } : {}) }
              : item
          );
          if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, updatedItems);
          return { ...prev, [room]: { ...(prev[room] || {}), [listKey]: updatedItems } };
        });
      } catch {
        setRoomLists((prev) => {
          const updatedItems = ((prev[room] || {})[listKey] || []).map((item) =>
            item.id === id ? { ...item, previewLoading: false } : item
          );
          return { ...prev, [room]: { ...(prev[room] || {}), [listKey]: updatedItems } };
        });
      }
    }
  };

  const toggleItem = (listKey, id) => {
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItems = currentItems.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
    setRoomLists((prev) => ({ ...prev, [room]: { ...(prev[room] || {}), [listKey]: newItems } }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
  };

  const removeItem = (listKey, id) => {
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItems = currentItems.filter((item) => item.id !== id);
    setRoomLists((prev) => ({ ...prev, [room]: { ...(prev[room] || {}), [listKey]: newItems } }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
  };

  const clearDoneItems = (listKey) => {
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItems = currentItems.filter((item) => !item.done);
    setRoomLists((prev) => ({ ...prev, [room]: { ...(prev[room] || {}), [listKey]: newItems } }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
  };

  const updateItemMeta = (listKey, id, patch) => {
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItems = currentItems.map(item => item.id === id ? { ...item, ...patch } : item);
    setRoomLists(prev => ({ ...prev, [room]: { ...(prev[room] || {}), [listKey]: newItems } }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
  };

  const handleKanbanMove = (itemId, targetStatus) => {
    updateItemMeta("shopping", itemId, { status: targetStatus, ...deriveFlagsFromStatus(targetStatus) });
  };

  const addLinkItem = async (listKey) => {
    const { label: lbl, url } = linkInput[listKey];
    if (!url.trim()) return;
    const { dueDate, assignee } = newMeta[listKey];
    const id = `${listKey}-${Date.now()}`;
    setLinkInput((prev) => ({ ...prev, [listKey]: { label: "", url: "" } }));
    setLinkMode((prev) => ({ ...prev, [listKey]: false }));
    setNewMeta(prev => ({ ...prev, [listKey]: { dueDate: "", assignee: "" } }));
    const currentItems = (roomLists[room] || {})[listKey] || [];
    const newItem = { id, text: lbl.trim() || url.trim(), url: url.trim(), done: false, previewLoading: true,
      ...(dueDate ? { dueDate } : {}), ...(assignee ? { assignee } : {}) };
    const newItems = [...currentItems, newItem];
    setRoomLists((prev) => ({ ...prev, [room]: { ...(prev[room] || {}), [listKey]: newItems } }));
    if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, newItems);
    try {
      const preview = await fetchLinkPreview(url.trim());
      setRoomLists((prev) => {
        const updatedItems = ((prev[room] || {})[listKey] || []).map((item) =>
          item.id === id
            ? { ...item, previewLoading: false, ...(preview.image ? { image: preview.image } : {}), ...(preview.title && !lbl.trim() ? { previewTitle: preview.title } : {}), ...(preview.price != null ? { price: preview.price, priceCurrency: preview.currency || undefined } : {}) }
            : item
        );
        if (saveRoomItemsFn && projectId) saveRoomItemsFn(projectId, room, listKey, updatedItems);
        return { ...prev, [room]: { ...(prev[room] || {}), [listKey]: updatedItems } };
      });
    } catch {
      setRoomLists((prev) => {
        const updatedItems = ((prev[room] || {})[listKey] || []).map((item) =>
          item.id === id ? { ...item, previewLoading: false } : item
        );
        return { ...prev, [room]: { ...(prev[room] || {}), [listKey]: updatedItems } };
      });
    }
  };

  const renderList = (listKey, items, input, setInput, title, eyebrow, placeholder) => {
    const pending = items.filter((i) => !i.done);
    const done = items.filter((i) => i.done);
    const meta = newMeta[listKey];
    const pickerKey = `new-${listKey}`;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</p>
            <h3 className="type-h3">{title}</h3>
          </div>
          {listKey === "shopping" && (() => {
            const selectedItems = items.filter(item => item.selectedForPurchase);
            const selectedCount = selectedItems.length;
            if (selectedCount === 0 && !showSelectedOnly) return null;
            const selectedTotal = selectedItems.reduce((sum, item) => sum + (typeof item.price === "number" ? item.price : 0), 0);
            const totalCurrency = selectedItems.find(item => item.priceCurrency)?.priceCurrency;
            return (
              <div className="mb-0.5 flex shrink-0 flex-wrap items-center gap-2">
                {selectedTotal > 0 && (
                  <span className="text-xs font-semibold text-slate-600">{formatPrice(selectedTotal, totalCurrency)}</span>
                )}
                <button type="button" onClick={() => setShowSelectedOnly(v => !v)}
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs transition-colors ${showSelectedOnly ? "border-amber-300 bg-amber-100 text-amber-700" : "border-black/15 text-slate-500 hover:bg-slate-50"}`}>
                  {showSelectedOnly ? "Tout afficher" : `Sélectionnés pour l'achat (${selectedCount})`}
                </button>
              </div>
            );
          })()}
        </div>
        {listKey !== "shopping" && !linkMode[listKey] ? (
          <div className="flex gap-2">
            <input type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(listKey, input, setInput); }}
              placeholder={placeholder} className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm" />
            <button type="button" onClick={() => setLinkMode((prev) => ({ ...prev, [listKey]: true }))}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-black/15 bg-white text-slate-500 hover:bg-slate-50"
              title="Ajouter un lien avec un nom" aria-label="Ajouter un lien avec un nom">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </button>
            <button type="button" onClick={() => addItem(listKey, input, setInput)}
              className="shrink-0 rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white">Ajouter</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="url" value={linkInput[listKey].url}
                onChange={(e) => setLinkInput((prev) => ({ ...prev, [listKey]: { ...prev[listKey], url: e.target.value } }))}
                onKeyDown={(e) => { if (e.key === "Enter") addLinkItem(listKey); }}
                placeholder="https://…" className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm" />
              <input type="text" value={linkInput[listKey].label}
                onChange={(e) => setLinkInput((prev) => ({ ...prev, [listKey]: { ...prev[listKey], label: e.target.value } }))}
                onKeyDown={(e) => { if (e.key === "Enter") addLinkItem(listKey); }}
                placeholder={listKey === "shopping" ? "Titre (optionnel)" : "Nom du lien…"} className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm" />
              <button type="button" onClick={() => addLinkItem(listKey)} disabled={!linkInput[listKey].url.trim()}
                className="shrink-0 rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Ajouter</button>
            </div>
            {listKey !== "shopping" && (
              <button type="button" onClick={() => setLinkMode((prev) => ({ ...prev, [listKey]: false }))}
                className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                Texte libre
              </button>
            )}
          </div>
        )}
        {/* Options optionnelles : échéance + assigné */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-black/8 bg-slate-50 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className={meta.dueDate ? (isDueOverdue(meta.dueDate) ? "font-medium text-red-500" : isDueSoonDate(meta.dueDate) ? "font-medium text-amber-600" : "font-medium text-slate-700") : ""}>
              {meta.dueDate ? formatDueDate(meta.dueDate) : "Échéance"}
            </span>
            <input type="date" value={meta.dueDate}
              onChange={e => setNewMeta(prev => ({ ...prev, [listKey]: { ...prev[listKey], dueDate: e.target.value } }))}
              className="sr-only" />
          </label>
          {meta.dueDate && (
            <button type="button" onClick={() => setNewMeta(prev => ({ ...prev, [listKey]: { ...prev[listKey], dueDate: "" } }))}
              className="text-xs leading-none text-slate-300 hover:text-slate-500">×</button>
          )}
          <div className="relative">
            <button type="button" onClick={() => setOpenPicker(openPicker === pickerKey ? null : pickerKey)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${meta.assignee ? "border-slate-700 bg-slate-800 text-white" : "border-black/8 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
              {meta.assignee ? (
                <>
                  <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-white/20 text-[7px] font-bold">{personInitials(meta.assignee)}</span>
                  {meta.assignee}
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                  Assigné à
                </>
              )}
            </button>
            {openPicker === pickerKey && (
              <PersonPicker allPersons={allPersons} value={meta.assignee}
                onSelect={name => setNewMeta(prev => ({ ...prev, [listKey]: { ...prev[listKey], assignee: name } }))}
                onCreatePerson={name => { createPerson(name); setNewMeta(prev => ({ ...prev, [listKey]: { ...prev[listKey], assignee: name } })); }}
                onClose={() => setOpenPicker(null)} />
            )}
          </div>
          {meta.assignee && (
            <button type="button" onClick={() => setNewMeta(prev => ({ ...prev, [listKey]: { ...prev[listKey], assignee: "" } }))}
              className="text-xs leading-none text-slate-300 hover:text-slate-500">×</button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">Aucun élément pour l'instant.</div>
        ) : (
          <ul className="space-y-1.5">
            {(listKey === "shopping" && showSelectedOnly
              ? items.filter(item => item.selectedForPurchase)
              : listKey === "shopping" ? items : [...pending, ...done]
            ).map((item) => (
              <li key={item.id}
                className={`group flex flex-col gap-0.5 rounded-lg border px-3 py-2 ${
                  listKey === "shopping" ? styleForStatus(effectiveStatus(item))
                  : item.done ? "border-black/5 bg-white opacity-50"
                  : "border-black/10 bg-white"
                }`}>
                <div className="flex flex-wrap items-center gap-2">
                {listKey === "shopping" ? (
                  <select value={effectiveStatus(item)}
                    onChange={(e) => updateItemMeta(listKey, item.id, { status: e.target.value, ...deriveFlagsFromStatus(e.target.value) })}
                    className="shrink-0 rounded-md border border-black/15 bg-white px-1.5 py-1 text-[11px] text-slate-600">
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.title}</option>)}
                  </select>
                ) : (
                  <button type="button" onClick={() => toggleItem(listKey, item.id)}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${item.done ? "border-slate-300 bg-slate-100 text-slate-500" : "border-black/20 bg-white hover:bg-slate-50"}`}>
                    {item.done ? "✓" : ""}
                  </button>
                )}
                {item.url ? (
                  <span className="min-w-0 flex-1" />
                ) : (
                  <span className={`min-w-0 flex-1 break-all text-sm ${item.done && listKey !== "shopping" ? "text-slate-400 line-through" : item.done ? "text-amber-800" : "text-slate-800"}`}>{item.text}</span>
                )}
                {/* Badge échéance */}
                {editingDate === item.id ? (
                  <input type="date" autoFocus value={item.dueDate || ""}
                    onChange={e => updateItemMeta(listKey, item.id, { dueDate: e.target.value || undefined })}
                    onBlur={() => setEditingDate(null)}
                    className="w-28 shrink-0 rounded border border-black/15 px-1 py-0.5 text-xs outline-none" />
                ) : item.dueDate ? (
                  <button type="button" onClick={() => setEditingDate(item.id)} title="Modifier l'échéance"
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isDueOverdue(item.dueDate) ? "bg-red-50 text-red-500" : isDueSoonDate(item.dueDate) ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                    {formatDueDate(item.dueDate)}
                  </button>
                ) : null}
                {/* Badge assigné */}
                {item.assignee && (
                  <div className="relative shrink-0">
                    <button type="button"
                      onClick={() => setOpenPicker(openPicker === `item-${item.id}` ? null : `item-${item.id}`)}
                      className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: personColor(item.assignee) }} title={item.assignee}>
                      {personInitials(item.assignee)}
                    </button>
                    {openPicker === `item-${item.id}` && (
                      <PersonPicker allPersons={allPersons} value={item.assignee || ""}
                        onSelect={name => updateItemMeta(listKey, item.id, { assignee: name || undefined })}
                        onCreatePerson={name => { createPerson(name); updateItemMeta(listKey, item.id, { assignee: name }); }}
                        onClose={() => setOpenPicker(null)} />
                    )}
                  </div>
                )}
                <ItemRowActions
                  item={item}
                  onAddDueDate={() => setEditingDate(item.id)}
                  onAddAssignee={() => setOpenPicker(`item-${item.id}`)}
                  onEditTitle={listKey === "shopping" && item.url ? () => { setEditingTitleId(item.id); setEditingTitleValue(linkItemTitle(item)); } : undefined}
                  onEditPrice={listKey === "shopping" && item.url ? () => { setEditingPriceId(item.id); setEditingPriceValue(""); } : undefined}
                  onDelete={() => removeItem(listKey, item.id)}
                />
                </div>
                {item.url && (
                  <div className="pl-7">
                    <LinkPreviewMini
                      item={item}
                      editingTitle={listKey === "shopping" && editingTitleId === item.id}
                      editingValue={editingTitleValue}
                      onChangeEditValue={setEditingTitleValue}
                      onSaveEditTitle={() => {
                        if (listKey === "shopping" && editingTitleValue.trim()) {
                          updateItemMeta(listKey, item.id, { text: editingTitleValue.trim() });
                        }
                        setEditingTitleId(null);
                        setEditingTitleValue("");
                      }}
                      onCancelEditTitle={() => { setEditingTitleId(null); setEditingTitleValue(""); }}
                      editingPrice={listKey === "shopping" && editingPriceId === item.id}
                      editingPriceValue={editingPriceValue}
                      onChangePriceValue={setEditingPriceValue}
                      onStartEditPrice={listKey === "shopping" ? (currentPrice) => {
                        setEditingPriceId(item.id);
                        setEditingPriceValue(currentPrice === "" ? "" : String(currentPrice));
                      } : undefined}
                      onSaveEditPrice={() => {
                        const parsed = parseFloat(editingPriceValue.replace(",", "."));
                        updateItemMeta(listKey, item.id, isNaN(parsed) ? { price: undefined, priceCurrency: undefined } : { price: parsed, priceCurrency: item.priceCurrency || "EUR" });
                        setEditingPriceId(null);
                        setEditingPriceValue("");
                      }}
                      onCancelEditPrice={() => { setEditingPriceId(null); setEditingPriceValue(""); }}
                    />
                  </div>
                )}
                {listKey === "shopping" && (
                  <ReactionRow
                    itemId={item.id}
                    reactions={itemReactions[item.id] || []}
                    currentUserId={currentUserId}
                    onToggle={onToggleReaction}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {listKey === "shopping" && done.length > 0 && (
          <button type="button" onClick={() => clearDoneItems("shopping")}
            className="mt-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            Effacer les sélectionnés ({done.length})
          </button>
        )}
      </div>
    );
  };

  const todosPanel = (
    <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
      {renderList("todos", todos, todoInput, setTodoInput, "À faire", "Tâches", "Ajouter une tâche…")}
    </div>
  );

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2 lg:hidden">
        <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
          {renderList("shopping", shopping, shopInput, setShopInput, "Mes envies", label, "Ajouter une envie…")}
        </div>
        {todosPanel}
      </div>
      <div className="hidden lg:block space-y-6">
        <div className="flex gap-2">
          <input type="url" value={linkInput.shopping.url}
            onChange={(e) => setLinkInput((prev) => ({ ...prev, shopping: { ...prev.shopping, url: e.target.value } }))}
            onKeyDown={(e) => { if (e.key === "Enter") addLinkItem("shopping"); }}
            placeholder="https://…" className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm" />
          <input type="text" value={linkInput.shopping.label}
            onChange={(e) => setLinkInput((prev) => ({ ...prev, shopping: { ...prev.shopping, label: e.target.value } }))}
            onKeyDown={(e) => { if (e.key === "Enter") addLinkItem("shopping"); }}
            placeholder="Titre (optionnel)" className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm" />
          <button type="button" onClick={() => addLinkItem("shopping")} disabled={!linkInput.shopping.url.trim()}
            className="shrink-0 rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Ajouter</button>
        </div>
        <ShoppingKanban
          items={shopping}
          formatPrice={formatPrice}
          onMoveItem={handleKanbanMove}
          onDelete={(id) => removeItem("shopping", id)}
          onSetDueDate={(id, date) => updateItemMeta("shopping", id, { dueDate: date || undefined })}
          onSetAssignee={(id, name) => updateItemMeta("shopping", id, { assignee: name || undefined })}
          allPersons={allPersons}
          onCreatePerson={createPerson}
        />
        {todosPanel}
      </div>
    </>
  );
}

// ─── Écran de connexion SSO ──────────────────────────────────────────────────

const LOGIN_SLIDES = [
  {
    id: "palette",
    title: "Palette Farrow & Ball",
    description: "Coordonnez chaque pièce avec de vraies teintes Farrow & Ball, la référence des peintres.",
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
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Palette Farrow & Ball</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[FB.parmaGray, FB.string, FB.yellowGround, FB.vertDeTerre, FB.farrowsCream, FB.yeabridgeGreen].map((s) => (
              <div key={s.hex} className="overflow-hidden rounded-lg border border-black/8">
                <div className="h-7" style={{ backgroundColor: s.hex }} />
                <div className="bg-white p-1">
                  <div className="truncate text-[8px] font-medium text-slate-700">{s.name}</div>
                  <div className="text-[7px] text-slate-400">N°{s.number}</div>
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

function translateAuthError(error) {
  const msg = error?.message || "";
  if (/invalid login credentials/i.test(msg)) return "Email ou mot de passe incorrect.";
  if (/user already registered|already registered/i.test(msg)) return "Un compte existe déjà avec cet email.";
  if (/password should be at least/i.test(msg)) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (/unable to validate email address|invalid email/i.test(msg)) return "Adresse email invalide.";
  if (/rate limit/i.test(msg)) return "Trop de tentatives. Réessaie dans quelques instants.";
  return "Une erreur est survenue. Réessaie.";
}

function PasswordInput({ value, onChange, placeholder, autoComplete, className }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

function LoginScreen({ onSignIn, onSignInWithEmail, onSignUpWithEmail, onResetPassword }) {
  const [slide, setSlide] = useState(0);
  const inviteCode = new URLSearchParams(window.location.search).get("invite");
  const isInvite = !!inviteCode;
  const [inviteProjectName, setInviteProjectName] = useState(null);

  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [signupNeedsConfirmation, setSignupNeedsConfirmation] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (mode === "forgot") {
      if (!email.trim()) { setFormError("Merci de renseigner ton email."); return; }
      setFormLoading(true);
      const { error } = await onResetPassword(email.trim());
      setFormLoading(false);
      if (error) { setFormError(translateAuthError(error)); return; }
      setForgotSent(true);
      return;
    }

    if (!email.trim() || !password) {
      setFormError("Merci de renseigner un email et un mot de passe.");
      return;
    }

    setFormLoading(true);
    if (mode === "signup") {
      const { error, needsConfirmation, alreadyRegistered } = await onSignUpWithEmail(email.trim(), password, fullName.trim());
      setFormLoading(false);
      if (error) { setFormError(translateAuthError(error)); return; }
      if (alreadyRegistered) { setFormError("Un compte existe déjà avec cet email. Connecte-toi, ou utilise «Mot de passe oublié»."); return; }
      if (needsConfirmation) setSignupNeedsConfirmation(true);
    } else {
      const { error } = await onSignInWithEmail(email.trim(), password);
      setFormLoading(false);
      if (error) setFormError(translateAuthError(error));
    }
  };

  useEffect(() => {
    const id = setInterval(() => setSlide((p) => (p + 1) % LOGIN_SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!inviteCode) return;
    fetch(`${API_BASE}/project-info-by-invite?invite=${inviteCode}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.name) setInviteProjectName(d.name); })
      .catch(() => {});
  }, [inviteCode]);

  const googleSvg = (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

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
            <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
              <span className="text-[11px] font-medium tracking-wide text-white/80">Boosté par l'IA</span>
            </div>

            {isInvite ? (
              <>
                <div className="mb-4 mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700">Invitation valide</span>
                </div>
                <h1 className="text-[26px] font-semibold leading-snug text-slate-900">
                  {inviteProjectName
                    ? <>Tu as été invité(e) à rejoindre<br /><span className="text-amber-700">"{inviteProjectName}"</span> 🏡</>
                    : "Tu as été invité(e) à rejoindre un projet déco 🏡"
                  }
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Connecte-toi pour voir les inspirations, ajouter les tiennes et décider ensemble.
                </p>
              </>
            ) : (
              <>
                <p className="mb-6 text-sm text-slate-400">Co-créez votre intérieur.</p>
                <h1 className="text-[26px] font-semibold leading-snug text-slate-900">
                  Votre projet déco,<br />organisé pièce par pièce.
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Palette de couleurs, inspirations, matériaux et plans — tout au même endroit.
                </p>
              </>
            )}
          </div>

          {isInvite ? (
            <div className="mb-8 space-y-2.5">
              {[
                { emoji: "🎨", label: "Inspirations partagées" },
                { emoji: "❤️", label: "Liste d'envies commune" },
                { emoji: "💬", label: "Discussions en temps réel" },
              ].map(({ emoji, label }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-black/8 bg-white px-4 py-3">
                  <span className="text-lg leading-none">{emoji}</span>
                  <span className="text-sm text-slate-700">{label}</span>
                  <span className="ml-auto text-sm text-emerald-400">✓</span>
                </div>
              ))}
            </div>
          ) : (
            /* Feature list */
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
          )}

          {/* Google CTA */}
          <button
            type="button"
            onClick={onSignIn}
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-black/12 bg-white px-5 py-3.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
          >
            {googleSvg}
            {isInvite ? "Rejoindre avec Google →" : "Continuer avec Google"}
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-xs text-slate-400">ou</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          {/* Formulaire email / mot de passe */}
          {mode === "forgot" && forgotSent ? (
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
              Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.
            </div>
          ) : mode === "signup" && signupNeedsConfirmation ? (
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
              Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prénom"
                  className="w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-black/20"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                className="w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-black/20"
              />
              {mode !== "forgot" && (
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-black/20"
                />
              )}

              {formError && (
                <p className="text-xs text-red-500">{formError}</p>
              )}

              <button
                type="submit"
                disabled={formLoading}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 active:bg-slate-900 disabled:opacity-60"
              >
                {formLoading && (
                  <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {mode === "signup" ? "Créer mon compte" : mode === "forgot" ? "Envoyer le lien" : "Se connecter"}
              </button>
            </form>
          )}

          {/* Liens de bascule entre modes */}
          <div className="mt-4 text-center text-xs text-slate-400">
            {mode === "signin" && (
              <>
                <button type="button" onClick={() => { setMode("forgot"); setFormError(""); }} className="cursor-pointer hover:text-slate-600">
                  Mot de passe oublié ?
                </button>
                <span className="mx-2">·</span>
                <button type="button" onClick={() => { setMode("signup"); setFormError(""); }} className="cursor-pointer hover:text-slate-600">
                  Créer un compte
                </button>
              </>
            )}
            {mode === "signup" && (
              <button type="button" onClick={() => { setMode("signin"); setFormError(""); setSignupNeedsConfirmation(false); }} className="cursor-pointer hover:text-slate-600">
                Déjà un compte ? Se connecter
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => { setMode("signin"); setFormError(""); setForgotSent(false); }} className="cursor-pointer hover:text-slate-600">
                Retour à la connexion
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            {isInvite ? "Gratuit · Aucune carte requise." : "Accès réservé aux membres du projet."}
          </p>
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

function SetNewPasswordScreen({ onUpdatePassword }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }

    setLoading(true);
    const { error } = await onUpdatePassword(password);
    setLoading(false);

    if (error) { setError(translateAuthError(error)); return; }
    setDone(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF6F0] p-8">
      <div className="w-full max-w-[340px]">
        <h1 className="mb-1 text-[22px] font-semibold text-slate-900">Nouveau mot de passe</h1>
        <p className="mb-6 text-sm text-slate-500">Choisis un nouveau mot de passe pour ton compte.</p>

        {done ? (
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
            Mot de passe mis à jour. Redirection en cours…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              autoComplete="new-password"
              className="w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-black/20"
            />
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmer le mot de passe"
              autoComplete="new-password"
              className="w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-black/20"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {loading && <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              Valider
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Catalogue Farrow & Ball ─────────────────────────────────────────────────

function FarrowBallCatalog({ existingHexes = [], onAdd, onClose }) {
  const [family, setFamily] = useState(FARROW_BALL_FAMILIES[0].key);
  const [query, setQuery] = useState("");
  const activeFamily = FARROW_BALL_FAMILIES.find((f) => f.key === family) || FARROW_BALL_FAMILIES[0];
  const q = query.trim().toLowerCase();
  const colors = q
    ? FARROW_BALL_LIBRARY.filter((c) => c.name.toLowerCase().includes(q) || (c.number || "").includes(q))
    : activeFamily.colors;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col bg-white sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl sm:shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Catalogue</p>
            <h2 className="type-h2">Farrow &amp; Ball</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le catalogue"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-lg text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>
        <div className="border-b border-black/10 px-4 py-3 sm:px-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom ou numéro…"
            className="w-full rounded-lg border border-black/15 bg-[#fafaf8] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          {!q ? (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {FARROW_BALL_FAMILIES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFamily(f.key)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    family === f.key ? "bg-slate-900 text-white" : "border border-black/10 bg-white text-slate-500 hover:border-black/30"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {colors.map((c) => {
              const already = existingHexes.includes(c.hex);
              return (
                <div key={c.hex} className="flex flex-col overflow-hidden rounded-xl border border-black/10">
                  <span className="block h-16 w-full" style={{ backgroundColor: c.hex }} />
                  <div className="flex flex-1 flex-col gap-1 p-2">
                    <p className="text-xs font-medium leading-tight text-slate-700">{c.name}</p>
                    <p className="text-[10px] text-slate-400">N°{c.number}</p>
                    <button
                      type="button"
                      onClick={() => onAdd(c)}
                      disabled={already}
                      className={`mt-auto rounded-md border px-2 py-1 text-[11px] font-medium transition-all ${
                        already ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-black/15 bg-white text-slate-600 hover:border-black/30"
                      }`}
                    >
                      {already ? "Ajoutée ✓" : "Ajouter en test"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {colors.length === 0 ? <p className="text-sm text-slate-400">Aucune couleur ne correspond à la recherche.</p> : null}
        </div>
      </div>
    </div>,
    document.body
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

function ActivityFeedView({ activityFeed, allRoomPresets, onNavigate }) {
  const PAGE = 20;
  const [visible, setVisible] = useState(PAGE);

  const timeAgo = (iso) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "à l'instant";
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
    return `il y a ${Math.floor(diff / 86400)} j`;
  };

  const actionLabel = (type) => {
    switch (type) {
      case "todo_added": return "a ajouté une tâche";
      case "shopping_added": return "a ajouté un article courses";
      case "inspiration_added": return "a ajouté une inspiration";
      case "inspiration_link_added": return "a ajouté un lien d'inspiration";
      case "discussion_added": return "a créé une discussion";
      case "reaction_added": return "a réagi à une envie";
      case "member_joined": return "a rejoint le projet";
      default: return "a effectué une action";
    }
  };

  const tabForAction = (type) => {
    switch (type) {
      case "todo_added":
      case "shopping_added": return "liste";
      case "inspiration_added":
      case "inspiration_link_added": return "inspirations";
      case "discussion_added": return "discussions";
      case "reaction_added": return "liste";
      default: return null;
    }
  };

  const avatarColor = (name) => {
    const palette = ["#A8B5A2", "#b8c9d0", "#CDAA73", "#c4a882", "#9fb5b0"];
    let hash = 0;
    for (let i = 0; i < (name || "?").length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash)) % palette.length;
    return palette[Math.abs(hash)];
  };

  return (
    <div>
      <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4 mb-4">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Journal</p>
        <h2 className="type-h2">Activité récente</h2>
        <p className="mt-1 text-sm text-slate-500">Ce que les membres ont fait récemment sur ce projet.</p>
      </div>
      {activityFeed.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">Aucune activité pour l'instant.</p>
          <p className="mt-1 text-xs text-slate-300">Les actions des membres apparaîtront ici.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-black/10 bg-white divide-y divide-black/[0.04]">
          {activityFeed.slice(0, visible).map((entry) => {
            const initials = (entry.user_name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
            const roomLabel = entry.room_key ? allRoomPresets[entry.room_key]?.label : null;
            const tab = tabForAction(entry.action_type);
            const isNavigable = onNavigate && entry.room_key && tab;
            return (
              <div
                key={entry.id}
                className={`flex items-start gap-3 px-4 py-3 ${isNavigable ? "cursor-pointer hover:bg-black/[0.025] transition-colors" : ""}`}
                onClick={isNavigable ? () => onNavigate(entry.room_key, tab) : undefined}
              >
                <div
                  className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: avatarColor(entry.user_name) }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[#1C1A17]">
                    <span className="font-medium">{entry.user_name || "Quelqu'un"}</span>{" "}
                    <span className="text-[#4D4A47]">
                      {entry.action_type === "reaction_added" && entry.metadata?.emoji
                        ? `a réagi ${entry.metadata.emoji} à une envie`
                        : actionLabel(entry.action_type)}
                    </span>
                    {roomLabel && (
                      <span className="text-[#4D4A47]"> dans <span className="font-medium text-[#1C1A17]">{roomLabel}</span></span>
                    )}
                  </p>
                  {(entry.metadata?.text || entry.metadata?.title) && (
                    <p className="mt-0.5 truncate text-[11.5px] text-[#8A8580]">« {entry.metadata.text || entry.metadata.title} »</p>
                  )}
                </div>
                <time className="flex-shrink-0 text-[11px] text-[#A8A5A0]">{timeAgo(entry.created_at)}</time>
              </div>
            );
          })}
          {activityFeed.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className="w-full px-4 py-3 text-center text-[12.5px] text-[#8A8580] transition-colors hover:bg-black/[0.02] hover:text-[#1C1A17]"
            >
              Voir plus ({activityFeed.length - visible} restant{activityFeed.length - visible > 1 ? "s" : ""})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Système de dialogues (remplace alert/confirm natifs) ───────────────────

let setDialogState = null;

function showAlert(message, { title, confirmLabel = "OK" } = {}) {
  return new Promise((resolve) => {
    setDialogState?.({
      type: "alert",
      title,
      message,
      confirmLabel,
      resolve: () => { setDialogState?.(null); resolve(); },
    });
  });
}

function showConfirm(message, { title, confirmLabel = "Confirmer", cancelLabel = "Annuler", danger = false } = {}) {
  return new Promise((resolve) => {
    setDialogState?.({
      type: "confirm",
      title,
      message,
      confirmLabel,
      cancelLabel,
      danger,
      resolve: (value) => { setDialogState?.(null); resolve(value); },
    });
  });
}

function DialogHost() {
  const [state, setState] = useState(null);

  useEffect(() => {
    setDialogState = setState;
    return () => { setDialogState = null; };
  }, []);

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") state.resolve(state.type === "confirm" ? false : undefined);
      if (e.key === "Enter") state.resolve(state.type === "confirm" ? true : undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state]);

  if (!state) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={() => state.type === "alert" && state.resolve()}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {state.title ? <h2 className="text-base font-semibold text-slate-900 mb-1.5">{state.title}</h2> : null}
        <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed mb-5">{state.message}</p>
        <div className="flex gap-2 justify-end">
          {state.type === "confirm" ? (
            <button
              onClick={() => state.resolve(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              {state.cancelLabel}
            </button>
          ) : null}
          <button
            autoFocus
            onClick={() => state.resolve(state.type === "confirm" ? true : undefined)}
            className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors ${
              state.danger ? "bg-red-600 hover:bg-red-500" : "bg-slate-900 hover:bg-slate-700"
            }`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function computeGeneralBadges({ orderedActiveRooms, roomLists, discussionsCache, roomDocuments, mentionNotifications, activityFeed, activityLastViewed, user }) {
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
  const tActivity = activityFeed.filter(e => e.user_id !== user?.id && (!activityLastViewed || e.created_at > activityLastViewed)).length;
  return { tPending, tUnread, tDocs, tMention, tActivity };
}

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    user, session, loading: authLoading, isPasswordRecovery,
    signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, updatePassword, signOut,
  } = useAuth();
  const isGod = GOD_EMAILS.includes(user?.email);

  // ── État snapshot / historique ────────────────────────────────────────────
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [copyInviteSuccess, setCopyInviteSuccess] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
  const mobileUserMenuRef = useRef(null);
  const projectPickerRef = useRef(null);

  // ── Projet ────────────────────────────────────────────────────────────────
  const [room, setRoom] = useState("salon");
  const [globalAccent, setGlobalAccent] = useState("butter");
  const [globalShade, setGlobalShade] = useState("moyen");
  const [globalDominantColor, setGlobalDominantColor] = useState("bleu");
  const [globalPalette, setGlobalPalette] = useState({
    dominante: { hex: FB.parmaGray.hex, name: fbLabel(FB.parmaGray) },
    secondaire: { hex: FB.string.hex, name: fbLabel(FB.string) },
    sol: { hex: FB.elephantsBreath.hex, name: fbLabel(FB.elephantsBreath) },
    accents: [
      { hex: FB.yellowGround.hex, name: fbLabel(FB.yellowGround) },
      { hex: FB.farrowsCream.hex, name: fbLabel(FB.farrowsCream) },
      { hex: FB.yeabridgeGreen.hex, name: fbLabel(FB.yeabridgeGreen) },
    ],
  });
  const [activePaletteSlot, setActivePaletteSlot] = useState(null);
  const [activePaletteFamily, setActivePaletteFamily] = useState(FARROW_BALL_FAMILIES[0].key);

  const [logoPaletteChanged, setLogoPaletteChanged] = useState(false);
  const isFirstPaletteRender = useRef(true);
  useEffect(() => {
    if (isFirstPaletteRender.current) {
      isFirstPaletteRender.current = false;
      return;
    }
    setLogoPaletteChanged(true);
    const t = setTimeout(() => setLogoPaletteChanged(false), 700);
    return () => clearTimeout(t);
  }, [globalPalette]);

  function getShade(colorKey, level) {
    if (!colorKey) return "#ddd";
    if (colorKey === "dominante") return globalPalette.dominante.hex;
    if (colorKey === "secondaire") return globalPalette.secondaire.hex;
    if (colorKey === "sol") return globalPalette.sol.hex;
    if (colorKey.startsWith("#")) return colorKey;
    const color = baseColors[colorKey];
    if (!color) return "#ddd";
    const key = shadeMap[level] || "hex";
    return color[key] || color.hex;
  }

  function getColorName(colorKey) {
    if (!colorKey) return "Couleur";
    if (colorKey === "dominante") return globalPalette.dominante.name;
    if (colorKey === "secondaire") return globalPalette.secondaire.name;
    if (colorKey === "sol") return globalPalette.sol.name;
    if (colorKey.startsWith("#")) return describeColor(colorKey);
    return baseColors[colorKey]?.name || "Couleur";
  }

  const [warmth, setWarmth] = useState(60);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectId, setProjectId] = useState(() => {
    if (new URLSearchParams(window.location.search).get("invite")) return null;
    return new URLSearchParams(window.location.search).get("p") || null;
  });
  const isApplyingRemoteUpdate = useRef(false);
  const hydratedRef = useRef(false);
  const previewFetchedIdsRef = useRef(new Set());
  const autoSaveTimerRef = useRef(null);
  const roomNoteTimerRef = useRef(null);
  const [isSavingToServer, setIsSavingToServer] = useState(false);
  const [loadingFromUrl, setLoadingFromUrl] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [customRooms, setCustomRooms] = useState([]);
  const [hiddenRooms, setHiddenRooms] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [uploadedImages, setUploadedImages] = useState({});
  const [inspirationLinks, setInspirationLinks] = useState({});
  const [materialUploads, setMaterialUploads] = useState({});
  const [materialLinks, setMaterialLinks] = useState({});
  const [planUploads, setPlanUploads] = useState({});
  const [planLinks, setPlanLinks] = useState({});
  const [extraPlanImages, setExtraPlanImages] = useState({});
  const [extraMaterialImages, setExtraMaterialImages] = useState({});
  const [extraMaterialMeta, setExtraMaterialMeta] = useState({});
  const [aiInspirations, setAiInspirations] = useState({});
  const [instagramItems, setInstagramItems] = useState({});
  const [imageAnalysis, setImageAnalysis] = useState({});
  const [deletedImages, setDeletedImages] = useState({});
  const [roomNuances, setRoomNuances] = useState(INITIAL_ROOM_NUANCES);
  const [roomColorTests, setRoomColorTests] = useState({});
  const [showColorCatalog, setShowColorCatalog] = useState(false);
  const [roomNotes, setRoomNotes] = useState({});
  const [viewMode, setViewMode] = useState("general");
  const [roomMode, setRoomMode] = useState("liste");
  const [generalMode, setGeneralMode] = useState("accueil");
  const lastRoomModeRef = useRef({});

  const handleSetRoomMode = (mode) => {
    lastRoomModeRef.current[room] = mode;
    setRoomMode(mode);
  };
  const [lightbox, setLightbox] = useState(null);
  const [show3D, setShow3D] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [chatBubbleDismissed, setChatBubbleDismissed] = useState(false);
  const [chatDrafts, setChatDrafts] = useState({});
  const [discussionsCache, setDiscussionsCache] = useState({});
  const [projectMembers, setProjectMembers] = useState([]);
  const [persons, setPersons] = useState([]);
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
  const [showNewProjectWizard, setShowNewProjectWizard] = useState(false);
  const [roomLists, setRoomLists] = useState({});
  const [itemReactions, setItemReactions] = useState({});
  const [roomDocuments, setRoomDocuments] = useState({});
  const [roomOrder, setRoomOrder] = useState(null);
  const [draggingRoom, setDraggingRoom] = useState(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [pasteToast, setPasteToast] = useState(false);
  const dragCounterRef = useRef(0);
  const [chatHistory, setChatHistory] = useState({});
  const [generalContext, setGeneralContext] = useState("");
  const [generalResources, setGeneralResources] = useState([]);
  const [budgetTarget, setBudgetTarget] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityLastViewed, setActivityLastViewed] = useState(
    () => localStorage.getItem("activityLastViewed") || null
  );
  const markActivityViewed = () => {
    const now = new Date().toISOString();
    setActivityLastViewed(now);
    localStorage.setItem("activityLastViewed", now);
  };

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
  const accentHex = (() => {
    const a = activeNuance.accent;
    if (!a) return globalPalette.accents[0].hex;
    if (a.startsWith("#")) return a;
    if (a === "bois") return baseColors.bois.hex;
    return accents[a]?.hex || globalPalette.accents[0].hex;
  })();
  const accentName = (() => {
    const a = activeNuance.accent;
    if (!a) return globalPalette.accents[0].name;
    if (a.startsWith("#")) return globalPalette.accents.find(ac => ac.hex === a)?.name || describeColor(a);
    if (a === "bois") return baseColors.bois.name;
    return accents[a]?.name || globalPalette.accents[0].name;
  })();

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

  const availableRooms = viewMode === "general" ? orderedActiveRooms.map((key) => {
    const p = allRoomPresets[key];
    if (!p) return null;
    return {
      key,
      label: p.label,
      line: p.line || "",
      roomNote: roomNotes[key] || "",
      todoItems: (roomLists[key]?.todos || []).filter((i) => !i.done).slice(0, 5).map((i) => ({ id: i.id, text: i.text })),
      shoppingItems: (roomLists[key]?.shopping || []).filter((i) => !i.done).slice(0, 3).map((i) => {
          const rxs = itemReactions[i.id];
          const grouped = {};
          if (rxs?.length) rxs.forEach(r => { if (!grouped[r.emoji]) grouped[r.emoji] = []; grouped[r.emoji].push(r.userName); });
          const result = { id: i.id, text: i.text };
          if (Object.keys(grouped).length) result.reactions = grouped;
          if (i.selectedForPurchase) result.selectedForPurchase = true;
          if (typeof i.price === "number") result.price = i.price;
          if (i.priceCurrency) result.priceCurrency = i.priceCurrency;
          return result;
        }),
      materialSummary: (materialsByRoom[key] || []).map((m) => `${m.label}: ${m.value}`).slice(0, 3),
      testColors: (roomColorTests[key] || []).map((c) => ({ id: c.id, name: c.name, number: c.number, hex: c.hex, chosen: c.chosen })),
    };
  }).filter(Boolean) : [];

  const globalSelectedTotal = viewMode === "general" ? (() => {
    const selected = ["general", ...orderedActiveRooms].flatMap((key) => (roomLists[key]?.shopping || [])).filter(
      (i) => !i.done && i.selectedForPurchase && typeof i.price === "number"
    );
    if (!selected.length) return null;
    return {
      amount: selected.reduce((sum, i) => sum + i.price, 0),
      currency: selected.find((i) => i.priceCurrency)?.priceCurrency || null,
    };
  })() : null;

  const aiShoppingItems = (roomLists[room]?.shopping || [])
    .filter((i) => !i.done).slice(0, 5).map((i) => {
      const rxs = itemReactions[i.id];
      const grouped = {};
      if (rxs?.length) rxs.forEach(r => { if (!grouped[r.emoji]) grouped[r.emoji] = []; grouped[r.emoji].push(r.userName); });
      const result = { id: i.id, text: i.text };
      if (Object.keys(grouped).length) result.reactions = grouped;
      if (i.selectedForPurchase) result.selectedForPurchase = true;
      if (typeof i.price === "number") result.price = i.price;
      if (i.priceCurrency) result.priceCurrency = i.priceCurrency;
      return result;
    });

  const selectedTotal = (() => {
    const selected = (roomLists[room]?.shopping || []).filter(
      (i) => !i.done && i.selectedForPurchase && typeof i.price === "number"
    );
    if (!selected.length) return null;
    return {
      amount: selected.reduce((sum, i) => sum + i.price, 0),
      currency: selected.find((i) => i.priceCurrency)?.priceCurrency || null,
    };
  })();

  const aiTodoItems = (roomLists[room]?.todos || [])
    .filter((i) => !i.done).slice(0, 8).map((i) => ({ id: i.id, text: i.text }));

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
    dominantName: getColorName(activeDominantColor),
    dominantHex,
    secondaryName: getColorName(activeSecondaryColor),
    secondaryHex,
    accentName,
    accentHex,
    roomNote: roomNotes[room] || "",
    roomImageMetadata,
    generalContext: generalContext.slice(0, 400),
    allRoomsSummary,
    shoppingItems: aiShoppingItems,
    selectedTotal,
    todoItems: aiTodoItems,
    materialSummary: aiMaterialSummary,
    persons: [...(projectMembers || []), ...(persons || [])].filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i).map(p => p.name),
    roomTestColors: roomColorTests[room] || [],
  };

  const handleExportRoomPdf = async () => {
    if (!projectId || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const res = await authedFetch(`${API_BASE}/record-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, roomKey: room }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await showAlert(data.error || "Export impossible pour le moment.");
        return;
      }

      const [{ pdf }, { RoomExportDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./pdf/RoomExportDocument.jsx"),
      ]);

      const projectName = userProjects.find((p) => p.id === projectId)?.name || "Projet";
      // Certains articles stockent encore "Titre — https://..." dans le champ texte
      // brut (aperçu de lien jamais résolu) : on retire l'URL traînante du titre
      // puisqu'elle est déjà affichée séparément en dessous.
      const stripTrailingUrl = (text) => {
        if (!text) return text;
        const cleaned = text.replace(/[\s\-–—]*https?:\/\/\S+$/i, "").trim();
        return cleaned || text;
      };
      const shoppingItems = (roomLists[room]?.shopping || [])
        .filter((i) => !i.done)
        .map((i) => ({
          text: stripTrailingUrl(linkItemTitle(i)),
          url: i.url && i.url !== i.text ? i.url : null,
          price: i.price,
          priceCurrency: i.priceCurrency,
          selectedForPurchase: i.selectedForPurchase,
          image: i.image || null,
        }));

      // Même logique que MaterialsSection : une photo de matériau du catalogue
      // n'est incluse que si l'utilisateur l'a réellement remplacée par son upload ;
      // les ajouts "extra" peuvent être une photo directe ou un lien produit avec
      // une image (personnalisée ou récupérée depuis l'aperçu du lien).
      const materialImages = [
        ...(materialsByRoom[room] || []).flatMap((_, i) => {
          const src = materialUploads[`${room}-material-${i}`];
          return src ? [src] : [];
        }),
        ...(extraMaterialImages[room] || []).flatMap((entry, i) => {
          if (entry && typeof entry === "object" && entry.type === "link") {
            const meta = extraMaterialMeta[`${room}-material-extra-${i}`] || {};
            const src = meta.customImage || entry.image || "";
            return src ? [src] : [];
          }
          return typeof entry === "string" ? [entry] : [];
        }),
      ];

      const blob = await pdf(
        <RoomExportDocument
          projectName={projectName}
          roomLabel={preset.label}
          roomLine={preset.line}
          generatedAt={new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          apartmentPalette={{
            dominant: globalPalette.dominante,
            secondary: globalPalette.secondaire,
            sol: globalPalette.sol,
            accent: globalPalette.accents?.[0],
          }}
          palette={{
            dominant: { name: aiContext.dominantName, hex: aiContext.dominantHex },
            secondary: { name: aiContext.secondaryName, hex: aiContext.secondaryHex },
            accent: { name: aiContext.accentName, hex: aiContext.accentHex },
          }}
          testColors={roomColorTests[room] || []}
          inspirationImages={(aiInspirations[room] || []).filter((_, i) => !deletedImages[`${room}-ai-${i}`])}
          materialImages={materialImages}
          shoppingItems={shoppingItems}
          budgetTotal={selectedTotal}
          note={roomNotes[room] || ""}
          inviteUrl={inviteCode ? `${window.location.origin}/?invite=${inviteCode}` : null}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName} - ${preset.label}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      await showAlert("Export impossible pour le moment.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const updateRoomNuance = (key, value) => {
    setRoomNuances((prev) => ({ ...prev, [room]: { ...prev[room], [key]: value } }));
  };

  const addColorTestToRoom = (roomKey, color) => {
    setRoomColorTests((prev) => {
      const existing = prev[roomKey] || [];
      if (existing.some((c) => c.hex === color.hex)) return prev;
      const updated = [...existing, { id: `color-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, hex: color.hex, name: color.name, number: color.number || null, chosen: false }];
      if (projectId) saveRoomColorTestsToServer(projectId, roomKey, updated);
      return { ...prev, [roomKey]: updated };
    });
  };

  const toggleColorTestChosen = (roomKey, id) => {
    setRoomColorTests((prev) => {
      const updated = (prev[roomKey] || []).map((c) => c.id === id ? { ...c, chosen: !c.chosen } : c);
      if (projectId) saveRoomColorTestsToServer(projectId, roomKey, updated);
      return { ...prev, [roomKey]: updated };
    });
  };

  const removeColorTest = (roomKey, id) => {
    setRoomColorTests((prev) => {
      const updated = (prev[roomKey] || []).filter((c) => c.id !== id);
      if (projectId) saveRoomColorTestsToServer(projectId, roomKey, updated);
      return { ...prev, [roomKey]: updated };
    });
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

    const defaultTodos = [
      { id: `todos-${Date.now()}-1`, text: "Ajouter une image d'inspiration", done: false },
      { id: `todos-${Date.now()}-2`, text: "Ajouter un document (plan, devis…)", done: false },
    ];
    setRoomLists((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), todos: defaultTodos } }));
    if (projectId) saveRoomItemsToServer(projectId, key, "todos", defaultTodos);

    setRoom(key);
    setViewMode("room");
    setSidebarOpen(false);
  };

  const deleteRoom = async () => {
    if (orderedActiveRooms.length <= 1) return;
    const roomLabel = allRoomPresets[room]?.label || "cette pièce";
    if (!(await showConfirm(`Supprimer ${roomLabel} de l'app ?`, { title: "Supprimer la pièce", danger: true, confirmLabel: "Supprimer" }))) return;

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
    if (!image) return;
    setAiInspirations((prev) => {
      const newList = [...(prev[targetRoom] || []), image];
      saveMediaKey("aiInspirations", targetRoom, newList);
      return { ...prev, [targetRoom]: newList };
    });
  };

  const handleAddImagesGlobal = async (files) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!fileArray.length) return;
    await Promise.all(
      fileArray.map(async (file) => {
        const data = await readFileAsDataUrl(file);
        if (typeof data !== "string") return;
        const url = await uploadToBlob(data, `inspo-${room}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extFromDataUrl(data)}`);
        if (!url) { await showAlert("Échec de l'upload. Réessaie."); return; }
        addAiInspiration(room, url);
        logActivity("inspiration_added", room, {});
        const analysis = await analyzeImageForContext({ image: url, context: `Inspiration ${preset.label}`, section: "inspiration", authedFetch, projectId });
        if (analysis) setImageAnalysis((prev) => ({ ...prev, [`${room}-ai-${(aiInspirations[room] || []).length}`]: analysis }));
      })
    );
  };

  useEffect(() => {
    // The onboarding wizard has its own drop zone that stops propagation on
    // drop, so this window-level listener would set fileDragActive but never
    // get the matching drop event to clear it — leaving the overlay stuck open.
    if (showNewProjectWizard) {
      dragCounterRef.current = 0;
      setFileDragActive(false);
      return;
    }
    const handleDragEnter = (e) => {
      if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
      dragCounterRef.current += 1;
      setFileDragActive(true);
    };
    const handleDragLeave = () => {
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setFileDragActive(false);
      }
    };
    const handleDragOver = (e) => e.preventDefault();
    const handleWindowDrop = (e) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setFileDragActive(false);
      const files = e.dataTransfer?.files;
      if (files?.length) handleAddImagesGlobal(files);
    };
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageFiles = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (!imageFiles.length) return;
      e.preventDefault();
      handleAddImagesGlobal(imageFiles);
      setPasteToast(true);
      setTimeout(() => setPasteToast(false), 2500);
    };
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleWindowDrop);
    document.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleWindowDrop);
      document.removeEventListener("paste", handlePaste);
    };
  }, [room, preset, aiInspirations, showNewProjectWizard]);

  const logActivity = async (actionType, roomKey, metadata = {}) => {
    if (!projectId || !user || !import.meta.env.VITE_SUPABASE_URL) return;
    try {
      const entry = {
        project_id: projectId,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur',
        action_type: actionType,
        room_key: roomKey || null,
        metadata,
      };
      const { data } = await supabase.from('activity_log').insert(entry).select().single();
      if (data) setActivityFeed(prev => [data, ...prev].slice(0, 50));
    } catch { /* ignore */ }
  };

  const addExtraPlanImage = (targetRoom, image) => {
    setExtraPlanImages((prev) => ({
      ...prev,
      [targetRoom]: [...(prev[targetRoom] || []), image],
    }));
  };

  const authedFetch = useCallback((url, options = {}) => {
    const token = session?.access_token;
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [session]);
  const authedFetchRef = useRef(authedFetch);
  authedFetchRef.current = authedFetch;

  const entitlements = useEntitlements({ authedFetch, apiBase: API_BASE, enabled: !!user });

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

  const clearChatMessagesFromServer = (pid, roomKey) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat-message", projectId: pid, roomKey }),
    }).catch(() => {});
  };

  const saveRoomItemsToServer = (pid, roomKey, listKey, items) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "items", projectId: pid, roomKey, listKey, items, allowClearAll: items.length === 0 }),
    }).catch(() => {});
  };

  const saveRoomColorTestsToServer = (pid, roomKey, colors) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "color-tests", projectId: pid, roomKey, colors, allowClearAll: colors.length === 0 }),
    }).catch(() => {});
  };

  const savePersonsToServer = (pid, newPersons) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-persons", projectId: pid, persons: newPersons }),
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

  const loadReactions = (pid) => {
    if (!pid) return;
    authedFetch(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(pid)}&type=reactions`)
      .then(r => r.json())
      .then(({ reactions }) => {
        if (!Array.isArray(reactions)) return;
        const map = {};
        for (const rx of reactions) {
          if (!map[rx.item_id]) map[rx.item_id] = [];
          map[rx.item_id].push({ id: rx.id, userId: rx.user_id, userName: rx.user_name, emoji: rx.emoji });
        }
        setItemReactions(map);
      })
      .catch(() => {});
  };

  const toggleReaction = (itemId, emoji) => {
    if (!projectId || !user) return;
    const userId = user.id;
    const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Moi";
    let isAdding = true;
    let myOtherEmoji = null;
    let itemRoomKey = null;
    let itemText = null;
    setItemReactions(prev => {
      const existing = prev[itemId] || [];
      const mine = existing.find(r => r.userId === userId && r.emoji === emoji);
      isAdding = !mine;
      if (mine) return { ...prev, [itemId]: existing.filter(r => r !== mine) };
      // Remplacer tout émoji existant de cet utilisateur sur cet article
      const myOther = existing.find(r => r.userId === userId && r.emoji !== emoji);
      if (myOther) myOtherEmoji = myOther.emoji;
      return { ...prev, [itemId]: [...existing.filter(r => r.userId !== userId), { id: `optimistic-${Date.now()}`, userId, userName, emoji }] };
    });
    if (isAdding) {
      for (const [rk, lists] of Object.entries(roomLists)) {
        const found = (lists.shopping || []).find(i => i.id === itemId);
        if (found) { itemRoomKey = rk; itemText = found.previewTitle || found.text; break; }
      }
      if (itemRoomKey) logActivity("reaction_added", itemRoomKey, { emoji, text: itemText });
      if (myOtherEmoji) {
        authedFetch(`${API_BASE}/save-room`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reaction", projectId, itemId, emoji: myOtherEmoji }),
        }).catch(() => loadReactions(projectId));
      }
    }
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reaction", projectId, itemId, emoji }),
    }).catch(() => loadReactions(projectId));
  };

  const markMentionsRead = (discussionIds) => {
    if (!discussionIds?.length || !projectId) return;
    setMentionNotifications(prev => prev.map(n =>
      discussionIds.includes(n.discussion_id) && !n.read_at
        ? { ...n, read_at: new Date().toISOString() }
        : n
    ));
    authedFetch(`${API_BASE}/save-room`, {
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
  const saveProject = async ({ snapshot = false, snapshotLabel = "", metaOnly = false } = {}) => {
    const savedAt = new Date().toISOString();
    // Capturer l'ID du projet au début — projectId peut changer pendant l'await (race condition si l'utilisateur switche de projet)
    const currentProjectId = projectId;
    const projectState = {
      version: 1,
      savedAt,
      room,
      viewMode,
      generalMode,
      globalAccent,
      globalShade,
      globalDominantColor,
      globalPalette,
      warmth,
      customRooms,
      hiddenRooms,
      // En mode metaOnly, on n'inclut pas le blob média (évite d'écraser les saves atomiques)
      ...(metaOnly ? {} : {
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
      }),
      roomNuances,
      roomNotes,
      roomLists,
      roomDocuments,
      roomOrder,
      generalContext,
      generalResources,
      budgetTarget,
      chatHistory: Object.fromEntries(
        Object.entries(chatHistory).map(([k, msgs]) => [
          k,
          (msgs || []).slice(-CHAT_HISTORY_MAX).map(({ images, image, ...rest }) => rest),
        ])
      ),
    };

    setLastSavedAt(savedAt);

    try {
      setIsSavingToServer(true);
      const res = await authedFetch(`${API_BASE}/save-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: projectState, id: currentProjectId, snapshot, snapshotLabel, metaOnly }),
      });
      const data = await res.json();
      const { id } = data;
      const savedProjectId = id || currentProjectId;
      if (id) {
        setProjectId(id);
        window.history.replaceState({}, "", `/?p=${id}`);
      }
      if (!res.ok) return;
    } catch {
      // ignore — server errors don't block the UI
    } finally {
      setIsSavingToServer(false);
    }
  };

  const saveMediaKey = (mediaType, key, value) => {
    if (!projectId) return;
    authedFetch(`${API_BASE}/save-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "media-upsert", projectId, mediaType, key, value }),
    }).catch(() => {});
  };

  const hydrateState = (saved, { skipRoomSync = false, mergeMedia = false } = {}) => {
    // Scalaires projet — priorité projectConfig (load-project normalisé) puis blob (snapshot restore)
    const cfg = saved.projectConfig || saved;
    if (cfg.room && !skipRoomSync) setRoom(cfg.room);
    if (cfg.viewMode && !skipRoomSync) setViewMode(cfg.viewMode);
    if (cfg.generalMode && !skipRoomSync) setGeneralMode(cfg.generalMode);
    if (cfg.globalAccent) setGlobalAccent(cfg.globalAccent);
    if (cfg.globalShade) setGlobalShade(cfg.globalShade);
    if (cfg.globalDominantColor) setGlobalDominantColor(cfg.globalDominantColor);
    if (cfg.globalPalette && !Array.isArray(cfg.globalPalette) && cfg.globalPalette.dominante) {
      setGlobalPalette(cfg.globalPalette);
    }
    if (typeof cfg.warmth === "number") setWarmth(cfg.warmth);
    if (Array.isArray(cfg.customRooms)) setCustomRooms(cfg.customRooms);
    if (Array.isArray(cfg.hiddenRooms)) setHiddenRooms(cfg.hiddenRooms);
    if (cfg.roomOrder) setRoomOrder(cfg.roomOrder);
    if (typeof cfg.generalContext === "string") setGeneralContext(cfg.generalContext);
    if (Array.isArray(cfg.generalResources)) setGeneralResources(cfg.generalResources);
    // budgetTarget peut être explicitement `null` (objectif effacé) — pas de garde par vérité comme warmth
    if ("budgetTarget" in cfg) setBudgetTarget(cfg.budgetTarget ?? null);
    if (Array.isArray(cfg.persons)) setPersons(cfg.persons);
    if (cfg.savedAt) setLastSavedAt(cfg.savedAt);

    // Médias — source normalisée (room_media) ou blob (snapshot restore)
    const media = saved.roomMediaNormalized || saved;
    if (mergeMedia) {
      // Mode sync realtime : merge — remote est la base, local gagne (protège les uploads non encore persistés)
      if (media.uploadedImages)      setUploadedImages(prev      => ({ ...media.uploadedImages,      ...prev }));
      if (media.inspirationLinks)    setInspirationLinks(prev    => ({ ...media.inspirationLinks,    ...prev }));
      if (media.materialUploads)     setMaterialUploads(prev     => ({ ...media.materialUploads,     ...prev }));
      if (media.materialLinks)       setMaterialLinks(prev       => ({ ...media.materialLinks,       ...prev }));
      if (media.planUploads)         setPlanUploads(prev         => ({ ...media.planUploads,         ...prev }));
      if (media.planLinks)           setPlanLinks(prev           => ({ ...media.planLinks,           ...prev }));
      if (media.extraPlanImages)     setExtraPlanImages(prev     => ({ ...media.extraPlanImages,     ...prev }));
      if (media.extraMaterialImages) setExtraMaterialImages(prev => ({ ...media.extraMaterialImages, ...prev }));
      if (media.extraMaterialMeta)   setExtraMaterialMeta(prev   => ({ ...media.extraMaterialMeta,   ...prev }));
      if (media.aiInspirations)      setAiInspirations(prev      => ({ ...media.aiInspirations,      ...prev }));
      if (media.instagramItems)      setInstagramItems(prev      => ({ ...media.instagramItems,      ...prev }));
      if (media.imageAnalysis)       setImageAnalysis(prev       => ({ ...media.imageAnalysis,       ...prev }));
      if (media.deletedImages)       setDeletedImages(prev       => ({ ...media.deletedImages,       ...prev }));
    } else {
      // Mode load initial / snapshot restore : remplacement complet
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
    }

    // Nuances — source normalisée ou blob (snapshot)
    if (saved.roomNuancesNormalized) setRoomNuances(saved.roomNuancesNormalized);
    else if (saved.roomNuances) setRoomNuances(saved.roomNuances);

    // Couleurs test — source normalisée uniquement (pas de blob legacy)
    if (saved.roomColorTestsNormalized) setRoomColorTests(saved.roomColorTestsNormalized);

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
          dueDate: item.due_date || undefined,
          assignee: item.assignee || undefined,
          price: item.price ?? undefined,
          priceCurrency: item.price_currency || undefined,
          selectedForPurchase: !!item.selected_for_purchase,
          status: item.status || undefined,
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

    hydratedRef.current = true;
  };

  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get("p");
    const idToLoad = urlId || projectId;
    if (!idToLoad || !session) return;
    setLoadingFromUrl(true);
    authedFetch(`${API_BASE}/load-project?id=${encodeURIComponent(idToLoad)}&t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(({ projectConfig, isOwner: owner, inviteCode: code, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomColorTestsNormalized, roomMediaNormalized }) => {
        if (projectConfig) {
          hydrateState({ projectConfig, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomColorTestsNormalized, roomMediaNormalized });
          setProjectId(idToLoad);
        }
        if (typeof owner === "boolean") setIsOwner(owner);
        if (code) setInviteCode(code);
      })
      .catch(() => {})
      .finally(() => setLoadingFromUrl(false));
    // Volontairement limité à l'id utilisateur (pas l'objet `session` entier) :
    // Supabase réémet un nouvel objet session (même utilisateur) au refocus de
    // l'onglet, ce qui redéclenchait un rechargement complet du projet.
  }, [session?.user?.id]);

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
    if (!(await showConfirm("Restaurer ce point ? Les changements non-sauvegardés seront perdus.", { title: "Restaurer le point de sauvegarde", danger: true, confirmLabel: "Restaurer" }))) return;
    setRestoringSnapshotId(snapshotId);
    try {
      const res = await authedFetch(`${API_BASE}/restore-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, snapshotId }),
      });
      const data = await res.json();
      if (data.ok) {
        // Nouveau format : reload depuis la DB
        setShowSnapshotHistory(false);
        switchProject(projectId);
      } else if (data.state) {
        // Ancien format blob (vieux snapshots)
        hydrateState(data.state);
        setShowSnapshotHistory(false);
      }
    } catch {
      // ignore
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  const switchProject = (id) => {
    hydratedRef.current = false;
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
    setGlobalAccent("butter");
    setGlobalShade("moyen");
    setGlobalDominantColor("bleu");
    setGlobalPalette({
      dominante: { hex: FB.parmaGray.hex, name: fbLabel(FB.parmaGray) },
      secondaire: { hex: FB.string.hex, name: fbLabel(FB.string) },
      sol: { hex: FB.elephantsBreath.hex, name: fbLabel(FB.elephantsBreath) },
      accents: [
        { hex: FB.yellowGround.hex, name: fbLabel(FB.yellowGround) },
        { hex: FB.farrowsCream.hex, name: fbLabel(FB.farrowsCream) },
        { hex: FB.yeabridgeGreen.hex, name: fbLabel(FB.yeabridgeGreen) },
      ],
    });
    setRoomOrder(null);
    setChatHistory({});
    setProjectId(id);
    window.history.replaceState({}, "", `/?p=${id}`);
    setShowProjectPicker(false);
    setLoadingFromUrl(true);
    authedFetch(`${API_BASE}/load-project?id=${encodeURIComponent(id)}&t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(({ projectConfig, isOwner: owner, inviteCode: code, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomColorTestsNormalized, roomMediaNormalized }) => {
        if (projectConfig) hydrateState({ projectConfig, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomColorTestsNormalized, roomMediaNormalized });
        if (typeof owner === "boolean") setIsOwner(owner);
        if (code) setInviteCode(code);
      })
      .catch(() => {})
      .finally(() => {
        if (!hydratedRef.current) hydratedRef.current = true;
        setLoadingFromUrl(false);
      });
  };

  const handleCreateSnapshot = async (label) => {
    if (!hydratedRef.current) return;
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
      window.history.replaceState({}, "", `/?p=${data.projectId}`);
      // Charger le projet
      const loaded = await authedFetch(`${API_BASE}/load-project?id=${data.projectId}`).then((r) => r.json());
      const loadedCfg = loaded.projectConfig || loaded.state;
      if (loadedCfg) {
        hydrateState(loaded.roomItems?.length ? { projectConfig: loadedCfg, roomItems: loaded.roomItems, roomNotesNormalized: loaded.roomNotesNormalized, roomDocumentsNormalized: loaded.roomDocumentsNormalized, roomNuancesNormalized: loaded.roomNuancesNormalized, roomColorTestsNormalized: loaded.roomColorTestsNormalized, roomMediaNormalized: loaded.roomMediaNormalized } : { projectConfig: loadedCfg });
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
          authedFetchRef.current(`${API_BASE}/load-project?id=${encodeURIComponent(projectId)}&t=${Date.now()}`, { cache: "no-store" })
            .then((r) => r.json())
            .then(({ projectConfig, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomColorTestsNormalized, roomMediaNormalized }) => {
              if (projectConfig) {
                hydrateState({ projectConfig, roomItems, chatMessages, roomNotesNormalized, roomDocumentsNormalized, roomNuancesNormalized, roomColorTestsNormalized, roomMediaNormalized }, { skipRoomSync: true, mergeMedia: true });
              }
            })
            .catch(() => {})
            .finally(() => { setTimeout(() => { isApplyingRemoteUpdate.current = false; }, 200); });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Backfill previews : items avec URL (dans item.url ou extraite du text) mais sans image
  useEffect(() => {
    if (!projectId) return;
    const toFetch = [];
    for (const [roomKey, lists] of Object.entries(roomLists)) {
      for (const [listKey, items] of Object.entries(lists)) {
        for (const item of (items || [])) {
          if (previewFetchedIdsRef.current.has(item.id) || item.previewLoading) continue;
          // Cas 1 : url déjà dans la colonne mais pas d'image
          if (item.url && !item.image) {
            previewFetchedIdsRef.current.add(item.id);
            toFetch.push({ roomKey, listKey, id: item.id, url: item.url, needsUrlSave: false });
            continue;
          }
          // Cas 2 : URL dans le texte mais jamais extraite en colonne (items IA anciens)
          if (!item.url) {
            const m = (item.text || "").match(/https?:\/\/[^\s]+/);
            if (m) {
              previewFetchedIdsRef.current.add(item.id);
              toFetch.push({ roomKey, listKey, id: item.id, url: m[0], needsUrlSave: true });
            }
          }
        }
      }
    }
    if (!toFetch.length) return;
    for (const { roomKey, listKey, id, url, needsUrlSave } of toFetch) {
      fetchLinkPreview(url).then((preview) => {
        setRoomLists((prev) => {
          const updatedItems = ((prev[roomKey] || {})[listKey] || []).map((i) => {
            if (i.id !== id) return i;
            return {
              ...i,
              ...(needsUrlSave ? { url } : {}),
              ...(preview.image ? { image: preview.image } : {}),
              ...(preview.title && !i.previewTitle ? { previewTitle: preview.title } : {}),
            };
          });
          saveRoomItemsToServer(projectId, roomKey, listKey, updatedItems);
          return { ...prev, [roomKey]: { ...(prev[roomKey] || {}), [listKey]: updatedItems } };
        });
      }).catch(() => {});
    }
  }, [roomLists, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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
            authedFetchRef.current(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(projectId)}`)
              .then((r) => r.json())
              .then(({ items }) => {
                if (!Array.isArray(items) || items.length === 0) return;
                if (!hydratedRef.current) return;
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

  // Charger les discussions de toutes les pièces non encore en cache quand on ouvre la vue globale
  useEffect(() => {
    if (!projectId || viewMode !== "general" || generalMode !== "discussions") return;
    const allRoomKeys = ["general", ...orderedActiveRooms];
    allRoomKeys.forEach(roomKey => {
      setDiscussionsCache(prev => {
        if (roomKey in prev) return prev;
        authedFetchRef.current(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(projectId)}&type=discussions&roomKey=${encodeURIComponent(roomKey)}`)
          .then(r => r.json())
          .then(({ discussions }) => setDiscussionsCache(p => ({ ...p, [roomKey]: discussions || [] })))
          .catch(() => {});
        return prev;
      });
    });
  }, [projectId, viewMode, generalMode, orderedActiveRooms]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime discussions — notifie les membres des nouveaux fils et statuts
  useEffect(() => {
    if (!projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    let reloadTimer;
    const discussionsChannel = supabase
      .channel(`discussions-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discussions", filter: `project_id=eq.${projectId}` },
        (payload) => {
          clearTimeout(reloadTimer);
          reloadTimer = setTimeout(() => {
            const changedRoomKey = payload?.new?.room_key || payload?.old?.room_key;
            setDiscussionsCache(cache => {
              const roomsToRefresh = new Set(Object.keys(cache));
              if (changedRoomKey) roomsToRefresh.add(changedRoomKey);
              roomsToRefresh.forEach(roomKey => {
                authedFetchRef.current(`${API_BASE}/load-room-items?projectId=${encodeURIComponent(projectId)}&type=discussions&roomKey=${encodeURIComponent(roomKey)}`)
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
      .then(({ count }) => {
        if (count !== null) {
          setUserProjectCount(count);
          if (count > 1) loadUserProjects();
        }
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserProjects = async () => {
    if (!user?.id || !import.meta.env.VITE_SUPABASE_URL) return;
    const { data } = await supabase
      .from("project_members")
      .select("project_id, role, projects(id, name, status)")
      .eq("user_id", user.id);
    if (data) {
      setUserProjects(
        data
          .filter(r => r.projects && r.projects.status !== "archived")
          .map(r => ({ id: r.projects.id, name: r.projects.name, role: r.role }))
      );
    }
  };

  const handleDeleteProject = async (p) => {
    if (!(await showConfirm(`Toutes ses données (pièces, discussions, médias, documents...) seront perdues. Cette action est irréversible.`, { title: `Supprimer "${p.name || "cet appartement"}" ?`, danger: true, confirmLabel: "Supprimer définitivement" }))) return;
    try {
      const res = await authedFetch(`${API_BASE}/delete-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: p.id }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        await showAlert(error || "Erreur lors de la suppression.");
        return;
      }
      const remaining = userProjects.filter(pr => pr.id !== p.id);
      setUserProjects(remaining);
      if (p.id === projectId) {
        if (remaining.length > 0) {
          switchProject(remaining[0].id);
        } else {
          setProjectId(null);
          setShowProjectPicker(false);
          window.history.replaceState({}, "", "/");
          setShowOnboarding(true);
        }
      }
    } catch {
      await showAlert("Erreur lors de la suppression.");
    }
  };

  const handleArchiveProject = async (p) => {
    if (!(await showConfirm("Cette action archive le projet — les données sont conservées, tu pourras demander sa réactivation.", { title: `Archiver "${p.name || "ce projet"}" ?`, confirmLabel: "Archiver" }))) return;
    try {
      const res = await authedFetch(`${API_BASE}/archive-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: p.id }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        await showAlert(error || "Erreur lors de l'archivage.");
        return;
      }
      const remaining = userProjects.filter(pr => pr.id !== p.id);
      setUserProjects(remaining);
      if (p.id === projectId) {
        if (remaining.length > 0) {
          switchProject(remaining[0].id);
        } else {
          setProjectId(null);
          setShowProjectPicker(false);
          window.history.replaceState({}, "", "/");
          setShowOnboarding(true);
        }
      }
    } catch {
      await showAlert("Erreur lors de l'archivage.");
    }
  };

  // Détecter le projet à charger au démarrage
  useEffect(() => {
    if (!user?.id || projectId || !import.meta.env.VITE_SUPABASE_URL) return;

    const inviteParam = new URLSearchParams(window.location.search).get("invite");
    if (inviteParam) {
      // Ne pas rejoindre automatiquement — l'écran d'invitation de l'onboarding
      // demande confirmation avant d'appeler handleJoinProject.
      setShowOnboarding(true);
      return;
    }

    supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (data?.length) {
          switchProject(data[0].project_id);
        } else {
          setShowOnboarding(true);
        }
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les membres du projet pour les @mentions
  useEffect(() => {
    if (projectId && user) loadProjectMembers(projectId);
  }, [projectId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les notifications de mention
  useEffect(() => {
    if (projectId && user) loadMentionNotifications(projectId);
  }, [projectId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les réactions emoji des envies
  useEffect(() => {
    if (projectId && user) loadReactions(projectId);
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

  // Charger le fil d'activité du projet
  useEffect(() => {
    if (!projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    supabase
      .from('activity_log')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setActivityFeed(data); })
      .catch(() => {});
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime — nouvelles activités des autres membres
  useEffect(() => {
    if (!projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    const channel = supabase
      .channel(`activity-${projectId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `project_id=eq.${projectId}` },
        (payload) => {
          setActivityFeed(prev => {
            if (prev.some(e => e.id === payload.new.id)) return prev;
            return [payload.new, ...prev].slice(0, 50);
          });
          if (
            payload.new.action_type === 'member_joined' &&
            payload.new.user_id !== user?.id &&
            document.visibilityState !== 'visible' &&
            Notification.permission === 'granted'
          ) {
            const notif = new Notification('Nouveau membre', {
              body: `${payload.new.user_name || 'Quelqu\'un'} a rejoint le projet.`,
              icon: '/vite.svg',
              tag: `member-joined-${payload.new.id}`,
            });
            notif.onclick = () => { window.focus(); notif.close(); };
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [projectId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime réactions emoji — sync entre membres du projet
  useEffect(() => {
    if (!projectId || !import.meta.env.VITE_SUPABASE_URL) return;
    const channel = supabase
      .channel(`reactions-${projectId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "item_reactions", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === "INSERT") {
            setItemReactions(prev => {
              const itemId = newRow.item_id;
              const existing = prev[itemId] || [];
              const withoutOptimistic = existing.filter(
                r => !(typeof r.id === "string" && r.id.startsWith("optimistic-") && r.userId === newRow.user_id && r.emoji === newRow.emoji)
              );
              if (withoutOptimistic.some(r => r.id === newRow.id)) return prev;
              return { ...prev, [itemId]: [...withoutOptimistic, { id: newRow.id, userId: newRow.user_id, userName: newRow.user_name, emoji: newRow.emoji }] };
            });
          } else if (eventType === "DELETE") {
            setItemReactions(prev => ({
              ...prev,
              [oldRow.item_id]: (prev[oldRow.item_id] || []).filter(r => r.id !== oldRow.id)
            }));
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save métadonnées projet dès qu'elles changent (sans le blob média pour ne pas écraser les saves atomiques)
  useEffect(() => {
    if (!projectId || !hydratedRef.current || isApplyingRemoteUpdate.current) return;
    saveProject({ metaOnly: true });
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    projectId, room, viewMode, generalMode, globalAccent, globalShade, globalDominantColor, globalPalette,
    warmth, customRooms, hiddenRooms, roomNuances, roomOrder,
    generalContext, generalResources, budgetTarget,
  ]);

  useEffect(() => {
    if (orderedActiveRooms.length && !orderedActiveRooms.includes(room)) {
      setRoom(orderedActiveRooms[0]);
    }
  }, [orderedActiveRooms, room]);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e) => {
      if (
        userMenuRef.current && !userMenuRef.current.contains(e.target) &&
        mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(e.target)
      ) setShowUserMenu(false);
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
    setRoomMode(lastRoomModeRef.current[room] || "liste");
  }, [room]);

  const getRoomColors = (roomKey) => {
    const p = allRoomPresets[roomKey];
    if (!p) return null;
    const nuance = roomNuances[roomKey] || INITIAL_ROOM_NUANCES[roomKey] || { dominant: "moyen", secondary: "moyen", accent: globalAccent };
    const dColor = nuance.dominantColor || p.dominant;
    const sColor = nuance.secondaryColor || p.secondary;
    const dHex = getShade(dColor, nuance.dominant);
    const sHex = getShade(sColor, nuance.secondary);
    const aHex = (() => { const a = nuance.accent; if (!a) return globalPalette.accents[0].hex; if (a.startsWith("#")) return a; if (a === "bois") return baseColors.bois.hex; return accents[a]?.hex || globalPalette.accents[0].hex; })();
    const aName = (() => { const a = nuance.accent; if (!a) return globalPalette.accents[0].name; if (a.startsWith("#")) return globalPalette.accents.find(ac => ac.hex === a)?.name || describeColor(a); if (a === "bois") return baseColors.bois.name; return accents[a]?.name || globalPalette.accents[0].name; })();
    return { dominant: { name: getColorName(dColor), hex: dHex }, secondary: { name: getColorName(sColor), hex: sHex }, accent: { name: aName, hex: aHex } };
  };

  const roomPendingCount = (key) => {
    const list = roomLists[key] || {};
    return [...(list.shopping || []), ...(list.todos || [])].filter((item) => !item.done).length;
  };

  // ── Guards auth ──────────────────────────────────────────────────────────
  if (authLoading) return <div className="min-h-screen bg-[#FAF6F0]" />;
  if (isPasswordRecovery) return <SetNewPasswordScreen onUpdatePassword={updatePassword} />;
  if (!user) {
    return (
      <LoginScreen
        onSignIn={signInWithGoogle}
        onSignInWithEmail={signInWithEmail}
        onSignUpWithEmail={signUpWithEmail}
        onResetPassword={resetPassword}
      />
    );
  }
  if (!projectId) {
    if (!showOnboarding) return <div className="min-h-screen bg-[#FAF6F0]" />;
    return (
      <div className="fixed inset-0 z-[60] bg-[#FAF6F0]">
        <OnboardingWizard
          user={user}
          session={session}
          initialStep="path"
          onComplete={(newId) => { setShowOnboarding(false); switchProject(newId); }}
          onJoinProject={handleJoinProject}
          signOut={signOut}
        />
      </div>
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
      <DialogHost />
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
          <svg
            width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
            style={logoPaletteChanged ? { animation: "logoPalettePulse 0.7s ease" } : undefined}
          >
            <rect x="0" y="0" width="9.5" height="9.5" rx="2" fill={globalPalette.dominante.hex} style={{ transition: "fill 0.5s ease" }}/>
            <rect x="12.5" y="0" width="9.5" height="9.5" rx="2" fill={globalPalette.secondaire.hex} style={{ transition: "fill 0.5s ease" }}/>
            <rect x="0" y="12.5" width="9.5" height="9.5" rx="2" fill={globalPalette.sol.hex} style={{ transition: "fill 0.5s ease" }}/>
            <rect x="12.5" y="12.5" width="9.5" height="9.5" rx="2" fill={globalPalette.accents[0].hex} stroke="rgba(0,0,0,0.12)" strokeWidth="0.75" style={{ transition: "fill 0.5s ease" }}/>
          </svg>
          <span className="text-[15px] font-bold tracking-[-0.02em] text-[#1C1A17]">renoom</span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2.5">
          <div className="mb-5">
            <span className="mb-1 block px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7A7773]">
              Vue générale
            </span>
            {(() => {
              const { tPending, tUnread, tMention, tActivity } = computeGeneralBadges({
                orderedActiveRooms, roomLists, discussionsCache, roomDocuments, mentionNotifications, activityFeed, activityLastViewed, user,
              });
              const selectGeneral = (key) => {
                setViewMode("general");
                setGeneralMode(key);
                if (key === "activite") markActivityViewed();
                setSidebarOpen(false);
              };
              const primary = [
                { key: "accueil", label: "Accueil", badge: 0, mention: 0 },
                { key: "todos", label: "Todos", badge: tPending, mention: 0 },
                { key: "budget", label: "Budget", badge: 0, mention: 0 },
                { key: "couleurs", label: "Teintes", badge: 0, mention: 0 },
                { key: "discussions", label: "Discussions", badge: tUnread, mention: tMention },
              ];
              const secondary = [
                { key: "ressources", label: "Documents", badge: 0, mention: 0 },
                { key: "activite", label: "Activité", badge: tActivity, mention: 0 },
              ];
              return (
                <>
                  {primary.map(({ key, label, badge, mention }) => {
                    const active = viewMode === "general" && generalMode === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectGeneral(key)}
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
                  })}
                  <OverflowMenu
                    items={secondary}
                    activeKey={viewMode === "general" ? generalMode : null}
                    onSelect={selectGeneral}
                    variant="sidebar"
                  />
                </>
              );
            })()}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7A7773]">
                Pièces
              </span>
              <button
                type="button"
                onClick={addRoom}
                title="Ajouter une pièce"
                aria-label="Ajouter une pièce"
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[#8A8680] transition-colors hover:bg-black/[0.04] hover:text-[#4D4A47]"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M7 2v10M2 7h10" />
                </svg>
              </button>
            </div>
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
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-black/[0.08] bg-[#F2EFE7]">
          {/* Project switcher */}
          <div className="relative border-b border-black/[0.06] px-2 py-1.5" ref={projectPickerRef}>
            <button
              type="button"
              onClick={() => {
                loadUserProjects();
                setShowProjectPicker(v => !v);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-[7px] text-left transition-colors hover:bg-black/[0.04]"
            >
              <div
                className="h-[18px] w-[18px] flex-shrink-0 rounded-[4px]"
                style={{ background: "linear-gradient(135deg,#CDAA73 10%,#A8B5A2 90%)" }}
              />
              <span className="flex-1 truncate text-[12.5px] font-semibold text-[#1C1A17]">{userProjects.find(p => p.id === projectId)?.name || "Appartement"}</span>
              <svg className="h-3.5 w-3.5 flex-shrink-0 text-[#8A8680]" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5L7 2.5L10 5.5M4 8.5L7 11.5L10 8.5" />
              </svg>
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
                    {renamingProjectId !== p.id && p.role === "owner" && (
                      <button
                        type="button"
                        title="Archiver ce projet"
                        onClick={e => { e.stopPropagation(); handleArchiveProject(p); }}
                        className="flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/[0.06]"
                      >
                        <svg className="h-3 w-3 text-[#8A8680]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1.5 2h9v2h-9zM2 4.5h8v5.5a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
                          <path d="M4.75 6.5h2.5" />
                        </svg>
                      </button>
                    )}
                    {renamingProjectId !== p.id && isGod && (
                      <button
                        type="button"
                        title="Supprimer l'appartement"
                        onClick={e => { e.stopPropagation(); handleDeleteProject(p); }}
                        className="flex-shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50"
                      >
                        <svg className="h-3 w-3 text-[#B0645A]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1m1.5 0l-.5 7a1 1 0 01-1 1h-4a1 1 0 01-1-1l-.5-7" />
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
                <div className="border-t border-black/[0.06] px-3 py-1.5">
                  {entitlements.limits && entitlements.usage && entitlements.usage.activeProjects >= entitlements.limits.max_active_projects ? (
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Limite de projets atteinte")}`}
                      title={`Limite de ${entitlements.limits.max_active_projects} projets actifs atteinte pour ton plan ${entitlements.plan?.name || ""}. Archive un projet existant ou contacte l'équipe.`}
                      className="block w-full rounded-md px-1 py-1 text-left text-[11px] text-[#ADA89E] transition-colors hover:text-[#8A8680]"
                    >
                      Limite de projets atteinte · Contacter l'équipe
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowProjectPicker(false); setShowNewProjectWizard(true); }}
                      className="w-full rounded-md px-1 py-1 text-left text-[11px] text-[#ADA89E] transition-colors hover:text-[#8A8680]"
                    >
                      Créer un tout nouvel appartement
                    </button>
                  )}
                </div>
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
                  <p className="truncate text-[10.5px] leading-tight text-[#B0ADA6]">{user?.email}</p>
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
            <div className="relative" ref={mobileUserMenuRef}>
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
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {(() => {
                const badgesFor = (key) => {
                  const pending = key === "liste" ? roomPendingCount(room) : key === "discussions" ? (discussionsCache[room] || []).reduce((sum, d) => sum + (d.unread_count || 0), 0) : 0;
                  const mentionBadge = key === "discussions"
                    ? (mentionNotifications || []).filter(n => !n.read_at && (discussionsCache[room] || []).some(d => d.id === n.discussion_id)).length
                    : 0;
                  return { pending, mentionBadge };
                };
                const primary = ["liste", "inspirations", "couleurs", "discussions"].map((key) => ({
                  key, label: { liste: "Liste", inspirations: "Inspirations", couleurs: "Teintes", discussions: "Discussions" }[key], ...badgesFor(key),
                }));
                const secondary = [
                  ...["documents"].map((key) => {
                    const { pending, mentionBadge } = badgesFor(key);
                    return { key, label: "Documents", badge: pending, mention: mentionBadge };
                  }),
                  { key: "export-pdf", label: isExportingPdf ? "Export..." : "Exporter PDF" },
                ];
                const selectSecondary = (key) => {
                  if (key === "export-pdf") handleExportRoomPdf();
                  else handleSetRoomMode(key);
                };
                return (
                  <>
                    {primary.map(({ key, label, pending, mentionBadge }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSetRoomMode(key)}
                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
                    ))}
                    <OverflowMenu items={secondary} activeKey={roomMode} onSelect={selectSecondary} variant="topbar" />
                  </>
                );
              })()}
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
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {(() => {
                const { tPending: totalPending, tUnread: totalUnread, tMention: totalMentionUnread, tActivity: totalActivity } = computeGeneralBadges({
                  orderedActiveRooms, roomLists, discussionsCache, roomDocuments, mentionNotifications, activityFeed, activityLastViewed, user,
                });
                const selectGeneral = (key) => { setGeneralMode(key); if (key === "activite") markActivityViewed(); };
                const primary = [
                  { key: "accueil", label: "Accueil", badge: 0 },
                  { key: "todos", label: "Todos", badge: totalPending },
                  { key: "budget", label: "Budget", badge: 0 },
                  { key: "couleurs", label: "Teintes", badge: 0 },
                  { key: "discussions", label: "Discussions", badge: totalUnread, mentionBadge: totalMentionUnread },
                ];
                const secondary = [
                  { key: "ressources", label: "Documents", badge: 0, mention: 0 },
                  { key: "activite", label: "Activité", badge: totalActivity, mention: 0 },
                ];
                return (
                  <>
                    {primary.map(({ key, label, badge, mentionBadge }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectGeneral(key)}
                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
                    ))}
                    <OverflowMenu items={secondary} activeKey={generalMode} onSelect={selectGeneral} variant="topbar" />
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:space-y-6 md:p-6">
        {viewMode === "general" ? (
          generalMode === "accueil" ? (() => {
            const { tPending, tUnread, tMention, tActivity } = computeGeneralBadges({
              orderedActiveRooms, roomLists, discussionsCache, roomDocuments, mentionNotifications, activityFeed, activityLastViewed, user,
            });
            return (
              <Dashboard
                projectName={userProjects.find(p => p.id === projectId)?.name || "Appartement"}
                lastSavedAt={lastSavedAt}
                orderedActiveRooms={orderedActiveRooms}
                allRoomPresets={allRoomPresets}
                getRoomColors={getRoomColors}
                roomLists={roomLists}
                totalPending={tPending}
                totalUnread={tUnread}
                totalMentionUnread={tMention}
                totalActivity={tActivity}
                onNavigateGeneral={(key) => { setGeneralMode(key); if (key === "activite") markActivityViewed(); }}
                onNavigateRoom={(key) => { setRoom(key); setViewMode("room"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                isOwner={isOwner}
                authedFetch={authedFetchRef.current}
                apiBase={API_BASE}
                projectId={projectId}
              />
            );
          })() : generalMode === "todos" ? (
            <TodosGlobalView
              orderedActiveRooms={orderedActiveRooms}
              allRoomPresets={allRoomPresets}
              roomLists={roomLists}
              setRoomLists={setRoomLists}
              projectId={projectId}
              saveRoomItemsFn={saveRoomItemsToServer}
              itemReactions={itemReactions}
              currentUserId={user?.id}
              onToggleReaction={toggleReaction}
              persons={persons}
              projectMembers={projectMembers}
              setPersons={setPersons}
              savePersonsFn={savePersonsToServer}
            />
          ) : generalMode === "budget" ? (
            <BudgetView
              orderedActiveRooms={orderedActiveRooms}
              allRoomPresets={allRoomPresets}
              roomLists={roomLists}
              setRoomLists={setRoomLists}
              saveRoomItemsFn={saveRoomItemsToServer}
              projectId={projectId}
              budgetTarget={budgetTarget}
              onSetBudgetTarget={setBudgetTarget}
              formatPrice={formatPrice}
              onNavigateToRoom={(key) => {
                lastRoomModeRef.current[key] = "liste";
                setRoom(key);
                setViewMode("room");
                setRoomMode("liste");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ) : generalMode === "couleurs" ? (
            <>
              {/* Palette globale — vue générale */}
              {(() => {
                const applyColor = (slotKey, hex, name) => {
                  setGlobalPalette(prev => {
                    if (slotKey.startsWith("accent-")) {
                      const idx = parseInt(slotKey.split("-")[1]);
                      const newAccents = [...prev.accents];
                      newAccents[idx] = { hex, name };
                      return { ...prev, accents: newAccents };
                    }
                    return { ...prev, [slotKey]: { hex, name } };
                  });
                };
                const applyToRooms = async (palette) => {
                  const confirmed = await showConfirm(
                    `Cela va écraser les couleurs dominante, secondaire et sol de chaque pièce avec celles de la palette globale. Les nuances (clair/moyen…) déjà choisies par pièce resteront inchangées.\n\nCette action n'est pas réversible automatiquement.`,
                    { title: `Appliquer cette palette à ${orderedActiveRooms.length} pièce${orderedActiveRooms.length > 1 ? "s" : ""} ?`, confirmLabel: "Appliquer" }
                  );
                  if (!confirmed) return;
                  setRoomNuances(prev => {
                    const updated = { ...prev };
                    orderedActiveRooms.forEach(k => {
                      updated[k] = {
                        ...(prev[k] || INITIAL_ROOM_NUANCES[k] || {}),
                        dominantColor: palette.dominante.hex,
                        secondaryColor: palette.secondaire.hex,
                        solColor: palette.sol.hex,
                      };
                    });
                    return updated;
                  });
                };
                const mainSlots = [
                  { key: "dominante", label: "Dominante", ...globalPalette.dominante },
                  { key: "secondaire", label: "Secondaire", ...globalPalette.secondaire },
                  { key: "sol", label: "Sol", ...globalPalette.sol },
                ];
                const currentHex = activePaletteSlot
                  ? activePaletteSlot.startsWith("accent-")
                    ? globalPalette.accents[parseInt(activePaletteSlot.split("-")[1])]?.hex
                    : globalPalette[activePaletteSlot]?.hex
                  : null;
                const openSlot = (slotKey, hex) => {
                  const next = activePaletteSlot === slotKey ? null : slotKey;
                  setActivePaletteSlot(next);
                  if (next) setActivePaletteFamily(familyOfHex(hex) || activePaletteFamily);
                };
                const activeFamily = FARROW_BALL_FAMILIES.find(f => f.key === activePaletteFamily) || FARROW_BALL_FAMILIES[0];
                return (
                  <div className="space-y-3 rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Palette de l'appartement — teintes Farrow & Ball</p>
                      <p className="text-[11px] text-slate-400">Cliquer une couleur pour la modifier</p>
                    </div>
                    <div className="flex gap-2">
                      {mainSlots.map(slot => (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() => openSlot(slot.key, slot.hex)}
                          className={`flex flex-1 flex-col overflow-hidden rounded-xl border transition-all ${
                            activePaletteSlot === slot.key ? "border-slate-900 shadow-md" : "border-black/10 hover:border-black/30"
                          }`}
                        >
                          <span className="block h-12 w-full" style={{ backgroundColor: slot.hex }} />
                          <span className="px-1 py-1 text-center">
                            <span className="block text-[10px] font-medium text-slate-700 truncate">{slot.name}</span>
                            <span className="block text-[9px] text-slate-400">{slot.label}</span>
                          </span>
                        </button>
                      ))}
                      {globalPalette.accents.map((accent, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => openSlot(`accent-${i}`, accent.hex)}
                          className={`flex flex-1 flex-col overflow-hidden rounded-xl border transition-all ${
                            activePaletteSlot === `accent-${i}` ? "border-slate-900 shadow-md" : "border-black/10 hover:border-black/30"
                          }`}
                        >
                          <span className="block h-12 w-full" style={{ backgroundColor: accent.hex }} />
                          <span className="px-1 py-1 text-center">
                            <span className="block text-[10px] font-medium text-slate-700 truncate">{accent.name}</span>
                            <span className="block text-[9px] text-slate-400">Accent {i + 1}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    {activePaletteSlot !== null && currentHex && (
                      <div className="space-y-3 rounded-xl border border-black/10 bg-slate-50 p-3">
                        <div className="flex gap-1 overflow-x-auto pb-1">
                          {FARROW_BALL_FAMILIES.map(family => (
                            <button
                              key={family.key}
                              type="button"
                              onClick={() => setActivePaletteFamily(family.key)}
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                                activePaletteFamily === family.key ? "bg-slate-900 text-white" : "border border-black/10 bg-white text-slate-500 hover:border-black/30"
                              }`}
                            >
                              {family.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
                          {activeFamily.colors.map(preset => (
                            <button
                              key={preset.hex}
                              type="button"
                              onClick={() => applyColor(activePaletteSlot, preset.hex, fbLabel(preset))}
                              title={fbLabel(preset)}
                              className={`flex flex-col overflow-hidden rounded-lg border-2 transition-all ${
                                currentHex === preset.hex ? "border-slate-900" : "border-transparent hover:border-black/30"
                              }`}
                            >
                              <span className="block h-7 w-full" style={{ backgroundColor: preset.hex }} />
                              <span className="w-full truncate px-1 py-0.5 text-left text-[9px] leading-tight text-slate-600">{preset.name}</span>
                              <span className="w-full truncate px-1 pb-0.5 text-left text-[8px] leading-tight text-slate-400">N°{preset.number}</span>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="color"
                              value={currentHex}
                              onChange={e => applyColor(activePaletteSlot, e.target.value, describeColor(e.target.value))}
                              className="h-7 w-7 cursor-pointer rounded border border-black/15"
                            />
                            <span className="text-xs text-slate-500">Couleur libre</span>
                          </label>
                          <span className="ml-auto text-[11px] text-slate-400">{describeColor(currentHex)}</span>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => applyToRooms(globalPalette)}
                      className="w-full rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800"
                    >
                      Appliquer la palette à toutes les pièces
                    </button>
                    <p className="text-[11px] text-amber-600">
                      ⚠ Écrase dominante, secondaire et sol de chaque pièce. Les nuances (clair/moyen…) restent inchangées.
                    </p>
                  </div>
                );
              })()}
              <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Vue d'ensemble</p>
                <h2 className="type-h2">Couleurs par pièce</h2>
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
                        ].map(({ hex, name, sublabel }) => (
                          <div key={sublabel} className="min-w-0 flex-1">
                            <div className="mb-1 h-7 rounded border border-black/10" style={{ backgroundColor: hex }} />
                            <div className="truncate text-[10px] text-slate-400">{sublabel}</div>
                            <div className="truncate text-[10px] text-slate-600">{name}</div>
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
          ) : generalMode === "ressources" ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Appartement</p>
                <h2 className="type-h2">Documents généraux</h2>
                <p className="mt-1 text-sm text-slate-600">Devis ou plans qui concernent tout l'appartement, sans lien avec une pièce précise.</p>
              </div>
              <DocumentsSection
                room="general"
                roomDocuments={roomDocuments}
                setRoomDocuments={setRoomDocuments}
                projectId={projectId}
                saveDocFn={saveRoomDocumentToServer}
                deleteDocFn={deleteRoomDocumentFromServer}
                authedFetch={authedFetch}
                roomLists={roomLists}
                setRoomLists={setRoomLists}
                saveRoomItemsFn={saveRoomItemsToServer}
                orderedActiveRooms={orderedActiveRooms}
                allRoomPresets={allRoomPresets}
              />
              <DocumentsGlobalView
                orderedActiveRooms={orderedActiveRooms}
                allRoomPresets={allRoomPresets}
                roomDocuments={roomDocuments}
              />
            </div>
          ) : (
            <ActivityFeedView
              activityFeed={activityFeed.filter(e => e.user_id !== user?.id)}
              allRoomPresets={allRoomPresets}
              onNavigate={(roomKey, tab) => {
                setRoom(roomKey);
                setViewMode("room");
                lastRoomModeRef.current[roomKey] = tab;
                setRoomMode(tab);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )
        ) : roomMode === "couleurs" ? (
          <>
            <section className="grid gap-6 xl:grid-cols-2">
              {(() => {
                const applyColor = (slotKey, hex, name) => {
                  setGlobalPalette(prev => {
                    if (slotKey.startsWith("accent-")) {
                      const idx = parseInt(slotKey.split("-")[1]);
                      const newAccents = [...prev.accents];
                      newAccents[idx] = { hex, name };
                      return { ...prev, accents: newAccents };
                    }
                    return { ...prev, [slotKey]: { hex, name } };
                  });
                };
                const applyToRooms = async (palette) => {
                  const confirmed = await showConfirm(
                    `Cela va écraser les couleurs dominante, secondaire et sol de chaque pièce avec celles de la palette globale. Les nuances (clair/moyen…) déjà choisies par pièce resteront inchangées.\n\nCette action n'est pas réversible automatiquement.`,
                    { title: `Appliquer cette palette à ${orderedActiveRooms.length} pièce${orderedActiveRooms.length > 1 ? "s" : ""} ?`, confirmLabel: "Appliquer" }
                  );
                  if (!confirmed) return;
                  setRoomNuances(prev => {
                    const updated = { ...prev };
                    orderedActiveRooms.forEach(k => {
                      updated[k] = {
                        ...(prev[k] || INITIAL_ROOM_NUANCES[k] || {}),
                        dominantColor: palette.dominante.hex,
                        secondaryColor: palette.secondaire.hex,
                        solColor: palette.sol.hex,
                      };
                    });
                    return updated;
                  });
                };
                const mainSlots = [
                  { key: "dominante", label: "Dominante", ...globalPalette.dominante },
                  { key: "secondaire", label: "Secondaire", ...globalPalette.secondaire },
                  { key: "sol", label: "Sol", ...globalPalette.sol },
                ];
                const currentHex = activePaletteSlot
                  ? activePaletteSlot.startsWith("accent-")
                    ? globalPalette.accents[parseInt(activePaletteSlot.split("-")[1])]?.hex
                    : globalPalette[activePaletteSlot]?.hex
                  : null;
                const openSlot = (slotKey, hex) => {
                  const next = activePaletteSlot === slotKey ? null : slotKey;
                  setActivePaletteSlot(next);
                  if (next) setActivePaletteFamily(familyOfHex(hex) || activePaletteFamily);
                };
                const activeFamily = FARROW_BALL_FAMILIES.find(f => f.key === activePaletteFamily) || FARROW_BALL_FAMILIES[0];
                return (
                  <div className="space-y-4 rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Palette globale</p>
                    <h2 className="type-h2">Palette de l'appartement</h2>
                    <p className="text-sm text-slate-600">Teintes Farrow & Ball, la référence des peintres.</p>

                    {/* Rangée 1 : dominante, secondaire, sol */}
                    <div className="grid grid-cols-3 gap-2">
                      {mainSlots.map(slot => (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() => openSlot(slot.key, slot.hex)}
                          className={`flex flex-col overflow-hidden rounded-xl border transition-all ${
                            activePaletteSlot === slot.key ? "border-slate-900 shadow-md" : "border-black/10 hover:border-black/30"
                          }`}
                        >
                          <span className="block h-16 w-full" style={{ backgroundColor: slot.hex }} />
                          <span className="px-1.5 py-1.5 text-center">
                            <span className="block truncate text-[10px] font-medium leading-tight text-slate-700">{slot.name}</span>
                            <span className="mt-0.5 block text-[9px] capitalize text-slate-400">{slot.label}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Rangée 2 : 3 accents */}
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-500">Accents</p>
                      <div className="grid grid-cols-3 gap-2">
                        {globalPalette.accents.map((accent, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openSlot(`accent-${i}`, accent.hex)}
                            className={`flex flex-col overflow-hidden rounded-xl border transition-all ${
                              activePaletteSlot === `accent-${i}` ? "border-slate-900 shadow-md" : "border-black/10 hover:border-black/30"
                            }`}
                          >
                            <span className="block h-10 w-full" style={{ backgroundColor: accent.hex }} />
                            <span className="px-1.5 py-1 text-center">
                              <span className="block truncate text-[10px] font-medium leading-tight text-slate-700">{accent.name}</span>
                              <span className="mt-0.5 block text-[9px] text-slate-400">Accent {i + 1}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Picker inline */}
                    {activePaletteSlot !== null && currentHex && (
                      <div className="space-y-3 rounded-xl border border-black/10 bg-slate-50 p-3">
                        <div className="flex gap-1 overflow-x-auto pb-1">
                          {FARROW_BALL_FAMILIES.map(family => (
                            <button
                              key={family.key}
                              type="button"
                              onClick={() => setActivePaletteFamily(family.key)}
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                                activePaletteFamily === family.key ? "bg-slate-900 text-white" : "border border-black/10 bg-white text-slate-500 hover:border-black/30"
                              }`}
                            >
                              {family.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
                          {activeFamily.colors.map(preset => (
                            <button
                              key={preset.hex}
                              type="button"
                              onClick={() => applyColor(activePaletteSlot, preset.hex, fbLabel(preset))}
                              title={fbLabel(preset)}
                              className={`flex flex-col overflow-hidden rounded-lg border-2 transition-all ${
                                currentHex === preset.hex ? "border-slate-900" : "border-transparent hover:border-black/30"
                              }`}
                            >
                              <span className="block h-7 w-full" style={{ backgroundColor: preset.hex }} />
                              <span className="w-full truncate px-1 py-0.5 text-left text-[9px] leading-tight text-slate-600">{preset.name}</span>
                              <span className="w-full truncate px-1 pb-0.5 text-left text-[8px] leading-tight text-slate-400">N°{preset.number}</span>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="color"
                              value={currentHex}
                              onChange={e => applyColor(activePaletteSlot, e.target.value, describeColor(e.target.value))}
                              className="h-7 w-7 cursor-pointer rounded border border-black/15"
                            />
                            <span className="text-xs text-slate-500">Couleur libre</span>
                          </label>
                          <span className="ml-auto text-[11px] text-slate-400">{describeColor(currentHex)}</span>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => applyToRooms(globalPalette)}
                      className="w-full rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800"
                    >
                      Appliquer la palette à toutes les pièces
                    </button>
                    <p className="text-[11px] text-amber-600">
                      ⚠ Écrase dominante, secondaire et sol de chaque pièce. Les nuances (clair/moyen…) restent inchangées.
                    </p>
                  </div>
                );
              })()}

              <div className="space-y-4 rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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
                    { role: "dominantColor", label: "Couleur dominante" },
                    { role: "secondaryColor", label: "Couleur secondaire" },
                  ].map(({ role, label }) => {
                    const selectedColor = activeNuance[role] || (role === "dominantColor" ? preset.dominant : preset.secondary);
                    return (
                      <div key={role}>
                        <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
                        <div className="flex gap-2">
                          {[
                            { key: "dominante", hex: globalPalette.dominante.hex, name: globalPalette.dominante.name },
                            { key: "secondaire", hex: globalPalette.secondaire.hex, name: globalPalette.secondaire.name },
                            { key: "sol", hex: globalPalette.sol.hex, name: globalPalette.sol.name },
                          ].map(({ key, hex, name }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => updateRoomNuance(role, key)}
                              title={name}
                              className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-1.5 transition-all ${
                                selectedColor === key ? "border-slate-900 shadow-sm" : "border-black/10 hover:border-black/30"
                              }`}
                            >
                              <span className="block h-6 w-full rounded-md" style={{ backgroundColor: hex }} />
                              <span className="text-[10px] leading-tight text-slate-500">{name.split(" ")[0]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-slate-700">Accent pièce</p>
                    <div className="flex gap-2">
                      {globalPalette.accents.map((accent, i) => (
                        <button
                          key={accent.hex}
                          type="button"
                          onClick={() => updateRoomNuance("accent", accent.hex)}
                          title={accent.name}
                          className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-1.5 transition-all ${
                            (activeNuance.accent === accent.hex || accents[activeNuance.accent]?.hex === accent.hex || (activeNuance.accent === "bois" && accent.hex === baseColors.bois.hex)) ? "border-slate-900 shadow-sm" : "border-black/10 hover:border-black/30"
                          }`}
                        >
                          <span className="block h-6 w-full rounded-md" style={{ backgroundColor: accent.hex }} />
                          <span className="text-[10px] leading-tight text-slate-500">{accent.name.split(" ")[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Swatch title={getColorName(activeDominantColor)} subtitle="Dominante" hex={dominantHex} />
                  <Swatch title={getColorName(activeSecondaryColor)} subtitle="Secondaire" hex={secondaryHex} />
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

            <div className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Couleurs test</p>
                  <h2 className="type-h2">Couleurs testées — {preset.label}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowColorCatalog(true)}
                  className="shrink-0 rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800"
                >
                  Parcourir le catalogue
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-600">Ajoute des teintes Farrow &amp; Ball à tester (pots d'essai) dans cette pièce, puis marque celles retenues.</p>
              {(roomColorTests[room] || []).length === 0 ? (
                <p className="mt-3 rounded-lg bg-[#f9f6ef] p-3 text-sm text-slate-500">Aucune couleur test pour l'instant — ouvre le catalogue pour en ajouter.</p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(roomColorTests[room] || []).map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 ${c.chosen ? "border-emerald-500 bg-emerald-50" : "border-black/10 bg-white"}`}
                    >
                      <span className="h-9 w-9 shrink-0 rounded-md border border-black/10" style={{ backgroundColor: c.hex }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-700">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{c.number ? `N°${c.number}` : c.hex}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleColorTestChosen(room, c.id)}
                        title={c.chosen ? "Retirer le statut choisi" : "Marquer comme choisi"}
                        className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition-all ${
                          c.chosen ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/15 bg-white text-slate-500 hover:border-black/30"
                        }`}
                      >
                        {c.chosen ? "Choisi ✓" : "Choisir"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeColorTest(room, c.id)}
                        title="Retirer"
                        aria-label="Retirer cette couleur test"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-black/10 bg-white text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {showColorCatalog ? (
              <FarrowBallCatalog
                existingHexes={(roomColorTests[room] || []).map((c) => c.hex)}
                onAdd={(color) => addColorTestToRoom(room, color)}
                onClose={() => setShowColorCatalog(false)}
              />
            ) : null}
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
              saveMediaKey={saveMediaKey}
              authedFetch={authedFetch}
              projectId={projectId}
            />
            <section className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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
                onLogActivity={logActivity}
                saveMediaKey={saveMediaKey}
                authedFetch={authedFetch}
                projectId={projectId}
              />
            </section>
            <section className="rounded-xl border border-black/10 bg-gradient-to-br from-[#fdf9f4] to-[#e8e1d6] p-4">
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
                saveMediaKey={saveMediaKey}
                authedFetch={authedFetch}
                projectId={projectId}
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
              projectMembers={projectMembers}
              persons={persons}
              setPersons={setPersons}
              savePersonsFn={savePersonsToServer}
              onLogActivity={logActivity}
              itemReactions={itemReactions}
              currentUserId={user?.id}
              onToggleReaction={toggleReaction}
            />
          </div>
        ) : roomMode === "documents" ? (
          <DocumentsSection
            room={room}
            roomDocuments={roomDocuments}
            setRoomDocuments={setRoomDocuments}
            projectId={projectId}
            saveDocFn={saveRoomDocumentToServer}
            deleteDocFn={deleteRoomDocumentFromServer}
            authedFetch={authedFetch}
            roomLists={roomLists}
            setRoomLists={setRoomLists}
            saveRoomItemsFn={saveRoomItemsToServer}
            orderedActiveRooms={orderedActiveRooms}
            allRoomPresets={allRoomPresets}
          />
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
            onLogActivity={logActivity}
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
                className="relative hidden sm:block rounded-2xl bg-slate-900 px-4 py-2.5 shadow-xl max-w-[210px] text-right"
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
              <div className={`relative h-full w-full bg-white shadow-2xl flex flex-col transition-all duration-200 ${isChatExpanded ? "max-w-2xl" : "max-w-sm"}`}>
                <ChatPanel
                  room={viewMode === "general" ? "general" : room}
                  isGeneral={viewMode === "general"}
                  availableRooms={availableRooms}
                  globalSelectedTotal={globalSelectedTotal}
                  aiContext={aiContext}
                  chatHistory={chatHistory}
                  setChatHistory={setChatHistory}
                  setRoomLists={setRoomLists}
                  setRoomNotes={setRoomNotes}
                  setRoomColorTests={setRoomColorTests}
                  projectId={projectId}
                  authedFetch={authedFetchRef.current}
                  saveMessageFn={saveChatMessageToServer}
                  clearChatFn={clearChatMessagesFromServer}
                  saveNoteFn={saveRoomNoteToServer}
                  saveRoomItemsFn={saveRoomItemsToServer}
                  saveRoomColorTestsFn={saveRoomColorTestsToServer}
                  onClose={() => setIsChatOpen(false)}
                  isExpanded={isChatExpanded}
                  onToggleExpand={() => setIsChatExpanded((v) => !v)}
                  draft={chatDrafts[viewMode === "general" ? "general" : room] || ""}
                  onDraftChange={(val) => setChatDrafts((prev) => ({ ...prev, [viewMode === "general" ? "general" : room]: val }))}
                  addAiInspiration={addAiInspiration}
                  addExtraPlanImage={addExtraPlanImage}
                  orderedActiveRooms={orderedActiveRooms}
                  allRoomPresets={allRoomPresets}
                  roomLists={roomLists}
                  roomImages={[
                    ...(roomPlanImages[room] || []).flatMap((src, i) => {
                      const key = `${room}-plan-${i}`;
                      return planUploads[key] ? [{ src: planUploads[key], key }] : [];
                    }),
                    ...(extraPlanImages[room] || []).map((src, i) => ({ src, key: `${room}-plan-extra-${i}` })),
                    ...(roomInspirationImages[room] || []).flatMap((src, i) => {
                      const key = `${room}-${i}`;
                      return uploadedImages[key] ? [{ src: uploadedImages[key], key }] : [];
                    }),
                    ...(materialsByRoom[room] || []).flatMap((m, i) => {
                      const key = `${room}-material-${i}`;
                      return materialUploads[key] ? [{ src: materialUploads[key], key }] : [];
                    }),
                    ...(aiInspirations[room] || []).map((src, i) => ({ src, key: `${room}-ai-${i}` })),
                  ].filter((img) => img.src && !deletedImages[img.key])}
                />
              </div>
            </div>
          ) : null}
        </>,
        document.body
      )}

      {showNewProjectWizard && (
        <div className="fixed inset-0 z-[60] bg-[#FAF6F0]">
          <OnboardingWizard
            user={user}
            session={session}
            initialStep="path"
            onComplete={(newId) => {
              setShowNewProjectWizard(false);
              switchProject(newId);
            }}
            onJoinProject={handleJoinProject}
            onSkip={() => setShowNewProjectWizard(false)}
            signOut={signOut}
          />
        </div>
      )}

      <GlobalDragOverlay
        isActive={fileDragActive}
        roomLabel={preset.label}
      />

      {pasteToast && (
        <div
          className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-xl"
          style={{ animation: "toastSlideUp 0.2s ease-out both" }}
        >
          Photo collée dans les inspirations ✓
        </div>
      )}
    </div>
  );
}
