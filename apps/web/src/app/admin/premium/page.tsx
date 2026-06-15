"use client";

import { useMemo, useState } from "react";
import {
  extractVideoId,
  normalizeYouTubeUrl,
  type PremiumTranscriptLine,
} from "@inputenglish/shared";
import {
  AlertCircle,
  BadgeCheck,
  Captions,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Languages,
  Loader2,
  Mic2,
  PlayCircle,
  Save,
  Sparkles,
  TimerReset,
  UploadCloud,
  Wand2,
} from "lucide-react";
import YouTubePlayer from "@/components/YouTubePlayer";
import { AdminAuthGate } from "../components/AdminAuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  attachPremiumTranscriptToDraft,
  applyPremiumTranscriptTranslations,
  getPremiumTranscriptStats,
  parsePremiumTranscriptJson,
  shiftPremiumTranscriptTiming,
  stringifyPremiumTranscript,
  updatePremiumTranscriptLine,
} from "@/lib/premium/admin-transcript-workspace";
import {
  getPremiumAdminOperationalSummary,
  getPremiumAdminDraftStats,
  markPremiumDraftReview,
  parsePremiumAdminDraftJson,
  updatePremiumDraftCrop,
  type PremiumAdminDraft,
  type PremiumPipelineAdminSummary,
  type PremiumReviewTarget,
} from "@/lib/premium/admin-draft-review";
import {
  premiumAdminFramingTheme,
  premiumAdminThemeStyle,
} from "@/lib/premium/admin-design-tokens";
import { normalizePremiumAdminFailure } from "@/lib/premium/admin-publish-status";
import { cn } from "@/lib/utils";

const SAMPLE_PREMIUM_SESSION: PremiumAdminDraft = {
  source_video_id: "sample-video-id",
  source_url: "https://www.youtube.com/watch?v=sample-video-id",
  title: "오늘 도착한 프리미엄 큐레이션",
  subtitle: "한 장면을 끝까지 먹어 치우는 15분",
  description: "영상, 기사, 표현, 롤플레잉이 한 흐름으로 이어지는 세션.",
  thumbnail_url: "https://img.youtube.com/vi/sample-video-id/hqdefault.jpg",
  channel_name: "InputEnglish",
  speaker_name: "Sample Speaker",
  source_type: "public-speech",
  genre: "business",
  speaking_situations: ["presentation-meeting", "school-work"],
  interest_tags: ["career", "leadership"],
  difficulty_level: 4,
  duration_seconds: 900,
  segment_start_time: 0,
  segment_end_time: 900,
  transcript: [
    {
      id: "s1",
      text: "I had the privilege of working with people who never gave up.",
      translation: "포기하지 않는 사람들과 함께 일할 수 있었어요.",
      startTime: 0,
      endTime: 5,
    },
  ],
  article: {
    title: "왜 이 장면을 오늘 들어야 할까",
    body: "이 세션은 한 문장을 외우는 데서 끝나지 않아요. 화자가 어떤 태도로 문장을 꺼냈는지 읽고, 듣고, 직접 말해보는 흐름으로 설계되어 있어요.",
    summary_bullets: [
      "표현보다 먼저 상황을 잡아요.",
      "마지막에는 직접 말해요.",
    ],
    reading_minutes: 2,
    reviewed: false,
  },
  delivery_analysis: [],
  roleplay: {
    title: "배운 표현으로 짧게 응답하기",
    situation: "회의에서 함께 일한 팀에게 공을 돌리는 상황",
    user_role: "프로젝트 리드",
    partner_role: "동료",
    target_expression_ids: [],
    turns: [
      {
        id: "r1",
        speaker: "coach",
        line: "How was it working with the launch team?",
        translation: "론치 팀과 함께 일해보니 어땠나요?",
      },
      {
        id: "r2",
        speaker: "user",
        hidden: true,
        translation:
          "포기하지 않는 사람들과 함께 일할 수 있어 영광이었다고 말해보세요.",
        reference_text:
          "I had the privilege of working with people who never gave up.",
      },
    ],
    analysis_reference_text:
      "I had the privilege of working with people who never gave up.",
    reviewed: false,
  },
  expression_cards: [],
  reviewed: false,
};

type SelectedPremiumSegment = {
  keySegment: {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    reason: string;
  };
  crop: {
    startTime: number;
    endTime: number;
    paddingBeforeSeconds: number;
    paddingAfterSeconds: number;
  };
  source: "ai" | "fallback";
  provider: string | null;
  model: string | null;
};

const PIPELINE_STEPS = [
  { id: "input", label: "자막과 구간", icon: UploadCloud },
  { id: "segment", label: "구간 확인", icon: PlayCircle },
  { id: "modules", label: "모듈 검수", icon: FileText },
  { id: "review", label: "최종 검수", icon: ClipboardCheck },
  { id: "publish", label: "발행", icon: BadgeCheck },
] as const;

const REVIEW_TARGET_LABELS: Record<PremiumReviewTarget, string> = {
  article: "아티클",
  delivery: "발화 분석",
  expressions: "표현 카드",
  roleplay: "롤플레잉",
  session: "세션",
  all: "전체 초안",
};

