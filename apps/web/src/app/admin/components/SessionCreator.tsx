import React, { useState, useMemo, useEffect } from "react";
import type {
  Sentence,
  SceneRecommendation,
  LearningSession,
  LongformContext,
  LongformPack,
  SessionContext,
  KeyVocabularyEntry,
  SessionSourceType,
  Genre,
  Speaker,
  SpeakingSituation,
  TransformationSet,
  TransformationExercise,
} from "@inputenglish/shared";
import {
  GENRES,
  SESSION_SOURCE_TYPES,
  SPEAKING_SITUATIONS,
  SPEAKING_SITUATION_LABELS,
} from "@inputenglish/shared";
import { Plus, Trash2, Clock, Edit2, Sparkles, RefreshCw } from "lucide-react";
import { TransformationExerciseEditor } from "./TransformationExerciseEditor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const SOURCE_TYPE_LABELS: Record<SessionSourceType, string> = {
  keynote: "키노트",
  demo: "데모",
  "earnings-call": "실적 발표",
  podcast: "팟캐스트",
  interview: "인터뷰",
  panel: "패널 토크",
  "public-speech": "공적 말하기",
  "talk-show": "토크쇼",
  vlog: "브이로그",
  "scripted-drama": "드라마/영화",
};

const GENRE_LABELS: Record<Genre, string> = {
  politics: "정치",
  tech: "테크",
  economy: "경제",
  "current-affairs": "시사",
  news: "뉴스",
  business: "업무",
  entertainment: "엔터테인먼트",
  lifestyle: "라이프스타일",
};

function createEmptyContext(): SessionContext {
  return {
    reusable_scenarios: [],
    key_vocabulary: [],
    grammar_rhetoric_note: "",
    expected_takeaway: "",
    generated_by: "manual",
  };
}

function createEmptyLongformContext(): LongformContext {
  return {
    speaker_snapshot: "",
    conversation_type: "",
    core_topics: [],
    why_this_segment: "",
    listening_takeaway: "",
    generated_by: "manual",
  };
}

function arrayToMultiline(value: string[]): string {
  return value.join("\n");
}

function multilineToArray(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTagInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function vocabToMultiline(items: (string | KeyVocabularyEntry)[]): string {
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      const parts = [item.expression || ""];
      if (item.example) parts.push(item.example);
      if (item.translation) parts.push(item.translation);
      return parts.join(" — ");
    })
    .join("\n");
}

function multilineToVocab(value: string): (string | KeyVocabularyEntry)[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(" — ").map((p) => p.trim());
      if (parts.length < 2) return line;
      return {
        expression: parts[0],
        example: parts[1] || "",
        translation: parts[2] || "",
      };
    });
}

function resolveSpeakerChoice(
  rawValue: string,
  options: Speaker[],
): {
  id: string | null;
  name: string | null;
  slug: string | null;
  avatar_url: string | null;
} {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { id: null, name: null, slug: null, avatar_url: null };
  }

  const exactMatch = options.find(
    (speaker) => speaker.name.toLowerCase() === trimmed.toLowerCase(),
  );

  if (exactMatch) {
    return {
      id: exactMatch.id,
      name: exactMatch.name,
      slug: exactMatch.slug,
      avatar_url: exactMatch.avatar_url || null,
    };
  }

  return {
    id: null,
    name: trimmed,
    slug: null,
    avatar_url: null,
  };
}

function getSentencesInRange(
  allSentences: Sentence[],
  startTime: number,
  endTime: number,
): Sentence[] {
  return allSentences
    .filter(
      (sentence) =>
        sentence.startTime >= startTime - 0.05 &&
        sentence.endTime <= endTime + 0.05,
    )
    .sort((a, b) => a.startTime - b.startTime);
}

function syncLongformSelectionWithSessionOverwrite(
  longformPack: LongformPack,
  allSentences: Sentence[],
  previousSession: LearningSession,
  replacementSentences: Sentence[],
): LongformPack {
  const preservedSentences = allSentences.filter((sentence) => {
    if (!longformPack.sentence_ids.includes(sentence.id)) return false;

    const overlapsPreviousSession =
      sentence.startTime >= previousSession.start_time - 0.05 &&
      sentence.endTime <= previousSession.end_time + 0.05;

    return !overlapsPreviousSession;
  });

  const nextSentences = [...preservedSentences, ...replacementSentences]
    .filter(
      (sentence, index, all) =>
        all.findIndex((candidate) => candidate.id === sentence.id) === index,
    )
    .sort((a, b) => a.startTime - b.startTime);

  if (nextSentences.length === 0) {
    return longformPack;
  }

  const nextStartTime = nextSentences[0].startTime;
  const nextEndTime = nextSentences[nextSentences.length - 1].endTime;

  return {
    ...longformPack,
    sentence_ids: nextSentences.map((sentence) => sentence.id),
    start_time: nextStartTime,
    end_time: nextEndTime,
    duration: Math.max(0, nextEndTime - nextStartTime),
    updated_at: new Date().toISOString(),
  };
}

interface SessionCreatorProps {
  sentences: Sentence[];
  videoId: string;
  videoTitle?: string;
  longformPack?: LongformPack | null;
  onLongformPackChange?: React.Dispatch<
    React.SetStateAction<LongformPack | null>
  >;
  shortformSelectedIds: Set<string>;
  onShortformSelectedIdsChange: (ids: Set<string>) => void;
  longformSelectedIds: Set<string>;
  onLongformSelectedIdsChange: (ids: Set<string>) => void;
  onSessionsChange: (sessions: LearningSession[]) => void;
  onHighlightedSentencesChange?: (ids: Set<string>) => void;
  initialSessions?: LearningSession[];
  suggestedScenes?: SceneRecommendation[];
}

