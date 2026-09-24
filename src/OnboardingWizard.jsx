import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { FB, fbLabel } from "./farrowBall.js";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const ALL_ROOMS = ["salon","cuisine","entree","parents","enfant","bureau","sdb","sanitaires","vinyle","cellier"];
const WIZARD_ROOMS = ["salon","cuisine","entree","parents","enfant","bureau","sdb","sanitaires"];
const ROOM_LABELS = {
  salon:"Salon", cuisine:"Cuisine", entree:"Entrée", parents:"Chambre parents",
  enfant:"Chambre enfant", bureau:"Bureau", sdb:"Salle de bain", sanitaires:"Sanitaires",
  vinyle:"Coin vinyle", cellier:"Cellier",
};
const DEFAULT_SELECTED = ["salon","cuisine","entree","parents","sdb"];

const fbColor = (entry) => ({ hex: entry.hex, name: fbLabel(entry) });

// Palette de départ du projet (dominante / secondaire / sol / 3 accents) —
// même forme que globalPalette dans App.jsx, appliquée à la création.
const buildPalette = (dominante, secondaire, sol, accents) => ({
  dominante: fbColor(dominante),
  secondaire: fbColor(secondaire),
  sol: fbColor(sol),
  accents: accents.map(fbColor),
});

const DECO_STYLES = [
  { key:"chaleureux", label:"Chaleureux & naturel", description:"Bois clair, lin, tons crème et terracotta.", palette:buildPalette(FB.oldWhite, FB.newWhite, FB.fawn, [FB.deadSalmon, FB.charlottesLocks, FB.yellowGround]), globalAccent:"lin",    warmth:70 },
  { key:"frais",      label:"Frais & lumineux",     description:"Bleu grisé, blanc cassé, matières épurées.", palette:buildPalette(FB.borrowedLight, FB.wimborneWhite, FB.cornforthWhite, [FB.lulworthBlue, FB.yeabridgeGreen, FB.cooksBlue]), globalAccent:"sky",    warmth:35 },
  { key:"vegetal",    label:"Végétal & texturé",    description:"Vert sauge, fibres naturelles, accents olive.", palette:buildPalette(FB.vertDeTerre, FB.newWhite, FB.cord, [FB.yeabridgeGreen, FB.ballGreen, FB.lichen]), globalAccent:"olive", warmth:55 },
  { key:"retro",      label:"Rétro & graphique",    description:"Jaune beurre, noir, touches de motif.", palette:buildPalette(FB.farrowsCream, FB.newWhite, FB.fawn, [FB.yellowGround, FB.offBlack, FB.charlottesLocks]), globalAccent:"butter", warmth:60 },
];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extFromDataUrl(dataUrl) {
  const mime = dataUrl.match(/^data:([^;]+)/)?.[1] || "image/jpeg";
  const ext = mime.split("/")[1] || "jpg";
  return ext === "jpeg" ? "jpg" : ext;
}

// Résumé transmis à l'IA dans chaque conversation — reste modifiable dans Teintes
function buildDefaultGeneralContext(projectName, selectedStyle, roomLabels) {
  return `${projectName || "Projet"}, style ${selectedStyle?.label || "moderne"}, pièces : ${roomLabels.join(", ")}.`;
}

// Même format de clé que createUniqueRoomKey dans App.jsx
function customRoomKey(label, existingKeys) {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "piece";
  let key = `custom-${base}`;
  let index = 2;
  while (existingKeys.includes(key)) {
    key = `custom-${base}-${index}`;
    index += 1;
  }
  return key;
}

