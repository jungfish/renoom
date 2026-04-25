import { useEffect, useRef, useState } from "react";

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
const CUSTOM_ROOMS_STORAGE_KEY = "palette_custom_rooms_v1";
const HIDDEN_ROOMS_STORAGE_KEY = "palette_hidden_rooms_v1";
const PROJECT_STATE_STORAGE_KEY = "palette_project_state_v1";
const LAST_SAVE_STORAGE_KEY = "palette_last_save_v1";
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
  bureau: { dominant: "moyen", secondary: "moyen", accent: "olive" },
  sdb: { dominant: "clair", secondary: "clair", accent: "bois" },
  salon: { dominant: "moyen", secondary: "moyen", accent: "bois" },
  cuisine: { dominant: "moyen", secondary: "moyen", accent: "butter" },
  entree: { dominant: "moyen", secondary: "moyen", accent: "butter" },
  parents: { dominant: "soutenu", secondary: "moyen", accent: "bois" },
  enfant: { dominant: "moyen", secondary: "clair", accent: "butter" },
  vinyle: { dominant: "moyen", secondary: "moyen", accent: "olive" },
  cellier: { dominant: "soutenu", secondary: "moyen", accent: "butter" },
};

const roomInspirationImages = {
  salon: ["/images/salon/01.jpg", "/images/salon/02.jpg", "/images/salon/03.jpg"],
  cuisine: ["/images/cuisine/01.webp", "/images/cuisine/02.webp", "/images/cuisine/03.jpg"],
  entree: ["/images/entree/01.jpg", "/images/entree/02.jpg", "/images/entree/03.jpg"],
  parents: ["/images/parents/01.jpg", "/images/parents/02.jpg", "/images/parents/03.jpg"],
  enfant: ["/images/enfant/01.jpg", "/images/enfant/02.jpg", "/images/enfant/03.jpg"],
  bureau: ["/images/bureau/01.jpg", "/images/bureau/02.jpg", "/images/bureau/03.jpg"],
  sdb: ["/images/sdb/01.jpg", "/images/sdb/02.jpg", "/images/sdb/03.jpg"],
  vinyle: ["/images/vinyle/01.webp", "/images/vinyle/02.jpg", "/images/vinyle/03.jpg"],
  cellier: ["/images/cellier/01.webp", "/images/cellier/02.jpg", "/images/cellier/03.jpg"],
};

