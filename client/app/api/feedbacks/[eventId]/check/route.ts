import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getBackendBaseUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const backendUrl = `${getBackendBaseUrl()}/api/feedbacks/${encodeURIComponent(eventId)}/check${request.nextUrl.search}`;
    const authorization = request.headers.get("authorization");

    const upstream = await fetch(backendUrl, {
      method: "GET",
      headers: authorization ? { Authorization: authorization } : undefined,
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Feedback check proxy error:", error);
    return NextResponse.json({ error: error?.message || "Failed to reach feedback service" }, { status: 500 });
  }
}