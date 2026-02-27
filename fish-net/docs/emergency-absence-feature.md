# 긴급 불참 신고 기능 구현 완료

## 📋 구현 개요

학생이 배정된 역할을 수행할 수 없게 되었을 때 긴급 불참을 신고하고, 교사에게 실시간 알림을 전송하는 시스템을 구축했습니다.

## 🎯 구현된 기능

### 1. 프론트엔드 (학생 페이지)

**파일**: `src/app/student/schedule/page.tsx`

#### 변경 사항:
- ✅ 정배정 역할 카드에 "🚨 긴급 불참 신고" 버튼 추가
- ✅ 불참 사유 입력 모달 구현
- ✅ API 호출 및 에러 핸들링
- ✅ 제출 후 자동 새로고침

#### 사용자 플로우:
1. 학생이 '내 역할 배정 확인' 페이지 접속
2. 정배정 역할 카드 하단의 "긴급 불참 신고" 버튼 클릭
3. 모달에서 불참 사유 입력 (필수)
4. "신고하기" 버튼 클릭
5. 성공 알림 표시 및 교사에게 알림 전송 안내

### 2. 백엔드 API

**파일**: `src/app/api/emergency/route.ts`

#### 기능:
- ✅ Firestore `assignments` 컬렉션 업데이트
  - `status`: "absent"로 변경
  - `absentReason`: 사유 저장
  - `absentReportedAt`: 신고 시각 기록
- ✅ n8n Webhook 호출
  - 학생 정보 (이름, 세례명)
  - 배정 정보 (날짜, 역할)
  - 불참 정보 (사유, 신고 시각)
- ✅ 에러 핸들링 및 로깅

#### API 엔드포인트:
```
POST /api/emergency
```

#### 요청 본문:
```json
{
  "studentId": "string",
  "studentName": "string",
  "baptismalName": "string (optional)",
  "massDateId": "string",
  "date": "YYYY-MM-DD",
  "role": "string",
  "reason": "string"
}
```

#### 응답:
```json
{
  "success": true,
  "assignmentId": "string",
  "webhookTriggered": boolean
}
```

### 3. 교사 대시보드

**파일**: `src/app/teacher/page.tsx`

#### 변경 사항:
- ✅ 실시간 긴급 불참 감지 (Firestore `onSnapshot`)
- ✅ 대시보드 상단에 빨간색 경고 배너 표시
- ✅ 불참 학생 정보 표시 (이름, 날짜, 역할, 사유, 신고 시각)
- ✅ '당일 대응' 섹션과 자동 연동
- ✅ 애니메이션 효과 (pulse)

#### 실시간 알림:
- Firestore의 `assignments` 컬렉션에서 `status: "absent"` 문서 감지
- 새로운 불참 발생 시 자동으로 배너 업데이트
- 최신 신고 순으로 정렬

### 4. 타입 정의

**파일**: `src/types/index.ts`

#### 추가된 필드:
```typescript
export interface Assignment {
  // ... 기존 필드
  status: "assigned" | "confirmed" | "declined" | "swapped" | "absent";
  absentReason?: string;
  absentReportedAt?: Date;
}
```

### 5. 환경 변수

**파일**: `fish-net/.env.example`

#### 추가된 변수:
```bash
# n8n Webhook (for emergency absence notifications)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/emergency-absence
```

## 🔄 데이터 흐름

```
┌─────────────────┐
│  학생 웹 페이지  │
│  (긴급 불참 신고)│
└────────┬────────┘
         │ POST /api/emergency
         ↓
┌─────────────────┐
│  Emergency API  │
│  (route.ts)     │
└────┬───────┬────┘
     │       │
     │       └──────────────────┐
     │                          │
     ↓                          ↓
┌─────────────────┐    ┌──────────────┐
│   Firestore     │    │  n8n Webhook │
│  (assignments)  │    │  (이메일 발송)│
│  status: absent │    └──────────────┘
└────────┬────────┘
         │ onSnapshot
         ↓
┌─────────────────┐
│  교사 대시보드   │
│  (실시간 알림)   │
└─────────────────┘
```

## 📁 생성/수정된 파일

### 생성된 파일:
1. `src/app/api/emergency/route.ts` - 긴급 불참 API
2. `fish-net/.env.example` - 환경변수 예시
3. `docs/n8n-emergency-workflow.md` - n8n 워크플로우 설정 가이드
4. `docs/emergency-absence-feature.md` - 기능 구현 문서 (현재 파일)

### 수정된 파일:
1. `src/app/student/schedule/page.tsx` - 학생 페이지에 긴급 불참 버튼 추가
2. `src/app/teacher/page.tsx` - 교사 대시보드에 실시간 알림 추가
3. `src/types/index.ts` - Assignment 타입에 불참 관련 필드 추가

## 🔐 보안 고려사항

1. **Firestore Rules**: 현재 `assignments` 컬렉션은 읽기/쓰기 모두 허용
   - 프로덕션 환경에서는 인증 기반 권한 제어 권장
2. **Webhook 인증**: n8n Webhook에 Bearer Token 추가 권장
3. **Rate Limiting**: 과도한 불참 신고 방지 로직 추가 권장

## 🧪 테스트 시나리오

### 1. 기본 플로우 테스트
1. 학생 배정 확인 페이지 접속
2. 정배정 역할 선택
3. "긴급 불참 신고" 버튼 클릭
4. 사유 입력 후 제출
5. 교사 대시보드에서 알림 확인

### 2. 에러 케이스 테스트
- 사유 미입력 시 제출 불가 확인
- 네트워크 오류 시 에러 메시지 표시 확인
- Webhook 실패 시에도 Firestore 업데이트는 성공 확인

### 3. 실시간 동기화 테스트
- 교사 대시보드를 열어둔 상태에서 학생이 불참 신고
- 새로고침 없이 알림 배너 자동 표시 확인

## 📊 n8n 워크플로우 설정

자세한 설정 가이드는 `docs/n8n-emergency-workflow.md` 참조

### 필수 단계:
1. n8n에서 Webhook 노드 생성
2. 이메일 발송 노드 추가 (Resend 또는 Gmail)
3. Webhook URL을 `.env` 파일에 추가
4. 워크플로우 활성화

### Webhook 페이로드 예시:
```json
{
  "type": "emergency_absence",
  "timestamp": "2026-02-26T10:30:00.000Z",
  "student": {
    "id": "student123",
    "name": "홍길동",
    "baptismalName": "요셉"
  },
  "assignment": {
    "massDateId": "mass456",
    "date": "2026-03-01",
    "role": "1독서"
  },
  "absence": {
    "reason": "갑작스러운 가족 행사",
    "reportedAt": "2026-02-26T10:30:00.000Z"
  }
}
```

## 🚀 향후 개선 사항

### 단기 (1-2주):
1. ✨ SMS 알림 추가 (교사 휴대폰)
2. ✨ 불참 신고 취소 기능
3. ✨ 불참 이력 조회 페이지

### 중기 (1개월):
1. 🔔 자동 대타 배정 시스템
2. 📊 불참 통계 대시보드
3. 🔒 학생 인증 시스템 (중복 신고 방지)

### 장기 (2-3개월):
1. 🤖 AI 기반 대타 추천
2. 📱 모바일 앱 푸시 알림
3. 📈 불참 패턴 분석 및 예측

## 🐛 알려진 이슈

없음 (현재 정상 작동)

## 📞 문의

구현 관련 문의사항은 프로젝트 담당자에게 연락하세요.

---

**구현 완료일**: 2026년 2월 26일  
**버전**: 1.0.0  
**작성자**: Elite Principal Engineer
