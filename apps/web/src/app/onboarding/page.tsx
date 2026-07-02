// @MX:ANCHOR: [AUTO] GET /onboarding — Phase 3 IL 7-band self-placement entry page.
// @MX:REASON: [AUTO] Landing point for users redirected here by auth/callback when
//   il_index is unset (REQ-WEB-001-E2). Renders the Task 3.1 band-seed step; the
//   vocab-diagnostic cross-validation (Task 3.2) and course selection (Task 3.3) are
//   surfaced via the client-side onboarding flow after seeding completes.
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E1, E2, U1, U2)

import { BAND_ANCHOR_FIXTURES } from "@/lib/onboarding/band-anchor-fixtures";
import { OnboardingFlow } from "./OnboardingFlow";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold">밴드 자가배치</h1>
        <p className="text-sm text-gray-500">
          네게 딱 맞는 난이도를 찾기 위한 3단계를 진행할게요.
        </p>
      </header>

      <OnboardingFlow fixtures={BAND_ANCHOR_FIXTURES} />
    </div>
  );
}
