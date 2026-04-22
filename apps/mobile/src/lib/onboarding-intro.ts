import type { ImageSourcePropType } from "react-native";

export type IntroScene = {
  id: string;
  title: string;
  mediaLabel: string;
  // @MX:NOTE: Use the raw require() value as ImageSourcePropType rather than
  //           Asset.fromModule(...).uri. On Hermes release builds (TestFlight),
  //           Asset.fromModule().uri resolves to null for bundled assets until
  //           downloadAsync() runs, which made the intro flow show the
  //           "IMAGE / VIDEO" fallback with the placeholder label instead of
  //           the actual scene artwork. Passing the require() result directly
  //           to <Image source={...}> lets Metro resolve the bundled asset
  //           synchronously in both dev and production.
  mediaSource?: ImageSourcePropType;
  citation?: string;
  showLoginCta?: boolean;
};

const INTRO_MEDIA_SOURCES: ImageSourcePropType[] = [
  require("../../assets/images/onboarding/onboarding_1.png"),
  require("../../assets/images/onboarding/onboarding_2.png"),
  require("../../assets/images/onboarding/onboarding_3.png"),
  require("../../assets/images/onboarding/onboarding_4.png"),
  require("../../assets/images/onboarding/onboarding_5.png"),
  require("../../assets/images/onboarding/onboarding_6.png"),
  require("../../assets/images/onboarding/onboarding_7.png"),
  require("../../assets/images/onboarding/onboarding_8.png"),
];

export const INTRO_SCENES: IntroScene[] = [
  {
    id: "scene-1",
    title:
      "어느 날, 유창한 원어민의 발음과 표현을 훔쳐 내 걸로 만들 수 있다면 얼마나 좋을까요?",
    mediaLabel: "인터뷰와 자막이 겹쳐지는 장면",
    mediaSource: INTRO_MEDIA_SOURCES[0],
  },
  {
    id: "scene-2",
    title:
      "자, 증명된 것만 말해볼게요.\n언어는 학습(learning)이 아니라 습득(acquisition)으로 뇌에 장착된다. 그리고 습득은 이해 가능한 입력이 충분히 쌓일 때 자동으로 일어난다.",
    mediaLabel: "입력과 패턴이 쌓이는 시각적 placeholder",
    mediaSource: INTRO_MEDIA_SOURCES[1],
    citation:
      "언어학자 Stephen Krashen이 1985년에 제안한 핵심 이론이에요. 문법을 외우고 규칙을 분석하는 '학습'이 아니라, 이해할 수 있는 영어를 대량으로 듣고 읽으면서 뇌가 스스로 패턴을 흡수하는 '습득'이 진짜 언어 능력이라는 거예요. 이후 40년간 다독 연구, 아기의 언어 습득 실험, 뇌 기억 시스템 연구가 모두 같은 결론을 내렸어요.",
  },
  {
    id: "scene-3",
    title:
      "아기가 문법책을 보고 모국어를 익히지 않잖아요. 수만 시간의 입력(input)에서 자동으로 통계적 규칙성을 추출하는 거죠.",
    mediaLabel: "듣기와 반복을 상징하는 placeholder",
    mediaSource: INTRO_MEDIA_SOURCES[2],
  },
  {
    id: "scene-4",
    title:
      "성인도 마찬가지에요. 강의나 비법서 가지고 되는 게 영어였으면 왜 이렇게 많은 한국인이 영어 하나로 고통받고 있을까요?",
    mediaLabel: "강의보다 실제 콘텐츠를 상징하는 placeholder",
    mediaSource: INTRO_MEDIA_SOURCES[3],
  },
  {
    id: "scene-5",
    title:
      "그냥 수십 번, 수백 번, 수천 번 문장을 보고 읽고 만들어보면 되는 거예요.",
    mediaLabel: "스크립트, 카드, 녹음을 상징하는 placeholder",
    mediaSource: INTRO_MEDIA_SOURCES[4],
  },
  {
    id: "scene-6",
    title:
      "그 수천 번으로 향하는 과정을 돕기 위해 인풋영어(InputEnglish)를 만들었어요.",
    mediaLabel: "셀럽 인터뷰와 실무 인터뷰를 상징하는 placeholder",
    mediaSource: INTRO_MEDIA_SOURCES[5],
  },
  {
    id: "scene-7",
    title:
      "영어를 좀 하세요? 잘됐네요. 연습 기능으로 문장을 만들어보세요. 업계 리드급들의 최신 인터뷰로 역량 업그레이드까지 하시고요.",
    mediaLabel: "실무 인터뷰와 고급 인풋을 상징하는 placeholder",
    mediaSource: INTRO_MEDIA_SOURCES[6],
  },
  {
    id: "scene-8",
    title:
      "영어를 못하세요? 잘 오셨어요. 일단 그냥 매일 듣고 읽고, 따라해보세요. 공부하기 싫으면 좋아하는 셀럽 인터뷰나 영화라도 보러 오세요.",
    mediaLabel: "셀럽 인터뷰와 영화 장면을 상징하는 placeholder",
    mediaSource: INTRO_MEDIA_SOURCES[7],
  },
  {
    id: "scene-9",
    title:
      "2주 안에 입이 트인다는 거짓말은 안할게요.\n하지만 여러분이 씹고 뜯고 맛볼 인풋들은 많이 준비해뒀어요.",
    mediaLabel: "즐길 수 있는 인풋 큐레이션을 상징하는 placeholder",
    showLoginCta: true,
  },
];
