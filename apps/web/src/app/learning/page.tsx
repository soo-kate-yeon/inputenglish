// @MX:ANCHOR: [AUTO] GET /learning — Phase 5 Task 5.2 learning home entry page.
// @MX:REASON: [AUTO] Landing point for auth/callback once onboarding_completed_at is
//   set (see auth/callback/route.ts). Root `/` remains the admin redirect for the
//   pre-existing admin surface; this SPEC does not change that behavior.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.2 (REQ-WEB-004, REQ-WEB-005, AC-004-1, AC-005-2)

import { LearningHome } from "./LearningHome";

export default function LearningPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold">오늘의 학습</h1>
      </header>
      <LearningHome />
    </div>
  );
}
