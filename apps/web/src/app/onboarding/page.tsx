// @MX:ANCHOR: [AUTO] GET /onboarding — Phase 3 IL 7-band self-placement entry page.
// @MX:REASON: [AUTO] Landing point for users redirected here by auth/callback when
//   il_index is unset (REQ-WEB-001-E2). Renders the Task 3.1 band-seed step; the
//   vocab-diagnostic cross-validation (Task 3.2) and course selection (Task 3.3) are
//   surfaced via the client-side onboarding flow after seeding completes.
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E1, E2, U1, U2)

import { Heading, Text } from "@framingui/ui";
import { BAND_ANCHOR_FIXTURES } from "@/lib/onboarding/band-anchor-fixtures";
import { OnboardingFlow } from "./OnboardingFlow";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <Heading level={1} className="text-2xl">
          밴드 자가배치
        </Heading>
        <Text variant="body" className="text-neutral-500">
          네게 딱 맞는 난이도를 찾기 위한 3단계를 진행할게요.
        </Text>
      </header>

      <OnboardingFlow fixtures={BAND_ANCHOR_FIXTURES} />
    </div>
  );
}
