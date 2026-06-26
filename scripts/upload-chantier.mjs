#!/usr/bin/env node
// Upload chantier photos to Vercel Blob and generate a localStorage injection snippet.
// Usage: node --env-file=.env.local scripts/upload-chantier.mjs

import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

const FILES = [
  { file: 'Salon.JPG',               room: 'salon' },
  { file: 'Salon 2.JPG',             room: 'salon' },
  { file: 'Cuisine 1.JPG',           room: 'cuisine' },
  { file: 'Salle de bain.JPG',       room: 'sdb' },
  { file: 'Bureau.JPG',              room: 'bureau' },
  { file: 'Bureau 2.JPG',            room: 'bureau' },
  { file: 'Bureau 3.JPG',            room: 'bureau' },
  { file: 'Chambre parent.JPG',      room: 'parents' },
  { file: 'Chambre parent 2.JPG',    room: 'parents' },
  { file: 'Chambre enfant.JPG',      room: 'enfant' },
  { file: 'Chambre enfant 2.JPG',    room: 'enfant' },
  { file: 'Celier.JPG',              room: 'cellier' },
  { file: 'Placard Chaudière.JPG',   room: 'cellier' },
  { file: 'Coin Vinyle.JPG',         room: 'vinyle' },
  { file: 'Buanderie.JPG',           room: 'custom-buanderie' },
  { file: 'Terasse.JPG',             room: 'custom-terrasse' },
  { file: 'Terasse 2.JPG',           room: 'custom-terrasse' },
];

async function uploadFile(file) {
  const filePath = path.join(IMAGES_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ Not found: ${filePath}`);
    return null;
  }
  const buffer = fs.readFileSync(filePath);
  const blobName = `chantier/${file}`;
  const blob = await put(blobName, buffer, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false });
  console.log(`  ✓ ${file} → ${blob.url}`);
  return blob.url;
}

function generateSnippet(roomUrls) {
  const lines = Object.entries(roomUrls)
    .map(([room, urls]) => `  extra[${JSON.stringify(room)}] = [...(extra[${JSON.stringify(room)}] || []), ${urls.map(u => JSON.stringify(u)).join(', ')}];`)
    .join('\n');

  return `
// ====== Upload chantier — paste in browser console ======
(function() {
  // 1. Custom rooms: Buanderie + Terrasse
  const customRooms = JSON.parse(localStorage.getItem('palette_custom_rooms_v1') || '[]');
  const newRooms = [
    { key: 'custom-buanderie', label: 'Buanderie', dominant: 'creme', secondary: 'bois',
      line: 'Buanderie : base douce, nuances à ajuster selon les inspirations ajoutées.', notes: [] },
    { key: 'custom-terrasse', label: 'Terrasse', dominant: 'creme', secondary: 'bois',
      line: 'Terrasse : base douce, nuances à ajuster selon les inspirations ajoutées.', notes: [] },
  ];
  const updatedRooms = [
    ...customRooms.filter(r => !['custom-buanderie', 'custom-terrasse'].includes(r.key)),
    ...newRooms,
  ];
  localStorage.setItem('palette_custom_rooms_v1', JSON.stringify(updatedRooms));

  // 2. Nuances for new rooms
  const nuances = JSON.parse(localStorage.getItem('palette_room_nuances_v1') || '{}');
  nuances['custom-buanderie'] = { dominant: 'moyen', secondary: 'moyen', accent: 'lin' };
  nuances['custom-terrasse'] = { dominant: 'moyen', secondary: 'moyen', accent: 'lin' };
  localStorage.setItem('palette_room_nuances_v1', JSON.stringify(nuances));

  // 3. Plan extra images (append, no duplicates)
  const extra = JSON.parse(localStorage.getItem('palette_plan_extra_images_v1') || '{}');
${lines}
  localStorage.setItem('palette_plan_extra_images_v1', JSON.stringify(extra));

  console.log('✓ Chantier photos injected. Reloading...');
  location.reload();
})();
// ====== END ======
`.trim();
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set. Run with: node --env-file=.env.local scripts/upload-chantier.mjs');
    process.exit(1);
  }

  console.log('Uploading chantier photos to Vercel Blob...\n');

  const roomUrls = {};
  for (const { file, room } of FILES) {
    const url = await uploadFile(file);
    if (url) {
      if (!roomUrls[room]) roomUrls[room] = [];
      roomUrls[room].push(url);
    }
  }

  console.log('\n\n===== BROWSER CONSOLE SNIPPET =====\n');
  console.log(generateSnippet(roomUrls));
  console.log('\n===== END SNIPPET =====\n');
  console.log('Open the app, open DevTools Console (F12), paste the snippet and press Enter.');
}

main().catch(err => { console.error(err); process.exit(1); });
