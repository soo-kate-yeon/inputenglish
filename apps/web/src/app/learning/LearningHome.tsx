"use client";

// @MX:ANCHOR: [AUTO] Learning home client component — Task 5.2 entry point consuming
//   GET /api/premium/today via fetchTodaySession() + buildLearningHomeViewModel().
// @MX:REASON: [AUTO] All branching logic (upgrade-required/preparing/ready/error) lives
//   in the pure, unit-tested learning-home-view-model.ts; this component only renders
//   the resulting discriminated view-model and owns fetch-on-mount state.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.2 (REQ-WEB-004, REQ-WEB-005, AC-004-1, AC-005-2)

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Heading, Text } from "@framingui/ui";
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
    return (
      <Text variant="body" className="text-neutral-500">
        오늘 세션을 불러오는 중…
      </Text>
    );
  }

  if (vm.kind === "upgrade-required") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <Heading level={2} className="text-lg">
            구독이 필요해요
          </Heading>
          <Text variant="body" className="text-neutral-600">
            체험 기간이 끝났거나 구독이 없어요. 약정을 시작하면 오늘의 콘텐츠에
            바로 접근할 수 있어요.
          </Text>
          <Button asChild variant="default" className="w-fit">
            <a href="/billing">구독 시작하기</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (vm.kind === "preparing") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-6">
          <Heading level={2} className="text-lg">
            콘텐츠 준비 중
          </Heading>
          <Text variant="body" className="text-neutral-600">
            지금 밴드에 맞는 콘텐츠를 준비하고 있어요. 곧 채워드릴게요.
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (vm.kind === "error") {
    return (
      <Text variant="body" className="text-red-600 dark:text-red-400">
        오늘 세션을 불러오지 못했어요: {vm.message}
      </Text>
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
