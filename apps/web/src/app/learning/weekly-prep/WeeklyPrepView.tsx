"use client";

// @MX:ANCHOR: [AUTO] WeeklyPrepView — Task 6.2 web delivery + print/PDF export.
// @MX:REASON: [AUTO] REQ-WEB-006-U1 requires "다운로드(PDF 등) 가능" (downloadable as
//   PDF, etc — deliberately flexible wording). No PDF-generation library exists in this
//   repo yet, so this uses a print-friendly layout (`print:` Tailwind variants + a
//   window.print() button) — the browser's native print-to-PDF satisfies "PDF export"
//   without adding a new server-side rendering dependency. The non-printable chrome
//   (header, print button) is hidden via `print:hidden`.
// @MX:SPEC: SPEC-WEB-001 Phase 6 Task 6.2 (REQ-WEB-006-U1)
import { useEffect, useState } from "react";
import type { WeeklyPrep } from "@inputenglish/shared";
import { fetchWeeklyPrep } from "@/lib/premium/fetch-weekly-prep";

export function WeeklyPrepView() {
  const [weeklyPrep, setWeeklyPrep] = useState<WeeklyPrep | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWeeklyPrep().then((result) => {
      if (cancelled) return;
      if (result.status === 200) {
        setWeeklyPrep(result.body.weeklyPrep ?? null);
      } else if (result.status === 402) {
        setError("구독 후 이용할 수 있어요.");
      } else {
        setError(result.body.error ?? "예습자료를 불러오지 못했어요.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (weeklyPrep === undefined) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>;
  }

  if (weeklyPrep === null || weeklyPrep.vocab.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        아직 이번 주 예습자료가 준비되지 않았어요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => window.print()}
        className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white print:hidden"
      >
        PDF로 저장 / 인쇄
      </button>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">이번 주 핵심 표현</h2>
        <ul className="flex flex-wrap gap-2">
          {weeklyPrep.expressions.map((expression) => (
            <li
              key={expression}
              className="rounded-full bg-gray-100 px-3 py-1 text-sm"
            >
              {expression}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">이번 주 단어집</h2>
        <ul className="flex flex-wrap gap-2">
          {weeklyPrep.vocab.map((word) => (
            <li
              key={word}
              className="rounded-full bg-gray-100 px-3 py-1 text-sm"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">실제 문장에서</h2>
        <ul className="flex flex-col gap-2">
          {weeklyPrep.sourceSentences.map((sentence) => (
            <li
              key={sentence.text}
              className="rounded-md border border-gray-200 p-3 text-sm leading-relaxed"
            >
              {sentence.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
