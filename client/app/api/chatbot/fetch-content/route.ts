import { NextResponse } from "next/server";

const FETCH_TIMEOUT_MS = 12000;
const MAX_HTML_CHARS = 220000;
const MAX_TEXT_CHARS = 14000;

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  if (host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) return true;

  const ipv4 = host.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
  if (!ipv4) return false;

  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;

  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  return false;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number(dec);
      if (Number.isNaN(code)) return "";
      return String.fromCodePoint(code);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (Number.isNaN(code)) return "";
      return String.fromCodePoint(code);
    });
}

function extractMetaContent(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }

  return "";
}

function htmlToPlainText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

function rankSentencesByQuery(text: string, query: string): string {
  const normalizedQuery = query.toLowerCase().trim();
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35);

  if (sentences.length === 0) return text.slice(0, 560);

  if (!normalizedQuery) {
    return sentences.slice(0, 3).join(" ").slice(0, 760);
  }

  const keywords = normalizedQuery
    .split(/\s+/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 2);

  if (keywords.length === 0) {
    return sentences.slice(0, 3).join(" ").slice(0, 760);
  }

  const scored = sentences
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const score = keywords.reduce((sum, keyword) => sum + (lower.includes(keyword) ? 1 : 0), 0);
      return { sentence, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.sentence.length - b.sentence.length)
    .slice(0, 4)
    .map((item) => item.sentence);

  if (scored.length === 0) {
    return sentences.slice(0, 3).join(" ").slice(0, 760);
  }

  return scored.join(" ").slice(0, 760);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const rawUrl = typeof payload?.url === "string" ? payload.url : "";
    const query = typeof payload?.query === "string" ? payload.query.slice(0, 240) : "";
    const normalized = normalizeUrl(rawUrl);

    if (!normalized) {
      return NextResponse.json({ ok: false, error: "Please provide a valid http/https URL." }, { status: 400 });
    }

    const parsedUrl = new URL(normalized);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ ok: false, error: "Only http/https URLs are supported." }, { status: 400 });
    }

    if (isPrivateHost(parsedUrl.hostname)) {
      return NextResponse.json({ ok: false, error: "Private or local network URLs are not allowed." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(parsedUrl.toString(), {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "SocioAssistBot/1.0 (+https://socio)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ ok: false, error: `Could not fetch URL (status ${response.status}).` }, { status: 400 });
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return NextResponse.json({ ok: false, error: "The URL is not an HTML webpage." }, { status: 400 });
    }

    let html = await response.text();
    if (html.length > MAX_HTML_CHARS) {
      html = html.slice(0, MAX_HTML_CHARS);
    }

    const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
    const description = extractMetaContent(html, "description") || extractMetaContent(html, "og:description");
    const text = htmlToPlainText(html).slice(0, MAX_TEXT_CHARS);

    if (!text) {
      return NextResponse.json({ ok: false, error: "No readable text found on this webpage." }, { status: 400 });
    }

    const summary = rankSentencesByQuery(text, query);

    return NextResponse.json({
      ok: true,
      url: parsedUrl.toString(),
      title: title || parsedUrl.hostname,
      description,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error while fetching webpage.";
    const timedOut = /aborted|abort/i.test(message);

    return NextResponse.json(
      {
        ok: false,
        error: timedOut ? "The fetch request timed out. Try again in a moment." : "Failed to fetch webpage content.",
      },
      { status: timedOut ? 504 : 500 },
    );
  }
}
