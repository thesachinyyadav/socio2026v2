import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const getBackendUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type");
    const body = await request.blob();

    const headers: Record<string, string> = { Authorization: authHeader };
    if (contentType) headers["Content-Type"] = contentType;

    const response = await fetch(`${getBackendUrl()}/api/events/${eventId}`, {
      method: "PUT",
      headers,
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    revalidateTag("events");
    console.log("🔄 Cache revalidated for tag: events");

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("Events update proxy error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    const response = await fetch(`${getBackendUrl()}/api/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: authHeader },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    revalidateTag("events");
    console.log("🔄 Cache revalidated for tag: events");

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("Events delete proxy error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
