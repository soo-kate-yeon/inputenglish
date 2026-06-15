import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";

export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    {
      error: "Legacy multi-scene analysis has been retired.",
      replacement: "/api/admin/premium/pipeline/draft",
    },
    { status: 410 },
  );
}
