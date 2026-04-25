import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const getBackendUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ festId: string }> }
) {
  try {
    const { festId } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${getBackendUrl()}/api/fests/${festId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    revalidateTag("fests");
    revalidateTag("events");
    console.log("🔄 Cache revalidated for tags: fests, events");

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("Fests update proxy error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ festId: string }> }
) {
  try {
    const { festId } = await params;
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    const response = await fetch(`${getBackendUrl()}/api/fests/${festId}`, {
      method: "DELETE",
      headers: { Authorization: authHeader },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    revalidateTag("fests");
    revalidateTag("events");
    console.log("🔄 Cache revalidated for tags: fests, events");

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("Fests delete proxy error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
