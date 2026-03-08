# Shadowing Ninja 🥷

AI 기반 영어 쉐도잉 학습 플랫폼 (Turborepo 모노레포)

## 📚 프로젝트 소개

Shadowing Ninja는 YouTube 영상을 활용한 영어 쉐도잉 학습을 돕는 웹 애플리케이션입니다. AI가 자막을 분석하고, 사용자의 학습을 효과적으로 지원합니다. pnpm + Turborepo 모노레포 구조로 웹(`apps/web`)과 모바일(`apps/mobile`) 앱을 위한 공유 패키지(`@shadowoo/shared`)를 제공합니다.

## 🚀 빠른 시작

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/your-username/shadowing-ninja.git
cd shadowing-ninja

# 의존성 설치 (pnpm 필요: npm install -g pnpm)
pnpm install

# 환경 변수 설정
cp .env.local.example .env.local
# .env.local 파일을 편집하여 실제 값 입력

# 로컬 Supabase 시작
pnpm run supabase:start

# 개발 서버 실행
pnpm dev
```

브라우저에서 http://localhost:3000 접속

### 배포하기

**5분 안에 배포**: [QUICKSTART.md](./QUICKSTART.md) 참고

**상세 가이드**: [DEPLOYMENT.md](./DEPLOYMENT.md) 참고

## 🛠️ 기술 스택

### 웹 앱

- **Frontend**: Next.js 15, React 18, TailwindCSS 4
- **Backend**: Next.js API Routes
- **AI**: Google Generative AI

### 모바일 앱

- **Framework**: React Native 0.76.3, Expo SDK 52
- **Language**: TypeScript 5.7
- **State Management**: Zustand 5
- **Offline Support**: MMKV (로컬 저장소)
- **Network**: `@react-native-community/netinfo`
- **Push Notifications**: Expo Push + APNs/FCM
- **Payments**: RevenueCat (react-native-purchases)
- **Build**: EAS Build + GitHub Actions

### 공통

- **Database**: Supabase (PostgreSQL, Auth, Storage)
- **패키지 관리**: pnpm + Turborepo (모노레포)
- **배포**: Vercel (웹), EAS/App Store/Play Store (모바일)
- **CI/CD**: GitHub Actions

## 📖 문서

### 모바일 앱 문서

- **[모바일 아키텍처](./.moai/docs/MOBILE-ARCHITECTURE.md)** - 오프라인 지원, 푸시 알림, 결제 시스템 아키텍처
- **[모바일 구현 가이드](./.moai/docs/MOBILE-IMPLEMENTATION-GUIDE.md)** - SPEC-MOBILE-007 (오프라인 + 푸시) 구현 상세 가이드
- **[모바일 AI + 결제](./.moai/docs/MOBILE-AI-PAYMENTS.md)** - SPEC-MOBILE-006 (AI 기능 + RevenueCat) 설명서
- **[모바일 코드맵](./.moai/docs/MOBILE-CODEMAP.md)** - 파일 구조 및 의존성 맵

### 배포 관련 문서

- **[빠른 배포 가이드](./QUICKSTART.md)** - 5분 안에 배포하기
- **[배포 전체 가이드](./DEPLOYMENT.md)** - 상세한 배포 방법 및 전략
- **[배포 가이드 (한국어 설명)](./docs/DEPLOYMENT_GUIDE_KR.md)** - 비개발자도 이해하는 배포 가이드
- **[배포 플랫폼 비교](./docs/DEPLOYMENT_COMPARISON.md)** - Vercel vs AWS vs 기타 플랫폼
- **[실전 배포 시나리오](./docs/DEPLOYMENT_SCENARIOS.md)** - 실제 상황별 대응 방법
- **[GitHub Actions 설정](/.github/SETUP.md)** - CI/CD 설정 가이드

### Git & 협업 문서

- **[Git 완벽 가이드](./docs/GIT_GUIDE_FOR_BEGINNERS.md)** ⭐ - 비개발자를 위한 Git 실전 매뉴얼

### 개발 문서

- **[워크플로우](./workflow.md)** - 개발 프로세스
- **[컴포넌트 가이드](./components.json)** - UI 컴포넌트 설정

## 🔧 주요 명령어

### 개발

```bash
npm run dev          # 개발 서버 실행
npm run dev:clean    # .next 폴더 삭제 후 실행
npm run dev:fresh    # 캐시 완전 초기화 후 실행
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
```

### 코드 품질

```bash
npm run lint         # ESLint 검사
npm run lint:fix     # ESLint 자동 수정
npm run type-check   # TypeScript 타입 체크
npm run format       # Prettier 포맷팅
npm run format:check # Prettier 검사
```

### 배포

```bash
npm run deploy:vercel   # Production 배포
npm run deploy:preview  # Preview 배포
```

### Docker

```bash
npm run docker:build    # Docker 이미지 빌드
npm run docker:run      # Docker 컨테이너 실행
npm run docker:up       # Docker Compose 시작
npm run docker:down     # Docker Compose 종료
```

### Supabase

```bash
npm run supabase:start      # 로컬 Supabase 시작
npm run supabase:stop       # 로컬 Supabase 중지
npm run supabase:types      # DB 타입 생성
npm run supabase:migration  # 마이그레이션 생성
npm run supabase:push       # 마이그레이션 적용
```

## 🌟 주요 기능

- ✅ YouTube 영상 기반 쉐도잉 학습
- ✅ AI 자막 분석 및 번역
- ✅ 구간 반복 재생
- ✅ 학습 진도 추적
- ✅ 사용자 인증 (Supabase Auth)
- ✅ 관리자 CMS
- 🚧 AI 발음 분석 (개발 중)

## 📁 프로젝트 구조

```
shadowing-ninja/
├── src/
│   ├── app/              # Next.js App Router 페이지
│   │   ├── api/          # API Routes
│   │   ├── admin/        # 관리자 페이지
│   │   ├── auth/         # 인증 페이지
│   │   └── ...
│   ├── components/       # React 컴포넌트
│   ├── lib/             # 유틸리티 함수
│   ├── store/           # 상태 관리 (Zustand)
│   ├── types/           # TypeScript 타입 정의
│   └── utils/           # Supabase 클라이언트 등
├── supabase/
│   ├── migrations/      # DB 마이그레이션
│   └── schema.sql       # DB 스키마
├── public/              # 정적 파일
├── docs/                # 문서
├── .github/
│   └── workflows/       # GitHub Actions
├── Dockerfile           # Docker 설정
├── docker-compose.yml   # Docker Compose 설정
└── vercel.json          # Vercel 배포 설정
```

## 🔐 환경 변수

필수 환경 변수:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

상세한 설정은 [.env.example](./.env.example) 파일을 참고하세요.

## 🧪 테스트

```bash
# 테스트 실행 (추가 예정)
npm test

