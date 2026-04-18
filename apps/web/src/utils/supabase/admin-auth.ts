import { NextResponse } from "next/server";
import { createClient } from "./server";

type AdminUser = { id: string; email: string };

/**
 * Verify the caller is an authenticated admin.
 * Returns the admin user on success, or a 401/403 NextResponse on failure.
 *
 * When ADMIN_EMAILS is set (comma-separated), only those emails are allowed.
 * When ADMIN_EMAILS is unset, any authenticated user is allowed.
 */
export async function requireAdmin(): Promise<AdminUser | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const raw = process.env.ADMIN_EMAILS;
  if (raw) {
    const allowed = raw.split(",").map((e) => e.trim().toLowerCase());
    if (!allowed.includes((user.email ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return { id: user.id, email: user.email ?? "" };
}
