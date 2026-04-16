import { NextRequest, NextResponse } from "next/server";
import {
  getApiErrorMessage,
  parseJsonSafely,
  resolveBackendApiBase,
} from "@/lib/backendApi";

export const dynamic = "force-dynamic";

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
    const backendBase = resolveBackendApiBase({
      requestOrigin: request.nextUrl.origin,
    });

    if (!backendBase) {
      return NextResponse.json(
        {
          error:
            "Backend API origin is not configured. Set BACKEND_API_URL (or NEXT_PUBLIC_API_URL) to your server deployment.",
        },
        { status: 500 }
      );
    }

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
      const message = getApiErrorMessage(
        payload,
        rawBody,
        `Failed to fetch fest (${backendResponse.status})`
      );

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
