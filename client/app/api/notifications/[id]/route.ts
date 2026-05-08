import { NextRequest, NextResponse } from "next/server";

const getBackendUrl = () =>
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get("authorization");

    const qs = searchParams.toString();
    const url = `${getBackendUrl()}/api/notifications/${params.id}${qs ? `?${qs}` : ""}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: authHeader ? { Authorization: authHeader } : {},
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