const roomPlanImages = {
  salon: ["/images/plan/salon-bibliotheque.webp"],
  cuisine: ["/images/plan/cuisine-plan.webp", "/images/plan/cuisine-banquette-plan.webp"],
  entree: ["/images/plan/entree-01.jpg"],
  parents: ["/images/plan/chambre.webp"],
  enfant: ["/images/plan/chambre-enfant.webp"],
  bureau: ["/images/plan/bureau-verriere.webp"],
  sdb: ["/images/plan/toilette.webp"],
  vinyle: ["/images/plan/vinyle-01.jpg"],
  cellier: ["/images/plan/cellier-plan.webp"],
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

function AddImageButton({ onFile }) {
  const inputRef = useRef(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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
        className="grid h-9 w-9 place-items-center rounded-full border border-black/15 bg-white text-lg leading-none shadow-sm hover:bg-[#fcf8d5]"
      >
        +
      </button>
    </>
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
        className={`grid h-9 w-9 place-items-center rounded-md border border-black/15 bg-white text-sm shadow-sm hover:bg-[#fcf8d5] ${
          value ? "ring-2 ring-[#b8c9d0]" : ""
        }`}
      >
        🔗
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

function RepoImage({ src, alt, onMissingChange }) {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
  }, [src]);

  useEffect(() => {
    if (onMissingChange) onMissingChange(missing);
  }, [missing, onMissingChange]);

  if (missing) {
    return (
      <div className="grid h-full min-h-36 place-items-center bg-[#f8f5ef] p-3 text-center text-xs text-slate-500">
        Image manquante: <code>{src}</code>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      loading="lazy"
      onLoad={() => setMissing(false)}
      onError={() => setMissing(true)}
    />
  );
}

function AiImageEditor({ imageSrc, imageKind, imageTitle, aiContext, imageMetadata, onApply, onAddToInspirations }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const openPanel = () => {
    setPrompt(buildImagePrompt({ aiContext: { ...aiContext, imageMetadata }, imageKind, imageTitle }));
    setGeneratedImage("");
    setError("");
    setOpen((current) => !current);
  };

  const generateImage = async () => {
    setError("");
    setIsGenerating(true);
    try {
      const image = await imageSrcToDataUrl(imageSrc);
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
    <div className="relative space-y-2">
      <button
        type="button"
        title="Générer une proposition IA"
        aria-label="Générer une proposition IA"
        onClick={openPanel}
        className="grid h-9 w-9 place-items-center rounded-md border border-black/15 bg-[#fcf8d5] text-base font-medium shadow-sm hover:bg-white"
      >
        🪄
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-[min(82vw,420px)] space-y-2 rounded-md border border-black/10 bg-white p-2 shadow-xl">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Instruction IA</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-32 w-full rounded-md border border-black/15 bg-white p-2 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={generateImage}
            disabled={isGenerating || !prompt.trim()}
            className="rounded-md border border-black/15 bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            {isGenerating ? "Génération..." : "Générer une proposition"}
          </button>
          {error ? <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
          {generatedImage ? (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-slate-500">Original</div>
                  <img src={imageSrc} alt="Original" className="h-36 w-full rounded-md object-cover" />
                </div>
                <div>
                  <div className="mb-1 text-xs text-slate-500">Proposition IA</div>
                  <img src={generatedImage} alt="Proposition IA" className="h-36 w-full rounded-md object-cover" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onAddToInspirations(generatedImage);
                    setGeneratedImage("");
                  }}
                  className="rounded-md border border-black/15 bg-[#fcf8d5] px-3 py-1 text-xs"
                >
                  Ajouter aux inspirations
                </button>
                <button type="button" onClick={() => onApply(generatedImage)} className="rounded-md border border-black/15 bg-white px-3 py-1 text-xs">
                  Remplacer cette image
                </button>
                <button type="button" onClick={() => setGeneratedImage("")} className="rounded-md border border-black/15 bg-white px-3 py-1 text-xs">
                  Ne pas la prendre
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
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
}) {
  const items = [
    ...(roomPlanImages[room] || []).map((src, i) => ({ src, key: `${room}-plan-${i}` })),
    ...(extraPlanImages[room] || []).map((src, i) => ({ src, key: `${room}-plan-extra-${i}` })),
  ].filter((item) => !deletedImages[item.key]);
  const [missingCards, setMissingCards] = useState({});
  const [index, setIndex] = useState(0);

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
      setPlanUploads((prev) => ({ ...prev, [currentKey]: data }));
      const analysis = await analyzeImageForContext({
        image: data,
        context: `Plan ${label}, pièce ${label}`,
        section: "plan",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [currentKey]: analysis }));
    }
  };

  const handleAddImage = async (file) => {
    if (!file) return;
    const data = await readFileAsDataUrl(file);
    if (typeof data === "string") {
      const nextIndex = (extraPlanImages[room] || []).length;
      const nextKey = `${room}-plan-extra-${nextIndex}`;
      setExtraPlanImages((prev) => ({ ...prev, [room]: [...(prev[room] || []), data] }));
      const analysis = await analyzeImageForContext({
        image: data,
        context: `Plan ajouté ${label}`,
        section: "plan",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
    }
  };

  return (
    <div className="overflow-visible rounded-xl border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/10 p-3">
        <div className="text-sm font-medium">Plan simplifié - {label}</div>
        <div className="flex items-center gap-2">
          {pageCount > 1 ? (
            <div className="flex items-center gap-2 text-xs">
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
          <AddImageButton onFile={handleAddImage} />
        </div>
      </div>
      <div className="group relative h-[360px] bg-[#efe7de]">
        {currentSrc ? (
          <RepoImage src={currentSrc} alt={`Plan ${label}`} onMissingChange={(missing) => setMissingCards((prev) => ({ ...prev, [currentKey]: missing }))} />
        ) : (
          <div className="grid h-full place-items-center bg-[#f8f5ef] p-4 text-center text-sm text-slate-500">Ajoute une image de plan.</div>
        )}
        {currentSrc ? (
          <div className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <AiImageEditor
              imageSrc={currentSrc}
              imageKind="plan"
              imageTitle={`Plan ${label}`}
              aiContext={aiContext}
              imageMetadata={imageAnalysis[currentKey]}
              onApply={(image) => setPlanUploads((prev) => ({ ...prev, [currentKey]: image }))}
              onAddToInspirations={(image) => addAiInspiration(room, image)}
            />
            <button
              type="button"
              title="Supprimer l'image"
              aria-label="Supprimer l'image"
              className="grid h-9 w-9 place-items-center rounded-md border border-red-200 bg-white text-base font-bold text-red-600 shadow-sm hover:bg-red-50"
              onClick={() => {
                setDeletedImages((prev) => ({ ...prev, [currentKey]: true }));
                setPlanUploads((prev) => removeObjectKey(prev, currentKey));
                setPlanLinks((prev) => removeObjectKey(prev, currentKey));
                setImageAnalysis((prev) => removeObjectKey(prev, currentKey));
              }}
            >
              ×
            </button>
            <LinkAction
              value={currentLink}
              onChange={(value) =>
                setPlanLinks((prev) => ({
                  ...prev,
                  [currentKey]: value,
                }))
              }
            />
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
                  <img src={thumbSrc} alt={`Miniature plan ${i + 1}`} className="h-full w-full object-cover" />
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
    </div>
  );
}

function Inspirations({ room, label, uploadedImages, setUploadedImages, inspirationLinks, setInspirationLinks, aiContext, aiInspirations, addAiInspiration, imageAnalysis, setImageAnalysis, deletedImages, setDeletedImages }) {
  const items = [
    ...(roomInspirationImages[room] || []).map((src, i) => ({ src, cardKey: `${room}-${i}`, index: i })),
    ...(aiInspirations[room] || []).map((src, i) => ({ src, cardKey: `${room}-ai-${i}`, index: i })),
  ].filter((item) => !deletedImages[item.cardKey]);
  const [missingCards, setMissingCards] = useState({});
  const [page, setPage] = useState(0);
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
      setUploadedImages((prev) => ({ ...prev, [cardKey]: data }));
      const analysis = await analyzeImageForContext({
        image: data,
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
      addAiInspiration(room, data);
      const analysis = await analyzeImageForContext({
        image: data,
        context: `Inspiration ajoutée ${label}`,
        section: "inspiration",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
    }
  };

  const visibleItems = items
    .slice(page * pageSize, page * pageSize + pageSize)
    .map((item, offset) => ({ ...item, displayIndex: page * pageSize + offset }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">Inspirations</h3>
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
          <AddImageButton onFile={handleAddImage} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map(({ src, cardKey, displayIndex: i }) => (
          (() => {
            const imageSrc = uploadedImages[cardKey] || src;
            const linkValue = inspirationLinks[cardKey] || "";
            const isMissing = !!missingCards[cardKey];

            return (
              <div key={cardKey} className="overflow-visible rounded-xl border border-black/10 bg-white">
                <div className="group relative h-44">
                  <RepoImage src={imageSrc} alt={`${label} inspiration ${i + 1}`} onMissingChange={(missing) => handleMissingChange(cardKey, missing)} />
                  <div className="absolute inset-x-2 top-2 z-20 flex flex-wrap items-start justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <AiImageEditor
                      imageSrc={imageSrc}
                      imageKind="inspiration"
                      imageTitle={`${label} inspiration ${i + 1}`}
                      aiContext={aiContext}
                      imageMetadata={imageAnalysis[cardKey]}
                      onApply={(image) => setUploadedImages((prev) => ({ ...prev, [cardKey]: image }))}
                      onAddToInspirations={(image) => addAiInspiration(room, image)}
                    />
                    <button
                      type="button"
                      title="Supprimer l'image"
                      aria-label="Supprimer l'image"
                      className="grid h-9 w-9 place-items-center rounded-md border border-red-200 bg-white text-base font-bold text-red-600 shadow-sm hover:bg-red-50"
                      onClick={() => {
                        setDeletedImages((prev) => ({ ...prev, [cardKey]: true }));
                        setUploadedImages((prev) => removeObjectKey(prev, cardKey));
                        setInspirationLinks((prev) => removeObjectKey(prev, cardKey));
                        setImageAnalysis((prev) => removeObjectKey(prev, cardKey));
                      }}
                    >
                      ×
                    </button>
                    <LinkAction
                      value={linkValue}
                      onChange={(value) =>
                        setInspirationLinks((prev) => ({
                          ...prev,
                          [cardKey]: value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  {isMissing ? <div className="text-xs text-slate-500">Image manquante: ajoute une image avec le bouton +.</div> : null}
                  {linkValue ? (
                    <a href={linkValue} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2">
                      Voir l'objet
                    </a>
                  ) : null}
                </div>
          </div>
            );
          })()
        ))}
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
  aiContext,
  addAiInspiration,
  imageAnalysis,
  setImageAnalysis,
  deletedImages,
  setDeletedImages,
}) {
  const items = [
    ...(materialsByRoom[room] || []).map((item, i) => ({ item, cardKey: `${room}-material-${i}`, index: i })),
    ...(extraMaterialImages[room] || []).map((src, i) => ({
      item: { label: "Ajout", value: "Matériau ajouté", src },
      cardKey: `${room}-material-extra-${i}`,
      index: i,
    })),
  ]
    .filter(({ cardKey }) => !deletedImages[cardKey]);
  const [missingCards, setMissingCards] = useState({});
  const [page, setPage] = useState(0);
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
      setMaterialUploads((prev) => ({ ...prev, [cardKey]: data }));
      const analysis = await analyzeImageForContext({
        image: data,
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
      setExtraMaterialImages((prev) => ({ ...prev, [room]: [...(prev[room] || []), data] }));
      const analysis = await analyzeImageForContext({
        image: data,
        context: `Matériau ajouté ${room}`,
        section: "matériau",
      });
      if (analysis) setImageAnalysis((prev) => ({ ...prev, [nextKey]: analysis }));
    }
  };

  const visibleItems = items
    .slice(page * pageSize, page * pageSize + pageSize)
    .map((entry, offset) => ({ ...entry, displayIndex: page * pageSize + offset }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">Matériaux</h3>
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
          <AddImageButton onFile={handleAddImage} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {visibleItems.map(({ item, cardKey, displayIndex: index }) => {
          const imageSrc = materialUploads[cardKey] || item.src;
          const linkValue = materialLinks[cardKey] ?? item.link ?? "";
          const isMissing = !!missingCards[cardKey];
          return (
            <div key={cardKey} className="overflow-visible rounded-xl border border-black/10 bg-white">
              <div className="group relative h-40">
                <RepoImage src={imageSrc} alt={`${item.label} ${item.value}`} onMissingChange={(missing) => handleMissingChange(cardKey, missing)} />
                <div className="absolute inset-x-2 top-2 z-20 flex flex-wrap items-start justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <AiImageEditor
                    imageSrc={imageSrc}
                    imageKind="matériau"
                    imageTitle={`${item.label} - ${item.value}`}
                    aiContext={aiContext}
                    imageMetadata={imageAnalysis[cardKey]}
                    onApply={(image) => setMaterialUploads((prev) => ({ ...prev, [cardKey]: image }))}
                    onAddToInspirations={(image) => addAiInspiration(room, image)}
                  />
                  <button
                    type="button"
                    title="Supprimer l'image"
                    aria-label="Supprimer l'image"
                    className="grid h-9 w-9 place-items-center rounded-md border border-red-200 bg-white text-base font-bold text-red-600 shadow-sm hover:bg-red-50"
                    onClick={() => {
                      setDeletedImages((prev) => ({ ...prev, [cardKey]: true }));
                      setMaterialUploads((prev) => removeObjectKey(prev, cardKey));
                      setMaterialLinks((prev) => removeObjectKey(prev, cardKey));
                      setImageAnalysis((prev) => removeObjectKey(prev, cardKey));
                    }}
                  >
                    ×
                  </button>
                  <LinkAction
                    value={linkValue}
                    onChange={(value) =>
                      setMaterialLinks((prev) => ({
                        ...prev,
                        [cardKey]: value,
                      }))
                    }
                  />
                </div>
              </div>
                <div className="space-y-2 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
                  <div className="text-sm font-medium">{item.value}</div>
                {isMissing ? <div className="text-xs text-slate-500">Image manquante: ajoute une image avec le bouton +.</div> : null}
                {linkValue ? (
                  <a className="text-sm underline underline-offset-2" href={linkValue} target="_blank" rel="noreferrer">
                    {item.cta || "Voir le produit"}
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [room, setRoom] = useState("salon");
  const [globalAccent, setGlobalAccent] = useState("butter");
  const [warmth, setWarmth] = useState(60);
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
  const preset = allRoomPresets[room] || allRoomPresets[activeRooms[0]] || roomPresets.salon;
  const activeNuance = roomNuances[room] || INITIAL_ROOM_NUANCES[room] || { dominant: "moyen", secondary: "moyen", accent: globalAccent };
  const dominantHex = getShade(preset.dominant, activeNuance.dominant);
  const secondaryHex = getShade(preset.secondary, activeNuance.secondary);
  const accentHex = activeNuance.accent === "bois" ? baseColors.bois.hex : accents[activeNuance.accent]?.hex || accents[globalAccent].hex;
  const accentName = activeNuance.accent === "bois" ? "Chêne clair" : accents[activeNuance.accent]?.name || accents[globalAccent].name;
  const previewSecondaryHex = warmth < 40 ? baseColors.bleu.light : warmth > 70 ? baseColors.bois.light : secondaryHex;
  const previewAccentHex = warmth < 40 ? accents.sky.hex : warmth > 70 ? accents.butter.hex : accentHex;
  const roomImageMetadata = Object.entries(imageAnalysis)
    .filter(([key, metadata]) => key.startsWith(`${room}-`) && normalizeImageMetadata(metadata))
    .map(([key, metadata]) => ({
      key,
      kind: key.includes("-plan-") ? "plan" : key.includes("-material-") ? "matériau" : "inspiration",
      metadata,
    }));
  const aiContext = {
    roomLabel: preset.label,
    line: preset.line,
    dominantName: baseColors[preset.dominant].name,
    dominantHex,
    secondaryName: baseColors[preset.secondary].name,
    secondaryHex,
    accentName,
    accentHex,
    roomNote: roomNotes[room] || "",
    roomImageMetadata,
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
  };

  const deleteRoom = () => {
    if (activeRooms.length <= 1) return;
    const roomLabel = allRoomPresets[room]?.label || "cette pièce";
    if (!window.confirm(`Supprimer ${roomLabel} de l'app ?`)) return;

    const nextRoom = activeRooms.find((key) => key !== room) || "salon";
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
    setRoom(nextRoom);
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
      aiInspirations,
      imageAnalysis,
      deletedImages,
      roomNuances,
      roomNotes,
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
  };

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
    let isMounted = true;
    readLargeValue(PROJECT_STATE_STORAGE_KEY)
      .then((saved) => {
        if (!isMounted || !saved) return;
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
        if (saved.aiInspirations) setAiInspirations(saved.aiInspirations);
        if (saved.imageAnalysis) setImageAnalysis(saved.imageAnalysis);
        if (saved.deletedImages) setDeletedImages(saved.deletedImages);
        if (saved.roomNuances) setRoomNuances(saved.roomNuances);
        if (saved.roomNotes) setRoomNotes(saved.roomNotes);
        if (saved.savedAt) setLastSavedAt(saved.savedAt);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeRooms.length && !activeRooms.includes(room)) {
      setRoom(activeRooms[0]);
    }
  }, [activeRooms, room]);

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

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
        <header className="rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.2em] text-slate-500">Palette appartement interactive</p>
              <h1 className="font-display text-3xl">Univers rétro, coloré, doux</h1>
              <p className="mt-2 text-sm text-slate-600">Projet de Violette et Matthieu Jungfer pour Botzaris.</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={saveProject}
                className="rounded-md border border-black/15 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
              >
                Save
              </button>
              {lastSavedAt ? <span className="text-xs text-slate-500">Sauvé: {new Date(lastSavedAt).toLocaleString("fr-FR")}</span> : null}
            </div>
          </div>
        </header>

        <section className="sticky top-2 z-30 rounded-xl border border-black/10 bg-white/95 p-4 backdrop-blur md:top-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {activeRooms.map((key) => (
              <button
                key={key}
                onClick={() => setRoom(key)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  room === key ? "border-slate-900 bg-slate-900 text-white" : "border-black/15 bg-[#f9f7f3]"
                }`}
              >
                {allRoomPresets[key].label}
              </button>
            ))}
            <button
              type="button"
              onClick={addRoom}
              title="Ajouter une pièce"
              aria-label="Ajouter une pièce"
              className="grid h-10 w-10 place-items-center rounded-full border border-black/15 bg-white text-xl leading-none shadow-sm hover:bg-[#fcf8d5]"
            >
              +
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-black/10 bg-white p-4">
            <h2 className="font-display text-2xl">Module Couleur Global</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Chaleur globale: {warmth}</label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={warmth}
                onChange={(e) => setWarmth(Number(e.target.value))}
                className="w-full"
              />
              <p className="mt-2 text-sm text-slate-600">
                Ajuste uniquement l'aperçu du nuancier: plus frais vers les bleus, plus chaud vers chêne clair et jaune beurre.
              </p>
            </div>
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
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl">{preset.label}</h2>
              {activeRooms.length > 1 ? (
                <button
                  type="button"
                  onClick={deleteRoom}
                  title="Supprimer cette pièce"
                  aria-label="Supprimer cette pièce"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-red-200 bg-white text-base font-bold text-red-600 shadow-sm hover:bg-red-50"
                >
                  ×
                </button>
              ) : null}
            </div>
            <p className="text-sm text-slate-700">{preset.line}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm">
                Nuance dominante
                <select
                  className="mt-1 w-full rounded-md border border-black/15 bg-white p-2"
                  value={activeNuance.dominant}
                  onChange={(e) => updateRoomNuance("dominant", e.target.value)}
                >
                  <option value="clair">Clair</option>
                  <option value="moyen">Moyen</option>
                  <option value="soutenu">Soutenu</option>
                  <option value="fonce">Foncé</option>
                </select>
              </label>
              <label className="text-sm">
                Nuance secondaire
                <select
                  className="mt-1 w-full rounded-md border border-black/15 bg-white p-2"
                  value={activeNuance.secondary}
                  onChange={(e) => updateRoomNuance("secondary", e.target.value)}
                >
                  <option value="clair">Clair</option>
                  <option value="moyen">Moyen</option>
                  <option value="soutenu">Soutenu</option>
                  <option value="fonce">Foncé</option>
                </select>
              </label>
              <label className="text-sm">
                Accent pièce
                <select
                  className="mt-1 w-full rounded-md border border-black/15 bg-white p-2"
                  value={activeNuance.accent}
                  onChange={(e) => updateRoomNuance("accent", e.target.value)}
                >
                  <option value="bois">Chêne clair</option>
                  {Object.entries(accents).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Swatch title={baseColors[preset.dominant].name} subtitle="Dominante" hex={dominantHex} />
              <Swatch title={baseColors[preset.secondary].name} subtitle="Secondaire" hex={secondaryHex} />
              <Swatch
                title={accentName}
                subtitle="Accent"
                hex={accentHex}
              />
            </div>
            <label className="block text-sm">
              Note de la pièce
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-black/15 bg-white p-2"
                placeholder="Ajouter une note sur cette pièce..."
                value={roomNotes[room] || ""}
                onChange={(e) =>
                  setRoomNotes((prev) => ({
                    ...prev,
                    [room]: e.target.value,
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
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
          />
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <h2 className="font-display text-2xl">Nuancier Recommandé</h2>
            <p className="mb-3 text-sm text-slate-600">Répartition visuelle pour garder un cap cohérent dans la pièce active. La chaleur globale module seulement cet aperçu.</p>
            <div className="overflow-hidden rounded-xl border border-black/10">
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
                <p key={note} className="rounded-lg bg-[#f9f6ef] p-3 text-sm">
                  {note}
                </p>
              ))}
            </div>
          </div>
        </section>

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
            aiContext={aiContext}
            addAiInspiration={addAiInspiration}
            imageAnalysis={imageAnalysis}
            setImageAnalysis={setImageAnalysis}
            deletedImages={deletedImages}
            setDeletedImages={setDeletedImages}
          />
        </section>
      </main>
    </div>
  );
}
