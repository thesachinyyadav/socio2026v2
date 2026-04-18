import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ festId: string }> }
) {
  try {
    const { festId } = await params;
    const authHeader = request.headers.get("authorization");
    const body = await request.json();

    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    // Call the backend Express server
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const backendUrl = apiUrl.replace(/\/api\/?$/, "");
    const response = await fetch(`${backendUrl}/api/fests/${festId}/archive`, {
      method: "PATCH",
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

    // ✅ Revalidate cache after successful archive
    revalidateTag("events");
    revalidateTag("fests");
    console.log("🔄 Cache revalidated for tags: events, fests");

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Fest archive API bridge error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
