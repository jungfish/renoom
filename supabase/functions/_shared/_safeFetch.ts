// Récupération d'URL fournies par les utilisateurs sans exposer le réseau
// interne (SSRF), et nettoyage des URL stockées (pas de javascript:).

export class UnsafeUrlError extends Error {}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal"];
const IPV4_RE = /^\d+\.\d+\.\d+\.\d+$/;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||           // link-local (métadonnées cloud)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224;                             // multicast / réservé
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === "::" || addr === "::1") return true;
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (addr.startsWith("::ffff:")) return true;
  return /^f[cd]/.test(addr) || /^fe[89ab]/.test(addr); // fc00::/7, fe80::/10
}

function isBlockedAddress(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  if (h.includes(":")) return isPrivateIPv6(h);
  if (IPV4_RE.test(h)) return isPrivateIPv4(h);
  return false;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Seules les URL http(s) sont acceptées.");
  }
  // Le parseur normalise déjà les IP écrites en décimal/hexa (2130706433 → 127.0.0.1).
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)) || isBlockedAddress(host)) {
    throw new UnsafeUrlError("Adresse non autorisée.");
  }
  // Nom de domaine : on vérifie aussi les IP résolues quand le runtime le permet.
  if (!host.includes(":") && !IPV4_RE.test(host) && typeof Deno.resolveDns === "function") {
    const signal = AbortSignal.timeout(3000);
    const results = await Promise.allSettled([
      Deno.resolveDns(host, "A", { signal }),
      Deno.resolveDns(host, "AAAA", { signal }),
    ]);
    const addrs = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (addrs.some(isBlockedAddress)) throw new UnsafeUrlError("Adresse non autorisée.");
  }
  return url;
}

// fetch qui revérifie chaque redirection au lieu de les suivre aveuglément.
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  { maxRedirects = 3, timeoutMs = 10000 } = {},
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicHttpUrl(current);
    const res = await fetch(url, { ...init, redirect: "manual", signal });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      current = new URL(location, url).toString();
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("Trop de redirections.");
}

export async function readBodyLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) {
    await res.body?.cancel();
    throw new UnsafeUrlError("Fichier trop volumineux.");
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UnsafeUrlError("Fichier trop volumineux.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

const STORED_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

// URL saisie par un membre et réaffichée en lien : on refuse javascript:,
// vbscript:, data:text/html… Une URL sans schéma (« ikea.com/… ») est gardée.
export function sanitizeStoredUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  try {
    const { protocol } = new URL(v, "https://example.invalid");
    if (protocol === "data:") return /^data:(image\/|application\/pdf)/i.test(v) ? v : null;
    return STORED_URL_PROTOCOLS.has(protocol) ? v : null;
  } catch {
    return null;
  }
}
