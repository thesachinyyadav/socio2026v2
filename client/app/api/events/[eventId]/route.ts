import { NextRequest, NextResponse } from "next/server";
import {
  getApiErrorMessage,
  parseJsonSafely,
  resolveBackendApiBase,
} from "@/lib/backendApi";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const normalizedEventId = String(eventId || "").trim();

    if (!normalizedEventId) {
      return NextResponse.json({ error: "Event ID is required." }, { status: 400 });
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
      `${backendBase}/api/events/${encodeURIComponent(normalizedEventId)}`,
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
        `Failed to fetch event (${backendResponse.status})`
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
    console.error("Event GET API bridge error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const normalizedEventId = String(eventId || "").trim();

    if (!normalizedEventId) {
      return NextResponse.json({ error: "Event ID is required." }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
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
      `${backendBase}/api/events/${encodeURIComponent(normalizedEventId)}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/json",
          Authorization: authHeader,
        },
        body: formData,
        cache: "no-store",
      }
    );

    const rawBody = await backendResponse.text();
    const payload = parseJsonSafely(rawBody);

    if (!backendResponse.ok) {
      const message = getApiErrorMessage(
        payload,
        rawBody,
        `Failed to update event (${backendResponse.status})`
      );

      const responsePayload = {
        ...(payload && typeof payload === "object" ? payload : {}),
        error: message,
      };

      return NextResponse.json(responsePayload, { status: backendResponse.status });
    }

    if (payload && typeof payload === "object") {
      return NextResponse.json(payload, { status: 200 });
    }

    return NextResponse.json(
      { error: "Backend returned an invalid response payload." },
      { status: 502 }
    );
  } catch (error: any) {
    console.error("Event PUT API bridge error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
