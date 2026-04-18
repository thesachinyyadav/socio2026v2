import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
    "google-site-verification: googlef9d3f1696ce89505.html",
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
