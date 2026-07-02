"use client";

// @MX:ANCHOR: [AUTO] QuestionHistoryList — Task 5.6 read-only question-history tab.
// @MX:REASON: [AUTO] EC-004-C: renders ONLY the AskedItem history list (highlight,
//   question, answer, date) — no flashcards, recall quizzes, or "expression
//   dictionary" curation UI.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.6 (REQ-WEB-004-U3, EC-004-C)
import { useEffect, useState } from "react";
import type { AskedItem } from "@inputenglish/shared";
import { fetchAskedItems } from "@/lib/premium/fetch-asked-items";

export function QuestionHistoryList() {
  const [items, setItems] = useState<AskedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAskedItems().then((result) => {
      if (cancelled) return;
      if (result.status === 200 && result.body.items) {
        setItems(result.body.items);
      } else {
        setError(result.body.error ?? "질문 기록을 불러오지 못했어요.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (items === null) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        아직 남긴 질문이 없어요. 학습 중 문장을 하이라이트해서 질문해보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-md border border-gray-200 p-3 text-sm"
        >
          <p className="font-medium">&ldquo;{item.highlightText}&rdquo;</p>
          {item.question ? (
            <p className="text-gray-600">Q. {item.question}</p>
          ) : null}
          {item.answer ? (
            <p className="text-gray-800">A. {item.answer}</p>
          ) : null}
          <p className="mt-1 text-xs text-gray-400">
            {new Date(item.createdAt).toLocaleDateString("ko-KR")}
          </p>
        </li>
      ))}
    </ul>
  );
}
