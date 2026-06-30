import { CORS_HEADERS, corsResponse, optionsResponse } from "../_shared/_cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return corsResponse(405, { error: "Méthode non supportée." });

  const { url } = await req.json();
  if (!url) return corsResponse(400, { error: "URL required" });

  const isInstagram = url.includes("instagram.com");
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": isInstagram
          ? "Mozilla/5.0 (compatible; Twitterbot/1.0)"
          : "Mozilla/5.0 (compatible; RenoomBot/1.0; +https://renoom.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return corsResponse(200, { url, title: url, description: null, image: null });
    }

    const html = await response.text();

    const getOgTag = (prop: string) => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) return decodeHtmlEntities(m[1].trim());
      }
      return null;
    };

    const getMetaName = (name: string) => {
      const patterns = [
        new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) return decodeHtmlEntities(m[1].trim());
      }
      return null;
    };

    const getPageTitle = () => {
      const og = getOgTag("title");
      if (og) return og;
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return m ? decodeHtmlEntities(m[1].trim()) : null;
    };

    let image =
      getOgTag("image") ||
      getOgTag("image:url") ||
      getMetaName("twitter:image") ||
      getMetaName("twitter:image:src");
    if (image && !image.startsWith("http")) {
      try {
        image = new URL(image, new URL(url).origin).href;
      } catch {
        image = null;
      }
    }

    return corsResponse(200, {
      url,
      title: getPageTitle() || url,
      description: getOgTag("description") || getMetaName("description"),
      image,
    });
  } catch {
    return corsResponse(200, { url, title: url, description: null, image: null });
  }
});

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
