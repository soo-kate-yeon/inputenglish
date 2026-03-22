# Git 완벽 가이드 - 비개발자를 위한 실전 매뉴얼

> "Commit? Push? PR? 이게 뭔데 다들 쓰는거야?"
>
> 이 문서는 Git을 처음 접하는 분들이 **실전에서 바로 사용**할 수 있도록 만들어졌습니다.

## 📋 목차

1. [Git이란 무엇인가?](#git이란-무엇인가)
2. [핵심 개념 3가지](#핵심-개념-3가지)
3. [실전 워크플로우](#실전-워크플로우)
4. [명령어 완전 정복](#명령어-완전-정복)
5. [CI/CD와의 연결](#cicd와의-연결)
6. [문제 해결](#문제-해결)

---

## Git이란 무엇인가?

### 🎯 한 줄 정의

**Git = 코드의 변경 이력을 관리하는 도구**

### 🏢 현실 세계 비유

**Git 없이 작업하기**:

```
작업.docx
작업_최종.docx
작업_진짜최종.docx
작업_진짜진짜최종.docx
작업_최종_수정본.docx
작업_최종_수정본_진짜최종.docx
```

**Git으로 작업하기**:

```
작업.docx (하나의 파일)
  ├─ 버전 1: 초안 작성 (2025-01-01)
  ├─ 버전 2: 오타 수정 (2025-01-02)
  ├─ 버전 3: 내용 추가 (2025-01-03)
  └─ 버전 4: 최종 검토 (2025-01-04)

언제든지 이전 버전으로 돌아갈 수 있음!
```

### 🌟 Git의 핵심 가치

1. **타임머신**: 과거 어떤 시점으로든 돌아갈 수 있음
2. **협업**: 여러 명이 동시에 작업 가능
3. **백업**: 클라우드에 자동 저장
4. **추적**: 누가, 언제, 무엇을, 왜 바꿨는지 기록

---

## 핵심 개념 3가지

### 1️⃣ Repository (저장소) = 프로젝트 폴더

**비유**: 프로젝트의 집

```
Local Repository (로컬 저장소)
└─ 내 컴퓨터에 있는 프로젝트 폴더

Remote Repository (원격 저장소)
└─ GitHub에 있는 프로젝트 폴더 (클라우드)
```

**예시**:

```bash
# 로컬 저장소 위치
/Users/asleep/Developer/inputenglish

# 원격 저장소 주소
https://github.com/your-username/inputenglish
```

---

### 2️⃣ Commit (커밋) = 저장 + 스냅샷

**비유**: 게임의 세이브 포인트

#### Commit의 구조

```
┌─────────────────────────────────────┐
│ Commit ID: abc1234                 │ ← 고유 번호 (자동 생성)
│ Author: 김개발 <dev@email.com>     │ ← 누가
│ Date: 2025-01-15 14:30            │ ← 언제
│ Message: "로그인 버그 수정"         │ ← 무엇을, 왜
│                                     │
│ Changed files:                      │
│  - src/app/login/page.tsx (+5, -2) │ ← 변경된 파일
│  - src/lib/auth.ts (+10, -0)       │
└─────────────────────────────────────┘
```

#### 좋은 Commit vs 나쁜 Commit

**❌ 나쁜 예시**:

```bash
git commit -m "수정"
git commit -m "ㅇㅇ"
git commit -m "아무튼 고침"
```

**✅ 좋은 예시**:

```bash
git commit -m "feat: 사용자 프로필 페이지 추가"
git commit -m "fix: 로그인 시 세션 만료 오류 수정"
git commit -m "docs: README에 설치 가이드 추가"
```

#### Commit 메시지 규칙

```
타입: 간단한 설명 (50자 이내)

상세 설명 (선택사항)
- 왜 이 변경이 필요한가?
- 무엇을 변경했는가?
- 어떤 영향이 있는가?
```

**타입 종류**:
| 타입 | 의미 | 예시 |
|------|------|------|
| `feat` | 새 기능 | feat: AI 발음 분석 기능 추가 |
| `fix` | 버그 수정 | fix: 로그인 에러 수정 |
| `docs` | 문서 수정 | docs: API 문서 업데이트 |
| `style` | 코드 포맷팅 | style: 들여쓰기 정리 |
| `refactor` | 코드 개선 | refactor: 인증 로직 개선 |
| `test` | 테스트 추가 | test: 로그인 테스트 추가 |
| `chore` | 기타 작업 | chore: 의존성 업데이트 |
| `perf` | 성능 개선 | perf: 이미지 로딩 최적화 |

---

### 3️⃣ Branch (브랜치) = 평행 세계

**비유**: 소설의 외전

#### Branch의 개념

```
main (메인 스토리)
├─ Chapter 1: 프로젝트 시작
├─ Chapter 2: 로그인 기능
└─ Chapter 3: 프로필 기능

feature/ai-analysis (외전 - AI 기능 개발)
├─ 메인 스토리와 별도 진행
├─ 실험하고 망가뜨려도 메인에 영향 없음
└─ 완성되면 메인에 합침 (Merge)
```

#### Branch 전략

```
main (프로덕션)
  └─ 실제 서비스 운영 중인 코드
  └─ 항상 안정적이어야 함
  └─ 함부로 건드리지 않음

develop (개발)
  └─ 개발 중인 코드
  └─ 새 기능들을 모으는 곳

feature/* (기능 개발)
  └─ 새 기능 하나하나를 개발
  └─ 예: feature/user-profile
  └─ 예: feature/ai-pronunciation

hotfix/* (긴급 수정)
  └─ 프로덕션의 긴급 버그 수정
  └─ 예: hotfix/login-error
```

#### 우리 프로젝트의 Branch 전략

```
main
  └─ 실제 서비스 (https://yourdomain.com)
  └─ Git 푸시 → 자동 배포

feature/new-feature
  └─ 새 기능 개발
  └─ PR 생성 → Preview 배포
  └─ 팀 검토 → main에 합침

hotfix/critical-bug
  └─ 긴급 버그 수정
  └─ 빠르게 main에 합침
```

---

## 실전 워크플로우

### 시나리오 1: 혼자 작업하기 (기본)

#### 1단계: 프로젝트 시작

```bash
# 1. GitHub에서 저장소 클론 (최초 1회)
cd ~/Developer
git clone https://github.com/your-username/inputenglish.git
cd inputenglish

# 이제 이 폴더가 Git 저장소!
```

**결과**:

```
📁 inputenglish/
  ├─ .git/           ← Git 설정 폴더 (건드리지 말 것!)
  ├─ src/            ← 소스 코드
  ├─ package.json
  └─ README.md
```

---

#### 2단계: 코드 수정

```bash
# 1. 최신 코드 받아오기
git pull origin main

# 2. 파일 수정
# (VS Code나 에디터에서 코드 수정)

# 3. 변경 내용 확인
git status
```

**git status 결과 해석**:

```bash
$ git status

On branch main                          # 현재 main 브랜치에 있음
Your branch is up to date with 'origin/main'.

Changes not staged for commit:          # 아직 저장 안된 변경 사항
  modified:   src/app/page.tsx          # 수정된 파일

Untracked files:                         # 새로 만든 파일
  src/components/NewFeature.tsx
```

---

#### 3단계: 변경 사항 저장 (Commit)

```bash
# 1. 저장할 파일 선택 (Staging)
git add src/app/page.tsx
git add src/components/NewFeature.tsx

# 또는 모든 변경 사항 선택
git add .

# 2. 저장 (Commit)
git commit -m "feat: 새로운 기능 추가"
```

**과정 시각화**:

```
Working Directory        Staging Area        Local Repository
(작업 중인 파일)          (저장 대기)          (저장 완료)
┌──────────────┐        ┌──────────────┐    ┌──────────────┐
│ page.tsx     │        │              │    │              │
│ (수정됨)      │        │              │    │              │
└──────────────┘        └──────────────┘    └──────────────┘
       │
       │ git add
       ↓
┌──────────────┐        ┌──────────────┐    ┌──────────────┐
│              │        │ page.tsx     │    │              │
│              │        │ (대기 중)     │    │              │
└──────────────┘        └──────────────┘    └──────────────┘
                               │
                               │ git commit
                               ↓
┌──────────────┐        ┌──────────────┐    ┌──────────────┐
│              │        │              │    │ Commit       │
│              │        │              │    │ abc1234      │
└──────────────┘        └──────────────┘    └──────────────┘
```

---

#### 4단계: GitHub에 업로드 (Push)

```bash
# GitHub에 업로드
git push origin main
```

**결과**:

- 로컬 커밋이 GitHub에 업로드됨
- **CI/CD 자동 실행** ← 여기서 배포 파이프라인 시작!
- 3~5분 후 실제 서비스에 반영

---

### 시나리오 2: Branch 사용하기 (권장)

#### 왜 Branch를 사용하나?

**Branch 없이**:

```
main 브랜치에서 직접 작업
  ↓
실수로 버그 만듦
  ↓
main에 푸시
  ↓
실제 서비스가 망가짐! 😱
```

**Branch 사용**:

```
feature 브랜치에서 작업
  ↓
실수로 버그 만듦
  ↓
feature 브랜치에만 영향
  ↓
main과 실제 서비스는 안전! 😊
```

---

#### 실전: Feature Branch 워크플로우

**1단계: 새 Branch 만들기**

```bash
# 1. main 브랜치에서 시작
git checkout main

# 2. 최신 코드 받기
git pull origin main

# 3. 새 브랜치 생성 & 이동
git checkout -b feature/user-profile

# 확인
git branch
# * feature/user-profile  ← 현재 위치
#   main
```

**명명 규칙**:

```
feature/기능이름         → 새 기능
fix/버그이름             → 버그 수정
hotfix/긴급버그이름      → 긴급 수정
docs/문서이름            → 문서 작업
refactor/리팩토링이름    → 코드 개선
```

---

**2단계: 브랜치에서 작업**

```bash
# 1. 파일 수정
# (에디터에서 코드 작성)

# 2. 커밋
git add .
git commit -m "feat: 사용자 프로필 페이지 추가"

# 3. 더 작업하고 또 커밋
git add .
git commit -m "feat: 프로필 이미지 업로드 기능"

# 4. GitHub에 푸시
git push origin feature/user-profile
```

---

**3단계: Pull Request (PR) 생성**

**PR이란?**

- Pull Request = "이 코드 main에 합쳐주세요" 라는 요청
- 코드 리뷰를 받는 과정
- CI/CD 자동 테스트 실행
- Preview 배포 자동 생성

**PR 생성 방법**:

```
1. GitHub 웹사이트 접속
2. Repository 페이지
3. "Compare & pull request" 버튼 클릭
   (또는 "Pull requests" 탭 → "New pull request")

4. PR 정보 입력:
   ┌─────────────────────────────────────────┐
   │ Title: feat: 사용자 프로필 페이지 추가    │
   │                                          │
   │ Description:                             │
   │ ## 변경 사항                             │
   │ - 프로필 페이지 UI 구현                   │
   │ - 이미지 업로드 기능                      │
   │ - 프로필 수정 API 연동                    │
   │                                          │
   │ ## 테스트                                │
   │ - [x] 로컬 테스트 완료                    │
   │ - [x] 빌드 성공 확인                      │
   │                                          │
   │ ## 스크린샷                              │
   │ [이미지 첨부]                             │
   └─────────────────────────────────────────┘

5. "Create pull request" 클릭
```

---

**4단계: 자동 검사 대기**

PR 생성 즉시 **자동으로 실행**:

```
GitHub Actions 워크플로우:
├─ ✅ Lint Check (30초)
├─ ✅ Type Check (30초)
├─ ✅ Build (2분)
├─ ✅ Security Scan (1분)
├─ ✅ Lighthouse (3분)
└─ 🌐 Preview Deploy (2분)

총 소요 시간: ~9분
```

**PR 페이지에서 확인**:

```
GitHub PR 페이지:

Checks
  ✅ CI / Lint and Type Check
  ✅ CI / Build
  ✅ CI / Security Scan
  ✅ Lighthouse CI
  🌐 Deploy Preview

Preview URL:
https://inputenglish-git-feature-user-profile.vercel.app
```

---

**5단계: 코드 리뷰 (팀 작업 시)**

**혼자 작업**: 스킵 가능

**팀 작업**:

```
1. 팀원에게 리뷰 요청
2. 팀원이 코드 검토
3. 피드백:
   - 승인 (Approve) ✅
   - 변경 요청 (Request Changes) ⚠️
   - 코멘트 (Comment) 💬
4. 피드백 반영 후 다시 푸시
```

---

**6단계: Main에 Merge**

**모든 검사 통과 후**:

```
PR 페이지에서:
1. "Merge pull request" 버튼 클릭
2. Merge 방식 선택:
   - Merge commit (추천) ← 히스토리 보존
   - Squash and merge ← 커밋 하나로 합침
   - Rebase and merge ← 커밋 재정렬

3. "Confirm merge" 클릭
```

**자동 실행**:

```
main 브랜치에 Merge 완료
  ↓
GitHub Actions 자동 실행
  ├─ 모든 테스트 재실행
  ├─ Production 빌드
  └─ Vercel 배포
  ↓
3~5분 후 실제 서비스 반영!
```

---

**7단계: 정리**

```bash
# 1. main 브랜치로 돌아가기
git checkout main

# 2. 최신 코드 받기 (방금 merge된 코드)
git pull origin main

# 3. 사용한 브랜치 삭제 (선택)
git branch -d feature/user-profile

# 4. GitHub에서도 삭제 (선택)
git push origin --delete feature/user-profile
```

---

### 시나리오 3: 긴급 버그 수정 (Hotfix)

**상황**: 실제 서비스에 긴급 버그 발생!

```bash
# 1. main에서 hotfix 브랜치 생성
git checkout main
git checkout -b hotfix/login-error

# 2. 버그 수정
# (코드 수정)

# 3. 즉시 커밋 & 푸시
git add .
git commit -m "hotfix: 로그인 세션 만료 에러 수정"
git push origin hotfix/login-error

# 4. PR 생성 (또는 직접 merge)
# (긴급한 경우 PR 스킵 가능)

# 5. main에 merge
git checkout main
git merge hotfix/login-error
git push origin main

# 자동 배포 시작 (3~5분)
```

---

## 명령어 완전 정복

### 기본 명령어

#### `git status` - 현재 상태 확인

**사용 시점**: 항상! 명령어 실행 전후에 확인

```bash
git status
```

**결과 해석**:

```bash
On branch main                           # 현재 main 브랜치
Your branch is up to date with 'origin/main'.  # 최신 상태

Changes not staged for commit:           # 수정했지만 add 안함
  modified:   src/app/page.tsx

Untracked files:                          # 새 파일 (add 안함)
  src/components/New.tsx

nothing to commit, working tree clean    # 변경 사항 없음
```

---

#### `git add` - 저장할 파일 선택

**사용법**:

```bash
# 특정 파일만
git add src/app/page.tsx

# 여러 파일
git add src/app/page.tsx src/components/New.tsx

# 특정 폴더의 모든 파일
git add src/components/

# 모든 변경 사항
git add .

# 삭제된 파일 포함 모든 변경 사항
git add -A
```

**주의사항**:

```bash
# ❌ 이런 파일은 add하지 마세요!
git add .env              # 환경 변수 (비밀 정보!)
git add node_modules/     # 의존성 폴더 (용량 큼)
git add .DS_Store         # OS 파일

# .gitignore 파일이 자동으로 막아줍니다
```

---

#### `git commit` - 저장

**기본 사용**:

```bash
# 간단한 메시지
git commit -m "feat: 새 기능 추가"

# 자세한 메시지
git commit -m "feat: 사용자 프로필 기능 추가

- 프로필 페이지 UI 구현
- 이미지 업로드 기능
- API 연동 완료"
```

**고급 사용**:

```bash
# add + commit 한번에 (수정된 파일만)
git commit -am "fix: 버그 수정"

# 이전 커밋 메시지 수정
git commit --amend -m "새 메시지"

# 이전 커밋에 파일 추가
git add forgotten-file.tsx
git commit --amend --no-edit
```

---

#### `git push` - GitHub에 업로드

**기본 사용**:

```bash
# 현재 브랜치를 origin에 푸시
git push origin 브랜치이름

# main 브랜치 푸시
git push origin main

# feature 브랜치 푸시
git push origin feature/new-feature
```

**처음 푸시할 때**:

```bash
# 브랜치 생성 + 푸시 (최초 1회)
git push -u origin feature/new-feature

# 이후부터는
git push
```

---

#### `git pull` - GitHub에서 다운로드

**사용 시점**: 작업 시작 전, 항상!

```bash
# 최신 코드 받기
git pull origin main

# 현재 브랜치의 최신 코드 받기
git pull
```

**충돌 발생 시**:

```bash
$ git pull origin main

Auto-merging src/app/page.tsx
CONFLICT (content): Merge conflict in src/app/page.tsx
Automatic merge failed; fix conflicts and then commit the result.
```

**해결 방법**:

1. 충돌 파일 열기
2. 충돌 부분 찾기:
   ```typescript
   <<<<<<< HEAD
   const title = "내가 수정한 내용"
   =======
   const title = "GitHub에 있던 내용"
   >>>>>>> origin/main
   ```
3. 올바른 내용으로 수정
4. 커밋:
   ```bash
   git add src/app/page.tsx
   git commit -m "merge: 충돌 해결"
   git push origin main
   ```

---

### Branch 명령어

#### `git branch` - 브랜치 확인

```bash
# 로컬 브랜치 목록
git branch

# 결과:
#   feature/user-profile
# * main                    ← * 표시 = 현재 위치
#   hotfix/login-bug

# 원격 브랜치 포함
git branch -a

# 브랜치 생성 (이동은 안함)
git branch feature/new-feature

# 브랜치 삭제
git branch -d feature/old-feature

# 강제 삭제 (merge 안된 브랜치)
git branch -D feature/experimental
```

---

#### `git checkout` - 브랜치 이동

```bash
# 기존 브랜치로 이동
git checkout main
git checkout feature/user-profile

# 새 브랜치 생성 + 이동
git checkout -b feature/new-feature

# 특정 커밋으로 이동 (읽기 전용)
git checkout abc1234

# main으로 돌아가기
git checkout main
```

---

#### `git merge` - 브랜치 합치기

```bash
# feature를 main에 합치기
git checkout main              # 1. main으로 이동
git pull origin main           # 2. 최신 코드 받기
git merge feature/user-profile # 3. feature 합치기
git push origin main           # 4. 푸시
```

---

### 히스토리 명령어

#### `git log` - 커밋 히스토리 보기

```bash
# 기본 로그
git log

# 한 줄로 보기 (추천)
git log --oneline

# 결과:
# abc1234 feat: 프로필 기능 추가
# def5678 fix: 로그인 버그 수정
# ghi9012 docs: README 업데이트

# 그래프로 보기
git log --oneline --graph --all

# 최근 5개만
git log --oneline -n 5

# 특정 파일의 히스토리
git log --oneline src/app/page.tsx
```

---

#### `git diff` - 변경 내용 비교

```bash
# 아직 add 안한 변경 사항
git diff

# add한 변경 사항
git diff --staged

# 특정 파일만
git diff src/app/page.tsx

# 두 커밋 비교
git diff abc1234 def5678

# 브랜치 비교
git diff main feature/new-feature
```

---

### 되돌리기 명령어

#### `git restore` - 변경 취소 (권장)

```bash
# 파일 수정 취소 (add 전)
git restore src/app/page.tsx

# 모든 파일 수정 취소
git restore .

# add 취소 (파일은 그대로)
git restore --staged src/app/page.tsx
```

---

#### `git reset` - 커밋 되돌리기

**주의**: 협업 시 신중하게 사용!

```bash
# 최근 커밋 취소 (파일은 유지, add도 유지)
git reset --soft HEAD~1

# 최근 커밋 취소 (파일은 유지, add 취소)
git reset --mixed HEAD~1
# 또는
git reset HEAD~1

# 최근 커밋 취소 (모든 변경 삭제!)
git reset --hard HEAD~1

# 특정 커밋으로 되돌리기
git reset --hard abc1234
```

**HEAD~1 의미**:

- HEAD = 현재 커밋
- HEAD~1 = 한 단계 이전
- HEAD~2 = 두 단계 이전

---

#### `git revert` - 안전한 되돌리기

**추천**: 이미 push한 커밋 되돌리기

```bash
# 특정 커밋 되돌리기 (새 커밋 생성)
git revert abc1234

# 최근 커밋 되돌리기
git revert HEAD
```

**reset vs revert**:

```
git reset:
  커밋 히스토리에서 삭제
  push 전에만 사용
  위험함 (복구 어려움)

git revert:
  되돌리는 새 커밋 생성
  히스토리 보존
  안전함 (언제든 되돌릴 수 있음)
```

---

## CI/CD와의 연결

### Git → GitHub Actions → 배포

**전체 흐름**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 로컬 개발                                                  │
│    - 코드 수정                                                │
│    - git add, commit                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ git push
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. GitHub에 코드 업로드                                       │
│    - 원격 저장소 업데이트                                      │
│    - Webhook 트리거                                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Webhook
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. GitHub Actions 시작 (.github/workflows/*.yml)            │
│    - 자동으로 실행                                            │
│    - 가상 서버에서 작업                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. CI 파이프라인 실행                                         │
│    ├─ Lint Check                                            │
│    ├─ Type Check                                            │
│    ├─ Build                                                 │
│    ├─ Security Scan                                         │
│    └─ Lighthouse                                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ 모두 통과
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. CD 파이프라인 실행                                         │
│    ├─ Vercel 배포                                           │
│    ├─ DB 마이그레이션                                        │
│    └─ 알림 발송                                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ 3~5분 후
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 배포 완료                                                  │
│    - https://yourdomain.com 업데이트                         │
│    - 사용자들이 새 버전 사용                                  │
└─────────────────────────────────────────────────────────────┘
```

---

### Git 이벤트별 CI/CD 동작

#### Event 1: PR 생성/업데이트

**트리거**:

```bash
git push origin feature/new-feature
# + GitHub에서 PR 생성
```

**실행되는 워크플로우**:

```yaml
# .github/workflows/ci.yml
on:
  pull_request:
    branches: [main, develop]

# .github/workflows/deploy-preview.yml
on:
  pull_request:
    branches: [main, develop]

# .github/workflows/lighthouse-ci.yml
on:
  pull_request:
    branches: [main, develop]
```

**결과**:

```
✅ 자동 테스트 실행
🌐 Preview 배포 생성
📊 성능 측정
💬 PR에 결과 코멘트
```

---

#### Event 2: main 브랜치 푸시

**트리거**:

```bash
git push origin main
# 또는 PR merge
```

**실행되는 워크플로우**:

```yaml
# .github/workflows/deploy-production.yml
on:
  push:
    branches:
      - main
```

**결과**:

```
✅ 모든 테스트 재실행
🚀 Production 배포
🗄️ DB 마이그레이션
📢 배포 완료 알림
```

---

### Git 커밋이 배포까지 가는 과정

**예시: 로그인 버그 수정**

```bash
# 1. 브랜치 생성
git checkout -b fix/login-session-error
```

↓

```bash
# 2. 코드 수정
# src/app/api/auth/login/route.ts 수정
```

↓

```bash
# 3. 커밋
git add src/app/api/auth/login/route.ts
git commit -m "fix: 세션 만료 시 리다이렉트 오류 수정"
```

↓

```bash
# 4. GitHub에 푸시
git push origin fix/login-session-error
```

↓

```
GitHub에서 자동 실행:
- 코드 저장소 업데이트
- Webhook 발송
```

↓

```
GitHub Actions 트리거:
- ci.yml 실행 시작
```

↓

```
CI 파이프라인:
├─ ✅ ESLint 검사 (30초)
├─ ✅ TypeScript 타입 체크 (30초)
├─ ✅ Next.js 빌드 (2분)
├─ ✅ npm audit 보안 검사 (1분)
└─ ✅ secret 스캔 (1분)
```

↓

```
PR 생성:
- GitHub 웹에서 "Create Pull Request" 클릭
```

↓

```
deploy-preview.yml 실행:
- Vercel Preview 배포
- 결과: https://app-git-fix-login.vercel.app
```

↓

```
lighthouse-ci.yml 실행:
- 성능 측정
- 결과: Performance 95/100
```

↓

```
PR 검토:
- 코드 리뷰
- Preview 테스트
- 승인
```

↓

```
PR Merge:
- "Merge pull request" 클릭
- main 브랜치에 합쳐짐
```

↓

```
deploy-production.yml 자동 실행:
├─ 테스트 재실행
├─ Production 빌드
├─ Vercel 배포
└─ DB 마이그레이션
```

↓

```
3~5분 후:
✅ https://yourdomain.com 업데이트
✅ 사용자들이 수정된 버전 사용
```

**총 소요 시간**:

- PR 생성까지: ~9분
- Production 배포까지: +5분
- 합계: **약 15분**

---

## 문제 해결

### 자주 발생하는 문제

#### 문제 1: "Permission denied (publickey)"

**증상**:

```bash
$ git push origin main
Permission denied (publickey).
fatal: Could not read from remote repository.
```

**원인**: SSH 키가 등록되지 않음

**해결**:

**Option A: HTTPS로 변경 (추천)**

```bash
# 1. 현재 remote 확인
git remote -v

# 2. SSH → HTTPS로 변경
git remote set-url origin https://github.com/username/repo.git

# 3. 다시 푸시 (로그인 필요)
git push origin main
```

**Option B: SSH 키 등록**

```bash
# 1. SSH 키 생성
ssh-keygen -t ed25519 -C "your_email@example.com"

# 2. 공개 키 복사
cat ~/.ssh/id_ed25519.pub

# 3. GitHub → Settings → SSH Keys → Add
# 4. 복사한 내용 붙여넣기
```

---

#### 문제 2: "Your branch is behind 'origin/main'"

**증상**:

```bash
$ git status
Your branch is behind 'origin/main' by 3 commits.
```

**원인**: GitHub의 코드가 더 최신

**해결**:

```bash
# 최신 코드 받기
git pull origin main

# 충돌 발생 시 해결 후:
git add .
git commit -m "merge: 충돌 해결"
```

---

#### 문제 3: "fatal: not a git repository"

**증상**:

```bash
$ git status
fatal: not a git repository (or any of the parent directories)
```

**원인**: Git 저장소가 아닌 폴더에서 명령어 실행

**해결**:

```bash
# 1. 올바른 폴더로 이동
cd ~/Developer/inputenglish

# 2. 확인
ls -la
# .git 폴더가 있어야 함

# 또는 새로 clone
git clone https://github.com/username/repo.git
```

---

#### 문제 4: "Please commit your changes or stash them"

**증상**:

```bash
$ git checkout main
error: Your local changes would be overwritten by checkout.
Please commit your changes or stash them.
```

**원인**: 변경 사항이 있는데 브랜치 이동하려고 함

**해결 Option A: 커밋**

```bash
git add .
git commit -m "WIP: 작업 중"
git checkout main
```

**해결 Option B: Stash (임시 저장)**

```bash
# 1. 변경 사항 임시 저장
git stash

# 2. 브랜치 이동
git checkout main

# 3. 나중에 복구
git checkout feature/branch
git stash pop
```

---

#### 문제 5: 실수로 잘못된 파일 커밋

**시나리오**: .env 파일을 커밋해버림 (비밀 정보!)

**해결 (아직 push 안했을 때)**:

```bash
# 1. 최근 커밋 취소
git reset HEAD~1

# 2. .env 제거
git rm --cached .env

# 3. .gitignore에 추가
echo ".env" >> .gitignore

# 4. 다시 커밋
git add .
git commit -m "feat: 기능 추가 (env 제외)"
```

**해결 (이미 push 했을 때)**:

```bash
# 1. 파일 제거 및 .gitignore 추가
git rm --cached .env
echo ".env" >> .gitignore

# 2. 커밋
git commit -m "chore: .env 파일 제거"

# 3. 푸시
git push origin main

# 4. 🚨 중요: GitHub에서 Secret 변경!
# .env에 있던 모든 비밀 정보 재생성
```

---

#### 문제 6: Merge Conflict (충돌)

**증상**:

```bash
$ git merge feature/branch
CONFLICT (content): Merge conflict in src/app/page.tsx
```

**해결**:

```bash
# 1. 충돌 파일 확인
git status

# 2. 파일 열기
code src/app/page.tsx

# 3. 충돌 표시 찾기:
<<<<<<< HEAD
const title = "Main 브랜치의 내용"
=======
const title = "Feature 브랜치의 내용"
>>>>>>> feature/branch

# 4. 올바른 내용으로 수정:
const title = "합친 내용"

# 5. 충돌 해결 완료
git add src/app/page.tsx
git commit -m "merge: 충돌 해결"
```

---

### Git 명령어 치트시트

```bash
# 🔧 설정
git config --global user.name "김개발"
git config --global user.email "dev@email.com"

# 📥 시작
git clone <url>                    # 저장소 복제
git init                           # 새 저장소 생성

# 📊 상태 확인
git status                         # 현재 상태
git log --oneline                  # 커밋 히스토리
git diff                           # 변경 내용

# 💾 저장
git add <file>                     # 파일 선택
git add .                          # 모든 파일
git commit -m "메시지"             # 커밋
git commit -am "메시지"            # add + commit

# 🌿 브랜치
git branch                         # 브랜치 목록
git branch <name>                  # 브랜치 생성
git checkout <name>                # 브랜치 이동
git checkout -b <name>             # 생성 + 이동
git merge <name>                   # 브랜치 합치기
git branch -d <name>               # 브랜치 삭제

# 🔄 동기화
git pull origin main               # 다운로드
git push origin main               # 업로드
git push -u origin <branch>        # 처음 업로드

# ⏮️ 되돌리기
git restore <file>                 # 수정 취소
git restore --staged <file>        # add 취소
git reset HEAD~1                   # 커밋 취소
git revert <commit>                # 안전한 되돌리기

# 🔍 검색
git log --oneline --grep="검색어"  # 커밋 메시지 검색
git log --oneline <file>           # 파일 히스토리

# 💡 유용한 명령어
git stash                          # 임시 저장
git stash pop                      # 복구
git clean -fd                      # 추적 안하는 파일 삭제
git remote -v                      # 원격 저장소 확인
```

---

## 다음 단계

### 1. Git 설치 및 설정

```bash
# Git 설치 확인
git --version

# 사용자 정보 설정 (최초 1회)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 확인
git config --list
```

### 2. GitHub 계정 설정

1. https://github.com 가입
2. 2FA (이중 인증) 설정 권장
3. Personal Access Token 생성 (HTTPS 사용 시)

### 3. 첫 프로젝트 Clone

```bash
cd ~/Developer
git clone https://github.com/your-username/inputenglish.git
cd inputenglish
```

### 4. 첫 커밋 해보기

```bash
# README 수정
echo "# My First Commit" >> README.md

# 저장
git add README.md
git commit -m "docs: README 수정"
git push origin main
```

### 5. 첫 PR 만들어보기

```bash
# 브랜치 생성
git checkout -b feature/my-first-pr

# 파일 수정
echo "Test" >> test.txt

# 커밋 & 푸시
git add test.txt
git commit -m "test: 첫 PR 테스트"
git push origin feature/my-first-pr

# GitHub에서 PR 생성
```

---

## 추가 학습 자료

### 비주얼 학습

- **[Visualizing Git](https://git-school.github.io/visualizing-git/)** - Git 명령어 시각화
- **[Learn Git Branching](https://learngitbranching.js.org/)** - 인터랙티브 학습

### 문서

- **[Git 공식 문서 (한글)](https://git-scm.com/book/ko/v2)** - 완전 가이드
- **[GitHub Docs](https://docs.github.com/ko)** - GitHub 사용법

### 치트시트

- **[Git 치트시트 PDF](https://education.github.com/git-cheat-sheet-education.pdf)**

---

## 요약

### Git의 핵심 3가지

1. **Commit**: 저장 + 스냅샷 (게임 세이브)
2. **Branch**: 평행 세계 (실험실)
3. **Remote**: 클라우드 백업 (GitHub)

### 기본 워크플로우

```bash
# 1. 최신 코드 받기
git pull origin main

# 2. 브랜치 만들기
git checkout -b feature/new-feature

# 3. 작업하기
# (코드 수정)

# 4. 저장하기
git add .
git commit -m "feat: 새 기능"

# 5. 업로드하기
git push origin feature/new-feature

# 6. PR 만들기 (GitHub)

# 7. 자동 배포 대기
```

### CI/CD 연결

```
Git Push → GitHub → GitHub Actions → Vercel → 배포 완료
         (코드 저장) (자동 테스트)   (배포)   (3~5분)
```

---

**축하합니다!** 🎉

이제 Git의 기본 개념과 CI/CD 파이프라인의 연결을 이해하셨습니다.

다음 단계:

1. 실제로 커밋해보기
2. PR 만들어보기
3. 자동 배포 확인하기

궁금한 점이 있으면:

- 이 문서에서 Ctrl+F로 검색
- [DEPLOYMENT_SCENARIOS.md](./DEPLOYMENT_SCENARIOS.md) 참고
- 또는 추가 질문 환영!
