// @MX:NOTE: [AUTO] Admin whitelist-channel management endpoint (Task 4.1).
// @MX:SPEC: SPEC-WEB-001 Phase 4 REQ-WEB-003-U1, AC-003-2, EC-003-A
//
// Scope decision (implementation_divergence): no channels admin UI exists yet
// (grepped apps/web/src/app/admin/** — none found for channels). This phase
// ships a server-side admin API (POST create + GET list) only, matching the
// established admin/premium/* route conventions (requireAdmin + Zod +
// createAdminClient). A CRUD UI is deferred to a later phase since it is not
// required by any REQ-WEB-003 acceptance criterion.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";
import { validateChannelEntry } from "@/lib/premium/channel-entry-rules";
import type { Channel } from "@inputenglish/shared";

const vocabBandSchema = z.enum([
  "beginner",
  "basic",
  "conversation",
  "professional",
]);

const legalStatusSchema = z.enum([
  "official",
  "unofficial_reupload",
  "embed_disabled",
  "major_ip_excluded",
]);

const createChannelRequestSchema = z.object({
  name: z.string().min(1),
  youtubeChannelId: z.string().min(1),
  levelBand: vocabBandSchema,
  visualAccentTags: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  legalStatus: legalStatusSchema,
});

// biome-ignore lint/suspicious/noExplicitAny: DB row shape from Supabase query builder
function toChannel(row: any): Channel {
  return {
    id: row.id,
    name: row.name,
    youtubeChannelId: row.youtube_channel_id,
    levelBand: row.level_band,
    visualAccentTags: row.visual_accent_tags ?? [],
    topics: row.topics ?? [],
    active: row.active,
    createdAt: row.created_at ?? new Date().toISOString(),
    legalStatus: row.legal_status,
  };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createChannelRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid channel payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // ── Task 4.2: entry-rule gate — reject before any DB write (AC-003-2, EC-003-A) ──
  const validation = validateChannelEntry({
    name: input.name,
    legalStatus: input.legalStatus,
  });
  if (!validation.accepted) {
    return NextResponse.json(
      {
        error: `Channel entry rejected: ${validation.reason}`,
        reason: validation.reason,
      },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("channels")
      .insert({
        name: input.name,
        youtube_channel_id: input.youtubeChannelId,
        level_band: input.levelBand,
        visual_accent_tags: input.visualAccentTags,
        topics: input.topics,
        legal_status: input.legalStatus,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[admin/premium/channels] insert failed", error);
      return NextResponse.json(
        { error: error.message ?? "Failed to create channel" },
        { status: 422 },
      );
    }

    return NextResponse.json({ channel: toChannel(data) }, { status: 201 });
  } catch (error) {
    console.error("[admin/premium/channels] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create channel",
      },
      { status: 422 },
    );
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/premium/channels] list failed", error);
      return NextResponse.json(
        { error: error.message ?? "Failed to list channels" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      channels: (data ?? []).map(toChannel),
    });
  } catch (error) {
    console.error("[admin/premium/channels] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list channels",
      },
      { status: 422 },
    );
  }
}
