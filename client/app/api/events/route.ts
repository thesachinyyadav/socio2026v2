import { NextRequest, NextResponse } from "next/server";
import {
  getApiErrorMessage,
  parseJsonSafely,
  resolveBackendApiBase,
} from "@/lib/backendApi";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
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

    const authHeader = request.headers.get("authorization");
    const backendResponse = await fetch(`${backendBase}/api/events${request.nextUrl.search}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    const rawBody = await backendResponse.text();
    const payload = parseJsonSafely(rawBody);

    if (!backendResponse.ok) {
      const message = getApiErrorMessage(
        payload,
        rawBody,
        `Failed to fetch events (${backendResponse.status})`
      );

      return NextResponse.json(
        {
          ...(payload && typeof payload === "object" ? payload : {}),
          error: message,
        },
        { status: backendResponse.status }
      );
    }

    if (payload && typeof payload === "object") {
      return NextResponse.json(payload, { status: backendResponse.status });
    }

    return NextResponse.json(
      { error: "Backend returned an invalid response payload." },
      { status: 502 }
    );
  } catch (error: any) {
    console.error("Events GET API bridge error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

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

    const formData = await request.formData();
    const backendResponse = await fetch(`${backendBase}/api/events`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
      },
      body: formData,
      cache: "no-store",
    });

    const rawBody = await backendResponse.text();
    const payload = parseJsonSafely(rawBody);

    if (!backendResponse.ok) {
      const message = getApiErrorMessage(
        payload,
        rawBody,
        `Failed to create event (${backendResponse.status})`
      );

      return NextResponse.json(
        {
          ...(payload && typeof payload === "object" ? payload : {}),
          error: message,
        },
        { status: backendResponse.status }
      );
    }

    if (payload && typeof payload === "object") {
      return NextResponse.json(payload, { status: backendResponse.status });
    }

    return NextResponse.json(
      { error: "Backend returned an invalid response payload." },
      { status: 502 }
    );
  } catch (error: any) {
    console.error("Events POST API bridge error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}