export function SessionCreator({
  sentences,
  videoId,
  videoTitle,
  longformPack = null,
  onLongformPackChange,
  shortformSelectedIds,
  onShortformSelectedIdsChange,
  longformSelectedIds,
  onLongformSelectedIdsChange,
  onSessionsChange,
  onHighlightedSentencesChange,
  initialSessions = [],
  suggestedScenes = [],
}: SessionCreatorProps) {
  const [checkedSessionIds, setCheckedSessionIds] = useState<Set<string>>(
    new Set(),
  );

  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isLongformSheetOpen, setIsLongformSheetOpen] = useState(false);
  const [isLongformAutofilling, setIsLongformAutofilling] = useState(false);
  const [isLongformGeneratingContext, setIsLongformGeneratingContext] =
    useState(false);
  const [isLongformGeneratingAll, setIsLongformGeneratingAll] = useState(false);
  const [longformEditTitle, setLongformEditTitle] = useState("");
  const [longformEditSubtitle, setLongformEditSubtitle] = useState("");
  const [longformEditDescription, setLongformEditDescription] = useState("");
  const [longformEditSpeakerSummary, setLongformEditSpeakerSummary] =
    useState("");
  const [longformEditTalkSummary, setLongformEditTalkSummary] = useState("");
  const [longformEditTopicTags, setLongformEditTopicTags] = useState("");
  const [longformEditContentTags, setLongformEditContentTags] = useState("");
  const [longformEditContext, setLongformEditContext] =
    useState<LongformContext>(createEmptyLongformContext());

  // Edit Sheet State
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LearningSession | null>(
    null,
  );
  const [editTab, setEditTab] = useState<"context" | "transformation">(
    "context",
  );
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<
    "beginner" | "intermediate" | "advanced"
  >("intermediate");
  const [editSourceType, setEditSourceType] =
    useState<SessionSourceType>("podcast");
  const [editGenre, setEditGenre] = useState<Genre | undefined>(undefined);
  const [editSpeakingSituations, setEditSpeakingSituations] = useState<
    SpeakingSituation[]
  >([]);
  const [editDifficultyLevel, setEditDifficultyLevel] = useState<
    1 | 2 | 3 | 4 | 5 | undefined
  >(undefined);
  const [editPremiumRequired, setEditPremiumRequired] = useState(true);
  const [editPrimarySpeakerName, setEditPrimarySpeakerName] = useState("");
  const [editPrimarySpeakerId, setEditPrimarySpeakerId] = useState<
    string | null
  >(null);
  const [editPrimarySpeakerSlug, setEditPrimarySpeakerSlug] = useState<
    string | null
  >(null);
  const [editPrimarySpeakerDescription, setEditPrimarySpeakerDescription] =
    useState("");
  const [editPrimarySpeakerAvatarUrl, setEditPrimarySpeakerAvatarUrl] =
    useState("");
  const [editContext, setEditContext] =
    useState<SessionContext>(createEmptyContext());
  const [isEditGeneratingAll, setIsEditGeneratingAll] = useState(false);
  const [editTransformationPattern, setEditTransformationPattern] = useState<
    string | null
  >(null);
  const [editGeneratedTransformationSet, setEditGeneratedTransformationSet] =
    useState<Partial<TransformationSet> | null>(null);
  const [editGeneratedExercises, setEditGeneratedExercises] = useState<
    Partial<TransformationExercise>[]
  >([]);
  const [speakerOptions, setSpeakerOptions] = useState<Speaker[]>([]);

  // List State
  const [createdSessions, setCreatedSessions] =
    useState<LearningSession[]>(initialSessions);

  // Effect to notify parent
  useEffect(() => {
    onSessionsChange(createdSessions);
  }, [createdSessions, onSessionsChange]);

  // Sync with initialSessions when they change (e.g., when loading existing video)
  useEffect(() => {
    if (initialSessions.length > 0 && createdSessions.length === 0) {
      setCreatedSessions(initialSessions);
      console.log(
        `📥 Loaded ${initialSessions.length} sessions into SessionCreator`,
      );
    }
  }, [initialSessions]);

  useEffect(() => {
    if (suggestedScenes.length > 0) {
      setIsSuggestionModalOpen(true);
    }
  }, [suggestedScenes.length]);

  useEffect(() => {
    if (!longformPack?.id) return;

    setCreatedSessions((prev) =>
      prev.map((session) =>
        session.longform_pack_id === longformPack.id
          ? session
          : {
              ...session,
              longform_pack_id: longformPack.id,
            },
      ),
    );
  }, [longformPack?.id]);

  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;

    fetch(`/api/admin/speakers?videoId=${encodeURIComponent(videoId)}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || "Failed to load speakers");
        }
        return response.json() as Promise<{
          speakers: Speaker[];
          currentPrimarySpeaker?: Speaker | null;
        }>;
      })
      .then((payload) => {
        if (cancelled) return;

        setSpeakerOptions(payload.speakers ?? []);

        if (payload.currentPrimarySpeaker) {
          const current = payload.currentPrimarySpeaker;
          setEditPrimarySpeakerName((prev) => prev || current.name);
          setEditPrimarySpeakerId((prev) => prev ?? current.id);
          setEditPrimarySpeakerSlug((prev) => prev ?? current.slug);
          setEditPrimarySpeakerDescription(
            (prev) => prev || current.description_long || "",
          );
          setEditPrimarySpeakerAvatarUrl(
            (prev) => prev || current.avatar_url || "",
          );
          setCreatedSessions((prev) =>
            prev.map((session) => ({
              ...session,
              primary_speaker_id: current.id,
              primary_speaker_name: current.name,
              primary_speaker_slug: current.slug,
              primary_speaker_description: current.description_long || null,
              primary_speaker_avatar_url: current.avatar_url || null,
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpeakerOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Notify parent about highlighted sentence IDs when checked sessions change
  useEffect(() => {
    const ids = new Set<string>();
    for (const session of createdSessions) {
      if (checkedSessionIds.has(session.id)) {
        for (const sid of session.sentence_ids) {
          ids.add(sid);
        }
      }
    }
    onHighlightedSentencesChange?.(ids);
  }, [checkedSessionIds, createdSessions, onHighlightedSentencesChange]);

  const toggleSessionCheck = (sessionId: string) => {
    const nextChecked = new Set(checkedSessionIds);
    if (nextChecked.has(sessionId)) {
      nextChecked.delete(sessionId);
    } else {
      nextChecked.add(sessionId);
    }
    setCheckedSessionIds(nextChecked);

    // Sync sentence selection with all checked sessions
    const sentenceIds = new Set<string>();
    for (const session of createdSessions) {
      if (nextChecked.has(session.id)) {
        for (const sid of session.sentence_ids) {
          sentenceIds.add(sid);
        }
      }
    }
    onShortformSelectedIdsChange(sentenceIds);
  };

  // Auto-sync sessions when sentences are edited/split/merged in Step2.
  // Uses time-range matching so split sentences (new IDs) are picked up.
  // Uses functional state update to avoid stale closure on createdSessions.
  useEffect(() => {
    setCreatedSessions((prev) => {
      if (prev.length === 0) return prev;

      const updatedSessions = prev.map((session) => {
        // Find all sentences that overlap with this session's time range
        const currentSentences = getSentencesInRange(
          sentences,
          session.start_time,
          session.end_time,
        );

        if (currentSentences.length === 0) return session;

        const startTime = currentSentences[0].startTime;
        const endTime = currentSentences[currentSentences.length - 1].endTime;

        return {
          ...session,
          sentence_ids: currentSentences.map((s) => s.id),
          sentences: currentSentences,
          start_time: startTime,
          end_time: endTime,
          duration: endTime - startTime,
        };
      });

      const hasChanges = updatedSessions.some((updated, idx) => {
        const original = prev[idx];
        return (
          updated.sentence_ids.length !== original.sentence_ids.length ||
          updated.sentence_ids.some((id, i) => id !== original.sentence_ids[i])
        );
      });

      return hasChanges ? updatedSessions : prev;
    });
  }, [sentences]); // Trigger when sentences array changes

  useEffect(() => {
    if (!longformPack) return;

    const currentSentences = getSentencesInRange(
      sentences,
      longformPack.start_time,
      longformPack.end_time,
    );

    if (currentSentences.length === 0) return;

    const nextIds = currentSentences.map((sentence) => sentence.id);
    const hasChanges =
      nextIds.length !== longformPack.sentence_ids.length ||
      nextIds.some((id, index) => id !== longformPack.sentence_ids[index]);

    if (!hasChanges) return;

    updateLongformPack({
      ...longformPack,
      sentence_ids: nextIds,
      start_time: currentSentences[0].startTime,
      end_time: currentSentences[currentSentences.length - 1].endTime,
      duration: Math.max(
        0,
        currentSentences[currentSentences.length - 1].endTime -
          currentSentences[0].startTime,
      ),
      updated_at: new Date().toISOString(),
    });
  }, [longformPack, sentences]);

  // DB에 실제로 저장된 세션 ID 집합
  const persistedSessionIds = useMemo(
    () => new Set(initialSessions.map((s) => s.id)),
    [initialSessions],
  );

  // Derived State
  const sortedSelectedSentences = useMemo(() => {
    if (shortformSelectedIds.size === 0) return [];
    // Filter and sort based on original order in 'sentences' array
    return sentences
      .filter((s) => shortformSelectedIds.has(s.id))
      .sort((a, b) => a.startTime - b.startTime);
  }, [sentences, shortformSelectedIds]);

  const selectionDuration = useMemo(() => {
    if (sortedSelectedSentences.length === 0) return 0;
    const start = sortedSelectedSentences[0].startTime;
    const end =
      sortedSelectedSentences[sortedSelectedSentences.length - 1].endTime;
    return Math.max(0, end - start);
  }, [sortedSelectedSentences]);

  const sortedLongformSelectedSentences = useMemo(() => {
    if (longformSelectedIds.size === 0) return [];
    return sentences
      .filter((sentence) => longformSelectedIds.has(sentence.id))
      .sort((a, b) => a.startTime - b.startTime);
  }, [longformSelectedIds, sentences]);

  const longformSelectionDuration = useMemo(() => {
    if (sortedLongformSelectedSentences.length === 0) return 0;
    const start = sortedLongformSelectedSentences[0].startTime;
    const end =
      sortedLongformSelectedSentences[
        sortedLongformSelectedSentences.length - 1
      ].endTime;
    return Math.max(0, end - start);
  }, [sortedLongformSelectedSentences]);

  // Handlers
  const buildLongformFromSelection = (
    baseLongform: LongformPack | null = null,
  ): LongformPack | null => {
    if (sortedLongformSelectedSentences.length === 0) return null;

    const firstSessionSpeaker = createdSessions.find(
      (session) =>
        session.primary_speaker_id ||
        session.primary_speaker_name ||
        session.primary_speaker_slug,
    );

    const titleFallback = "롱폼 리스닝 구간";
    const now = new Date().toISOString();

    return {
      id: baseLongform?.id ?? crypto.randomUUID(),
      source_video_id: videoId,
      title: baseLongform?.title ?? titleFallback,
      subtitle:
        baseLongform?.subtitle ?? "핵심 흐름을 길게 듣는 리스닝 구간이에요.",
      description:
        baseLongform?.description ??
        "짧은 쇼츠보다 더 긴 호흡으로 화자의 흐름과 전개를 따라가는 구간이에요.",
      duration: longformSelectionDuration,
      sentence_ids: sortedLongformSelectedSentences.map(
        (sentence) => sentence.id,
      ),
      start_time: sortedLongformSelectedSentences[0].startTime,
      end_time:
        sortedLongformSelectedSentences[
          sortedLongformSelectedSentences.length - 1
        ].endTime,
      primary_speaker_id:
        baseLongform?.primary_speaker_id ??
        firstSessionSpeaker?.primary_speaker_id ??
        editPrimarySpeakerId,
      primary_speaker_name:
        baseLongform?.primary_speaker_name ??
        firstSessionSpeaker?.primary_speaker_name ??
        editPrimarySpeakerName.trim() ??
        null,
      primary_speaker_slug:
        baseLongform?.primary_speaker_slug ??
        firstSessionSpeaker?.primary_speaker_slug ??
        editPrimarySpeakerSlug,
      primary_speaker_description:
        baseLongform?.primary_speaker_description ??
        firstSessionSpeaker?.primary_speaker_description ??
        editPrimarySpeakerDescription.trim() ??
        null,
      primary_speaker_avatar_url:
        baseLongform?.primary_speaker_avatar_url ??
        firstSessionSpeaker?.primary_speaker_avatar_url ??
        editPrimarySpeakerAvatarUrl.trim() ??
        null,
      speaker_summary: baseLongform?.speaker_summary ?? "",
      talk_summary: baseLongform?.talk_summary ?? "",
      topic_tags: baseLongform?.topic_tags ?? [],
      content_tags: baseLongform?.content_tags ?? [],
      created_at: baseLongform?.created_at ?? now,
      created_by: baseLongform?.created_by ?? null,
      updated_at: now,
      context: baseLongform?.context ?? createEmptyLongformContext(),
      shorts: baseLongform?.shorts,
    };
  };

  const openLongformSheet = (nextLongform: LongformPack) => {
    setLongformEditTitle(nextLongform.title ?? "");
    setLongformEditSubtitle(nextLongform.subtitle ?? "");
    setLongformEditDescription(nextLongform.description ?? "");
    setLongformEditSpeakerSummary(nextLongform.speaker_summary ?? "");
    setLongformEditTalkSummary(nextLongform.talk_summary ?? "");
    setLongformEditTopicTags((nextLongform.topic_tags ?? []).join(", "));
    setLongformEditContentTags((nextLongform.content_tags ?? []).join(", "));
    setLongformEditContext(
      nextLongform.context ?? createEmptyLongformContext(),
    );
    setIsLongformSheetOpen(true);
  };

  const handleCreateOrEditLongformFromSelection = () => {
    const nextLongform = buildLongformFromSelection(longformPack);
    if (!nextLongform) return;

    updateLongformPack(nextLongform);
    openLongformSheet(nextLongform);
    onLongformSelectedIdsChange(new Set(nextLongform.sentence_ids));
  };

  const handleOpenLongformSheet = () => {
    if (!longformPack) return;
    openLongformSheet(longformPack);
  };

  const handleSaveLongformSheet = () => {
    const baseLongform = longformPack ?? buildLongformFromSelection(null);
    if (!baseLongform) return;

    updateLongformPack({
      ...baseLongform,
      title: longformEditTitle.trim() || baseLongform.title,
      subtitle: longformEditSubtitle.trim(),
      description: longformEditDescription.trim(),
      speaker_summary: longformEditSpeakerSummary.trim(),
      talk_summary: longformEditTalkSummary.trim(),
      topic_tags: parseTagInput(longformEditTopicTags),
      content_tags: parseTagInput(longformEditContentTags),
      context: {
        ...longformEditContext,
        speaker_snapshot: longformEditContext.speaker_snapshot.trim(),
        conversation_type: longformEditContext.conversation_type.trim(),
        core_topics: (longformEditContext.core_topics ?? [])
          .map((item) => item.trim())
          .filter(Boolean),
        why_this_segment: longformEditContext.why_this_segment.trim(),
        listening_takeaway: longformEditContext.listening_takeaway.trim(),
        generated_by: longformEditContext.generated_by ?? "manual",
      },
      updated_at: new Date().toISOString(),
    });
    setIsLongformSheetOpen(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    setCreatedSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleOverwriteSessionSentences = (sessionId: string) => {
    if (sortedSelectedSentences.length === 0) return;
    const targetSession = createdSessions.find(
      (session) => session.id === sessionId,
    );
    if (!targetSession) return;

    const start = sortedSelectedSentences[0].startTime;
    const end =
      sortedSelectedSentences[sortedSelectedSentences.length - 1].endTime;
    setCreatedSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              sentence_ids: sortedSelectedSentences.map((sent) => sent.id),
              sentences: sortedSelectedSentences,
              start_time: start,
              end_time: end,
              duration: end - start,
            }
          : s,
      ),
    );

    const sessionBelongsToLongform =
      !!longformPack &&
      (targetSession.longform_pack_id === longformPack.id ||
        targetSession.sentence_ids.some((sentenceId) =>
          longformPack.sentence_ids.includes(sentenceId),
        ));

    if (longformPack && sessionBelongsToLongform) {
      updateLongformPack(
        syncLongformSelectionWithSessionOverwrite(
          longformPack,
          sentences,
          targetSession,
          sortedSelectedSentences,
        ),
      );
    }

    onShortformSelectedIdsChange(new Set());
  };

  const handleOpenEditSheet = (
    session: LearningSession,
    tab: "context" | "transformation" = "context",
  ) => {
    setEditingSession(session);
    setEditTitle(session.title);
    setEditSubtitle(session.subtitle || "");
    setEditDescription(session.description || "");
    setEditDifficulty(session.difficulty || "intermediate");
    setEditSourceType(session.source_type || "podcast");
    setEditGenre(session.genre ?? undefined);
    setEditSpeakingSituations(
      (session.speaking_situations as SpeakingSituation[]) ?? [],
    );
    setEditDifficultyLevel(
      session.difficulty_level as 1 | 2 | 3 | 4 | 5 | undefined,
    );
    setEditPremiumRequired(session.premium_required ?? true);
    setEditPrimarySpeakerName(
      session.primary_speaker_name || editPrimarySpeakerName || "",
    );
    setEditPrimarySpeakerId(
      session.primary_speaker_id || editPrimarySpeakerId || null,
    );
    setEditPrimarySpeakerSlug(
      session.primary_speaker_slug || editPrimarySpeakerSlug || null,
    );
    setEditPrimarySpeakerDescription(
      session.primary_speaker_description ||
        editPrimarySpeakerDescription ||
        "",
    );
    setEditPrimarySpeakerAvatarUrl(
      session.primary_speaker_avatar_url || editPrimarySpeakerAvatarUrl || "",
    );
    setEditContext(session.context ?? createEmptyContext());
    setEditTransformationPattern(null);
    setEditGeneratedTransformationSet(null);
    setEditGeneratedExercises([]);
    setEditTab(tab);
    setIsEditSheetOpen(true);
  };

  const handleSaveEditSession = () => {
    if (!editingSession) return;
    const speakerChoice = resolveSpeakerChoice(
      editPrimarySpeakerName,
      speakerOptions,
    );
    setEditPrimarySpeakerName(speakerChoice.name || "");
    setEditPrimarySpeakerId(speakerChoice.id);
    setEditPrimarySpeakerSlug(speakerChoice.slug);
    setCreatedSessions((prev) =>
      prev.map((s) =>
        s.id === editingSession.id
          ? {
              ...s,
              title: editTitle,
              subtitle: editSubtitle,
              description: editDescription,
              difficulty: editDifficulty,
              difficulty_level: editDifficultyLevel,
              speaking_situations: editSpeakingSituations,
              source_type: editSourceType,
              genre: editGenre,
              premium_required: editPremiumRequired,
              context: editContext,
              primary_speaker_id: speakerChoice.id,
              primary_speaker_name: speakerChoice.name,
              primary_speaker_slug: speakerChoice.slug,
              primary_speaker_description:
                editPrimarySpeakerDescription.trim() || null,
              primary_speaker_avatar_url:
                editPrimarySpeakerAvatarUrl.trim() || null,
            }
          : {
              ...s,
              primary_speaker_id: speakerChoice.id,
              primary_speaker_name: speakerChoice.name,
              primary_speaker_slug: speakerChoice.slug,
              primary_speaker_description:
                editPrimarySpeakerDescription.trim() || null,
              primary_speaker_avatar_url:
                editPrimarySpeakerAvatarUrl.trim() || null,
            },
      ),
    );
    setIsEditSheetOpen(false);
  };

  const handleCreateAndEditSession = () => {
    if (sortedSelectedSentences.length === 0) return;

    const newSession: LearningSession = {
      id: crypto.randomUUID(),
      source_video_id: videoId,
      longform_pack_id: longformPack?.id ?? null,
      title: "",
      description: "",
      start_time: sortedSelectedSentences[0].startTime,
      end_time:
        sortedSelectedSentences[sortedSelectedSentences.length - 1].endTime,
      duration: selectionDuration,
      sentence_ids: sortedSelectedSentences.map((s) => s.id),
      difficulty: "intermediate",
      order_index: createdSessions.length,
      source_type: "podcast",
      primary_speaker_id: editPrimarySpeakerId,
      primary_speaker_name: editPrimarySpeakerName.trim() || null,
      primary_speaker_slug: editPrimarySpeakerSlug,
      primary_speaker_description: editPrimarySpeakerDescription.trim() || null,
      primary_speaker_avatar_url: editPrimarySpeakerAvatarUrl.trim() || null,
      premium_required: true,
      created_at: new Date().toISOString(),
      sentences: sortedSelectedSentences,
      context: null,
    };

    setCreatedSessions((prev) => [...prev, newSession]);
    onShortformSelectedIdsChange(new Set());
    handleOpenEditSheet(newSession);
  };

  const handleGenerateAllForEdit = async () => {
    if (!editingSession) return;

    const sessionSentences = sentences.filter((s) =>
      editingSession.sentence_ids.includes(s.id),
    );
    if (sessionSentences.length === 0) return;

    setIsEditGeneratingAll(true);
    try {
      const transformationResponse = await fetch(
        "/api/admin/generate-transformation",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sessionId: editingSession.id,
            sentences: sessionSentences,
          }),
        },
      );

      if (!transformationResponse.ok) {
        const errorData = await transformationResponse.json();
        throw new Error(errorData.error || "Failed to generate transformation");
      }

      const transformationData = (await transformationResponse.json()) as {
        set: Partial<TransformationSet>;
        exercises: Partial<TransformationExercise>[];
      };

      const targetPattern = transformationData.set.target_pattern ?? null;
      setEditTransformationPattern(targetPattern);
      setEditGeneratedTransformationSet(transformationData.set);
      setEditGeneratedExercises(transformationData.exercises ?? []);

      const autofillResponse = await fetch("/api/admin/autofill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sentences: sessionSentences,
          videoTitle,
          targetPattern: targetPattern ?? undefined,
          primarySpeakerName: editPrimarySpeakerName.trim() || undefined,
        }),
      });

      if (!autofillResponse.ok) {
        const errorData = await autofillResponse.json();
        throw new Error(
          errorData.error || "Failed to autofill session details",
        );
      }

      const autofillData = await autofillResponse.json();
      setEditSubtitle(autofillData.subtitle || "");
      if (autofillData.sourceType) setEditSourceType(autofillData.sourceType);
      if (autofillData.genre) setEditGenre(autofillData.genre);
      if (Array.isArray(autofillData.speakingSituations))
        setEditSpeakingSituations(autofillData.speakingSituations);
      if (autofillData.difficultyLevel)
        setEditDifficultyLevel(autofillData.difficultyLevel);

      const contextResponse = await fetch(
        "/api/admin/generate-session-context",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: editTitle,
            description: editDescription,
            sentences: sessionSentences,
            targetPattern: targetPattern ?? undefined,
          }),
        },
      );

      if (!contextResponse.ok) {
        const errorData = await contextResponse.json();
        throw new Error(errorData.error || "Failed to generate context");
      }

      const contextData = (await contextResponse.json()) as {
        context: SessionContext;
        subtitle?: string;
      };

      setEditContext(contextData.context);
      // Don't overwrite subtitle when targetPattern is set — autofill already
      // crafted it specifically to contain the pattern.
      if (contextData.subtitle && !targetPattern?.trim()) {
        setEditSubtitle(contextData.subtitle);
      }
    } catch (error) {
      console.error("Generate all for edit error:", error);
      alert(
        "변형문제, 기본정보, 프리러닝 컨텍스트를 한 번에 생성하지 못했습니다. 다시 시도해주세요.",
      );
    } finally {
      setIsEditGeneratingAll(false);
    }
  };

  const buildSuggestedSession = (
    scene: SceneRecommendation,
    orderIndex: number,
  ): LearningSession => {
    const sceneSentences = sentences.slice(
      scene.startIndex,
      scene.endIndex + 1,
    );

    if (sceneSentences.length === 0) {
      return {
        id: crypto.randomUUID(),
        source_video_id: videoId,
        longform_pack_id: longformPack?.id ?? null,
        title: scene.title,
        description: scene.reason,
        start_time: 0,
        end_time: 0,
        duration: 0,
        sentence_ids: [],
        difficulty: "intermediate" as const,
        order_index: orderIndex,
        source_type: "podcast" as const,
        primary_speaker_id: editPrimarySpeakerId,
        primary_speaker_name: editPrimarySpeakerName.trim() || null,
        primary_speaker_slug: editPrimarySpeakerSlug,
        primary_speaker_description:
          editPrimarySpeakerDescription.trim() || null,
        primary_speaker_avatar_url: editPrimarySpeakerAvatarUrl.trim() || null,
        premium_required: true,
        created_at: new Date().toISOString(),
        sentences: [],
        context: null,
      };
    }

    return {
      id: crypto.randomUUID(),
      source_video_id: videoId,
      longform_pack_id: longformPack?.id ?? null,
      title: scene.title,
      description: scene.reason,
      start_time: sceneSentences[0].startTime,
      end_time: sceneSentences[sceneSentences.length - 1].endTime,
      duration: scene.estimatedDuration,
      sentence_ids: sceneSentences.map((s) => s.id),
      difficulty: "intermediate" as const,
      order_index: orderIndex,
      source_type: "podcast" as const,
      primary_speaker_id: editPrimarySpeakerId,
      primary_speaker_name: editPrimarySpeakerName.trim() || null,
      primary_speaker_slug: editPrimarySpeakerSlug,
      primary_speaker_description: editPrimarySpeakerDescription.trim() || null,
      primary_speaker_avatar_url: editPrimarySpeakerAvatarUrl.trim() || null,
      premium_required: true,
      created_at: new Date().toISOString(),
      sentences: sceneSentences,
      context: null,
    };
  };

  const handleUseSuggestion = (scene: SceneRecommendation) => {
    const newSession = buildSuggestedSession(scene, createdSessions.length);
    setCreatedSessions((prev) => [...prev, newSession]);
    setIsSuggestionModalOpen(false);
    handleOpenEditSheet(newSession);
  };

  const handleCreateSuggestion = (scene: SceneRecommendation) => {
    setCreatedSessions((prev) => [
      ...prev,
      buildSuggestedSession(scene, prev.length),
    ]);
    setIsSuggestionModalOpen(false);
  };

  const handleUseAllSuggestions = () => {
    const newSessions = suggestedScenes.map((scene, idx) =>
      buildSuggestedSession(scene, createdSessions.length + idx),
    );
    setCreatedSessions([...createdSessions, ...newSessions]);
    setIsSuggestionModalOpen(false);
  };

  const updateLongformPack = (
    updater:
      | LongformPack
      | null
      | ((prev: LongformPack | null) => LongformPack | null),
  ) => {
    if (typeof updater === "function") {
      onLongformPackChange?.((prev) => {
        const next = updater(prev);
        onLongformSelectedIdsChange(new Set(next?.sentence_ids ?? []));
        return next;
      });
      return;
    }

    onLongformSelectedIdsChange(new Set(updater?.sentence_ids ?? []));
    onLongformPackChange?.(updater);
  };

  const handleAutofillLongform = async () => {
    if (!longformPack) return;

    const longformSentences = sentences.filter((sentence) =>
      longformPack.sentence_ids.includes(sentence.id),
    );

    if (longformSentences.length === 0) return;

    setIsLongformAutofilling(true);
    try {
      const primarySpeakerName =
        longformPack.primary_speaker_name ||
        createdSessions.find((session) => session.primary_speaker_name)
          ?.primary_speaker_name ||
        editPrimarySpeakerName.trim() ||
        undefined;

      const response = await fetch("/api/admin/autofill-longform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sentences: longformSentences,
          videoTitle,
          primarySpeakerName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to autofill longform");
      }

      const data = await response.json();
      setLongformEditTitle(data.title);
      setLongformEditSubtitle(data.subtitle || "");
      setLongformEditDescription(data.description || "");
      setLongformEditSpeakerSummary(data.speakerSummary || "");
      setLongformEditTalkSummary(data.talkSummary || "");
      setLongformEditTopicTags((data.topicTags ?? []).join(", "));
      setLongformEditContentTags((data.contentTags ?? []).join(", "));
      updateLongformPack((prev) =>
        prev
          ? {
              ...prev,
              title: data.title,
              subtitle: data.subtitle,
              description: data.description,
              speaker_summary: data.speakerSummary,
              talk_summary: data.talkSummary,
              topic_tags: data.topicTags ?? [],
              content_tags: data.contentTags ?? [],
            }
          : prev,
      );
    } catch (error) {
      console.error("Longform autofill error:", error);
      alert("롱폼 기본정보 자동 완성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLongformAutofilling(false);
    }
  };

  const handleGenerateLongformContext = async () => {
    if (!longformPack) return;

    const longformSentences = sentences.filter((sentence) =>
      longformPack.sentence_ids.includes(sentence.id),
    );

    if (longformSentences.length === 0) return;

    setIsLongformGeneratingContext(true);
    try {
      const primarySpeakerName =
        longformPack.primary_speaker_name ||
        createdSessions.find((session) => session.primary_speaker_name)
          ?.primary_speaker_name ||
        editPrimarySpeakerName.trim() ||
        undefined;

      const response = await fetch("/api/admin/generate-longform-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: longformEditTitle.trim() || longformPack.title,
          description:
            longformEditDescription.trim() || longformPack.description,
          sentences: longformSentences,
          primarySpeakerName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to generate longform context",
        );
      }

      const data = (await response.json()) as {
        context: LongformPack["context"];
      };
      setLongformEditContext(data.context ?? createEmptyLongformContext());
      updateLongformPack((prev) =>
        prev
          ? {
              ...prev,
              title: longformEditTitle.trim() || prev.title,
              subtitle: longformEditSubtitle.trim() || prev.subtitle,
              description: longformEditDescription.trim() || prev.description,
              speaker_summary:
                longformEditSpeakerSummary.trim() || prev.speaker_summary,
              talk_summary: longformEditTalkSummary.trim() || prev.talk_summary,
              topic_tags: parseTagInput(longformEditTopicTags),
              content_tags: parseTagInput(longformEditContentTags),
              context: data.context ?? null,
            }
          : prev,
      );
    } catch (error) {
      console.error("Longform context generation error:", error);
      alert("롱폼 컨텍스트 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLongformGeneratingContext(false);
    }
  };

  const handleGenerateAllForLongform = async () => {
    if (!longformPack) return;

    const longformSentences = sentences.filter((sentence) =>
      longformPack.sentence_ids.includes(sentence.id),
    );

    if (longformSentences.length === 0) return;

    setIsLongformGeneratingAll(true);
    try {
      const primarySpeakerName =
        longformPack.primary_speaker_name ||
        createdSessions.find((session) => session.primary_speaker_name)
          ?.primary_speaker_name ||
        editPrimarySpeakerName.trim() ||
        undefined;

      const autofillResponse = await fetch("/api/admin/autofill-longform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sentences: longformSentences,
          videoTitle,
          primarySpeakerName,
        }),
      });

      if (!autofillResponse.ok) {
        const errorData = await autofillResponse.json();
        throw new Error(errorData.error || "Failed to autofill longform");
      }

      const autofillData = await autofillResponse.json();
      setLongformEditTitle(autofillData.title);
      setLongformEditSubtitle(autofillData.subtitle || "");
      setLongformEditDescription(autofillData.description || "");
      setLongformEditSpeakerSummary(autofillData.speakerSummary || "");
      setLongformEditTalkSummary(autofillData.talkSummary || "");
      setLongformEditTopicTags((autofillData.topicTags ?? []).join(", "));
      setLongformEditContentTags((autofillData.contentTags ?? []).join(", "));

      const contextResponse = await fetch(
        "/api/admin/generate-longform-context",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: autofillData.title,
            description: autofillData.description,
            sentences: longformSentences,
            primarySpeakerName,
          }),
        },
      );

      if (!contextResponse.ok) {
        const errorData = await contextResponse.json();
        throw new Error(
          errorData.error || "Failed to generate longform context",
        );
      }

      const contextData = (await contextResponse.json()) as {
        context: LongformContext;
      };

      setLongformEditContext(contextData.context);
      updateLongformPack((prev) =>
        prev
          ? {
              ...prev,
              title: autofillData.title,
              subtitle: autofillData.subtitle,
              description: autofillData.description,
              speaker_summary: autofillData.speakerSummary,
              talk_summary: autofillData.talkSummary,
              topic_tags: autofillData.topicTags ?? [],
              content_tags: autofillData.contentTags ?? [],
              context: contextData.context,
            }
          : prev,
      );
    } catch (error) {
      console.error("Longform generate all error:", error);
      alert(
        "롱폼 기본정보와 프리러닝 컨텍스트를 한 번에 생성하지 못했습니다. 다시 시도해주세요.",
      );
    } finally {
      setIsLongformGeneratingAll(false);
    }
  };

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden min-h-0"
      style={{
        backgroundColor: "#fafafa",
        gap: 0,
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          backgroundColor: "#fafafa",
          borderBottom: "1px solid #e5e5e5",
          padding: "6px 12px",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: "#0a0a0a" }}>
            {longformPack
              ? "Step 3: 포인트 쇼츠 만들기"
              : "Step 3: 세션 만들기"}
          </span>
          {suggestedScenes.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsSuggestionModalOpen(true)}
              className="flex items-center"
              style={{
                gap: 4,
                padding: "2px 8px",
                border: "1px solid #ddd6fe",
                backgroundColor: "#f5f3ff",
                color: "#6d28d9",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              <Sparkles className="w-3 h-3" />
              {longformPack
                ? `AI 추천 포인트 쇼츠 보기 (${suggestedScenes.length})`
                : `AI 추천 장면 보기 (${suggestedScenes.length})`}
            </button>
          ) : null}
        </div>
        <span className="text-xs" style={{ color: "#737373" }}>
          {createdSessions.length}개 생성됨
        </span>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
          {longformPack ? (
            <div
              className="shrink-0"
              style={{
                padding: "12px",
                borderBottom: "1px solid #e5e5e5",
                backgroundColor: "#f8fafc",
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              <div
                className="flex items-start justify-between"
                style={{ gap: 12, marginBottom: 10 }}
              >
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "#94a3b8", marginBottom: 4 }}
                  >
                    Parent Longform
                  </div>
                  <div
                    className="text-xs font-semibold"
                    style={{ color: "#0f172a" }}
                  >
                    롱폼 먼저 정리하고, 그 아래 쇼츠를 붙입니다
                  </div>
                </div>
                <div
                  className="flex items-center justify-end flex-wrap"
                  style={{ gap: 6 }}
                >
                  {longformSelectedIds.size > 0 ? (
                    <button
                      type="button"
                      onClick={handleCreateOrEditLongformFromSelection}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #fde68a",
                        backgroundColor: "#fffbeb",
                        color: "#b45309",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      선택 범위로 롱폼 덮어쓰기
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleOpenLongformSheet}
                    style={{
                      padding: "4px 8px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#ffffff",
                      color: "#334155",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    롱폼 편집
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAllForLongform}
                    disabled={isLongformGeneratingAll}
                    style={{
                      padding: "4px 8px",
                      border: "1px solid #dbeafe",
                      backgroundColor: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: isLongformGeneratingAll
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {isLongformGeneratingAll ? "생성 중..." : "AI 한 번에 생성"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "#0f172a" }}
                  >
                    {longformPack.title}
                  </div>
                  {longformPack.subtitle ? (
                    <div className="text-xs" style={{ color: "#475569" }}>
                      {longformPack.subtitle}
                    </div>
                  ) : null}
                  {longformPack.description ? (
                    <div
                      className="text-xs leading-5"
                      style={{ color: "#334155" }}
                    >
                      {longformPack.description}
                    </div>
                  ) : null}
                  <div
                    className="flex flex-wrap text-[10px]"
                    style={{ gap: 6, color: "#64748b" }}
                  >
                    <span>
                      {Math.floor(longformPack.duration / 60)}:
                      {String(Math.floor(longformPack.duration % 60)).padStart(
                        2,
                        "0",
                      )}
                    </span>
                    {longformPack.talk_summary ? (
                      <span>{longformPack.talk_summary}</span>
                    ) : null}
                    {longformPack.speaker_summary ? (
                      <span>{longformPack.speaker_summary}</span>
                    ) : null}
                  </div>
                </div>

                <div
                  className="flex flex-wrap text-[11px]"
                  style={{ gap: 6, color: "#64748b" }}
                >
                  <span>
                    롱폼 선택 {longformSelectedIds.size}문장
                    {longformSelectedIds.size > 0
                      ? ` · ${Math.floor(longformSelectionDuration / 60)}:${String(
                          Math.floor(longformSelectionDuration % 60),
                        ).padStart(2, "0")}`
                      : ""}
                  </span>
                </div>

                {(longformPack.topic_tags?.length ?? 0) > 0 ||
                (longformPack.content_tags?.length ?? 0) > 0 ? (
                  <div
                    className="flex flex-wrap text-[11px]"
                    style={{ gap: 6 }}
                  >
                    {(longformPack.topic_tags ?? []).map((tag) => (
                      <span
                        key={`topic-${tag}`}
                        style={{
                          padding: "4px 8px",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                          color: "#334155",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {(longformPack.content_tags ?? []).map((tag) => (
                      <span
                        key={`content-${tag}`}
                        style={{
                          padding: "4px 8px",
                          border: "1px solid #dbeafe",
                          backgroundColor: "#eff6ff",
                          color: "#1d4ed8",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {longformPack.context ? (
                <div
                  className="text-[11px]"
                  style={{
                    marginTop: 10,
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: 10,
                    color: "#334155",
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <strong>화자:</strong>{" "}
                    {longformPack.context.speaker_snapshot}
                  </div>
                  <div>
                    <strong>토크 유형:</strong>{" "}
                    {longformPack.context.conversation_type}
                  </div>
                  <div>
                    <strong>핵심 토픽:</strong>{" "}
                    {(longformPack.context.core_topics ?? []).join(", ")}
                  </div>
                  <div>
                    <strong>왜 이 구간인가:</strong>{" "}
                    {longformPack.context.why_this_segment}
                  </div>
                  <div>
                    <strong>청취 takeaway:</strong>{" "}
                    {longformPack.context.listening_takeaway}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Create Session Bar */}
          <div
            className="shrink-0 flex items-center justify-between"
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid #e5e5e5",
              backgroundColor:
                shortformSelectedIds.size > 0 || longformSelectedIds.size > 0
                  ? "#fafafa"
                  : "#ffffff",
              minHeight: 36,
            }}
          >
            {shortformSelectedIds.size > 0 ? (
              <>
                <span className="text-xs" style={{ color: "#525252" }}>
                  <span style={{ fontWeight: 600, color: "#0a0a0a" }}>
                    {shortformSelectedIds.size}문장
                  </span>{" "}
                  선택됨
                  <span
                    className="font-mono ml-2"
                    style={{ color: "#a3a3a3", fontSize: 10 }}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    {Math.floor(selectionDuration / 60)}:
                    {String(Math.floor(selectionDuration % 60)).padStart(
                      2,
                      "0",
                    )}
                  </span>
                </span>
                <div className="flex items-center" style={{ gap: 8 }}>
                  {!longformPack && longformSelectedIds.size > 0 ? (
                    <button
                      type="button"
                      onClick={handleCreateOrEditLongformFromSelection}
                      className="flex items-center"
                      style={{
                        gap: 4,
                        padding: "3px 10px",
                        backgroundColor: "#ffffff",
                        color: "#b45309",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "1px solid #fde68a",
                        cursor: "pointer",
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      선택 범위로 롱폼 만들기
                    </button>
                  ) : null}
                  <button
                    onClick={handleCreateAndEditSession}
                    className="flex items-center"
                    style={{
                      gap: 4,
                      padding: "3px 10px",
                      backgroundColor: "#0a0a0a",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#404040";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#0a0a0a";
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    {longformPack ? "포인트 쇼츠 만들기" : "세션 만들기"}
                  </button>
                </div>
              </>
            ) : !longformPack && longformSelectedIds.size > 0 ? (
              <>
                <span className="text-xs" style={{ color: "#525252" }}>
                  <span style={{ fontWeight: 600, color: "#0a0a0a" }}>
                    롱폼 {longformSelectedIds.size}문장
                  </span>{" "}
                  선택됨
                  <span
                    className="font-mono ml-2"
                    style={{ color: "#a3a3a3", fontSize: 10 }}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    {Math.floor(longformSelectionDuration / 60)}:
                    {String(
                      Math.floor(longformSelectionDuration % 60),
                    ).padStart(2, "0")}
                  </span>
                </span>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleCreateOrEditLongformFromSelection}
                    className="flex items-center"
                    style={{
                      gap: 4,
                      padding: "3px 10px",
                      backgroundColor: "#ffffff",
                      color: "#b45309",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "1px solid #fde68a",
                      cursor: "pointer",
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    선택 범위로 롱폼 만들기
                  </button>
                </div>
              </>
            ) : (
              <span className="text-[11px]" style={{ color: "#a3a3a3" }}>
                {longformPack
                  ? "왼쪽에서 쇼츠 선택으로 문장을 고르면 이 롱폼 아래 포인트 쇼츠를 만들 수 있어요"
                  : "왼쪽에서 롱폼 선택으로 문장을 고른 뒤 롱폼을 만들거나, 쇼츠 선택으로 세션을 만들 수 있어요"}
              </span>
            )}
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto">
            <div
              className="shrink-0 flex items-center"
              style={{ padding: "4px 12px", borderBottom: "1px solid #f0f0f0" }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#a3a3a3" }}
              >
                {longformPack
                  ? `Point Shorts (${createdSessions.length})`
                  : `Sessions (${createdSessions.length})`}
              </span>
            </div>
            {createdSessions.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{ padding: 24, color: "#d4d4d4" }}
              >
                <p className="text-xs">No sessions yet</p>
              </div>
            ) : (
              createdSessions.map((session, idx) => (
                <div
                  key={session.id}
                  className="flex items-start group transition-colors"
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #f5f5f5",
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedSessionIds.has(session.id)}
                    onChange={() => toggleSessionCheck(session.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: 3,
                      accentColor: "#3b82f6",
                      cursor: "pointer",
                    }}
                    title="트랜스크립트에서 해당 구간 표시"
                  />
                  <span
                    className="shrink-0 text-[10px] font-mono"
                    style={{ color: "#a3a3a3", paddingTop: 2 }}
                  >
                    #{idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-medium truncate"
                      style={{ color: "#0a0a0a" }}
                    >
                      {session.title}
                    </div>
                    {session.subtitle ? (
                      <div
                        className="text-[10px] truncate"
                        style={{ color: "#6d28d9", marginTop: 1 }}
                      >
                        {session.subtitle}
                      </div>
                    ) : null}
                    <div
                      className="flex items-center text-[10px]"
                      style={{ gap: 6, color: "#a3a3a3", marginTop: 2 }}
                    >
                      <span className="font-mono">
                        {Math.floor(session.duration / 60)}:
                        {String(Math.floor(session.duration % 60)).padStart(
                          2,
                          "0",
                        )}
                      </span>
                      <span>{session.sentence_ids.length} sent.</span>
                      <span className="capitalize">{session.difficulty}</span>
                      {session.source_type ? (
                        <span>{SOURCE_TYPE_LABELS[session.source_type]}</span>
                      ) : null}
                      {session.genre ? (
                        <span>{GENRE_LABELS[session.genre]}</span>
                      ) : null}
                      {session.primary_speaker_name ? (
                        <span>{session.primary_speaker_name}</span>
                      ) : null}
                      {session.premium_required ? <span>Premium</span> : null}
                      {session.context ? <span>Context</span> : null}
                    </div>
                  </div>
                  <div
                    className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ gap: 2 }}
                  >
                    {shortformSelectedIds.size > 0 && (
                      <button
                        onClick={() =>
                          handleOverwriteSessionSentences(session.id)
                        }
                        title="선택된 문장으로 이 세션의 범위를 덮어씁니다"
                        style={{
                          padding: "2px 8px",
                          color: "#d97706",
                          fontSize: 10,
                          fontWeight: 600,
                          border: "1px solid #fde68a",
                          backgroundColor: "#fffbeb",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#fef3c7";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#fffbeb";
                        }}
                      >
                        <RefreshCw className="w-3 h-3" />
                        선택 범위로 덮어쓰기
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditSheet(session)}
                      title="세션 편집하기"
                      style={{
                        padding: "2px 8px",
                        color: "#525252",
                        fontSize: 10,
                        fontWeight: 600,
                        border: "1px solid #e5e5e5",
                        backgroundColor: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
                      세션 편집하기
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      style={{ padding: 2, color: "#a3a3a3" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ef4444";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#a3a3a3";
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Longform Edit Sheet */}
      <Sheet open={isLongformSheetOpen} onOpenChange={setIsLongformSheetOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-[760px] gap-0 border-l border-[#e5e5e5] bg-white p-0 sm:max-w-[760px] flex flex-col"
        >
          <SheetHeader className="shrink-0 border-b border-[#e5e5e5] px-6 py-4">
            <SheetTitle className="text-sm font-bold text-[#0a0a0a]">
              {longformEditTitle || "롱폼 편집하기"}
            </SheetTitle>
            <SheetDescription className="text-xs text-[#737373]">
              롱폼 기본정보와 프리러닝 컨텍스트를 정리합니다.
            </SheetDescription>
          </SheetHeader>

          <div
            className="flex-1 overflow-y-auto"
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "#a3a3a3" }}
                >
                  롱폼 기본 정보
                </span>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleGenerateAllForLongform}
                    disabled={isLongformGeneratingAll}
                    className="flex items-center"
                    style={{
                      gap: 4,
                      padding: "3px 10px",
                      backgroundColor: isLongformGeneratingAll
                        ? "#d4d4d4"
                        : "#2563eb",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "none",
                      cursor: isLongformGeneratingAll
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {isLongformGeneratingAll ? "생성 중..." : "AI 한 번에 생성"}
                  </button>
                  <button
                    type="button"
                    onClick={handleAutofillLongform}
                    disabled={isLongformAutofilling}
                    className="flex items-center"
                    style={{
                      gap: 4,
                      padding: "3px 10px",
                      backgroundColor: isLongformAutofilling
                        ? "#d4d4d4"
                        : "#8b5cf6",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "none",
                      cursor: isLongformAutofilling ? "not-allowed" : "pointer",
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {isLongformAutofilling ? "생성 중..." : "기본정보 채우기"}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateLongformContext}
                    disabled={
                      isLongformGeneratingContext || !longformEditTitle.trim()
                    }
                    style={{
                      padding: "3px 10px",
                      border: "none",
                      backgroundColor:
                        isLongformGeneratingContext || !longformEditTitle.trim()
                          ? "#d4d4d4"
                          : "#2563eb",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor:
                        isLongformGeneratingContext || !longformEditTitle.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {isLongformGeneratingContext
                      ? "생성 중..."
                      : "컨텍스트 생성"}
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={longformEditTitle}
                onChange={(e) => setLongformEditTitle(e.target.value)}
                placeholder="롱폼 제목"
                className="w-full text-sm focus:outline-none"
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e5e5",
                  color: "#0a0a0a",
                  backgroundColor: "#ffffff",
                }}
              />
              <input
                type="text"
                value={longformEditSubtitle}
                onChange={(e) => setLongformEditSubtitle(e.target.value)}
                placeholder="롱폼 서브타이틀"
                className="w-full text-sm focus:outline-none"
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                  backgroundColor: "#ffffff",
                }}
              />
              <textarea
                value={longformEditDescription}
                onChange={(e) => setLongformEditDescription(e.target.value)}
                placeholder="롱폼 설명"
                rows={3}
                className="w-full text-sm focus:outline-none resize-none"
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                  backgroundColor: "#ffffff",
                  lineHeight: 1.6,
                }}
              />

              <div className="grid grid-cols-2" style={{ gap: 12 }}>
                <textarea
                  value={longformEditSpeakerSummary}
                  onChange={(e) =>
                    setLongformEditSpeakerSummary(e.target.value)
                  }
                  placeholder="화자 요약"
                  rows={3}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                    backgroundColor: "#ffffff",
                    lineHeight: 1.6,
                  }}
                />
                <textarea
                  value={longformEditTalkSummary}
                  onChange={(e) => setLongformEditTalkSummary(e.target.value)}
                  placeholder="이 토크가 어떤 형식인지"
                  rows={3}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                    backgroundColor: "#ffffff",
                    lineHeight: 1.6,
                  }}
                />
              </div>

              <div className="grid grid-cols-2" style={{ gap: 12 }}>
                <textarea
                  value={longformEditTopicTags}
                  onChange={(e) => setLongformEditTopicTags(e.target.value)}
                  placeholder="주제 태그를 쉼표나 줄바꿈으로 구분"
                  rows={3}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                    backgroundColor: "#ffffff",
                    lineHeight: 1.6,
                  }}
                />
                <textarea
                  value={longformEditContentTags}
                  onChange={(e) => setLongformEditContentTags(e.target.value)}
                  placeholder="콘텐츠 태그를 쉼표나 줄바꿈으로 구분"
                  rows={3}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                    backgroundColor: "#ffffff",
                    lineHeight: 1.6,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: 16,
                border: "1px solid #e5e5e5",
                backgroundColor: "#fcfcfc",
              }}
            >
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "#737373" }}
              >
                롱폼 프리러닝 컨텍스트
              </span>

              <label className="flex flex-col" style={{ gap: 6 }}>
                <span
                  className="text-xs font-medium"
                  style={{ color: "#525252" }}
                >
                  화자 스냅샷
                </span>
                <textarea
                  value={longformEditContext.speaker_snapshot}
                  onChange={(e) =>
                    setLongformEditContext((prev) => ({
                      ...prev,
                      speaker_snapshot: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                  }}
                />
              </label>

              <label className="flex flex-col" style={{ gap: 6 }}>
                <span
                  className="text-xs font-medium"
                  style={{ color: "#525252" }}
                >
                  토크 형식
                </span>
                <input
                  type="text"
                  value={longformEditContext.conversation_type}
                  onChange={(e) =>
                    setLongformEditContext((prev) => ({
                      ...prev,
                      conversation_type: e.target.value,
                    }))
                  }
                  className="w-full text-sm focus:outline-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                  }}
                />
              </label>

              <label className="flex flex-col" style={{ gap: 6 }}>
                <span
                  className="text-xs font-medium"
                  style={{ color: "#525252" }}
                >
                  핵심 토픽
                </span>
                <textarea
                  value={arrayToMultiline(
                    longformEditContext.core_topics ?? [],
                  )}
                  onChange={(e) =>
                    setLongformEditContext((prev) => ({
                      ...prev,
                      core_topics: multilineToArray(e.target.value),
                    }))
                  }
                  placeholder="한 줄에 하나씩 입력"
                  rows={3}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                  }}
                />
              </label>

              <label className="flex flex-col" style={{ gap: 6 }}>
                <span
                  className="text-xs font-medium"
                  style={{ color: "#525252" }}
                >
                  왜 이 구간인가
                </span>
                <textarea
                  value={longformEditContext.why_this_segment}
                  onChange={(e) =>
                    setLongformEditContext((prev) => ({
                      ...prev,
                      why_this_segment: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                  }}
                />
              </label>

              <label className="flex flex-col" style={{ gap: 6 }}>
                <span
                  className="text-xs font-medium"
                  style={{ color: "#525252" }}
                >
                  리스닝 takeaway
                </span>
                <textarea
                  value={longformEditContext.listening_takeaway}
                  onChange={(e) =>
                    setLongformEditContext((prev) => ({
                      ...prev,
                      listening_takeaway: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                  }}
                />
              </label>
            </div>
          </div>

          <div
            className="shrink-0 flex items-center justify-end"
            style={{
              padding: "12px 24px",
              borderTop: "1px solid #e5e5e5",
              backgroundColor: "#fafafa",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setIsLongformSheetOpen(false)}
              style={{
                padding: "6px 16px",
                border: "1px solid #e5e5e5",
                backgroundColor: "#ffffff",
                color: "#525252",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveLongformSheet}
              style={{
                padding: "6px 16px",
                border: "none",
                backgroundColor: "#0a0a0a",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              저장
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Session Edit Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-[800px] gap-0 border-l border-[#e5e5e5] bg-white p-0 sm:max-w-[800px] flex flex-col"
        >
          <SheetHeader className="shrink-0 border-b border-[#e5e5e5] px-6 py-4">
            <SheetTitle className="text-sm font-bold text-[#0a0a0a]">
              {editTitle || "세션 편집하기"}
            </SheetTitle>
            <SheetDescription className="text-xs text-[#737373]">
              프리러닝 컨텍스트와 변형문제를 설정합니다.
            </SheetDescription>
          </SheetHeader>

          {/* Tab Menu */}
          <div
            className="shrink-0 flex"
            style={{ borderBottom: "1px solid #e5e5e5" }}
          >
            {(["context", "transformation"] as const).map((tab) => {
              const label =
                tab === "context" ? "프리러닝 컨텍스트" : "변형문제 생성";
              const isActive = editTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEditTab(tab)}
                  style={{
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#0a0a0a" : "#737373",
                    backgroundColor: "transparent",
                    border: "none",
                    borderBottom: isActive
                      ? "2px solid #0a0a0a"
                      : "2px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab: 프리러닝 컨텍스트 */}
          {editTab === "context" && editingSession && (
            <div
              className="flex-1 overflow-y-auto"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* 기본 정보 */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#a3a3a3" }}
                  >
                    기본 정보
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateAllForEdit}
                    disabled={isEditGeneratingAll}
                    className="flex items-center"
                    style={{
                      gap: 4,
                      padding: "3px 10px",
                      backgroundColor: isEditGeneratingAll
                        ? "#d4d4d4"
                        : "#2563eb",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "none",
                      cursor: isEditGeneratingAll ? "not-allowed" : "pointer",
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {isEditGeneratingAll ? "생성 중..." : "AI 채우기"}
                  </button>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="세션 제목 (영상 제목에서 요약)"
                  className="w-full text-sm focus:outline-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#0a0a0a",
                    backgroundColor: "#ffffff",
                  }}
                />
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  placeholder="서브타이틀 (핵심 표현/패턴)"
                  className="w-full text-xs focus:outline-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                    backgroundColor: "#fafafa",
                  }}
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="세션 설명"
                  rows={2}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                    backgroundColor: "#ffffff",
                  }}
                />
                <div className="grid grid-cols-3" style={{ gap: 12 }}>
                  <label className="flex flex-col" style={{ gap: 4 }}>
                    <span className="text-xs" style={{ color: "#737373" }}>
                      콘텐츠 형식
                    </span>
                    <select
                      value={editSourceType}
                      onChange={(e) =>
                        setEditSourceType(e.target.value as SessionSourceType)
                      }
                      className="text-sm focus:outline-none"
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #e5e5e5",
                        color: "#525252",
                      }}
                    >
                      {SESSION_SOURCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {SOURCE_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col" style={{ gap: 4 }}>
                    <span className="text-xs" style={{ color: "#737373" }}>
                      난이도
                    </span>
                    <select
                      value={editDifficulty}
                      onChange={(e) =>
                        setEditDifficulty(
                          e.target.value as
                            | "beginner"
                            | "intermediate"
                            | "advanced",
                        )
                      }
                      className="text-sm focus:outline-none"
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #e5e5e5",
                        color: "#525252",
                      }}
                    >
                      <option value="beginner">입문</option>
                      <option value="intermediate">중급</option>
                      <option value="advanced">고급</option>
                    </select>
                  </label>
                  <label className="flex flex-col" style={{ gap: 4 }}>
                    <span className="text-xs" style={{ color: "#737373" }}>
                      장르
                    </span>
                    <select
                      value={editGenre ?? ""}
                      onChange={(e) =>
                        setEditGenre(
                          e.target.value
                            ? (e.target.value as Genre)
                            : undefined,
                        )
                      }
                      className="text-sm focus:outline-none"
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #e5e5e5",
                        color: "#525252",
                      }}
                    >
                      <option value="">선택 안 함</option>
                      {GENRES.map((genre) => (
                        <option key={genre} value={genre}>
                          {GENRE_LABELS[genre]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-col" style={{ gap: 4 }}>
                  <span className="text-xs" style={{ color: "#737373" }}>
                    말하기 상황
                  </span>
                  <div className="flex flex-wrap" style={{ gap: 6 }}>
                    {SPEAKING_SITUATIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setEditSpeakingSituations((prev) =>
                            prev.includes(s)
                              ? prev.filter((x) => x !== s)
                              : [...prev, s],
                          )
                        }
                        className="text-xs"
                        style={{
                          padding: "4px 10px",
                          border: "1px solid",
                          borderColor: editSpeakingSituations.includes(s)
                            ? "#404040"
                            : "#e5e5e5",
                          backgroundColor: editSpeakingSituations.includes(s)
                            ? "#404040"
                            : "#ffffff",
                          color: editSpeakingSituations.includes(s)
                            ? "#ffffff"
                            : "#737373",
                          cursor: "pointer",
                        }}
                      >
                        {SPEAKING_SITUATION_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex flex-col" style={{ gap: 4 }}>
                  <span className="text-xs" style={{ color: "#737373" }}>
                    난이도 레벨 (1-5)
                  </span>
                  <div className="flex" style={{ gap: 6 }}>
                    {([1, 2, 3, 4, 5] as const).map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() =>
                          setEditDifficultyLevel(
                            editDifficultyLevel === lv ? undefined : lv,
                          )
                        }
                        className="text-xs"
                        style={{
                          width: 32,
                          height: 32,
                          border: "1px solid",
                          borderColor:
                            editDifficultyLevel === lv ? "#404040" : "#e5e5e5",
                          backgroundColor:
                            editDifficultyLevel === lv ? "#404040" : "#ffffff",
                          color:
                            editDifficultyLevel === lv ? "#ffffff" : "#737373",
                          cursor: "pointer",
                          fontWeight:
                            editDifficultyLevel === lv ? "600" : "400",
                        }}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "10px 12px",
                    border: "1px solid #e5e5e5",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <label className="flex flex-col" style={{ gap: 4 }}>
                    <span className="text-xs" style={{ color: "#737373" }}>
                      Key speaker
                    </span>
                    <input
                      type="text"
                      value={editPrimarySpeakerName}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setEditPrimarySpeakerName(nextValue);
                        const matchedSpeaker = resolveSpeakerChoice(
                          nextValue,
                          speakerOptions,
                        );
                        setEditPrimarySpeakerId(matchedSpeaker.id);
                        setEditPrimarySpeakerSlug(matchedSpeaker.slug);
                        if (matchedSpeaker.id) {
                          setEditPrimarySpeakerAvatarUrl(
                            matchedSpeaker.avatar_url || "",
                          );
                        }
                      }}
                      list="speaker-options"
                      placeholder="예: Simon Sinek"
                      className="w-full text-sm focus:outline-none"
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #e5e5e5",
                        color: "#525252",
                        backgroundColor: "#ffffff",
                      }}
                    />
                    <datalist id="speaker-options">
                      {speakerOptions.map((speaker) => (
                        <option key={speaker.id} value={speaker.name}>
                          {speaker.headline || speaker.organization || ""}
                        </option>
                      ))}
                    </datalist>
                  </label>
                  <span
                    className="text-[11px]"
                    style={{ color: "#737373", lineHeight: 1.5 }}
                  >
                    이 값은 세션 단위가 아니라 현재 영상 전체의 대표 speaker로
                    저장됩니다. 기존 speaker가 없으면 저장 시 자동으로
                    생성합니다.
                  </span>
                  <textarea
                    value={editPrimarySpeakerDescription}
                    onChange={(e) =>
                      setEditPrimarySpeakerDescription(e.target.value)
                    }
                    placeholder="이 인물의 말하기 특징이나, 이 사람을 통해 뭘 배울 수 있는지 적어주세요."
                    rows={3}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                      backgroundColor: "#fafafa",
                      lineHeight: 1.6,
                    }}
                  />
                  <input
                    type="url"
                    value={editPrimarySpeakerAvatarUrl}
                    onChange={(e) =>
                      setEditPrimarySpeakerAvatarUrl(e.target.value)
                    }
                    placeholder="https://... speaker thumbnail URL"
                    className="w-full text-sm focus:outline-none"
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                      backgroundColor: "#fafafa",
                    }}
                  />
                </div>
                <label
                  className="flex items-center justify-between text-sm"
                  style={{
                    border: "1px solid #e5e5e5",
                    padding: "8px 12px",
                    color: "#525252",
                  }}
                >
                  <span>프리미엄 브리프 잠금</span>
                  <input
                    type="checkbox"
                    checked={editPremiumRequired}
                    onChange={(e) => setEditPremiumRequired(e.target.checked)}
                  />
                </label>
              </div>

              {/* 프리러닝 컨텍스트 */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 16,
                  border: "1px solid #e5e5e5",
                  backgroundColor: "#fcfcfc",
                }}
              >
                {editTransformationPattern && (
                  <div
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#15803d",
                      fontSize: 11,
                      lineHeight: 1.5,
                      marginBottom: 8,
                    }}
                  >
                    변형연습 패턴{" "}
                    <strong>{`'${editTransformationPattern}'`}</strong>이
                    선택되었어요. 아래 버튼으로 컨텍스트를 생성하면 이 패턴
                    중심으로 브리핑이 만들어집니다.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#737373" }}
                  >
                    프리러닝 컨텍스트
                  </span>
                </div>

                <label className="flex flex-col" style={{ gap: 6 }}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#525252" }}
                  >
                    학습 기대 효과
                  </span>
                  <textarea
                    value={editContext.expected_takeaway}
                    onChange={(e) =>
                      setEditContext((prev) => ({
                        ...prev,
                        expected_takeaway: e.target.value,
                      }))
                    }
                    placeholder="학습 후 기대 효과를 적어주세요"
                    rows={3}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                    }}
                  />
                </label>

                <label className="flex flex-col" style={{ gap: 6 }}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#525252" }}
                  >
                    문법/수사 메모
                  </span>
                  <textarea
                    value={editContext.grammar_rhetoric_note}
                    onChange={(e) =>
                      setEditContext((prev) => ({
                        ...prev,
                        grammar_rhetoric_note: e.target.value,
                      }))
                    }
                    placeholder="문법/수사 메모"
                    rows={2}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                    }}
                  />
                </label>

                <label className="flex flex-col" style={{ gap: 6 }}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#525252" }}
                  >
                    재사용 가능한 상황
                  </span>
                  <textarea
                    value={arrayToMultiline(editContext.reusable_scenarios)}
                    onChange={(e) =>
                      setEditContext((prev) => ({
                        ...prev,
                        reusable_scenarios: multilineToArray(e.target.value),
                      }))
                    }
                    placeholder="한 줄에 하나씩 입력"
                    rows={4}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                    }}
                  />
                </label>

                <label className="flex flex-col" style={{ gap: 6 }}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#525252" }}
                  >
                    핵심 표현
                  </span>
                  <textarea
                    value={vocabToMultiline(editContext.key_vocabulary)}
                    onChange={(e) =>
                      setEditContext((prev) => ({
                        ...prev,
                        key_vocabulary: multilineToVocab(e.target.value),
                      }))
                    }
                    placeholder="표현 — 예문 — 번역 (한 줄에 하나씩)"
                    rows={5}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                      fontFamily: "monospace",
                      fontSize: 12,
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Tab: 변형문제 생성 */}
          {editTab === "transformation" && editingSession && (
            <div className="flex-1 overflow-y-auto" style={{ padding: 0 }}>
              <TransformationExerciseEditor
                sessionId={editingSession.id}
                sentences={sentences.filter((s) =>
                  editingSession.sentence_ids.includes(s.id),
                )}
                isSaved={persistedSessionIds.has(editingSession.id)}
                onSaved={() => setEditTab("context")}
                onPatternGenerated={setEditTransformationPattern}
                seedSet={editGeneratedTransformationSet}
                seedExercises={editGeneratedExercises}
              />
            </div>
          )}

          {/* Footer */}
          {editTab === "context" && (
            <div
              className="shrink-0 flex items-center justify-end"
              style={{
                padding: "12px 24px",
                borderTop: "1px solid #e5e5e5",
                backgroundColor: "#fafafa",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setIsEditSheetOpen(false)}
                style={{
                  padding: "6px 16px",
                  border: "1px solid #e5e5e5",
                  backgroundColor: "#ffffff",
                  color: "#525252",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEditSession}
                style={{
                  padding: "6px 16px",
                  border: "none",
                  backgroundColor: "#0a0a0a",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                저장
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={isSuggestionModalOpen}
        onOpenChange={setIsSuggestionModalOpen}
      >
        <SheetContent
          side="right"
          className="w-full max-w-[720px] gap-0 border-l border-[#e5e5e5] bg-white p-0 sm:max-w-[720px]"
        >
          <SheetHeader className="border-b border-[#e5e5e5] px-6 py-5">
            <SheetTitle className="flex items-center gap-2 text-[#0a0a0a]">
              <Sparkles className="h-4 w-4 text-purple-600" />
              {longformPack ? "AI 추천 포인트 쇼츠" : "AI 추천 장면"}
            </SheetTitle>
            <SheetDescription className="text-[#525252]">
              {longformPack
                ? "현재 롱폼 안에서 학습 포인트가 또렷한 쇼츠만 골랐습니다."
                : "말하기 목적이 분명하고, 실무 세션으로 만들 가치가 높은 장면만 골랐습니다."}
            </SheetDescription>
          </SheetHeader>

          <div
            className="flex-1 overflow-y-auto"
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {longformPack ? (
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "#94a3b8" }}
                >
                  Parent Longform
                </div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: "#0f172a" }}
                >
                  {longformPack.title}
                </div>
                {longformPack.description ? (
                  <div
                    className="text-xs leading-5"
                    style={{ color: "#475569" }}
                  >
                    {longformPack.description}
                  </div>
                ) : null}
              </div>
            ) : null}

            {suggestedScenes.length === 0 ? (
              <div
                className="text-sm"
                style={{
                  color: "#737373",
                  border: "1px dashed #d4d4d4",
                  padding: 16,
                }}
              >
                아직 추천 장면이 없습니다. 먼저 `AI 세션 장면 분석`을
                실행하세요.
              </div>
            ) : (
              suggestedScenes.map((scene, idx) => {
                const start = sentences[scene.startIndex]?.startTime ?? 0;
                const end = sentences[scene.endIndex]?.endTime ?? 0;

                return (
                  <div
                    key={`${scene.startIndex}-${scene.endIndex}-${idx}`}
                    style={{
                      border: "1px solid #ddd6fe",
                      backgroundColor: "#faf5ff",
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: "#7c3aed" }}
                          >
                            {longformPack
                              ? `Short ${idx + 1}`
                              : `Scene ${idx + 1}`}
                          </span>
                          <span
                            className="text-[10px] font-mono"
                            style={{ color: "#737373" }}
                          >
                            {Math.floor(start / 60)}:
                            {String(Math.floor(start % 60)).padStart(2, "0")} -{" "}
                            {Math.floor(end / 60)}:
                            {String(Math.floor(end % 60)).padStart(2, "0")}
                          </span>
                        </div>
                        <h3
                          className="text-sm font-semibold"
                          style={{ color: "#0a0a0a" }}
                        >
                          {scene.title}
                        </h3>
                      </div>
                    </div>

                    <p
                      className="text-xs leading-5"
                      style={{ color: "#5b21b6" }}
                    >
                      {scene.reason}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {scene.learningPoints.map((point, pointIdx) => (
                        <span
                          key={`${scene.title}-${pointIdx}`}
                          style={{
                            border: "1px solid #e9d5ff",
                            backgroundColor: "#ffffff",
                            color: "#6d28d9",
                            fontSize: 11,
                            padding: "4px 8px",
                          }}
                        >
                          {point}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUseSuggestion(scene)}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #7c3aed",
                          backgroundColor: "#ffffff",
                          color: "#6d28d9",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {longformPack
                          ? "쇼츠 만들고 편집하기"
                          : "세션 만들고 편집하기"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateSuggestion(scene)}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #6d28d9",
                          backgroundColor: "#6d28d9",
                          color: "#ffffff",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {longformPack ? "바로 쇼츠 만들기" : "바로 세션 만들기"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {suggestedScenes.length > 0 ? (
            <div
              className="shrink-0 flex items-center justify-between"
              style={{
                padding: 16,
                borderTop: "1px solid #e5e5e5",
                backgroundColor: "#fafafa",
              }}
            >
              <span className="text-xs" style={{ color: "#737373" }}>
                {longformPack
                  ? "추천 포인트 쇼츠를 하나씩 고르거나 한 번에 만들 수 있습니다."
                  : "추천 장면을 하나씩 고르거나 한 번에 만들 수 있습니다."}
              </span>
              <button
                type="button"
                onClick={handleUseAllSuggestions}
                className="flex items-center gap-2"
                style={{
                  padding: "8px 12px",
                  border: "none",
                  backgroundColor: "#6d28d9",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Sparkles className="w-4 h-4" />
                {longformPack
                  ? "추천 포인트 쇼츠 모두 만들기"
                  : "추천 장면 모두 세션으로 만들기"}
              </button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
