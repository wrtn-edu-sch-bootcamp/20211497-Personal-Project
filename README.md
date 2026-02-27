# 🐟 어망 (Fish-Net) v1.0

> **비영리 커뮤니티 행정 과부하 해소를 위한 AI 에이전트 기반 역할 배정 및 교육 지원 솔루션**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?logo=firebase)](https://firebase.google.com/)
[![Claude API](https://img.shields.io/badge/Claude-API-8B5CF6?logo=anthropic)](https://www.anthropic.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)
[![LangChain](https://img.shields.io/badge/LangChain.js-RAG-1C3C3C)](https://js.langchain.com/)

---

## 📌 기획 의도

저는 성당 중고등부 주일학교 교리교사를 맡고 있습니다. 중고등부 미사에서는 학생들이 독서, 해설, 반주 등 핵심적인 전례 역할을 직접 담당합니다. 그러나 현실에서는 담당 학생이 당일 늦게 도착하거나 갑작스럽게 불참하는 상황이 반복적으로 발생하고, 교사는 미사 직전 대타를 급하게 수소문해야 하는 상황에 내몰립니다.

이 문제는 단순히 한 성당만의 이야기가 아닙니다. 지역사회 봉사를 중심으로 운영되는 비영리 단체(종교 단체, 지역아동센터 등)는 청소년 돌봄의 중추적인 역할을 담당하고 있지만, 운영진은 역할 배정·일정 공유·당일 대응 같은 반복적인 행정 업무에 과부하가 걸려 정작 학생들과 정서적으로 교감할 시간을 빼앗기고 있습니다.

**어망(Fish-Net)은 교사가 행정에서 벗어나 학생 곁에 있을 수 있도록, AI가 그 빈자리를 채우는 시스템입니다.**

---

## 🎯 핵심 문제 & 해결 방식

| 문제 | 어망의 해결 방식 |
|------|-----------------|
| 매달 학생 가용성 수동 취합 | 학생이 직접 링크로 응답 → AI가 자동 분석 |
| 역할 배정에 수십 분 소요 | Claude API가 최적 배정표 + 백업까지 자동 생성 |
| 개별 연락 메시지 수동 작성 | 학생별 개인화 메시지 초안 자동 생성 |
| 당일 불참 시 대타 수소문 | 긴급 불참 신고 → 대타 후보 즉시 조회 → SMS 자동 발송 |
| 역할 수행 방법 질문 반복 대응 | RAG 챗봇이 역할 가이드 PDF 기반 실시간 답변 |

---

## ✨ 주요 기능

### 1. 🗓️ 스마트 가용성 수집
- 학생이 날짜별 **가능 / 불가능 / 애매** 3단계 응답
- 자유 코멘트 입력 ("시험 기간이라 힘들어요")
- 복사단 봉사 자동 불참 처리 (`isCopasadan` 플래그)
- 응답 마감일 설정 및 미응답자 파악

### 2. 🤖 AI 월간 배정 엔진 (Claude API)
- 학생 코멘트 분석 → 배정 우선순위 자동 판단
- 반주는 악기 가능자 우선 배정
- 연속 배정 방지 / 역할 쏠림 방지
- 신입생 가벼운 역할 우선 배정
- **1순위 백업 + 2순위 백업(백백업)** 자동 지정
- 배정 가능 인원 부족 시 교사에게 사전 경고 (`warnings` 배열)

### 3. 💬 개인화 메시지 자동 생성
- 배정 결과 기반 학생별 상황 맞춤 메시지 초안 생성
- 학생 속성(이름, 세례명, 학년, 성별, 신입 여부) 반영
- SMS(Solapi) 자동 발송 연동

### 4. 🎵 성가 안내 자동화
- 고정 성가(거룩하시도다, 하느님의 어린양 등) DB 기본값 저장
- 야훼이레 목록에서 교사가 사이사이 성가 선택
- 성가 확정 시 당일 참석 학생 전원에게 성가 안내 메시지 자동 생성
- ※ 저작권 문제로 악보 PDF 전송은 지원하지 않음 (곡 번호·제목 안내까지만)

### 5. 🚨 당일 돌발 상황 대응
- 학생 긴급 불참 신고 → 교사 대시보드 **실시간 알림** (Firestore onSnapshot)
- 대타 후보 자동 조회 → 교사 원클릭 대타 확정
- 대타 요청 SMS 즉시 발송

### 6. 📊 출석 추적 시스템
- 긴급 불참 신고 시 **자동 결석 처리** (absent_with_reason + 사유 저장)
- 교사 원클릭 출석 토글 (present / absent / unknown)
- 실시간 출석 현황 요약 바
- 출석 기반 학생 사이드바 도넛 차트

### 7. 🧠 RAG 기반 교육 비서 챗봇
- 역할별 가이드 문서 기반 실시간 질의응답 (LangChain.js)
- 학생 화면 플로팅 챗봇 + 메인 페이지 QuickChat
- "화답송은 어떻게 해요?" 같은 실무 질문에 즉시 답변

### 8. 👥 학생 상세 사이드바
- 출석률 도넛 차트 (이번 달 기준)
- 정배정 / 백업 배정 횟수 배지
- 최근 코멘트 로그 (패턴 파악)
- **Claude API 기반 AI 패턴 분석** 한 줄 요약

---

## 🛠️ 기술 스택

| 구성 요소 | 기술 | 선택 이유 |
|-----------|------|-----------|
| Framework | Next.js 15 (App Router) | 프론트·백엔드 통합, 기존 학습 경험 |
| Language | TypeScript | 타입 안전성, 코드 품질 |
| 배포 | Vercel | Next.js 최적화, 자동 배포 |
| DB / 실시간 | Firebase Firestore | 실시간성, 50명+ 동시 접속 대응 |
| 인증 | Firebase Auth (Google OAuth) | 교사·학생 권한 분리 |
| AI 배정 엔진 | Claude API (claude-sonnet) | 자연어 코멘트 분석 + 구조화 배정 |
| RAG | LangChain.js | JS 생태계 통합, 기술적 깊이 |
| SMS 발송 | Solapi API | 국내 SMS/카카오 연동 |
| 자동화 | n8n Webhook | 긴급 불참 알림 워크플로우 |
| UI | Tailwind CSS + shadcn/ui | 빠른 개발, 일관된 디자인 |

---

## 🏗️ 시스템 아키텍처

```
학생                    교사                      AI 레이어
 │                       │                          │
 ├─ 가용성 응답 제출      │                          │
 │   (날짜별 체크 + 코멘트)│                          │
 │                       ├─ AI 배정 실행 ──────────► Claude API
 │                       │   (월간 배정표 자동 생성)   │
 │                       │                          │
 ├─ 배정 확인 화면        │                          │
 │   (내 역할 + 성가 안내) │                          │
 │                       ├─ 성가 확정 → 메시지 생성   │
 │                       │                     ─────► Claude API
 ├─ 긴급 불참 신고        │                          │
 │   (사유 입력)          ├─ 실시간 알림 수신          │
 │                       ├─ 대타 후보 조회            │
 │                       └─ SMS 발송 ────────────► Solapi
 │                                                  │
 ├─ RAG 챗봇 질문 ──────────────────────────────► LangChain.js
 │   "화답송 어떻게 해요?"                     (역할 가이드 기반)
```

---

## 📁 프로젝트 구조

```
fish-net/
├── app/
│   ├── page.tsx                    # 메인 페이지 (D-Day, 월간 응답률)
│   ├── login/page.tsx              # 교사 로그인
│   ├── teacher/
│   │   ├── page.tsx                # 교사 대시보드
│   │   ├── responses/page.tsx      # 학생 응답 현황 + 출석 토글
│   │   └── hymns/page.tsx          # 성가 관리
│   ├── student/
│   │   ├── response/page.tsx       # 가용성 응답 제출
│   │   └── schedule/page.tsx       # 배정 확인 + 긴급 불참 신고
│   └── api/
│       ├── assignment/monthly/     # AI 월간 배정 (Claude API)
│       ├── message/generate/       # 개인화 메시지 생성 (Claude API)
│       ├── emergency/              # 긴급 불참 처리 + n8n 웹훅
│       ├── sms/                    # SMS 발송 (Solapi)
│       ├── rag/                    # RAG 챗봇 (LangChain.js)
│       ├── attendance/             # 출석 상태 업데이트
│       └── student/analyze/        # AI 학생 패턴 분석 (Claude API)
├── components/
│   ├── StudentDrawer.tsx           # 학생 상세 슬라이딩 사이드바
│   ├── AttendanceToggle.tsx        # 출석 토글 컴포넌트
│   ├── AttendanceSummaryBar.tsx    # 실시간 출석 현황 바
│   ├── GuideChatbot.tsx            # RAG 플로팅 챗봇
│   └── MessageModal.tsx            # 메시지 미리보기 + 복사
├── lib/
│   ├── firebase.ts                 # Firebase 초기화
│   ├── firebase-admin.ts           # 서버사이드 Firebase Admin
│   ├── firestore.ts                # Firestore CRUD
│   ├── firestore-realtime.ts       # 실시간 리스너 (onSnapshot)
│   └── langchain.ts                # LangChain RAG 설정
└── types/
    └── index.ts                    # TypeScript 타입 정의
```

---

## 🚀 시작하기

### 사전 요구사항
- Node.js 18+
- Firebase 프로젝트 (Firestore + Authentication)
- Claude API 키
- Solapi API 키 (SMS 발송)

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/wrtn-edu-sch-bootcamp/[본인 레포명].git
cd fish-net

# 의존성 설치
npm install

# 환경변수 설정
cp .env.local.example .env.local
# .env.local에 아래 키 입력

# 개발 서버 실행
npm run dev
```

### 환경변수

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_KEY=     # JSON (서버사이드)

# Claude API
ANTHROPIC_API_KEY=

# Solapi (SMS)
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER=                     # 발신번호 (실명 인증 필요)

# n8n
N8N_WEBHOOK_URL=
```

---

## 📊 구현 현황

### ✅ 구현 완료

| 기능 | 상태 |
|------|------|
| 학생 가용성 응답 수집 | ✅ |
| AI 월간 배정 엔진 (Claude API) | ✅ |
| 1·2순위 백업 자동 지정 | ✅ |
| 개인화 메시지 생성 | ✅ |
| SMS 자동 발송 (Solapi) | ✅ |
| 성가 관리 및 안내 메시지 | ✅ |
| 긴급 불참 신고 + 자동 결석 처리 | ✅ |
| 실시간 대타 후보 조회 | ✅ |
| 출석 추적 (교사 원클릭 토글) | ✅ |
| RAG 챗봇 (LangChain.js) | ✅ |
| 학생 상세 사이드바 (AI 패턴 분석) | ✅ |
| 교사·학생 권한 분리 (Firebase Auth) | ✅ |
| 실시간 알림 (Firestore onSnapshot) | ✅ |

### 🔜 향후 계획

| 기능 | 비고 |
|------|------|
| 카카오 비즈니스 API 연동 | 현재 SMS로 대체 |
| 학생 간 역할 교환 UI | 데이터 구조 설계 완료 |
| RAG PDF 직접 업로드 | 현재 텍스트 기반 |
| 가톨릭 굿뉴스 주보 연동 성가 추천 | 크롤링 검토 완료 |
| 출석 기반 은총 포인트 시스템 | 향후 확장 |

---

## 🔒 시스템 범위 및 한계

의도적으로 **교사 재량 영역**으로 남겨둔 항목들입니다.

| 상황 | 시스템 대응 범위 |
|------|----------------|
| 당일 애매한 시간대 도착 | 백업 전환 버튼까지만 지원. 최종 판단은 교사 재량 |
| 학생끼리 사적 역할 변경 | 교사가 배정표 수동 수정 가능. 앱 내 변경 요청 UX 제공 |
| 대타 체인 반복 (대타의 대타) | 최악의 경우 교사가 최종 판단 |
| 성가 악보 제공 | 저작권 문제로 곡 번호·제목 안내까지만 |

---

## 🌍 확장 가능성

Firebase 기반으로 50명 이상 동시 접속 대응 가능하며, 성당 중고등부 외에도 **지역아동센터, 방과후학교** 등 봉사자 기반 스케줄링이 필요한 비영리 단체 전반으로 확산 가능합니다.

> **"가톨릭 청소년 전례 역할 배정에 특화된 AI 자동화 도구는 전 세계에 어망이 유일합니다."**

---

## 📝 변경 이력

| 버전 | 주요 변경 사항 |
|------|--------------|
| v0.35 | 초기 기획 (가용성 수집, AI 배정, 메시지 생성) |
| v0.4 | 당일 돌발 상황 대응, 백업 로직 고도화, 학생 간 역할 변경 설계 |
| v0.5 | 성가 안내 자동화, Vercel 배포 전환 |
| v0.6 | Next.js + Firebase 전면 전환, LangChain.js RAG 도입 |
| v0.68 | 프로젝트명 → 어망(Fish-Net), 교사·학생 권한 분리 완성 |
| **v1.0** | **출석 추적 시스템, 학생 사이드바 AI 분석, SMS 자동 발송, RAG 챗봇 전체 완성** |

---

<div align="center">

**어망 (Fish-Net)** — 교사는 학생 곁에, 행정은 AI에게

*wrtn-edu-sch-bootcamp | 2026*

</div>
