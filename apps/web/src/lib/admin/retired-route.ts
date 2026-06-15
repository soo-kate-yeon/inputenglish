import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";

export async function retiredAdminRoute(
  error: string,
  replacement = "/api/admin/premium/pipeline/draft",
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    {
      error,
      replacement,
    },
    { status: 410 },
  );
}
