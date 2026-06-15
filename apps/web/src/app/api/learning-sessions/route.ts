import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Legacy learning sessions API has been retired.",
      replacement: "/api/premium/today",
    },
    { status: 410 },
  );
}
