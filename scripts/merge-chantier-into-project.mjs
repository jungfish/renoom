#!/usr/bin/env node
// Loads the existing project from Vercel Blob, merges chantier photos + new rooms, saves back.
// Usage: node --env-file=.env.local scripts/merge-chantier-into-project.mjs

import { put } from '@vercel/blob';

const PROJECT_ID = 'ydj47sns';
const PROJECT_URL = `https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/projects/${PROJECT_ID}.json`;

const CHANTIER_PHOTOS = {
  salon: [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Salon.JPG",
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Salon%202.JPG",
  ],
  cuisine: [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Cuisine%201.JPG",
  ],
  sdb: [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Salle%20de%20bain.JPG",
  ],
  bureau: [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Bureau.JPG",
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Bureau%202.JPG",
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Bureau%203.JPG",
  ],
  parents: [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Chambre%20parent.JPG",
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Chambre%20parent%202.JPG",
  ],
  enfant: [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Chambre%20enfant.JPG",
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Chambre%20enfant%202.JPG",
  ],
  cellier: [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Celier.JPG",
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Placard%20Chaudi%C3%A8re.JPG",
  ],
  vinyle: [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Coin%20Vinyle.JPG",
  ],
  "custom-buanderie": [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Buanderie.JPG",
  ],
  "custom-terrasse": [
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Terasse.JPG",
    "https://8jyffbtqylmfilvg.public.blob.vercel-storage.com/chantier/Terasse%202.JPG",
  ],
};

const NEW_ROOMS = [
  { key: "custom-buanderie", label: "Buanderie", dominant: "creme", secondary: "bois",
    line: "Buanderie : base douce, nuances à ajuster selon les inspirations ajoutées.", notes: [] },
  { key: "custom-terrasse", label: "Terrasse", dominant: "creme", secondary: "bois",
    line: "Terrasse : base douce, nuances à ajuster selon les inspirations ajoutées.", notes: [] },
];

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set.');
    process.exit(1);
  }

  console.log(`Loading project ${PROJECT_ID}...`);
  const res = await fetch(PROJECT_URL);
  if (!res.ok) { console.error('Failed to load project:', res.status); process.exit(1); }
  const project = await res.json();

  // Merge extraPlanImages (append CDN URLs, no duplicates)
  const extra = project.extraPlanImages || {};
  for (const [room, urls] of Object.entries(CHANTIER_PHOTOS)) {
    const existing = extra[room] || [];
    extra[room] = [...existing, ...urls.filter(u => !existing.includes(u))];
  }
  project.extraPlanImages = extra;

  // Merge customRooms (add Buanderie + Terrasse if not already there)
  const customRooms = project.customRooms || [];
  const existingKeys = customRooms.map(r => r.key);
  for (const room of NEW_ROOMS) {
    if (!existingKeys.includes(room.key)) customRooms.push(room);
  }
  project.customRooms = customRooms;

  // Add nuances for new rooms if missing
  const nuances = project.roomNuances || {};
  for (const room of NEW_ROOMS) {
    if (!nuances[room.key]) nuances[room.key] = { dominant: 'moyen', secondary: 'moyen', accent: 'lin' };
  }
  project.roomNuances = nuances;

  project.savedAt = new Date().toISOString();

  console.log('Saving updated project...');
  const buffer = Buffer.from(JSON.stringify(project));
  await put(`projects/${PROJECT_ID}.json`, buffer, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  console.log(`\n✓ Done! Open: https://design-jungfish.vercel.app/?p=${PROJECT_ID}`);
  console.log(`  or locally: http://localhost:5173/?p=${PROJECT_ID}`);
}

main().catch(err => { console.error(err); process.exit(1); });