function formatSeconds(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0:00";
  const rounded = Math.max(0, Math.round(value));
  const minutes = `${Math.floor(rounded / 60)}`;
  const seconds = `${rounded % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function parseSecondsInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTranscriptSecond(value: number) {
  return Number(value.toFixed(2));
}

function formatGeneratedModuleLabel(module: string) {
  const labels: Record<string, string> = {
    article: "아티클",
    expression_cards: "표현 카드",
    roleplay: "롤플레잉",
  };
  return labels[module] ?? module;
}

function formatRange(startTime?: number | null, endTime?: number | null) {
  if (typeof startTime !== "number" || typeof endTime !== "number") {
    return "0:00 - 0:00";
  }
  return `${formatSeconds(startTime)} - ${formatSeconds(endTime)}`;
}

function StatusDot({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full border",
        done
          ? "border-green-400/30 bg-green-400/15 text-green-200"
          : "border-white/15 bg-white/5 text-[var(--premium-text-muted)]",
      )}
    >
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--premium-text-muted)]">
      {children}
    </label>
  );
}

function renderMarkdownInline(text: string) {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong
            key={`${part}-${index}`}
            className="font-semibold text-[var(--premium-text)]"
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={`${part}-${index}`}
            className="rounded border border-white/10 bg-white/10 px-1 py-0.5 text-[0.85em] text-[var(--premium-text)]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (
        (part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_"))
      ) {
        return (
          <em
            key={`${part}-${index}`}
            className="italic text-[var(--premium-text-secondary)]"
          >
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
}

function MarkdownText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let unorderedItems: string[] = [];
  let orderedItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const value = paragraph.join(" ");
    blocks.push(
      <p key={`p-${blocks.length}`} className="[overflow-wrap:anywhere]">
        {renderMarkdownInline(value)}
      </p>,
    );
    paragraph = [];
  };

  const flushUnordered = () => {
    if (!unorderedItems.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {unorderedItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderMarkdownInline(item)}</li>
        ))}
      </ul>,
    );
    unorderedItems = [];
  };

  const flushOrdered = () => {
    if (!orderedItems.length) return;
    blocks.push(
      <ol key={`ol-${blocks.length}`} className="list-decimal space-y-1 pl-5">
        {orderedItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderMarkdownInline(item)}</li>
        ))}
      </ol>,
    );
    orderedItems = [];
  };

  const flushLists = () => {
    flushUnordered();
    flushOrdered();
  };

  text.split(/\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushLists();
      return;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    if (unordered) {
      flushParagraph();
      flushOrdered();
      unorderedItems.push(unordered[1]);
      return;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      flushUnordered();
      orderedItems.push(ordered[1]);
      return;
    }

    const quote = /^>\s+(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      flushLists();
      blocks.push(
        <blockquote
          key={`quote-${blocks.length}`}
          className="border-l-2 border-white/20 pl-3 text-[var(--premium-text-secondary)]"
        >
          {renderMarkdownInline(quote[1])}
        </blockquote>,
      );
      return;
    }

    flushLists();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushLists();

  return <div className={cn("space-y-2", className)}>{blocks}</div>;
}

export default function PremiumAdminPage() {
  const initialJson = useMemo(
    () => JSON.stringify(SAMPLE_PREMIUM_SESSION, null, 2),
    [],
  );
  const [draftJson, setDraftJson] = useState(initialJson);
  const [sessionId, setSessionId] = useState("");
  const [activeStep, setActiveStep] =
    useState<(typeof PIPELINE_STEPS)[number]["id"]>("input");
  const [pipelineSummary, setPipelineSummary] =
    useState<PremiumPipelineAdminSummary | null>(null);
  const [pipelineInput, setPipelineInput] = useState({
    sourceUrl: "",
    title: "",
    durationSeconds: "",
    transcriptJson: "",
  });
  const [sourceMetadata, setSourceMetadata] = useState<{
    title?: string | null;
    durationSeconds?: number | null;
    channelName?: string | null;
    thumbnailUrl?: string | null;
  }>({});
  const [selectedSegment, setSelectedSegment] =
    useState<SelectedPremiumSegment | null>(null);
  const [transcriptOffsetSeconds, setTranscriptOffsetSeconds] = useState("0.5");
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [player, setPlayer] = useState<YT.Player | null>(null);
  const [status, setStatus] = useState<{
    tone: "success" | "error" | "info";
    message: string;
    issues?: string[];
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectingSegment, setIsSelectingSegment] = useState(false);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  const [isTranslatingTranscript, setIsTranslatingTranscript] = useState(false);

  const parsed = useMemo(
    () => parsePremiumAdminDraftJson(draftJson),
    [draftJson],
  );
  const sourceVideoId = useMemo(
    () => extractVideoId(pipelineInput.sourceUrl),
    [pipelineInput.sourceUrl],
  );
  const transcriptParse = useMemo(
    () => parsePremiumTranscriptJson(pipelineInput.transcriptJson),
    [pipelineInput.transcriptJson],
  );
  const transcriptLines = transcriptParse.lines;
  const transcriptStats = useMemo(
    () => getPremiumTranscriptStats(transcriptLines),
    [transcriptLines],
  );
  const inferredDurationSeconds = useMemo(() => {
    const explicitDuration = parseSecondsInput(pipelineInput.durationSeconds);
    if (explicitDuration !== null && explicitDuration > 0) {
      return Math.ceil(explicitDuration);
    }
    if (typeof transcriptStats.endTime === "number") {
      return Math.ceil(transcriptStats.endTime);
    }
    return null;
  }, [pipelineInput.durationSeconds, transcriptStats.endTime]);
  const inferredDurationLabel =
    inferredDurationSeconds === null
      ? "자막을 불러오면 자동 계산"
      : `${formatSeconds(inferredDurationSeconds)} · ${inferredDurationSeconds}초`;
  const stats = useMemo(
    () => getPremiumAdminDraftStats(parsed.draft),
    [parsed.draft],
  );
  const draftTranslatedCount = useMemo(() => {
    const draftTranscript = Array.isArray(parsed.draft?.transcript)
      ? parsed.draft.transcript
      : [];
    return draftTranscript.filter(
      (line) => typeof line.translation === "string" && line.translation.trim(),
    ).length;
  }, [parsed.draft]);
  const draftSourceUrl =
    typeof parsed.draft?.source_url === "string" ? parsed.draft.source_url : "";
  const draftCropStart =
    typeof parsed.draft?.segment_start_time === "number"
      ? parsed.draft.segment_start_time
      : (pipelineSummary?.crop.startTime ?? 0);
  const draftCropEnd =
    typeof parsed.draft?.segment_end_time === "number"
      ? parsed.draft.segment_end_time
      : (pipelineSummary?.crop.endTime ?? 0);
  const transcriptNeedsDraftAttach =
    transcriptStats.count > 0 &&
    (stats.transcriptCount !== transcriptStats.count ||
      draftTranslatedCount !== transcriptStats.translatedCount ||
      (pipelineInput.sourceUrl.trim().length > 0 &&
        draftSourceUrl !== pipelineInput.sourceUrl.trim()));
  const operationalSummary = useMemo(
    () =>
      getPremiumAdminOperationalSummary({
        draft: parsed.draft,
        parseError: parsed.error,
        pipelineSummary,
        sessionId,
      }),
    [parsed.draft, parsed.error, pipelineSummary, sessionId],
  );
  const publishChecks = operationalSummary.readinessItems;
  const canPublish = operationalSummary.publishReady;

  function setStatusMessage(
    tone: "success" | "error" | "info",
    message: string,
    issues?: string[],
  ) {
    setStatus({ tone, message, issues });
  }

  function updateDraft(nextDraft: PremiumAdminDraft) {
    setDraftJson(JSON.stringify(nextDraft, null, 2));
  }

  function updateDraftArticleField(field: string, value: string) {
    if (!parsed.draft) return;
    updateDraft({
      ...parsed.draft,
      article: {
        ...(parsed.draft.article ?? {}),
        [field]: value,
      },
    });
  }

  function updateDraftRoleplayField(field: string, value: string) {
    if (!parsed.draft) return;
    updateDraft({
      ...parsed.draft,
      roleplay: {
        ...(parsed.draft.roleplay ?? {}),
        [field]: value,
      },
    });
  }

  function updateDraftRoleplayTurnField(
    index: number,
    field: string,
    value: string,
  ) {
    if (!parsed.draft) return;
    const turns = Array.isArray(parsed.draft.roleplay?.turns)
      ? [...parsed.draft.roleplay.turns]
      : [];
    turns[index] = {
      ...(turns[index] ?? {}),
      [field]: value,
    };
    updateDraft({
      ...parsed.draft,
      roleplay: {
        ...(parsed.draft.roleplay ?? {}),
        turns,
      },
    });
  }

  function updatePipelineSourceUrl(nextUrl: string) {
    setPipelineInput((prev) => ({
      ...prev,
      sourceUrl: normalizeYouTubeUrl(nextUrl),
    }));
    setSourceMetadata({});
    setSelectedSegment(null);
  }

  function setTranscriptLines(nextLines: PremiumTranscriptLine[]) {
    setPipelineInput((prev) => ({
      ...prev,
      transcriptJson: stringifyPremiumTranscript(nextLines),
    }));
  }

  function updateTranscriptLineField(
    lineId: string,
    patch: Partial<PremiumTranscriptLine>,
  ) {
    if (transcriptParse.error) {
      setStatusMessage(
        "error",
        "자막 원본 형식을 먼저 고쳐야 줄을 편집할 수 있어요.",
      );
      return;
    }

    const lineIndex = transcriptLines.findIndex((line) => line.id === lineId);
    if (lineIndex < 0) return;

    const currentLine = transcriptLines[lineIndex];
    const nextStartTime =
      typeof patch.startTime === "number"
        ? roundTranscriptSecond(Math.max(0, patch.startTime))
        : currentLine.startTime;
    const nextEndTime =
      typeof patch.endTime === "number"
        ? roundTranscriptSecond(Math.max(0, patch.endTime))
        : currentLine.endTime;

    if (nextEndTime < nextStartTime) {
      setStatusMessage("error", "끝 시간은 시작 시간보다 뒤에 있어야 해요.");
      return;
    }

    const nextLines = updatePremiumTranscriptLine(transcriptLines, lineId, {
      ...patch,
      ...(typeof patch.startTime === "number"
        ? { startTime: nextStartTime }
        : {}),
      ...(typeof patch.endTime === "number" ? { endTime: nextEndTime } : {}),
    });

    if (typeof patch.startTime === "number" && lineIndex > 0) {
      const previousLine = nextLines[lineIndex - 1];
      nextLines[lineIndex - 1] = {
        ...previousLine,
        endTime: nextStartTime,
      };
    }
    if (typeof patch.endTime === "number" && lineIndex < nextLines.length - 1) {
      const followingLine = nextLines[lineIndex + 1];
      nextLines[lineIndex + 1] = {
        ...followingLine,
        startTime: nextEndTime,
      };
    }

    setTranscriptLines(nextLines);
  }

  function splitTranscriptLine(index: number, cursorPosition: number) {
    if (transcriptParse.error) {
      setStatusMessage(
        "error",
        "자막 원본 형식을 먼저 고쳐야 줄을 나눌 수 있어요.",
      );
      return;
    }

    const line = transcriptLines[index];
    if (!line) return;

    const beforeText = line.text.substring(0, cursorPosition).trim();
    const afterText = line.text.substring(cursorPosition).trim();
    if (!beforeText || !afterText) {
      setStatusMessage("info", "커서를 문장 가운데에 둔 뒤 ]를 눌러 주세요.");
      return;
    }

    const duration = Math.max(0, line.endTime - line.startTime);
    const splitRatio = cursorPosition / Math.max(line.text.length, 1);
    const splitTime = Number(
      (line.startTime + duration * splitRatio).toFixed(2),
    );
    const firstLine: PremiumTranscriptLine = {
      ...line,
      text: beforeText,
      endTime: splitTime,
    };
    const secondLine: PremiumTranscriptLine = {
      ...line,
      id: `split-${Date.now()}-${index}`,
      text: afterText,
      translation: "",
      startTime: splitTime,
    };

    const nextLines = [...transcriptLines];
    nextLines.splice(index, 1, firstLine, secondLine);
    setTranscriptLines(nextLines);
    setStatusMessage("info", `${index + 1}번 줄을 두 문장으로 나눴어요.`);
  }

  function mergeTranscriptLineWithPrevious(index: number) {
    if (transcriptParse.error || index <= 0) return;

    const current = transcriptLines[index];
    const previous = transcriptLines[index - 1];
    if (!current || !previous) return;

    const mergedLine: PremiumTranscriptLine = {
      ...previous,
      text: `${previous.text} ${current.text}`.trim(),
      translation: [previous.translation, current.translation]
        .filter(Boolean)
        .join(" "),
      endTime: current.endTime,
    };

    const nextLines = [...transcriptLines];
    nextLines.splice(index - 1, 2, mergedLine);
    setTranscriptLines(nextLines);
    setStatusMessage("info", `${index}번 줄과 ${index + 1}번 줄을 합쳤어요.`);
  }

  function handleTranscriptTextKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number,
  ) {
    if (event.key === "]") {
      event.preventDefault();
      splitTranscriptLine(index, event.currentTarget.selectionStart ?? 0);
    } else if (event.key === "[") {
      event.preventDefault();
      mergeTranscriptLineWithPrevious(index);
    }
  }

  async function loadYouTubeTranscript() {
    if (!pipelineInput.sourceUrl.trim()) {
      setStatusMessage("error", "먼저 유튜브 주소를 입력해 주세요.");
      return;
    }

    setIsTranscriptLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/premium/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: pipelineInput.sourceUrl }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          [payload.error, payload.details].filter(Boolean).join("\n") ||
            "자막을 불러오지 못했어요.",
        );
      }

      const transcript = payload.transcript as PremiumTranscriptLine[];
      const fetchedStats = getPremiumTranscriptStats(transcript);
      const fetchedDuration =
        typeof payload.metadata?.duration === "number"
          ? Math.ceil(payload.metadata.duration)
          : fetchedStats.endTime !== null
            ? Math.ceil(fetchedStats.endTime)
            : null;
      setTranscriptLines(transcript);
      setSourceMetadata({
        title: payload.metadata?.title ?? null,
        durationSeconds: fetchedDuration,
        channelName: payload.metadata?.channel ?? null,
        thumbnailUrl: payload.metadata?.thumbnail ?? null,
      });
      setSelectedSegment(null);
      setPipelineInput((prev) => ({
        ...prev,
        title: prev.title || payload.metadata?.title || "",
        durationSeconds:
          prev.durationSeconds ||
          (fetchedDuration !== null ? String(fetchedDuration) : ""),
      }));
      setActiveStep("input");
      setStatusMessage(
        "success",
        `유튜브 자막 ${transcript.length}줄을 불러왔어요. 싱크와 번역을 확인한 뒤 초안에 반영해 주세요.`,
      );
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "자막을 불러오지 못했어요.",
      );
    } finally {
      setIsTranscriptLoading(false);
    }
  }

  function applyTranscriptOffset(direction: 1 | -1) {
    if (transcriptParse.error || transcriptLines.length === 0) {
      setStatusMessage(
        "error",
        transcriptParse.error || "먼저 자막을 불러오거나 붙여넣어 주세요.",
      );
      return;
    }

    const offset = parseSecondsInput(transcriptOffsetSeconds);
    if (offset === null) {
      setStatusMessage("error", "보정값에는 초 단위 숫자를 넣어 주세요.");
      return;
    }

    const signedOffset = direction * offset;
    setTranscriptLines(
      shiftPremiumTranscriptTiming(transcriptLines, signedOffset),
    );
    setStatusMessage(
      "info",
      `전체 자막 시간을 ${signedOffset > 0 ? "+" : ""}${signedOffset}초 보정했어요. 초안에 반영하면 발행 데이터에도 적용됩니다.`,
    );
  }

  async function selectPremiumSegment() {
    if (transcriptParse.error || transcriptLines.length === 0) {
      setStatusMessage(
        "error",
        transcriptParse.error || "먼저 전체 영상 자막을 불러와 주세요.",
      );
      return;
    }
    if (!pipelineInput.sourceUrl.trim()) {
      setStatusMessage("error", "먼저 유튜브 주소를 입력해 주세요.");
      return;
    }

    setIsSelectingSegment(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/premium/pipeline/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: pipelineInput.sourceUrl,
          ...(pipelineInput.title.trim() || sourceMetadata.title
            ? { title: pipelineInput.title.trim() || sourceMetadata.title }
            : {}),
          ...(typeof inferredDurationSeconds === "number"
            ? { durationSeconds: inferredDurationSeconds }
            : {}),
          transcript: transcriptLines,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "구간 후보를 찾지 못했어요.");
      }

      setSelectedSegment(payload as SelectedPremiumSegment);
      setStatusMessage(
        "success",
        `추천 구간을 찾았어요: ${formatSeconds(
          payload.crop.startTime,
        )}-${formatSeconds(payload.crop.endTime)}. 범위를 확인한 뒤 작업줄을 좁혀 주세요.`,
      );
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "구간 후보를 찾지 못했어요.",
      );
    } finally {
      setIsSelectingSegment(false);
    }
  }

  function updateSelectedCrop(field: "startTime" | "endTime", value: string) {
    const next = parseSecondsInput(value);
    if (next === null || !selectedSegment) return;

    setSelectedSegment({
      ...selectedSegment,
      crop: {
        ...selectedSegment.crop,
        [field]: next,
      },
    });
  }

  function focusTranscriptOnSelectedSegment() {
    if (!selectedSegment) {
      setStatusMessage("error", "먼저 2~3분 구간 후보를 찾아 주세요.");
      return;
    }
    const { startTime, endTime } = selectedSegment.crop;
    if (endTime <= startTime) {
      setStatusMessage("error", "끝 시간이 시작 시간보다 커야 합니다.");
      return;
    }

    const focusedLines = transcriptLines.filter(
      (line) => line.endTime >= startTime && line.startTime <= endTime,
    );
    if (!focusedLines.length) {
      setStatusMessage("error", "선택한 구간 안에 자막이 없어요.");
      return;
    }

    setTranscriptLines(focusedLines);
    setStatusMessage(
      "success",
      `${formatSeconds(startTime)}-${formatSeconds(
        endTime,
      )} 구간의 자막 ${focusedLines.length}줄만 작업줄에 남겼어요.`,
    );
  }

  async function translateTranscriptLines() {
    if (transcriptParse.error || transcriptLines.length === 0) {
      setStatusMessage(
        "error",
        transcriptParse.error || "번역할 자막이 없어요.",
      );
      return;
    }

    setIsTranslatingTranscript(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentences: transcriptLines.map((line) => line.text),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "자막을 번역하지 못했어요.");
      }

      setTranscriptLines(
        applyPremiumTranscriptTranslations(
          transcriptLines,
          payload.translations ?? [],
        ),
      );
      setStatusMessage(
        "success",
        `자막 번역 ${payload.translations?.length ?? 0}줄을 채웠어요. 초안에 반영하면 발행 데이터에도 포함됩니다.`,
      );
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "자막을 번역하지 못했어요.",
      );
    } finally {
      setIsTranslatingTranscript(false);
    }
  }

  function playTranscriptLine(line: PremiumTranscriptLine) {
    if (!player) {
      setStatusMessage(
        "info",
        "영상 플레이어가 준비되면 이 라인부터 재생할 수 있어요.",
      );
      return;
    }
    player.seekTo(line.startTime, true);
    player.playVideo();
  }

  function attachTranscriptWorkspaceToDraft() {
    if (transcriptParse.error || transcriptLines.length === 0) {
      setStatusMessage(
        "error",
        transcriptParse.error || "먼저 자막을 불러오거나 붙여넣어 주세요.",
      );
      return;
    }
    if (!parsed.draft) {
      setStatusMessage("error", "초안 원본을 먼저 고쳐야 반영할 수 있어요.");
      return;
    }

    const durationSeconds = inferredDurationSeconds;
    const nextDraft = attachPremiumTranscriptToDraft({
      draft: parsed.draft,
      lines: transcriptLines,
      sourceUrl: pipelineInput.sourceUrl,
      title: pipelineInput.title,
      durationSeconds,
    });
    if (sourceMetadata.channelName) {
      nextDraft.channel_name = sourceMetadata.channelName;
    }
    if (sourceMetadata.thumbnailUrl) {
      nextDraft.thumbnail_url = sourceMetadata.thumbnailUrl;
    }
    updateDraft(nextDraft);
    setActiveStep("input");
    setStatusMessage(
      "success",
      `자막 ${transcriptLines.length}줄을 현재 초안에 반영했어요.`,
    );
  }

  async function buildPipelineDraft() {
    setIsSaving(true);
    setStatus(null);
    try {
      const transcriptText = pipelineInput.transcriptJson.trim();
      const title = pipelineInput.title.trim();
      const durationSeconds = inferredDurationSeconds;
      const response = await fetch("/api/admin/premium/pipeline/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: pipelineInput.sourceUrl,
          ...(sourceVideoId ? { sourceVideoId } : {}),
          ...(sourceMetadata.channelName
            ? { channelName: sourceMetadata.channelName }
            : {}),
          ...(sourceMetadata.thumbnailUrl
            ? { thumbnailUrl: sourceMetadata.thumbnailUrl }
            : {}),
          ...(selectedSegment
            ? {
                keySegments: [
                  {
                    ...selectedSegment.keySegment,
                    id: `operator-${selectedSegment.keySegment.id}`,
                    startTime: selectedSegment.crop.startTime,
                    endTime: selectedSegment.crop.endTime,
                    reason: `${selectedSegment.keySegment.reason} 운영자가 이 2~3분 편집 범위로 확정했습니다.`,
                  },
                ],
              }
            : {}),
          sourceType: "public-speech",
          genre: "business",
          speakingSituations: ["presentation-meeting", "school-work"],
          interestTags: ["career", "leadership"],
          difficultyLevel: 4,
          ...(title ? { title } : {}),
          ...(typeof durationSeconds === "number" && durationSeconds > 0
            ? { durationSeconds }
            : {}),
          ...(transcriptText ? { transcript: JSON.parse(transcriptText) } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "초안을 만들지 못했어요.");
      }
      setDraftJson(JSON.stringify(payload.session, null, 2));
      setPipelineSummary(payload.pipeline);
      setActiveStep("segment");
      setStatusMessage(
        "success",
        `초안을 만들었어요. 핵심구간 ${payload.pipeline.keySegments.length}개, 편집 범위 ${formatSeconds(
          payload.pipeline.crop.startTime,
        )}-${formatSeconds(payload.pipeline.crop.endTime)}입니다.`,
      );
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "초안을 만들지 못했어요.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    setIsSaving(true);
    setStatus(null);
    try {
      const session = JSON.parse(draftJson);
      const response = await fetch("/api/admin/premium/sessions/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? "초안을 저장하지 못했어요.");
      setSessionId(payload.sessionId);
      setActiveStep("review");
      setStatusMessage(
        "success",
        `초안을 저장했어요: ${payload.sessionId} (표현 카드 ${payload.expressionCount}개)`,
      );
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "초안을 저장하지 못했어요.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function publish() {
    if (!sessionId.trim()) {
      setStatusMessage("error", "저장된 세션 아이디가 필요해요.");
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/admin/premium/sessions/${sessionId}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publishedOn: new Date().toISOString().slice(0, 10),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        const failure = normalizePremiumAdminFailure(
          payload,
          "발행하지 못했어요.",
        );
        setStatusMessage("error", failure.message, failure.issues);
        return;
      }
      setActiveStep("publish");
      setStatusMessage("success", `발행했어요: ${payload.sessionId}`);
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "발행하지 못했어요.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function markDraftReviewed(target: PremiumReviewTarget = "all") {
    if (!parsed.draft) {
      setStatusMessage(
        "error",
        "초안 원본을 먼저 고쳐야 검수 표시가 가능해요.",
      );
      return;
    }
    updateDraft(markPremiumDraftReview(parsed.draft, target));
    setActiveStep("review");
    setStatusMessage(
      "info",
      target === "all"
        ? "현재 초안을 사람 검수 완료 상태로 표시했어요."
        : `${REVIEW_TARGET_LABELS[target]} 검수 완료 상태로 표시했어요.`,
    );
  }

  function updateDraftCropField(field: "start" | "end", value: string) {
    if (!parsed.draft) {
      setStatusMessage(
        "error",
        "초안 원본을 먼저 만들어야 편집 범위를 조정할 수 있어요.",
      );
      return;
    }

    const next = parseSecondsInput(value);
    if (next === null) {
      setStatusMessage("error", "편집 범위에는 초 단위 숫자를 넣어 주세요.");
      return;
    }

    try {
      updateDraft(
        updatePremiumDraftCrop(parsed.draft, {
          startTime: field === "start" ? next : draftCropStart,
          endTime: field === "end" ? next : draftCropEnd,
        }),
      );
      setActiveStep("segment");
      setStatusMessage(
        "info",
        "편집 범위를 초안에 반영했어요. 자막도 범위에 맞춰 정리됩니다.",
      );
    } catch (error) {
      setStatusMessage(
        "error",
        error instanceof Error ? error.message : "편집 범위를 바꾸지 못했어요.",
      );
    }
  }

  return (
    <AdminAuthGate>
      <main
        data-theme={premiumAdminFramingTheme.id}
        className="min-h-screen bg-[var(--premium-bg)] text-[var(--premium-text)]"
        style={premiumAdminThemeStyle}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
          <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
            <div className="w-full min-w-0 flex-1 space-y-3">
              <Badge className="w-fit border-white/15 bg-white/10 text-[var(--premium-text)] hover:bg-white/10">
                프리미엄 운영
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                  프리미엄 세션 운영 콘솔
                </h1>
                <p className="mt-2 w-full max-w-[680px] text-sm leading-6 text-[var(--premium-text-secondary)] [word-break:keep-all]">
                  영상 주소에서 핵심 표현이 담긴 2~3분 구간을 고르고, 표현
                  카드와 사람 검수를 거쳐 발행합니다.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-right">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-[var(--premium-text-muted)]">
                  초안 자막
                </p>
                <p className="text-xl font-semibold">{stats.transcriptCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-[var(--premium-text-muted)]">
                  핵심 표현
                </p>
                <p className="text-xl font-semibold">{stats.anchorCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-[var(--premium-text-muted)]">
                  보조 표현
                </p>
                <p className="text-xl font-semibold">{stats.supportCount}</p>
              </div>
            </div>
          </header>

          {status ? (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
                status.tone === "success" &&
                  "border-green-400/30 bg-green-400/10 text-green-100",
                status.tone === "error" &&
                  "border-red-400/30 bg-red-400/10 text-red-100",
                status.tone === "info" &&
                  "border-white/15 bg-white/[0.06] text-[var(--premium-text)]",
              )}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 space-y-2">
                <p>{status.message}</p>
                {status.issues?.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs leading-5">
                    {status.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          <section className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--premium-text-muted)]">
                구간 출처
              </p>
              <p className="mt-2 text-sm font-semibold leading-5">
                {operationalSummary.sourceLabel}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--premium-text-muted)]">
                모듈 출처
              </p>
              <p className="mt-2 text-sm font-semibold leading-5">
                {operationalSummary.moduleLabel}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--premium-text-muted)]">
                표현 카드
              </p>
              <p className="mt-2 text-sm font-semibold leading-5">
                {operationalSummary.expressionCardLabel}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--premium-text-muted)]">
                편집 길이
              </p>
              <p className="mt-2 text-sm font-semibold leading-5">
                {operationalSummary.cropLabel}
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border p-4",
                operationalSummary.publishReady
                  ? "border-green-400/30 bg-green-400/10"
                  : "border-amber-300/30 bg-amber-300/10",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--premium-text-muted)]">
                발행 조건
              </p>
              <p className="mt-2 text-sm font-semibold leading-5">
                {operationalSummary.reviewLabel}
              </p>
            </div>
          </section>

          {operationalSummary.blockingIssues.length ? (
            <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-50">
                    발행 전에 확인할 항목
                  </p>
                  <ul className="mt-2 grid gap-1 text-xs leading-5 text-amber-50/80 md:grid-cols-2">
                    {operationalSummary.blockingIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="min-w-0 space-y-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1">
              <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--premium-text-muted)] [word-break:keep-all]">
                    01. 유튜브 주소, 자막, 2~3분 구간
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-normal [word-break:keep-all]">
                    세션에 쓸 장면 고르기
                  </h2>
                  <p className="mt-2 w-full text-sm leading-6 text-[var(--premium-text-secondary)] [word-break:keep-all]">
                    핵심 표현이 들어간 장면을 기준으로 전체 세션 길이를 최대 3분
                    안쪽으로 제안합니다.
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <FieldLabel>유튜브 주소</FieldLabel>
                      <Input
                        className="border-white/10 bg-black/40 text-[var(--premium-text)]"
                        value={pipelineInput.sourceUrl}
                        onChange={(event) =>
                          updatePipelineSourceUrl(event.target.value)
                        }
                        placeholder="https://youtu.be/..."
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>세션 제목</FieldLabel>
                      <Input
                        className="border-white/10 bg-black/40 text-[var(--premium-text)]"
                        value={pipelineInput.title}
                        onChange={(event) =>
                          setPipelineInput((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <FieldLabel>영상 정보</FieldLabel>
                      <p className="mt-1 text-lg font-semibold">
                        {inferredDurationLabel}
                      </p>
                      {sourceMetadata.channelName ? (
                        <p className="mt-1 text-xs leading-5 text-[var(--premium-text-secondary)]">
                          {sourceMetadata.channelName}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs leading-5 text-[var(--premium-text-muted)]">
                        유튜브에서 받은 길이와 채널 정보를 초안에 저장합니다.
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      <div className="aspect-video bg-black">
                        {sourceVideoId ? (
                          <YouTubePlayer
                            key={sourceVideoId}
                            videoId={sourceVideoId}
                            className="h-full w-full"
                            onReady={setPlayer}
                            onTimeUpdate={setCurrentVideoTime}
                            showNativeControls
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--premium-text-muted)]">
                            유튜브 주소를 넣으면 싱크 확인용 플레이어가
                            열립니다.
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-xs text-[var(--premium-text-muted)]">
                        <span>현재 {formatSeconds(currentVideoTime)}</span>
                        <span>{sourceVideoId ?? "영상 없음"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        className="gap-2 bg-white text-black hover:bg-white/90"
                        onClick={loadYouTubeTranscript}
                        disabled={
                          isTranscriptLoading || !pipelineInput.sourceUrl
                        }
                      >
                        {isTranscriptLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Captions className="h-4 w-4" />
                        )}
                        자막 불러오기
                      </Button>
                      <Button
                        variant="secondary"
                        className="gap-2 bg-white text-black hover:bg-white/90"
                        onClick={translateTranscriptLines}
                        disabled={
                          isTranslatingTranscript ||
                          transcriptLines.length === 0
                        }
                      >
                        {isTranslatingTranscript ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Languages className="h-4 w-4" />
                        )}
                        전체 번역
                      </Button>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center gap-2">
                        <TimerReset className="h-4 w-4 text-[var(--premium-text-muted)]" />
                        <FieldLabel>전체 시간 보정</FieldLabel>
                      </div>
                      <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                        <Input
                          className="border-white/10 bg-black/40 text-[var(--premium-text)]"
                          value={transcriptOffsetSeconds}
                          onChange={(event) =>
                            setTranscriptOffsetSeconds(event.target.value)
                          }
                          inputMode="decimal"
                        />
                        <Button
                          variant="secondary"
                          className="bg-white text-black hover:bg-white/90"
                          onClick={() => applyTranscriptOffset(-1)}
                          disabled={transcriptLines.length === 0}
                        >
                          - 적용
                        </Button>
                        <Button
                          variant="secondary"
                          className="bg-white text-black hover:bg-white/90"
                          onClick={() => applyTranscriptOffset(1)}
                          disabled={transcriptLines.length === 0}
                        >
                          + 적용
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <p className="text-xs text-[var(--premium-text-muted)]">
                          줄 수
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {transcriptStats.count}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <p className="text-xs text-[var(--premium-text-muted)]">
                          번역
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {transcriptStats.translatedCount}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <p className="text-xs text-[var(--premium-text-muted)]">
                          자막 범위
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatRange(
                            transcriptStats.startTime,
                            transcriptStats.endTime,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <FieldLabel>2~3분 구간 확정</FieldLabel>
                          <p className="mt-1 text-sm leading-6 text-[var(--premium-text-secondary)]">
                            전체 자막에서 핵심 표현 후보를 먼저 찾고, 시작/끝
                            시간을 확정한 뒤 그 구간만 싱크 확인합니다.
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          className="gap-2 bg-white text-black hover:bg-white/90"
                          onClick={selectPremiumSegment}
                          disabled={
                            isSelectingSegment ||
                            transcriptLines.length === 0 ||
                            Boolean(transcriptParse.error)
                          }
                        >
                          {isSelectingSegment ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          전체 자막에서 구간 찾기
                        </Button>
                      </div>

                      {selectedSegment ? (
                        <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3">
                          <p className="text-sm font-semibold">
                            {selectedSegment.keySegment.title}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[var(--premium-text-muted)]">
                            {selectedSegment.keySegment.reason}
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <FieldLabel>시작 초</FieldLabel>
                              <Input
                                className="h-9 border-white/10 bg-black/40 text-xs text-[var(--premium-text)]"
                                type="number"
                                step="0.1"
                                value={selectedSegment.crop.startTime}
                                onChange={(event) =>
                                  updateSelectedCrop(
                                    "startTime",
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <FieldLabel>끝 초</FieldLabel>
                              <Input
                                className="h-9 border-white/10 bg-black/40 text-xs text-[var(--premium-text)]"
                                type="number"
                                step="0.1"
                                value={selectedSegment.crop.endTime}
                                onChange={(event) =>
                                  updateSelectedCrop(
                                    "endTime",
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs leading-5 text-[var(--premium-text-secondary)]">
                              선택 범위:{" "}
                              {formatSeconds(selectedSegment.crop.startTime)} -{" "}
                              {formatSeconds(selectedSegment.crop.endTime)}
                            </p>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="bg-white text-black hover:bg-white/90"
                              onClick={focusTranscriptOnSelectedSegment}
                            >
                              이 구간만 작업줄에 남기기
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <FieldLabel>자막 작업줄</FieldLabel>
                        <p className="mt-1 text-sm text-[var(--premium-text-secondary)]">
                          문장을 클릭하면 그 위치부터 재생됩니다. 원문 칸에서
                          ]는 나누기, [는 앞 문장과 합치기입니다.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {transcriptNeedsDraftAttach &&
                        parsed.draft &&
                        transcriptLines.length > 0 &&
                        !transcriptParse.error ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2 bg-white text-black hover:bg-white/90"
                            onClick={attachTranscriptWorkspaceToDraft}
                          >
                            <Save className="h-3.5 w-3.5" />
                            자막 변경 반영
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {transcriptParse.error ? (
                      <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm leading-6 text-red-100">
                        {transcriptParse.error}
                      </div>
                    ) : null}

                    <div className="max-h-[560px] overflow-y-auto rounded-lg border border-white/10 bg-black/30">
                      {transcriptLines.length ? (
                        transcriptLines.map((line, index) => (
                          <div
                            key={line.id}
                            className="grid cursor-pointer gap-3 border-b border-white/10 p-3 transition last:border-b-0 hover:bg-white/[0.04] xl:grid-cols-[96px_1fr]"
                            onClick={() => playTranscriptLine(line)}
                          >
                            <div className="flex xl:flex-col gap-2 xl:gap-3">
                              <span className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 text-xs font-semibold text-[var(--premium-text)]">
                                {formatSeconds(line.startTime)}
                              </span>
                              <span className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-[var(--premium-text-muted)]">
                                #{index + 1}
                              </span>
                            </div>
                            <div className="min-w-0 space-y-2">
                              <div className="grid gap-2 md:grid-cols-2">
                                <Input
                                  className="h-9 border-white/10 bg-black/40 text-xs text-[var(--premium-text)]"
                                  type="number"
                                  step="0.1"
                                  value={line.startTime}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    const next = Number(event.target.value);
                                    if (Number.isFinite(next)) {
                                      updateTranscriptLineField(line.id, {
                                        startTime: next,
                                      });
                                    }
                                  }}
                                />
                                <Input
                                  className="h-9 border-white/10 bg-black/40 text-xs text-[var(--premium-text)]"
                                  type="number"
                                  step="0.1"
                                  value={line.endTime}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    const next = Number(event.target.value);
                                    if (Number.isFinite(next)) {
                                      updateTranscriptLineField(line.id, {
                                        endTime: next,
                                      });
                                    }
                                  }}
                                />
                              </div>
                              <textarea
                                className="min-h-[58px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm leading-6 text-[var(--premium-text)] outline-none focus:ring-2 focus:ring-white/40"
                                value={line.text}
                                onChange={(event) =>
                                  updateTranscriptLineField(line.id, {
                                    text: event.target.value,
                                  })
                                }
                                onKeyDown={(event) =>
                                  handleTranscriptTextKeyDown(event, index)
                                }
                              />
                              <textarea
                                className="min-h-[52px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm leading-6 text-[var(--premium-text-secondary)] outline-none focus:ring-2 focus:ring-white/40"
                                value={line.translation ?? ""}
                                onChange={(event) =>
                                  updateTranscriptLineField(line.id, {
                                    translation: event.target.value,
                                  })
                                }
                                placeholder="한국어 번역"
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-sm leading-6 text-[var(--premium-text-muted)]">
                          유튜브 자막을 불러오면 여기에서 문장을 나누고 합칠 수
                          있어요.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {pipelineSummary ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                      <p className="text-xs text-[var(--premium-text-muted)]">
                        핵심 구간
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {pipelineSummary.keySegments[0]?.title}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[var(--premium-text-secondary)]">
                        {pipelineSummary.keySegments[0]?.reason}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                      <p className="text-xs text-[var(--premium-text-muted)]">
                        편집 범위
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {formatSeconds(draftCropStart)} -{" "}
                        {formatSeconds(draftCropEnd)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <FieldLabel>시작 초</FieldLabel>
                          <Input
                            className="h-9 border-white/10 bg-black/40 text-xs text-[var(--premium-text)]"
                            type="number"
                            step="0.1"
                            value={draftCropStart}
                            onChange={(event) =>
                              updateDraftCropField("start", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel>끝 초</FieldLabel>
                          <Input
                            className="h-9 border-white/10 bg-black/40 text-xs text-[var(--premium-text)]"
                            type="number"
                            step="0.1"
                            value={draftCropEnd}
                            onChange={(event) =>
                              updateDraftCropField("end", event.target.value)
                            }
                          />
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-[var(--premium-text-secondary)]">
                        핵심 표현이 담긴 구간을 중심으로 전체 길이가 최대 3분이
                        되도록 제안합니다. 숫자를 바꾸면 초안의 편집 범위와
                        자막이 함께 갱신됩니다.
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                      <p className="text-xs text-[var(--premium-text-muted)]">
                        생성된 모듈
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {pipelineSummary.generatedModules.map((module) => (
                          <Badge
                            key={module}
                            className="border-white/10 bg-white/10 text-[var(--premium-text)] hover:bg-white/10"
                          >
                            {formatGeneratedModuleLabel(module)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            </section>

            <section className="min-w-0 space-y-5 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-2">
              <section className="space-y-5">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                  <div className="space-y-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--premium-text-muted)]">
                        02. 모듈 검수
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-normal [word-break:keep-all]">
                        생성된 내용을 읽고 확인하기
                      </h2>
                      <p className="mt-2 w-full text-sm leading-6 text-[var(--premium-text-secondary)] [word-break:keep-all]">
                        1단계에서 만든 초안의 아티클, 표현 카드, 롤플레잉을
                        읽어보고 실제 세션으로 써도 되는 항목만 검수 완료로
                        표시합니다.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="w-full gap-2 sm:w-fit"
                        onClick={buildPipelineDraft}
                        disabled={
                          isSaving ||
                          !pipelineInput.sourceUrl.trim() ||
                          transcriptLines.length === 0 ||
                          !selectedSegment
                        }
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        구간과 자막 확인 후 초안 만들기
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full gap-2 bg-white text-black hover:bg-white/90 sm:w-fit"
                        onClick={() => markDraftReviewed("all")}
                        disabled={!parsed.draft}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        전체 검수 완료 표시
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    {[
                      {
                        title: "아티클",
                        task: "본문이 오늘 장면을 정확히 설명하는지 확인",
                        body:
                          typeof parsed.draft?.article?.body === "string"
                            ? parsed.draft.article.body
                            : "아티클 본문이 아직 없어요.",
                        done: stats.articleReviewed,
                        icon: FileText,
                        reviewTarget: "article" as const,
                      },
                      {
                        title: "표현 카드",
                        task: "AI가 자동 생성한 핵심/보조 표현이 실제로 쓸 만한지 확인",
                        body: `핵심 ${stats.anchorCount}개 / 보조 ${stats.supportCount}개`,
                        done: stats.expressionReviewed,
                        icon: Wand2,
                        reviewTarget: "expressions" as const,
                      },
                      {
                        title: "롤플레잉",
                        task: "학습자가 마지막에 말해볼 상황이 자연스러운지 확인",
                        body:
                          typeof parsed.draft?.roleplay?.situation === "string"
                            ? parsed.draft.roleplay.situation
                            : "롤플레잉 상황이 아직 없어요.",
                        done: stats.roleplayReviewed,
                        icon: Mic2,
                        reviewTarget: "roleplay" as const,
                      },
                    ].map((module) => {
                      const Icon = module.icon;
                      return (
                        <div
                          key={module.title}
                          className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/30 p-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <StatusDot done={module.done} />
                              <Icon className="h-4 w-4" />
                              <span>{module.title}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--premium-text-secondary)]">
                              {module.task}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--premium-text-muted)]">
                              {module.body}
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full bg-white text-black hover:bg-white/90 lg:w-auto"
                            onClick={() =>
                              markDraftReviewed(module.reviewTarget)
                            }
                            disabled={!parsed.draft || module.done}
                          >
                            {module.done ? "검수 완료됨" : "이 모듈 검수 완료"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 space-y-4">
                    <details
                      open
                      className="rounded-lg border border-white/10 bg-black/30 p-4"
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        아티클 확인 및 수정
                      </summary>
                      <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                          <FieldLabel>제목</FieldLabel>
                          <Input
                            className="border-white/10 bg-black/40 text-[var(--premium-text)]"
                            value={
                              typeof parsed.draft?.article?.title === "string"
                                ? parsed.draft.article.title
                                : ""
                            }
                            onChange={(event) =>
                              updateDraftArticleField(
                                "title",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <FieldLabel>본문</FieldLabel>
                          <textarea
                            className="min-h-[220px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm leading-6 text-[var(--premium-text)] outline-none focus:ring-2 focus:ring-white/40"
                            value={
                              typeof parsed.draft?.article?.body === "string"
                                ? parsed.draft.article.body
                                : ""
                            }
                            onChange={(event) =>
                              updateDraftArticleField(
                                "body",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </details>

                    <details
                      open
                      className="rounded-lg border border-white/10 bg-black/30 p-4"
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        표현 카드 전체 확인
                      </summary>
                      <div className="mt-4 space-y-3">
                        {stats.expressionCards.length ? (
                          stats.expressionCards.map((card) => (
                            <div
                              key={card.id ?? card.expression}
                              className="min-w-0 rounded-lg border border-white/10 bg-black/30 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 whitespace-normal text-sm font-semibold leading-6 [overflow-wrap:anywhere]">
                                  {card.expression}
                                </p>
                                <Badge className="shrink-0 border-white/10 bg-white/10 text-[var(--premium-text)] hover:bg-white/10">
                                  {card.depth === "anchor" ? "핵심" : "보조"}
                                </Badge>
                              </div>
                              <MarkdownText
                                className="mt-2 text-sm leading-6 text-[var(--premium-text-secondary)]"
                                text={card.natural_meaning_ko}
                              />
                              <MarkdownText
                                className="mt-2 text-xs leading-5 text-[var(--premium-text-muted)]"
                                text={card.story}
                              />
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--premium-text-muted)]">
                            아직 표현 카드가 없어요. 구간과 자막을 확정한 뒤
                            초안을 만들면 핵심/보조 표현이 자동으로 생성됩니다.
                          </p>
                        )}
                      </div>
                    </details>

                    <details
                      open
                      className="rounded-lg border border-white/10 bg-black/30 p-4"
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        롤플레잉 대본 확인 및 수정
                      </summary>
                      <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                          <FieldLabel>상황</FieldLabel>
                          <textarea
                            className="min-h-[88px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm leading-6 text-[var(--premium-text)] outline-none focus:ring-2 focus:ring-white/40"
                            value={
                              typeof parsed.draft?.roleplay?.situation ===
                              "string"
                                ? parsed.draft.roleplay.situation
                                : ""
                            }
                            onChange={(event) =>
                              updateDraftRoleplayField(
                                "situation",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        {Array.isArray(parsed.draft?.roleplay?.turns)
                          ? parsed.draft.roleplay.turns.map((turn, index) => (
                              <div
                                key={String(turn.id ?? index)}
                                className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3"
                              >
                                <FieldLabel>
                                  {index + 1}번 발화 ·{" "}
                                  {typeof turn.avatar_label === "string" &&
                                  turn.avatar_label.trim()
                                    ? turn.avatar_label
                                    : turn.speaker === "user"
                                      ? "학습자"
                                      : "상대"}
                                </FieldLabel>
                                <textarea
                                  className="min-h-[64px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm leading-6 text-[var(--premium-text)] outline-none focus:ring-2 focus:ring-white/40"
                                  value={
                                    typeof turn.line === "string"
                                      ? turn.line
                                      : ""
                                  }
                                  onChange={(event) =>
                                    updateDraftRoleplayTurnField(
                                      index,
                                      "line",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="영어 발화"
                                />
                                <textarea
                                  className="min-h-[64px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm leading-6 text-[var(--premium-text-secondary)] outline-none focus:ring-2 focus:ring-white/40"
                                  value={
                                    typeof turn.translation === "string"
                                      ? turn.translation
                                      : ""
                                  }
                                  onChange={(event) =>
                                    updateDraftRoleplayTurnField(
                                      index,
                                      "translation",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="한국어 안내"
                                />
                              </div>
                            ))
                          : null}
                      </div>
                    </details>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <div className="space-y-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--premium-text-muted)]">
                      03. 저장과 발행
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-normal [word-break:keep-all]">
                      검수한 세션을 저장하고 발행하기
                    </h2>
                    <p className="mt-2 w-full text-sm leading-6 text-[var(--premium-text-secondary)] [word-break:keep-all]">
                      모든 내용이 준비되면 세션 검수 완료를 누르고, 초안을
                      저장한 뒤 발행합니다. 빠진 항목은 아래 목록에서
                      확인합니다.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="secondary"
                      className="gap-2 bg-white text-black hover:bg-white/90"
                      onClick={() => markDraftReviewed("session")}
                      disabled={!parsed.draft || stats.sessionReviewed}
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      세션 검수 완료
                    </Button>
                    <Button
                      variant="secondary"
                      className="gap-2 bg-white text-black hover:bg-white/90"
                      onClick={saveDraft}
                      disabled={isSaving || Boolean(parsed.error)}
                    >
                      <Save className="h-4 w-4" />
                      초안 저장
                    </Button>
                    <Button
                      className="gap-2"
                      onClick={publish}
                      disabled={isSaving || !canPublish}
                    >
                      <BadgeCheck className="h-4 w-4" />
                      발행
                    </Button>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <FieldLabel>세션 아이디</FieldLabel>
                    <Input
                      className="border-white/10 bg-black/40 text-[var(--premium-text)]"
                      placeholder="초안 저장 후 자동 입력"
                      value={sessionId}
                      onChange={(event) => setSessionId(event.target.value)}
                    />
                    {parsed.error ? (
                      <p className="text-sm text-red-200">{parsed.error}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {publishChecks.map((check) => (
                      <div
                        key={check.label}
                        className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm"
                      >
                        <StatusDot done={check.done} />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {check.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-4 text-[var(--premium-text-muted)]">
                            {check.detail}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <details className="mt-5 rounded-lg border border-white/10 bg-black/30 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    초안 원본
                  </summary>
                  <textarea
                    className="mt-4 min-h-[420px] w-full rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-xs leading-5 text-[var(--premium-text)] outline-none focus:ring-2 focus:ring-white/40"
                    value={draftJson}
                    onChange={(event) => setDraftJson(event.target.value)}
                    spellCheck={false}
                  />
                </details>
              </section>
            </section>
          </div>
        </div>
      </main>
    </AdminAuthGate>
  );
}