// "12 000", "12000 €", "12.000", "12 500,50" → nombre ; null si vide ou invalide
function parseBudget(value) {
  let cleaned = value.replace(/[\s €]/g, "");
  // Point utilisé comme séparateur de milliers ("15.000", "1.250.000")
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/\./g, "");
  cleaned = cleaned.replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function OnboardingWizard({ user, session, onComplete, onJoinProject, onSkip, signOut, initialStep = "path" }) {
  const [step, setStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);

  // Create path state
  const [projectName, setProjectName] = useState("");
  const [budget, setBudget] = useState("");
  const [selectedRooms, setSelectedRooms] = useState(DEFAULT_SELECTED);
  const [customRooms, setCustomRooms] = useState([]);
  const [decoStyle, setDecoStyle] = useState(null);
  const [inspoFiles, setInspoFiles] = useState([]);
  const [inspoUrlInput, setInspoUrlInput] = useState("");
  const [inspoUrlAdded, setInspoUrlAdded] = useState([]);
  const [loadingMessage, setLoadingMessage] = useState("Création de votre projet…");

  // Join path state
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get("invite") || "");
  const [joinError, setJoinError] = useState("");

  // Post-creation state
  const [createdProjectId, setCreatedProjectId] = useState(null);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  const fileInputRef = useRef(null);
  const joinCodeRef = useRef(joinCode);
  joinCodeRef.current = joinCode;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const goTo = (nextStep, dir = 1) => {
    setDirection(dir);
    setStep(nextStep);
  };

  // Show invite landing instead of auto-joining — gives context before action
  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite) {
      setJoinCode(invite);
      goTo("invite-landing");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress bar
  const PROGRESS_STEPS = ["name","rooms","style","inspo"];
  const progressIdx = PROGRESS_STEPS.indexOf(step);
  const progressPct = progressIdx >= 0 ? ((progressIdx + 1) / PROGRESS_STEPS.length) * 100 : 0;

  const labelOf = (key) => ROOM_LABELS[key] || customRooms.find(r => r.key === key)?.label || key;

  const addCustomRoom = (label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = customRoomKey(trimmed, [...ALL_ROOMS, ...customRooms.map(r => r.key)]);
    setCustomRooms(prev => [...prev, { key, label: trimmed }]);
    setSelectedRooms(prev => [...prev, key]);
  };

  // ── File handling ────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const defaultRoom = selectedRooms[0] || "salon";
    const newEntries = files.map(file => ({ file, preview: URL.createObjectURL(file), name: file.name, room: defaultRoom }));
    setInspoFiles(prev => [...prev, ...newEntries].slice(0, 6));
  };

  const setFileRoom = (idx, room) => {
    setInspoFiles(prev => prev.map((f, i) => (i === idx ? { ...f, room } : f)));
  };

  const removeFile = (idx) => {
    setInspoFiles(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  };

  const addInspoUrl = () => {
    const url = inspoUrlInput.trim();
    if (!url) return;
    setInspoUrlAdded(prev => [...prev, url].slice(0, 3));
    setInspoUrlInput("");
  };

  // ── Create project ───────────────────────────────────────────────────────

  const handleCreate = async () => {
    goTo("loading");
    setIsSubmitting(true);
    setCreateError("");

    try {
      const token = sessionRef.current?.access_token;
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      const selectedStyle = DECO_STYLES.find(s => s.key === decoStyle);
      const hiddenRooms = ALL_ROOMS.filter(r => !selectedRooms.includes(r));
      const activeRoom = selectedRooms[0] || "salon";
      const finalGeneralContext = buildDefaultGeneralContext(projectName, selectedStyle, selectedRooms.map(labelOf));
      const budgetTarget = parseBudget(budget);
      // Même forme que les pièces créées par addRoom dans App.jsx
      const projectCustomRooms = customRooms
        .filter(r => selectedRooms.includes(r.key))
        .map(r => ({ key: r.key, label: r.label, dominant: "creme", secondary: "bois" }));

      // Upload local inspiration files, grouped by the room each photo was assigned to
      const aiInspirations = {};
      if (inspoFiles.length > 0) {
        setLoadingMessage("Upload des inspirations…");
        for (let i = 0; i < inspoFiles.length; i++) {
          try {
            const dataUrl = await fileToDataUrl(inspoFiles[i].file);
            const targetRoom = inspoFiles[i].room || activeRoom;
            // Generate a safe storage key — the original filename (e.g. macOS
            // screenshots with curly quotes/combining accents) can be rejected
            // by Supabase Storage and silently drop the photo.
            const safeFilename = `inspo-${targetRoom}-${Date.now()}-${i}.${extFromDataUrl(dataUrl)}`;
            const res = await fetch(`${API_BASE}/upload-image`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeader },
              body: JSON.stringify({ dataUrl, filename: safeFilename }),
            });
            if (res.ok) {
              const { url } = await res.json();
              aiInspirations[targetRoom] = [...(aiInspirations[targetRoom] || []), url];
            }
          } catch {}
        }
      }

      // URL-based inspirations
      const inspirationLinks = {};
      inspoUrlAdded.forEach((url, i) => {
        inspirationLinks[`${activeRoom}-url-${i}`] = { src: url, label: "" };
      });

      setLoadingMessage("Création de votre projet…");

      const state = {
        version: 1,
        savedAt: new Date().toISOString(),
        room: activeRoom,
        globalAccent: selectedStyle?.globalAccent || "butter",
        warmth: selectedStyle?.warmth ?? 60,
        // Sans style choisi, App.jsx garde sa palette par défaut
        ...(selectedStyle ? { globalPalette: selectedStyle.palette } : {}),
        ...(budgetTarget ? { budgetTarget } : {}),
        customRooms: projectCustomRooms,
        hiddenRooms,
        roomOrder: null,
        generalContext: finalGeneralContext,
        generalResources: [],
        uploadedImages: {},
        inspirationLinks,
        aiInspirations,
        instagramItems: {},
        imageAnalysis: {},
        deletedImages: {},
        materialUploads: {},
        materialLinks: {},
        extraMaterialImages: {},
        extraMaterialMeta: {},
        planUploads: {},
        planLinks: {},
        extraPlanImages: {},
        roomNuances: {},
        roomNotes: {},
        roomLists: {},
        roomDocuments: {},
        chatHistory: {},
      };

      const res = await fetch(`${API_BASE}/save-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ state, name: projectName.trim() || undefined }),
      });
      if (!res.ok) throw new Error("save-project failed");
      const { id } = await res.json();

      setLoadingMessage("Finalisation…");

      // Pas de tâches de démarrage : la checklist « Démarrage » de l'accueil
      // guide les premières actions sans gonfler les compteurs de tâches.
      await Promise.allSettled([
        supabase.from("chat_messages").insert({
          id: `msg-welcome-${Date.now()}`,
          project_id: id,
          room_key: activeRoom,
          role: "assistant",
          content: `Bienvenue dans votre ${labelOf(activeRoom)} ! Je suis prêt à vous aider à créer l'ambiance ${selectedStyle?.label.toLowerCase() || "idéale"} que vous imaginez. Commencez par ajouter des inspirations ou posez-moi une question sur les couleurs et matières.`,
          created_at: new Date().toISOString(),
        }),
        supabase.from("change_log").insert({
          project_id: id,
          user_id: user.id,
          action: "onboarding_completed",
          details: {
            rooms: selectedRooms,
            style: decoStyle,
            hasInspo: inspoFiles.length > 0 || inspoUrlAdded.length > 0,
            inspoCount: inspoFiles.length + inspoUrlAdded.length,
            hasBudget: !!budgetTarget,
            customRoomCount: projectCustomRooms.length,
            invited: false,
          },
        }),
      ]);

      const { data: proj } = await supabase
        .from("projects")
        .select("invite_code")
        .eq("id", id)
        .single();
      if (proj?.invite_code) {
        setInviteLink(`${window.location.origin}?invite=${proj.invite_code}`);
      }

      setCreatedProjectId(id);
      goTo("invite");
    } catch {
      setIsSubmitting(false);
      setCreateError("La création du projet a échoué. Vérifiez votre connexion puis réessayez.");
      goTo("inspo", -1);
    }
  };

  // ── Join project ─────────────────────────────────────────────────────────

  const doJoin = async (code) => {
    setIsSubmitting(true);
    setJoinError("");
    try {
      const result = await onJoinProject((code || joinCodeRef.current).trim().toLowerCase());
      if (!result?.ok) {
        setJoinError(result?.error || "Code invalide ou expiré.");
        setIsSubmitting(false);
      } else if (result.projectId) {
        onComplete(result.projectId);
      }
    } catch {
      setJoinError("Une erreur est survenue, veuillez réessayer.");
      setIsSubmitting(false);
    }
  };

  // ── Invite actions ───────────────────────────────────────────────────────

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopySuccess(true);
      setInviteSent(true);
      setTimeout(() => setCopySuccess(false), 2000);
      if (createdProjectId) {
        supabase.from("change_log").insert({
          project_id: createdProjectId,
          user_id: user.id,
          action: "first_invite_sent",
          details: { method: "link" },
        }).then(() => {});
      }
    } catch {}
  };

  const handleWhatsApp = () => {
    const projectLabel = projectName ? ` "${projectName}"` : "";
    const inviterName = user?.user_metadata?.full_name?.split(" ")[0];
    const intro = inviterName ? `${inviterName} vous invite à rejoindre` : "Vous êtes invité(e) à rejoindre";
    const text = encodeURIComponent(`🏠 ${intro} le projet${projectLabel} sur Renoom — inspirations, achats et décisions, pièce par pièce 👉 ${inviteLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
    setInviteSent(true);
    if (createdProjectId) {
      supabase.from("change_log").insert({
        project_id: createdProjectId,
        user_id: user.id,
        action: "first_invite_sent",
        details: { method: "whatsapp" },
      }).then(() => {});
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const animClass = direction > 0
    ? "animate-[slideInRight_0.22s_ease-out]"
    : "animate-[slideInLeft_0.22s_ease-out]";

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col">
      {progressIdx >= 0 && (
        <div className="w-full h-0.5 bg-black/8">
          <div className="h-0.5 bg-slate-800 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div key={step} className={`flex-1 flex flex-col items-center justify-center px-5 py-10 ${animClass}`}>
        <div className="w-full max-w-sm">

          {step === "path" && (
            <StepPath
              onCreate={() => goTo("name")}
              onJoin={() => goTo("join")}
              onBack={onSkip}
              signOut={onSkip ? null : signOut}
            />
          )}

          {step === "name" && (
            <StepName
              value={projectName}
              onChange={setProjectName}
              budget={budget}
              onBudgetChange={setBudget}
              onNext={() => goTo("rooms")}
              onBack={() => goTo("path", -1)}
            />
          )}

          {step === "rooms" && (
            <StepRooms
              selectedRooms={selectedRooms}
              setSelectedRooms={setSelectedRooms}
              customRooms={customRooms}
              onAddCustomRoom={addCustomRoom}
              onNext={() => goTo("style")}
              onBack={() => goTo("name", -1)}
            />
          )}

          {step === "style" && (
            <StepStyle
              decoStyle={decoStyle}
              setDecoStyle={setDecoStyle}
              onNext={() => goTo("inspo")}
              onBack={() => goTo("rooms", -1)}
            />
          )}

          {step === "inspo" && (
            <StepInspo
              inspoFiles={inspoFiles}
              inspoUrlAdded={inspoUrlAdded}
              inspoUrlInput={inspoUrlInput}
              setInspoUrlInput={setInspoUrlInput}
              onFileChange={handleFileChange}
              onRemoveFile={removeFile}
              onFileRoomChange={setFileRoom}
              selectedRooms={selectedRooms}
              roomLabels={Object.fromEntries(selectedRooms.map(k => [k, labelOf(k)]))}
              onAddUrl={addInspoUrl}
              onRemoveUrl={(i) => setInspoUrlAdded(prev => prev.filter((_, idx) => idx !== i))}
              fileInputRef={fileInputRef}
              createError={createError}
              onNext={handleCreate}
              onBack={() => goTo("style", -1)}
            />
          )}

          {step === "loading" && <StepLoading message={loadingMessage} />}

          {step === "invite" && (
            <StepInvite
              inviteLink={inviteLink}
              inviteSent={inviteSent}
              copySuccess={copySuccess}
              onCopy={handleCopyInvite}
              onWhatsApp={handleWhatsApp}
              onEnter={() => onComplete(createdProjectId)}
              projectName={projectName}
            />
          )}

          {step === "invite-landing" && (
            <StepInviteLanding
              onJoin={() => doJoin()}
              isSubmitting={isSubmitting}
              joinError={joinError}
            />
          )}

          {step === "join" && (
            <StepJoin
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              joinError={joinError}
              isSubmitting={isSubmitting}
              onJoin={() => doJoin()}
              onBack={() => goTo("path", -1)}
            />
          )}

        </div>
      </div>
    </div>
  );
}

// ── Step sub-components ────────────────────────────────────────────────────

function BackLink({ onClick }) {
  return (
    <button onClick={onClick} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1 transition-colors">
      ← Retour
    </button>
  );
}

function PrimaryBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-slate-900 text-white text-sm font-medium rounded-xl py-3 hover:bg-slate-800 active:bg-slate-700 transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function StepPath({ onCreate, onJoin, onBack, signOut }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        {/* Retour seulement depuis l'app (nouveau projet) ; au premier lancement, rien avant cet écran */}
        {onBack && <BackLink onClick={onBack} />}
        <h2 className="font-['Sora'] text-xl font-semibold text-slate-800">Que voulez-vous faire ?</h2>
      </div>

      {[
        { emoji:"🏠", title:"Créer un projet", sub:"Je configure un nouveau projet, pièce par pièce.", onClick:onCreate },
        { emoji:"🔗", title:"Rejoindre un projet existant", sub:"J'ai reçu un lien ou un code d'invitation.", onClick:onJoin },
      ].map(card => (
        <button
          key={card.title}
          onClick={card.onClick}
          className="w-full text-left rounded-2xl border border-black/10 bg-white p-5 hover:border-slate-400 hover:shadow-sm transition-all flex items-start gap-4"
        >
          <span className="text-2xl mt-0.5">{card.emoji}</span>
          <div className="flex-1">
            <div className="font-semibold text-sm text-slate-800 mb-1">{card.title}</div>
            <div className="text-xs text-slate-500">{card.sub}</div>
          </div>
          <span className="text-slate-400 text-lg mt-0.5">›</span>
        </button>
      ))}

      {signOut && (
        <button onClick={signOut} className="text-xs text-slate-300 hover:text-slate-500 transition-colors">
          Se déconnecter
        </button>
      )}
    </div>
  );
}

function StepName({ value, onChange, budget, onBudgetChange, onNext, onBack }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink onClick={onBack} />
        <h2 className="font-['Sora'] text-xl font-semibold text-slate-800 mb-1">
          Comment s'appelle ce projet ?
        </h2>
        <p className="text-xs text-slate-500">Le nom du client ou du lieu, par exemple. Vous pourrez le renommer plus tard.</p>
      </div>

      <input
        autoFocus
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onNext()}
        placeholder="Appartement Martin, Maison rue Lepic…"
        maxLength={60}
        className="w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60"
      />

      <label className="-mt-1 block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Budget du projet <span className="font-normal text-slate-400">(optionnel)</span>
        </span>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={budget}
            onChange={e => onBudgetChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onNext()}
            placeholder="15 000"
            className="w-full rounded-xl border border-black/12 bg-white py-3 pl-4 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300/60"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
        </div>
        <span className="mt-1 block text-[11px] text-slate-400">Suivi dans la vue Budget, modifiable à tout moment.</span>
      </label>

      <PrimaryBtn onClick={onNext}>Suivant</PrimaryBtn>

      {!value && !budget && (
        <button onClick={onNext} className="text-xs text-slate-400 hover:text-slate-600 text-center transition-colors">
          Passer cette étape
        </button>
      )}
    </div>
  );
}

function StepRooms({ selectedRooms, setSelectedRooms, customRooms, onAddCustomRoom, onNext, onBack }) {
  const [customLabel, setCustomLabel] = useState("");
  const toggle = (key) => {
    setSelectedRooms(prev => prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]);
  };
  const submitCustom = () => {
    if (!customLabel.trim()) return;
    onAddCustomRoom(customLabel);
    setCustomLabel("");
  };
  const roomChoices = [
    ...WIZARD_ROOMS.map(key => ({ key, label: ROOM_LABELS[key] })),
    ...customRooms,
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink onClick={onBack} />
        <h2 className="font-['Sora'] text-xl font-semibold text-slate-800 mb-1">
          Quelles pièces sont concernées ?
        </h2>
        <p className="text-xs text-slate-500">Sélectionnez les pièces du projet. Vous pourrez en ajouter ensuite.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {roomChoices.map(({ key, label }) => {
          const sel = selectedRooms.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`truncate rounded-xl border py-2.5 px-3 text-xs font-medium text-left transition-all ${
                sel ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-black/10 hover:border-slate-400"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="-mt-2 flex gap-2">
        <input
          type="text"
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitCustom()}
          placeholder="Autre pièce : véranda, dressing…"
          maxLength={40}
          className="min-w-0 flex-1 rounded-xl border border-black/12 bg-white px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />
        <button
          type="button"
          onClick={submitCustom}
          disabled={!customLabel.trim()}
          className="shrink-0 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40"
        >
          + Ajouter
        </button>
      </div>

      <PrimaryBtn onClick={onNext} disabled={selectedRooms.length === 0}>Suivant</PrimaryBtn>
    </div>
  );
}

