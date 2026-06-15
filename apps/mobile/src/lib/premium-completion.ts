import type { PremiumSession } from "@inputenglish/shared";

declare const require: <T>(id: string) => T;

export function buildPremiumCompletionAssets(session: PremiumSession) {
  return session.expression_cards.map((card) => {
    const transcriptLine = session.transcript.find(
      (line) => line.id === card.source_sentence_id,
    );

    return {
      expressionId: card.id,
      savedSentence: {
        video_id: session.source_video_id,
        premium_session_id: session.id,
        session_title: session.title,
        sentence_id: card.source_sentence_id ?? card.id,
        sentence_text: card.source_line,
        start_time: transcriptLine?.startTime ?? session.segment_start_time,
        end_time: transcriptLine?.endTime ?? session.segment_end_time,
      },
      playbookEntry: {
        sessionId: session.id,
        sourceVideoId: session.source_video_id,
        sourceSentence: card.source_line,
        practiceMode: "bookmark" as const,
        userRewrite:
          card.saved_atoms.examples[0] ?? card.saved_atoms.one_line_nuance_ko,
        attemptMetadata: {
          premiumSessionId: session.id,
          sessionTitle: session.title,
          expressionId: card.id,
          depth: card.depth,
          headword: card.saved_atoms.headword,
        },
      },
    };
  });
}

export async function persistPremiumCompletionAssets(
  userId: string,
  session: PremiumSession,
): Promise<number> {
  const { savePlaybookEntry } = require<
    typeof import("@/lib/api")
  >("@/lib/api");
  const { supabase } = require<
    typeof import("@/lib/supabase")
  >("@/lib/supabase");
  const assets = buildPremiumCompletionAssets(session);

  await Promise.all(
    assets.map(async (asset) => {
      const { error } = await supabase.from("saved_sentences").insert({
        user_id: userId,
        ...asset.savedSentence,
      });
      if (error) throw error;

      await savePlaybookEntry(userId, asset.playbookEntry);
    }),
  );

  return assets.length;
}
