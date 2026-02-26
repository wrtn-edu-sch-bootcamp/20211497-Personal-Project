# 🐟 어망 (Fish-Net)

비영리 커뮤니티 행정 과부하 해소를 위한 AI 에이전트 기반 역할 배정 및 교육 지원 솔루션

## 📋 프로젝트 개요

"교사는 링크만 공유하고 버튼만 누른다. 배정, 교육, 성가 안내, 당일 대응까지 AI 에이전트가 전담한다."

### 주요 기능

- **스마트 가용성 분석**: 학생 코멘트를 AI가 분석하여 배정 우선순위 자동 판단
- **지능형 배정 엔진**: 숙련도, 연속 배정 방지, 역할 쏠림 방지 등을 고려한 최적 배정
- **개인화 메시지 생성**: 배정 결과에 맞춘 카카오톡 메시지 초안 자동 생성
- **성가 안내 자동화**: 고정 성가 및 야훼이레 목록 기반 성가 안내 메시지 생성
- **RAG 기반 교육 비서**: 역할별 가이드 질문에 실시간 답변 제공
- **돌발 상황 대응**: 불참 시 대타 후보 자동 조회 및 변경 반영

## 🛠 기술 스택

| 구성 요소 | 기술 | 용도 |
|-----------|------|------|
| Framework | Next.js 16 (App Router) | 프론트·백엔드 통합 |
| Language | TypeScript | 타입 안전성 |
| Styling | TailwindCSS | UI 스타일링 |
| Database | Firebase Firestore | 실시간 데이터 저장 |
| Auth | Firebase Auth | 교사/학생 권한 분리 |
| AI Engine | Claude API (Anthropic) | 배정 로직 및 메시지 생성 |
| RAG | LangChain.js | 역할별 가이드 질문 답변 |
| Deploy | Vercel | 자동 배포 |

## 📁 프로젝트 구조

```
fish-net/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 메인 페이지
│   │   ├── layout.tsx            # 루트 레이아웃
│   │   ├── teacher/page.tsx      # 교사 대시보드
│   │   ├── student/page.tsx      # 학생 페이지
│   │   └── api/
│   │       ├── schedule/route.ts # 배정 로직 API
│   │       ├── message/route.ts  # 메시지 생성 API
│   │       └── rag/route.ts      # RAG 챗봇 API
│   ├── components/
│   │   ├── Header.tsx            # 헤더 컴포넌트
│   │   ├── Button.tsx            # 버튼 컴포넌트
│   │   └── Card.tsx              # 카드 컴포넌트
│   ├── lib/
│   │   ├── firebase.ts           # Firebase 초기화
│   │   ├── claude.ts             # Claude API 연동
│   │   ├── langchain.ts          # LangChain RAG 설정
│   │   └── utils.ts              # 유틸리티 함수
│   └── types/
│       └── index.ts              # TypeScript 타입 정의
├── .env.local                    # 환경 변수
└── package.json
```

## 🚀 시작하기

### 1. 필수 요구사항

- Node.js 18+
- npm 또는 yarn

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. 의존성 설치

```bash
npm install
```

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

### 5. 프로덕션 빌드

```bash
npm run build
npm start
```

## 📱 화면 구성

### 교사 화면
- 이번 달 미사 날짜와 필요 역할 등록
- 학생 응답 수집 링크 생성 및 공유
- AI 배정 실행 후 월간 배정표 확인
- 카카오톡 메시지 초안 확인·복사
- 성가 확정 및 안내 메시지 생성

### 학생 화면
- 날짜별 가능 여부 체크 (가능 / 불가능 / 애매)
- 자유 코멘트 입력
- 배정 결과 확인
- 역할 변경 요청
- RAG 챗봇에게 역할 수행 방법 질문

## 🔮 향후 확장 계획

- n8n을 활용한 미응답자 자동 리마인드 워크플로우
- 출석 기반 은총 포인트 시스템
- 가톨릭 굿뉴스 주보 연동 자동 성가 추천
- 카카오 비즈니스 API 연동을 통한 메시지 자동 발송

## 📄 라이선스

이 프로젝트는 비영리 커뮤니티를 위해 개발되었습니다.

---

© 2026 어망 (Fish-Net)
