import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

const MAX_CHARS = 15000;

// Reconstruit des lignes de texte à partir des items de getTextContent(),
// qui sortent dans l'ordre de dessin (pas de lecture) — un simple join(' ')
// mélangerait les colonnes désignation/qté/prix d'un devis tabulaire.
function groupTextItemsIntoLines(items) {
  const buckets = new Map();
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push(item);
  }
  const sortedY = [...buckets.keys()].sort((a, b) => b - a);
  return sortedY.map((y) =>
    buckets.get(y)
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map((i) => i.str)
      .join(" ")
      .trim()
  ).filter(Boolean);
}

// Extrait le texte d'un PDF déjà uploadé (URL Blob/Storage) pour l'envoyer
// à l'IA — pas d'extraction côté edge function Deno, pdfjs-dist dépend
// d'APIs navigateur (Canvas/DOMMatrix) peu fiables sur Deno Deploy.
export async function extractPdfText(url, { maxPages = 20 } = {}) {
  const pdf = await pdfjsLib.getDocument({ url }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const pages = [];
  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(groupTextItemsIntoLines(content.items).join("\n"));
  }
  const text = pages.join("\n\n--- page suivante ---\n\n").slice(0, MAX_CHARS);
  return { text, pageCount: pdf.numPages, truncated: pdf.numPages > maxPages };
}
