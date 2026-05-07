import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getBackendBaseUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");

async function proxyRequest(request: NextRequest, method: "GET" | "POST") {
  const backendUrl = `${getBackendBaseUrl()}/api/users${request.nextUrl.search}`;
  const headers: Record<string, string> = {};
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");

  if (authorization) headers.Authorization = authorization;
  if (contentType) headers["Content-Type"] = contentType;

  const body = method === "GET" ? undefined : await request.text();

  const upstream = await fetch(backendUrl, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    return await proxyRequest(request, "GET");
  } catch (error: any) {
    console.error("Users proxy GET error:", error);
    return NextResponse.json({ error: error?.message || "Failed to reach users service" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await proxyRequest(request, "POST");
  } catch (error: any) {
    console.error("Users proxy POST error:", error);
    return NextResponse.json({ error: error?.message || "Failed to reach users service" }, { status: 500 });
  }
}