function StepStyle({ decoStyle, setDecoStyle, onNext, onBack }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink onClick={onBack} />
        <h2 className="font-['Sora'] text-xl font-semibold text-slate-800 mb-1">
          Quelle ambiance vous correspond ?
        </h2>
        <p className="text-xs text-slate-500">Ces teintes Farrow & Ball deviennent la palette du projet — tout reste ajustable ensuite.</p>
      </div>

      <div className="flex flex-col gap-2">
        {DECO_STYLES.map(s => {
          const sel = decoStyle === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setDecoStyle(s.key)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${
                sel ? "border-slate-900 bg-white ring-1 ring-slate-900/10" : "border-black/10 bg-white hover:border-slate-400"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-800">{s.label}</span>
                <div className="flex gap-1">
                  {[s.palette.dominante, s.palette.secondaire, s.palette.sol, s.palette.accents[0]].map((c, i) => (
                    <div key={i} title={c.name} className="h-4 w-4 rounded-full border border-black/10" style={{ background: c.hex }} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500">{s.description}</p>
            </button>
          );
        })}
      </div>

      <PrimaryBtn onClick={onNext}>{decoStyle ? "Suivant" : "Continuer sans choisir"}</PrimaryBtn>
    </div>
  );
}

function StepInspo({
  inspoFiles, inspoUrlAdded, inspoUrlInput, setInspoUrlInput,
  onFileChange, onRemoveFile, onFileRoomChange, selectedRooms, roomLabels,
  onAddUrl, onRemoveUrl, fileInputRef, createError,
  onNext, onBack,
}) {
  const hasContent = inspoFiles.length > 0 || inspoUrlAdded.length > 0;
  const [stepDragging, setStepDragging] = useState(false);
  const stepDragCountRef = useRef(0);

  useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageFiles = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (!imageFiles.length) return;
      e.preventDefault();
      const dt = { target: { files: imageFiles } };
      onFileChange(dt);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onFileChange]);

  const handleStepDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    stepDragCountRef.current = 0;
    setStepDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) onFileChange({ target: { files: Array.from(files) } });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink onClick={onBack} />
        <h2 className="font-['Sora'] text-xl font-semibold text-slate-800 mb-1">
          Ajoutez vos premières inspirations
        </h2>
        <p className="text-xs text-slate-500">Photos ou liens — tout ce qui vous inspire.</p>
      </div>

      {/* File upload */}
      <div>
        <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={onFileChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => {
            e.preventDefault();
            stepDragCountRef.current += 1;
            setStepDragging(true);
          }}
          onDragLeave={() => {
            stepDragCountRef.current -= 1;
            if (stepDragCountRef.current <= 0) { stepDragCountRef.current = 0; setStepDragging(false); }
          }}
          onDrop={handleStepDrop}
          className={`w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center gap-2 py-8 px-4 ${
            stepDragging
              ? "border-[#CDAA73] bg-[#FCF8D5]/60 scale-[1.01]"
              : "border-black/15 bg-white hover:border-[#CDAA73]/60 hover:bg-[#faf7f2] text-slate-500"
          }`}
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${stepDragging ? "bg-[#CDAA73]/20" : "bg-black/5"}`}>
            <svg
              className={`h-6 w-6 ${stepDragging ? "text-[#CDAA73]" : "text-slate-400"}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </div>
          <div className="text-center">
            <span className={`text-sm font-medium block ${stepDragging ? "text-[#CDAA73]" : ""}`}>
              {stepDragging ? "Lâchez pour ajouter" : "Glissez vos photos ici"}
            </span>
            <span className="text-xs text-slate-400 mt-0.5 block">ou cliquez · ou collez (Ctrl+V)</span>
          </div>
        </button>

        {inspoFiles.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {inspoFiles.map((f, i) => (
              <div key={i} className="flex flex-col gap-1 shrink-0">
                <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-black/10">
                  <img src={f.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => onRemoveFile(i)}
                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white text-xs flex items-center justify-center leading-none"
                  >
                    ×
                  </button>
                </div>
                {selectedRooms.length > 1 && (
                  <select
                    value={f.room}
                    onChange={(e) => onFileRoomChange(i, e.target.value)}
                    className="w-16 rounded-md border border-black/10 bg-white px-0.5 py-0.5 text-[10px] text-slate-600 focus:outline-none focus:border-slate-400"
                  >
                    {selectedRooms.map((r) => (
                      <option key={r} value={r}>{roomLabels[r] || r}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* URL input */}
      <div>
        <div className="flex gap-2">
          <input
            type="url"
            value={inspoUrlInput}
            onChange={e => setInspoUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onAddUrl()}
            placeholder="Coller un lien image…"
            className="flex-1 rounded-xl border border-black/12 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
          />
          <button
            onClick={onAddUrl}
            disabled={!inspoUrlInput.trim()}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition-colors shrink-0"
          >
            Ajouter
          </button>
        </div>
        {inspoUrlAdded.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {inspoUrlAdded.map((url, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <span className="flex-1 truncate">{url}</span>
                <button onClick={() => onRemoveUrl(i)} className="text-slate-400 hover:text-slate-700 shrink-0">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {createError && (
        <p className="-mb-2 text-center text-xs text-red-500">{createError}</p>
      )}

      <PrimaryBtn onClick={onNext}>
        {hasContent ? "Créer le projet →" : "Créer le projet"}
      </PrimaryBtn>

      {!hasContent && (
        <p className="text-center text-xs text-slate-400">
          Vous pourrez en ajouter directement depuis l'app.
        </p>
      )}
    </div>
  );
}

function StepLoading({ message }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function StepInvite({ inviteLink, inviteSent, copySuccess, onCopy, onWhatsApp, onEnter, projectName }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-3">
        <span className="text-4xl">🎉</span>
        <h2 className="font-['Sora'] text-xl font-semibold text-slate-800">
          {projectName ? `"${projectName}" est prêt !` : "Votre projet est prêt !"}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Invitez votre client ou vos collaborateurs — ils verront les mêmes pièces et décisions en temps réel.
        </p>
      </div>

      {inviteLink && (
        <div className="flex flex-col gap-3">
          <button
            onClick={onWhatsApp}
            className="w-full py-3.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#20C05A] active:scale-[0.98] transition-all shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Partager sur WhatsApp
          </button>

          <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-black/8">
              <span className="text-xs text-slate-400 flex-1 truncate font-mono">{inviteLink}</span>
            </div>
            <button
              onClick={onCopy}
              className="w-full py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {copySuccess ? "✓ Copié !" : "📋 Copier le lien"}
            </button>
          </div>
        </div>
      )}

      <PrimaryBtn onClick={onEnter}>Ouvrir le projet →</PrimaryBtn>

      {!inviteSent && (
        <p className="text-center text-xs text-slate-400">
          Vous pourrez inviter plus tard depuis « Membres », en bas du menu.
        </p>
      )}
    </div>
  );
}

function StepInviteLanding({ onJoin, isSubmitting, joinError }) {
  return (
    <div className="flex flex-col gap-7 text-center">
      <div className="flex justify-center pt-2">
        <div className="w-24 h-24 rounded-3xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-5xl shadow-sm">
          🏡
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-1.5 mx-auto bg-emerald-50 border border-emerald-200/60 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          <span className="text-xs font-medium text-emerald-700">Invitation valide</span>
        </div>
        <h2 className="font-['Sora'] text-2xl font-semibold text-slate-800">
          Vous avez été invité(e) !
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Rejoignez le projet pour voir les inspirations, ajouter les vôtres et décider ensemble.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {[
          { emoji: "🎨", label: "Inspirations partagées" },
          { emoji: "🧾", label: "Achats et budget suivis ensemble" },
          { emoji: "💬", label: "Discussions en temps réel" },
        ].map(({ emoji, label }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-black/8">
            <span className="text-lg leading-none">{emoji}</span>
            <span className="text-sm text-slate-700">{label}</span>
            <span className="ml-auto text-emerald-400 text-sm">✓</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <PrimaryBtn onClick={onJoin} disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Connexion au projet…
            </span>
          ) : "Rejoindre le projet →"}
        </PrimaryBtn>
        {joinError && <p className="text-xs text-red-500">{joinError}</p>}
      </div>

      <p className="text-xs text-slate-400">Renoom · Projets déco en collaboration</p>
    </div>
  );
}

function StepJoin({ joinCode, setJoinCode, joinError, isSubmitting, onJoin, onBack }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink onClick={onBack} />
        <h2 className="font-['Sora'] text-xl font-semibold text-slate-800 mb-1">
          Entrez votre code d'invitation
        </h2>
        <p className="text-xs text-slate-500">Votre partenaire vous a partagé un code ou un lien.</p>
      </div>

      <input
        autoFocus
        type="text"
        value={joinCode}
        onChange={e => setJoinCode(e.target.value.trim())}
        onKeyDown={e => e.key === "Enter" && !isSubmitting && onJoin()}
        placeholder="abc123def"
        className="w-full rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 font-mono"
      />

      {joinError && <p className="text-xs text-red-500">{joinError}</p>}

      <PrimaryBtn onClick={onJoin} disabled={!joinCode.trim() || isSubmitting}>
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Connexion…
          </span>
        ) : "Rejoindre le projet"}
      </PrimaryBtn>
    </div>
  );
}
