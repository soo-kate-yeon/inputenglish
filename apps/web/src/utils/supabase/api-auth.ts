import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "./server";

function getRequestDebugId(request: NextRequest): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming) {
    return incoming;
  }

  return `server-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getRequestRoute(request: NextRequest): string {
  try {
    return request.nextUrl?.pathname ?? new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

function decodeJwtClaimsForDebug(
  token: string,
): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = Buffer.from(padded, "base64").toString("utf8");
    const claims = JSON.parse(json) as Record<string, unknown>;

    return {
      sub: claims.sub ?? null,
      aud: claims.aud ?? null,
      iss: claims.iss ?? null,
      exp: claims.exp ?? null,
      iat: claims.iat ?? null,
      role: claims.role ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireApiUser(
  request: NextRequest,
): Promise<User | NextResponse> {
  const requestId = getRequestDebugId(request);
  const route = getRequestRoute(request);
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (!token) {
      console.warn("[ApiAuth] Empty bearer token:", {
        requestId,
        route,
      });
      return NextResponse.json(
        {
          error: "Authentication required (bearer token missing)",
          requestId,
        },
        { status: 401, headers: { "x-request-id": requestId } },
      );
    }

    const tokenClaims = decodeJwtClaimsForDebug(token);
    const admin = createAdminClient();
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    if (error || !user) {
      console.error("[ApiAuth] Bearer token rejected:", {
        requestId,
        route,
        error: error?.message ?? null,
        tokenClaims,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
      });
      return NextResponse.json(
        {
          error: "Authentication required (bearer token rejected)",
          requestId,
        },
        { status: 401, headers: { "x-request-id": requestId } },
      );
    }

    console.log("[ApiAuth] Bearer token accepted:", {
      requestId,
      route,
      userId: user.id,
      tokenClaims,
    });
    return user;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.warn("[ApiAuth] Cookie session missing or invalid:", {
      requestId,
      route,
      error: error?.message ?? null,
    });
    return NextResponse.json(
      {
        error: "Authentication required (cookie session missing)",
        requestId,
      },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  console.log("[ApiAuth] Cookie session accepted:", {
    requestId,
    route,
    userId: user.id,
  });
  return user;
}
