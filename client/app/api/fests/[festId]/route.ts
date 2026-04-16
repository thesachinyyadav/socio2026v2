import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeApiBase(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/api\/?$/i, "");
}

function parseJsonSafely(value: string): any | null {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ festId: string }> }
) {
  try {
    const { festId } = await params;
    const normalizedFestId = String(festId || "").trim();

    if (!normalizedFestId) {
      return NextResponse.json({ error: "Fest ID is required." }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    const configuredBackendBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);
    const requestOrigin = normalizeApiBase(request.nextUrl.origin);
    const backendBase =
      configuredBackendBase && configuredBackendBase !== requestOrigin
        ? configuredBackendBase
        : "http://localhost:8000";

    const backendResponse = await fetch(
      `${backendBase}/api/fests/${encodeURIComponent(normalizedFestId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        cache: "no-store",
      }
    );

    const rawBody = await backendResponse.text();
    const payload = parseJsonSafely(rawBody);

    if (!backendResponse.ok) {
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : rawBody?.trim() || `Failed to fetch fest (${backendResponse.status})`;

      return NextResponse.json({ error: message }, { status: backendResponse.status });
    }

    if (payload && typeof payload === "object") {
      return NextResponse.json(payload, { status: 200 });
    }

    return NextResponse.json(
      { error: "Backend returned an invalid response payload." },
      { status: 502 }
    );
  } catch (error: any) {
    console.error("Fest GET API bridge error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
