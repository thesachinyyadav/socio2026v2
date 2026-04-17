import { NextRequest, NextResponse } from "next/server";
import { resolveBackendApiBase } from "@/lib/backendApi";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const backendBase = resolveBackendApiBase({ requestOrigin: request.nextUrl.origin });

    if (!backendBase) {
      return NextResponse.json(
        { error: "Backend API origin is not configured." },
        { status: 500 }
      );
    }

    const res = await fetch(`${backendBase}/api/departments`, {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // cache for 1 hour — departments rarely change
    });

    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}
