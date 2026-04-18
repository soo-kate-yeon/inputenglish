---
id: SPEC-MOBILE-013
title: "Goal-Oriented Home + Explore Split + Daily Input Queue"
version: "1.1.1"
status: completed
created: "2026-04-18"
updated: "2026-04-19"
author: Codex
priority: P0
dependencies:
  - SPEC-MOBILE-012
  - SPEC-MOBILE-003
  - SPEC-MOBILE-004
  - SPEC-MOBILE-005
tags:
  - mobile
  - home
  - feed
  - personalization
---

# SPEC-MOBILE-013: Goal-Oriented Home + Explore Split + Daily Input Queue

## 1. Overview

현재 홈은 기능/탐색 중심 세션 피드에 가깝고, 사용자가 오늘 무엇을 해야 하는지
즉시 이해하기 어렵다. 신규 온보딩이 도입되면 홈은 "둘러보는 곳"이 아니라
**오늘 바로 연습할 인풋을 받는 곳**이 되어야 한다.

이 SPEC은 홈을 `오늘의 인풋` 중심 구조로 재편하고, 기존 탐색형 목록은 별도
`탐색` 탭으로 분리하며, 사용자의 learning profile에 맞춰 하루 최대 3개의
학습 카드를 샘플링하는 daily queue를 정의한다.

## 2. Requirements

### 2.1 Home Information Architecture

#### REQ-HOME-001

시스템은 **항상** 홈의 1차 목적을 "오늘 할 학습 제안"으로 정의해야 하며, 기존
탐색형 세션 목록을 홈의 주 콘텐츠로 사용해서는 안 된다.

#### REQ-HOME-002

**WHEN** 사용자가 홈에 진입하면 **THEN** 상단에 `오늘의 인풋` 타이틀과 오늘의
학습 카드 목록이 먼저 보여야 한다.

#### REQ-HOME-003

**WHEN** 사용자가 더 많은 영상을 둘러보고 싶으면 **THEN** 별도 `탐색` 탭에서
기존 세션/영상 탐색 경험에 접근할 수 있어야 한다.

### 2.2 Daily Input Card

#### REQ-CARD-001

시스템은 **항상** 각 카드에 아래 요소를 포함해야 한다.

- 대표 영상 정보
- 오늘 학습할 핵심 문장
- 번역 토글
- 즉시 녹음 버튼

#### REQ-CARD-002

**WHEN** 사용자가 문장을 탭하면 **THEN** 해당 문장 구간으로 즉시 seek 후 재생이
시작되어야 한다.

#### REQ-CARD-003

**WHEN** 사용자가 번역 토글을 켜면 **THEN** 번역이 표시되어야 하고, 끄면 다시
숨겨져야 한다.

#### REQ-CARD-004

**WHEN** 사용자가 카드의 녹음 버튼을 누르면 **THEN** 기존 녹음 플로우를 재사용해
즉시 발화 시도를 시작할 수 있어야 한다.

### 2.3 Daily Queue Rules

#### REQ-QUEUE-001

시스템은 **항상** 하루 학습 카드 수를 최대 3개로 제한해야 한다.

#### REQ-QUEUE-002

시스템은 **항상** daily queue를 사용자의 learning profile에 기반해 생성해야 한다.

#### REQ-QUEUE-003

시스템은 **항상** 3개 중 최소 1개를 복습 또는 반복 목적 카드로 우선 배정할 수
있어야 한다.

#### REQ-QUEUE-004

시스템은 **항상** 같은 날 동일한 문장 또는 동일한 패턴을 중복 배정해서는 안 된다.

#### REQ-QUEUE-005

**IF** profile 기반 후보가 부족하면 **THEN** 시스템은 일반 curated session에서
fallback 후보를 채워 daily queue를 비워두지 않아야 한다.

### 2.4 Swipe Navigation

#### REQ-SWIPE-001

**WHEN** 사용자가 홈 카드 영역을 좌우로 스와이프하면 **THEN** 다음 또는 이전
학습 카드로 이동할 수 있어야 한다.

#### REQ-SWIPE-002

시스템은 **항상** 카드 전환 전에 다음 또는 이전 카드가 일부 보이는 affordance를
제공해야 하며, 현재 카드 기준선이 전환 후에도 흔들리지 않아야 한다.

### 2.5 Mode-aware Follow-up Surface

#### REQ-FOLLOW-001

시스템은 **항상** 오늘의 인풋 카드 하단 영역을 사용자의 `goal_mode`에 따라 다른
후속 학습 surface로 구성해야 한다.

#### REQ-FOLLOW-002

**IF** 사용자의 `goal_mode`가 `pronunciation`이면 **THEN** 카드 하단에는 방금
녹음한 시도를 바탕으로 피드백/교정 세션으로 이어지는 pronunciation surface가
표시되어야 한다.

#### REQ-FOLLOW-003

**IF** 사용자의 `goal_mode`가 `expression`이면 **THEN** 카드 하단에는 기존
변형연습 경험을 경량 카드로 재구성한 expression practice surface가 표시되어야
한다.

#### REQ-FOLLOW-004

시스템은 **항상** mode-aware follow-up surface를 카드 바깥 별도 CTA 링크가 아니라,
오늘의 인풋 카드 하단에 바로 이어지는 실행 영역으로 제공해야 한다.

