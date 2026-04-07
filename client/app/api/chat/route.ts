import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USAGE_HEADERS = [
  { source: "x-ai-limit", target: "X-AI-Limit" },
  { source: "x-ai-used", target: "X-AI-Used" },
  { source: "x-ai-remaining", target: "X-AI-Remaining" },
];

function getBackendBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  return apiUrl.replace(/\/api\/?$/, "");
}

function buildProxyHeaders(upstreamHeaders: Headers, contentType: string, isStream = false) {
  const headers = new Headers();
  headers.set("Content-Type", contentType);

  const upstreamCacheControl = upstreamHeaders.get("cache-control");
  if (isStream) {
    headers.set("Cache-Control", "no-cache, no-transform");
  } else if (upstreamCacheControl) {
    headers.set("Cache-Control", upstreamCacheControl);
  }

  for (const { source, target } of USAGE_HEADERS) {
    const value = upstreamHeaders.get(source);
    if (value) {
      headers.set(target, value);
    }
  }

  const exposeHeaders = upstreamHeaders.get("access-control-expose-headers");
  if (exposeHeaders) {
    headers.set("Access-Control-Expose-Headers", exposeHeaders);
  }

  return headers;
}

function getAuthorizationHeader(request: NextRequest) {
  return request.headers.get("authorization");
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = getAuthorizationHeader(request);

    if (!authHeader) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    const backendUrl = `${getBackendBaseUrl()}/api/chat/usage`;
    const upstream = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
      cache: "no-store",
    });

    const text = await upstream.text();
    const fallbackPayload = JSON.stringify({ error: "Empty response from chat service" });

    return new NextResponse(text || fallbackPayload, {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, "application/json"),
    });
  } catch (error: any) {
    console.error("Chat usage bridge error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to reach chat backend" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = getAuthorizationHeader(request);

    if (!authHeader) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    const body = await request.text();
    const backendUrl = `${getBackendBaseUrl()}/api/chat`;

    const upstream = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body,
      cache: "no-store",
    });

    const contentType = upstream.headers.get("content-type") || "";

    // Preserve streaming responses from backend chat route.
    if (contentType.includes("text/plain") && upstream.body) {
      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: buildProxyHeaders(upstream.headers, contentType, true),
      });
    }

    const text = await upstream.text();
    const fallbackPayload = JSON.stringify({ error: "Empty response from chat service" });

    const responseContentType = contentType.includes("application/json")
      ? contentType
      : "application/json";

    return new NextResponse(text || fallbackPayload, {
      status: upstream.status,
      headers: buildProxyHeaders(upstream.headers, responseContentType),
    });
  } catch (error: any) {
    console.error("Chat API bridge error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to reach chat backend" },
      { status: 500 }
    );
  }
}
