import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "./server";

export async function requireApiUser(
  request: NextRequest,
): Promise<User | NextResponse> {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    return user;
  }

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

  return user;
}