### 2.6 Mode-aware Routing

#### REQ-MODE-001

**IF** 사용자의 `goal_mode`가 `pronunciation`이면 **THEN** 카드 완료 후 발음 분석형
후속 경험으로 연결할 수 있어야 한다.

#### REQ-MODE-002

**IF** 사용자의 `goal_mode`가 `expression`이면 **THEN** 카드 완료 후 표현 연습형
후속 경험으로 연결할 수 있어야 한다.

### 2.7 Analytics

#### REQ-ANA-001

**WHEN** 홈의 오늘 카드가 노출되면 **THEN** `daily_input_impression` 이벤트가
수집되어야 한다.

#### REQ-ANA-002

**WHEN** 사용자가 문장을 탭해 구간 재생을 시작하면 **THEN**
`daily_input_seek_play` 이벤트가 수집되어야 한다.

#### REQ-ANA-003

**WHEN** 사용자가 녹음을 시작하면 **THEN** `daily_input_record_start` 이벤트가
수집되어야 한다.

#### REQ-ANA-004

**WHEN** 사용자가 홈 카드를 스와이프해 다음 카드로 이동하면 **THEN**
`daily_input_swipe` 이벤트가 수집되어야 한다.

## 3. Scope

### In Scope

- 홈 정보 구조 개편
- `탐색` 탭 분리
- 오늘의 인풋 카드 UI
- 문장 탭 seek-to-play
- 번역 토글
- 카드 스와이프
- mode-aware 하단 후속 surface
- daily queue 샘플링 규칙
- 홈 analytics

### Out of Scope

- 발음 분석 상세 UI
- 표현 모드 샘플 답변 UI
- 콘텐츠 생성 admin
- 정교한 추천 모델/ML

## 4. Technical Design

### 4.1 Suggested Queue Model

`daily_input_queues` (신규 캐시 테이블 또는 서버 계산 결과)

- `user_id`
- `queue_date`
- `items` JSONB
- `goal_mode`
- `generated_from_profile_hash`
- `created_at`

`items` 예시:

- `session_id`
- `sentence_id`
- `video_id`
- `mode`
- `card_order`
- `is_review`

### 4.2 Sampling Rules

- 최근 완료 이력 우선 고려
- 최근 3일 내 완료 항목은 점수 감점
- profile focus와 metadata 일치 항목 가점
- 하루 최대 3개
- 최소 1개 복습 카드 허용

### 4.3 Navigation Notes

- 홈은 daily queue 소비 중심
- 기존 browse/listing은 `탐색` 탭으로 이동
- 카드 상세 진입 없이도 핵심 행동(듣기/말하기) 가능해야 함
- indicator보다 mode-aware 실행 surface가 우선이며, 카드 하단에서 다음 행동이
  바로 이어져야 함

### 4.4 Remaining Work From V1

현재 구현 기준에서 남은 핵심 작업은 아래와 같다.

1. 카드 하단 indicator 제거
2. `goal_mode`별 하단 follow-up surface 삽입
3. pronunciation surface와 expression surface에 공통 container 계약 정의
4. 홈 카드에서 mode-aware 후속 액션 analytics 연결
5. 스와이프 후 카드 기준선/preview 위치 안정화 QA

## 5. Implementation Phases

### Phase 1: Data + Routing

1. daily queue 타입/계산 함수 정의
2. 홈/탐색 탭 역할 재정의
3. 이벤트 schema 추가

### Phase 2: Home Card UI

1. 오늘의 인풋 레이아웃
2. 문장/번역 토글/seek 재생
3. 즉시 녹음 액션 연결

### Phase 3: Queue Assembly + Swipe

1. 하루 1~3개 샘플링 로직
2. 스와이프/preview affordance
3. fallback/빈 상태 처리

### Phase 4: Mode-aware Follow-up

1. pronunciation 하단 피드백 surface 삽입
2. expression 하단 연습 카드 surface 삽입
3. indicator 제거 및 하단 레이아웃 재정렬
4. 홈 내 후속 학습 진입 analytics 추가

## 6. Acceptance Criteria

- [ ] AC-001: 홈 진입 시 `오늘의 인풋` 카드가 우선 노출된다
- [ ] AC-002: 사용자는 홈에서 하루 최대 3개의 카드만 본다
- [ ] AC-003: 문장을 탭하면 해당 구간으로 seek 후 재생된다
- [ ] AC-004: 번역은 토글로만 노출된다
- [ ] AC-005: 카드에서 즉시 녹음을 시작할 수 있다
- [ ] AC-006: 기존 탐색형 세션 목록은 별도 `탐색` 탭으로 이동한다
- [ ] AC-007: 동일한 날 동일 문장/패턴 중복 카드가 노출되지 않는다
- [ ] AC-008: 핵심 home events가 수집된다
- [ ] AC-009: 카드 하단에는 goal_mode에 맞는 후속 학습 surface가 표시된다
- [ ] AC-010: expression 모드에서는 하단에서 변형 연습형 surface로 이어질 수 있다
- [ ] AC-011: pronunciation 모드에서는 하단에서 피드백/교정 surface로 이어질 수 있다
