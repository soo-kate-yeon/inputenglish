"use client";

// @MX:ANCHOR: [AUTO] Learning home client component — Task 5.2 entry point consuming
//   GET /api/premium/today via fetchTodaySession() + buildLearningHomeViewModel().
// @MX:REASON: [AUTO] All branching logic (upgrade-required/preparing/ready/error) lives
//   in the pure, unit-tested learning-home-view-model.ts; this component only renders
//   the resulting discriminated view-model and owns fetch-on-mount state.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.2 (REQ-WEB-004, REQ-WEB-005, AC-004-1, AC-005-2)

import { useEffect, useState } from "react";
import { fetchTodaySession } from "@/lib/premium/fetch-today-session";
import {
  buildLearningHomeViewModel,
  type LearningHomeViewModel,
} from "@/lib/premium/learning-home-view-model";
import { LadderScreen } from "@/components/premium/LadderScreen";

export function LearningHome() {
  const [vm, setVm] = useState<LearningHomeViewModel | { kind: "loading" }>({
    kind: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    fetchTodaySession().then((result) => {
      if (cancelled) return;
      setVm(buildLearningHomeViewModel(result));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (vm.kind === "loading") {
    return <p className="text-sm text-gray-500">오늘 세션을 불러오는 중…</p>;
  }

  if (vm.kind === "upgrade-required") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold">구독이 필요해요</h2>
        <p className="text-sm text-gray-600">
          체험 기간이 끝났거나 구독이 없어요. 약정을 시작하면 오늘의 콘텐츠에
          바로 접근할 수 있어요.
        </p>
        <a
          href="/billing"
          className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          구독 시작하기
        </a>
      </div>
    );
  }

  if (vm.kind === "preparing") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold">콘텐츠 준비 중</h2>
        <p className="text-sm text-gray-600">
          지금 밴드에 맞는 콘텐츠를 준비하고 있어요. 곧 채워드릴게요.
        </p>
      </div>
    );
  }

  if (vm.kind === "error") {
    return (
      <p className="text-sm text-red-500">
        오늘 세션을 불러오지 못했어요: {vm.message}
      </p>
    );
  }

  return (
    <LadderScreen
      readingPiece={vm.readingPiece}
      segments={vm.segments}
      remainingQuestionCap={vm.remainingQuestionCap}
    />
  );
}
