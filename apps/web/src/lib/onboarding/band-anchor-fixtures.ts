// @MX:NOTE: [AUTO] Phase 3 PLACEHOLDER fixture data (REQ-WEB-002-E1, AC-002-1).
// @MX:REASON: [AUTO] The real Phase 4 IL-tagged video whitelist (REQ-WEB-003) does not
//   exist yet. These 7 rows are onboarding self-placement ANCHORS ONLY — well-known,
//   real, public YouTube content chosen to give users a recognizable "comfortable vs
//   overwhelming" gut-check per IL band. They are NOT the whitelist itself and MUST be
//   replaced by real Phase 4 whitelist-derived anchors once the segment index exists.
//
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E1, U2)

/** A single onboarding band-anchor card (Phase 3 placeholder — see @MX:NOTE above). */
export interface BandAnchorFixture {
  /** IL 7-band index (1.0-7.0), integer anchor for onboarding purposes. */
  il: number;
  /** Short human label shown on the card (e.g. "Peppa Pig"). */
  label: string;
  /** Public YouTube video id for the iframe embed sample clip. */
  youtubeVideoId: string;
  /** Short description of why this anchor represents the band. */
  description: string;
}

/**
 * 7 IL-band onboarding anchors, ascending from easiest (IL 1) to hardest (IL 7).
 *
 * Selection rationale (placeholder, Phase 3 only):
 *  - IL 1: Peppa Pig — extremely simple, slow, child-directed speech.
 *  - IL 2: Simple kids' educational content (Sesame Street style).
 *  - IL 3: Everyday conversational vlog content, moderate pace.
 *  - IL 4: TED-Ed style explainer — clear articulation, moderate vocabulary.
 *  - IL 5: Standard TED Talk — natural adult pace, broader vocabulary.
 *  - IL 6: News broadcast (VOA/BBC Learning English style) — faster, denser.
 *  - IL 7: Dense academic lecture — fast, technical, minimal simplification.
 */
export const BAND_ANCHOR_FIXTURES: BandAnchorFixture[] = [
  {
    il: 1,
    label: "Peppa Pig",
    youtubeVideoId: "Yxo6273JHrs",
    description: "매우 느리고 단순한 어린이용 대화",
  },
  {
    il: 2,
    label: "Sesame Street",
    youtubeVideoId: "9C5U1Wc-fW4",
    description: "쉬운 교육용 어린이 콘텐츠",
  },
  {
    il: 3,
    label: "Everyday Vlog",
    youtubeVideoId: "aGKMWBB5xwI",
    description: "일상 대화 속도의 브이로그",
  },
  {
    il: 4,
    label: "TED-Ed",
    youtubeVideoId: "yoD8RMq2OkU",
    description: "명료한 발음의 설명형 콘텐츠",
  },
  {
    il: 5,
    label: "TED Talk",
    youtubeVideoId: "8S0FDjFBj8o",
    description: "자연스러운 성인 화자의 강연",
  },
  {
    il: 6,
    label: "BBC Learning English News",
    youtubeVideoId: "hFV71QPvX2I",
    description: "빠르고 밀도 높은 뉴스 방송",
  },
  {
    il: 7,
    label: "Academic Lecture",
    youtubeVideoId: "UF8uR6Z6KLc",
    description: "빠르고 전문적인 학술 강의",
  },
];
