"use client";

// @MX:ANCHOR: [AUTO] HighlightQuestionPanel — Task 5.3/5.5 highlight-question UI.
// @MX:REASON: [AUTO] Thin client wrapper around postQuestion() (REQ-WEB-004-E3/W2).
//   EC-004-C guard: this panel intentionally renders ONLY a highlight-question
//   input/answer + remaining-cap notice — no flashcards, recall quizzes, or an
//   "expression dictionary" curation surface.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.3/5.5 (REQ-WEB-004-E3/W2/U3, AC-004-3, EC-004-B/C)
import { useState } from "react";
import type { AskedItemSourceRef } from "@inputenglish/shared";
import { postQuestion } from "@/lib/premium/post-question";

interface HighlightQuestionPanelProps {
  sourceType: "reading" | "segment";
  sourceRef: AskedItemSourceRef;
  remainingQuestionCap: number;
}

export function HighlightQuestionPanel({
  sourceType,
  sourceRef,
  remainingQuestionCap,
}: HighlightQuestionPanelProps) {
  const [highlightText, setHighlightText] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(remainingQuestionCap);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!highlightText.trim() || !question.trim() || submitting) return;
    setSubmitting(true);
    setAnswer(null);
    setNotice(null);

    const result = await postQuestion({
      highlightText,
      question,
      sourceType,
      sourceRef,
    });

    setSubmitting(false);

    if (result.status === 200) {
      setAnswer(result.body.answer ?? null);
      if (typeof result.body.remainingDailyCap === "number") {
        setRemaining(result.body.remainingDailyCap);
      }
      // Daily notice takes precedence (positive framing / soft-fail), fall
      // back to the existing monthly capNotice if present.
      setNotice(result.body.dailyCapNotice ?? result.body.capNotice ?? null);
    } else {
      setNotice(result.body.error ?? "질문을 보내지 못했어요.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
      <p className="text-xs text-gray-500">
        문장을 하이라이트하고 궁금한 점을 물어보세요.
      </p>
      <input
        value={highlightText}
        onChange={(e) => setHighlightText(e.target.value)}
        placeholder="하이라이트한 문장"
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      />
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="질문을 입력하세요"
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-fit rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {submitting ? "전송 중…" : "질문하기"}
      </button>

      {answer ? <p className="text-sm">{answer}</p> : null}
      {notice ? <p className="text-xs text-gray-500">{notice}</p> : null}
      <p className="text-xs text-gray-400">오늘 남은 질문: {remaining}</p>
    </div>
  );
}
