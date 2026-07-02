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

    const { price, currency } = extractPrice(html);

    return corsResponse(200, {
      url,
      title: getPageTitle() || url,
      description: getOgTag("description") || getMetaName("description"),
      image,
      price,
      currency,
    });
  } catch {
    return corsResponse(200, { url, title: url, description: null, image: null });
  }
});

function extractPrice(html: string): { price: number | null; currency: string | null } {
  const toNumber = (raw: string) => {
    const num = parseFloat(raw.replace(/[^\d.,]/g, "").replace(",", "."));
    return isNaN(num) ? null : num;
  };

  const ldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const jsonMatch = block.match(/>([\s\S]*?)<\/script>/i);
    if (!jsonMatch) continue;
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const nodes = Array.isArray(parsed) ? parsed : (parsed["@graph"] || [parsed]);
      for (const node of nodes) {
        const type = node?.["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct) continue;
        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        const rawPrice = offers?.price ?? offers?.priceSpecification?.price;
        if (rawPrice === undefined || rawPrice === null) continue;
        const price = toNumber(String(rawPrice));
        if (price !== null) {
          const currency = offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency ?? null;
          return { price, currency };
        }
      }
    } catch {
      // JSON-LD malformé, on ignore ce bloc
    }
  }

  const getMetaContent = (prop: string) => {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return m[1];
    }
    return null;
  };

  const metaAmount = getMetaContent("product:price:amount") || getMetaContent("og:price:amount");
  if (metaAmount) {
    const price = toNumber(metaAmount);
    if (price !== null) {
      const currency = getMetaContent("product:price:currency") || getMetaContent("og:price:currency");
      return { price, currency };
    }
  }

  const itemPropMatch =
    html.match(/<[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<[^>]+content=["']([^"']+)["'][^>]+itemprop=["']price["']/i);
  if (itemPropMatch?.[1]) {
    const price = toNumber(itemPropMatch[1]);
    if (price !== null) return { price, currency: null };
  }

  for (let i = 1; i <= 2; i++) {
    const label = getMetaContent(`twitter:label${i}`);
    if (label && /prix|price/i.test(label)) {
      const data = getMetaContent(`twitter:data${i}`);
      const priceMatch = data?.match(/[\d]+(?:[.,]\d{2})?/);
      if (priceMatch) {
        const price = toNumber(priceMatch[0]);
        if (price !== null) {
          const currency = /€/.test(data!) ? "EUR" : /\$/.test(data!) ? "USD" : /£/.test(data!) ? "GBP" : null;
          return { price, currency };
        }
      }
    }
  }

  return { price: null, currency: null };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
