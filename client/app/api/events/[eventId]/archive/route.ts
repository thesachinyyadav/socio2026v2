import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  getApiErrorMessage,
  parseJsonSafely,
  resolveBackendApiBase,
} from "@/lib/backendApi";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const authHeader = request.headers.get("authorization");
    const body = await request.json();

    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    // Call the backend Express server
    const backendUrl = resolveBackendApiBase({
      requestOrigin: request.nextUrl.origin,
    });

    if (!backendUrl) {
      return NextResponse.json(
        {
          error:
            "Backend API origin is not configured. Set BACKEND_API_URL (or NEXT_PUBLIC_API_URL) to your server deployment.",
        },
        { status: 500 }
      );
    }
    const response = await fetch(`${backendUrl}/api/events/${eventId}/archive`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    const rawBody = await response.text();
    const data = parseJsonSafely(rawBody);

    if (!response.ok) {
      const message = getApiErrorMessage(
        data,
        rawBody,
        `Failed to archive event (${response.status})`
      );
      return NextResponse.json(
        {
          ...(data && typeof data === "object" ? data : {}),
          error: message,
        },
        { status: response.status }
      );
    }

    // ✅ Revalidate cache after successful archive
    revalidateTag("events");
    console.log("🔄 Cache revalidated for tag: events");

    return NextResponse.json(
      data && typeof data === "object" ? data : { success: true },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Archive API bridge error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
