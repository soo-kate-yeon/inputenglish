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

function getHostFromUrlLike(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function getNumericClaim(
  claims: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = claims?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildBearerRejectionDetails(
  tokenClaims: Record<string, unknown> | null,
): {
  message: string;
  debug: Record<string, unknown>;
} {
  const configuredSupabaseHost = getHostFromUrlLike(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
  );
  const tokenIssuerHost = getHostFromUrlLike(tokenClaims?.iss ?? null);
  const serviceRoleClaims = decodeJwtClaimsForDebug(
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const serviceRoleIssuerHost = getHostFromUrlLike(
    serviceRoleClaims?.iss ?? null,
  );
  const tokenExpiration = getNumericClaim(tokenClaims, "exp");
  const tokenExpired =
    tokenExpiration !== null && tokenExpiration * 1000 <= Date.now();

  if (tokenExpired) {
    return {
      message: "Authentication required (bearer token expired)",
      debug: {
        configuredSupabaseHost,
        tokenIssuerHost,
        serviceRoleIssuerHost,
        tokenExpiration,
      },
    };
  }

  if (
    tokenIssuerHost &&
    configuredSupabaseHost &&
    tokenIssuerHost !== configuredSupabaseHost
  ) {
    return {
      message:
        "Authentication required (bearer token rejected: token issuer mismatch)",
      debug: {
        configuredSupabaseHost,
        tokenIssuerHost,
        serviceRoleIssuerHost,
        tokenExpiration,
      },
    };
  }

  if (
    serviceRoleIssuerHost &&
    configuredSupabaseHost &&
    serviceRoleIssuerHost !== configuredSupabaseHost
  ) {
    return {
      message:
        "Authentication required (bearer token rejected: service role project mismatch)",
      debug: {
        configuredSupabaseHost,
        tokenIssuerHost,
        serviceRoleIssuerHost,
        tokenExpiration,
      },
    };
  }

  if (
    tokenIssuerHost &&
    serviceRoleIssuerHost &&
    tokenIssuerHost !== serviceRoleIssuerHost
  ) {
    return {
      message:
        "Authentication required (bearer token rejected: token and service role belong to different projects)",
      debug: {
        configuredSupabaseHost,
        tokenIssuerHost,
        serviceRoleIssuerHost,
        tokenExpiration,
      },
    };
  }

  return {
    message: "Authentication required (bearer token rejected)",
    debug: {
      configuredSupabaseHost,
      tokenIssuerHost,
      serviceRoleIssuerHost,
      tokenExpiration,
    },
  };
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
    const rejectionDetails = buildBearerRejectionDetails(tokenClaims);
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
        ...rejectionDetails.debug,
      });
      return NextResponse.json(
        {
          error: rejectionDetails.message,
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
