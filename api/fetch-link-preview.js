export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DesignHelperBot/1.0; +https://design-helper.vercel.app)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return res.json({ url, title: url, description: null, image: null });
    }

    const html = await response.text();

    const getOgTag = (prop) => {
      const patterns = [
        new RegExp(
          `<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`,
          "i"
        ),
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`,
          "i"
        ),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) return decodeHtmlEntities(m[1].trim());
      }
      return null;
    };

    const getMetaName = (name) => {
      const patterns = [
        new RegExp(
          `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
          "i"
        ),
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
          "i"
        ),
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

    let image = getOgTag("image");
    if (image && !image.startsWith("http")) {
      try {
        const base = new URL(url);
        image = new URL(image, base).href;
      } catch {
        image = null;
      }
    }

    res.json({
      url,
      title: getPageTitle() || url,
      description: getOgTag("description") || getMetaName("description"),
      image,
    });
  } catch {
    res.json({ url, title: url, description: null, image: null });
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