# E2E 테스트 (추가 예정)
npm run test:e2e
```

## 📊 CI/CD

이 프로젝트는 GitHub Actions를 사용한 완전 자동화된 CI/CD 파이프라인을 갖추고 있습니다.

### Pull Request 시

- ✅ 린트 및 타입 체크
- ✅ 빌드 테스트
- ✅ 보안 스캔
- ✅ Lighthouse 성능 측정
- ✅ Vercel Preview 자동 배포

### Main 브랜치 푸시 시

- ✅ 모든 CI 체크 재실행
- ✅ Vercel Production 자동 배포
- ✅ Supabase DB 마이그레이션
- ✅ 배포 완료 알림

자세한 내용은 [CI/CD 가이드](./.github/SETUP.md)를 참고하세요.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 커밋 메시지 규칙

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 코드
chore: 빌드/설정 변경
perf: 성능 개선
```

## 📄 라이선스

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## 🙏 감사의 말

- [Next.js](https://nextjs.org/) - React 프레임워크
- [Supabase](https://supabase.com/) - 백엔드 플랫폼
- [Vercel](https://vercel.com/) - 배포 플랫폼
- [Google Generative AI](https://ai.google.dev/) - AI 기능

## 📞 문의

문제가 발생하거나 질문이 있으신 경우:

1. [GitHub Issues](https://github.com/your-username/shadowing-ninja/issues) 생성
2. [배포 가이드](./docs/DEPLOYMENT_GUIDE_KR.md) 참고
3. [실전 시나리오](./docs/DEPLOYMENT_SCENARIOS.md)에서 유사한 상황 찾기

---

Made with ❤️ by Shadowing Ninja Team
