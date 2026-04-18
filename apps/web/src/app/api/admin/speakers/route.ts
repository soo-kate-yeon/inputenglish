import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { createAdminClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const videoId = request.nextUrl.searchParams.get("videoId");
    const supabase = createAdminClient();

    const { data: speakers, error: speakersError } = await supabase
      .from("speakers")
      .select(
        "id, slug, name, headline, description_long, avatar_url, sort_order, is_featured",
      )
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (speakersError) {
      throw speakersError;
    }

    let currentPrimarySpeaker = null;

    if (videoId) {
      const { data: mapping, error: mappingError } = await supabase
        .from("video_speakers")
        .select(
          "speaker:speakers(id, slug, name, headline, description_long, avatar_url, sort_order, is_featured)",
        )
        .eq("video_id", videoId)
        .eq("is_primary", true)
        .maybeSingle();

      if (mappingError) {
        throw mappingError;
      }

      currentPrimarySpeaker = Array.isArray(mapping?.speaker)
        ? (mapping?.speaker[0] ?? null)
        : (mapping?.speaker ?? null);
    }

    return NextResponse.json({
      speakers: speakers ?? [],
      currentPrimarySpeaker,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "Failed to load speakers" },
      { status: 500 },
    );
  }
}
