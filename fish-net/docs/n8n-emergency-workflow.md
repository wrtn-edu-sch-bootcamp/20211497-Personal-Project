# n8n 긴급 불참 알림 워크플로우 설정 가이드

## 개요

학생이 긴급 불참을 신고하면 n8n 워크플로우가 자동으로 트리거되어 교사에게 이메일 알림을 전송합니다.

## 워크플로우 구조

```
학생 긴급 불참 신고
    ↓
Fish-Net API (/api/emergency)
    ↓
Firestore 업데이트 (status: 'absent')
    ↓
n8n Webhook 호출
    ↓
이메일 발송 (Resend/Gmail)
    ↓
교사 수신
```

## n8n 워크플로우 설정 단계

### 1. Webhook 노드 생성

1. n8n에서 새 워크플로우 생성
2. **Webhook** 노드 추가
3. 설정:
   - **HTTP Method**: POST
   - **Path**: `/emergency-absence` (또는 원하는 경로)
   - **Authentication**: None (또는 Bearer Token 추가 권장)
4. Webhook URL 복사 (예: `https://your-n8n.com/webhook/emergency-absence`)

### 2. 데이터 파싱 노드 (선택사항)

**Set** 노드를 추가하여 Webhook 데이터를 정리:

```json
{
  "type": "{{ $json.body.type }}",
  "studentName": "{{ $json.body.student.name }}",
  "baptismalName": "{{ $json.body.student.baptismalName }}",
  "date": "{{ $json.body.assignment.date }}",
  "role": "{{ $json.body.assignment.role }}",
  "reason": "{{ $json.body.absence.reason }}",
  "reportedAt": "{{ $json.body.absence.reportedAt }}"
}
```

### 3. 이메일 발송 노드

#### 옵션 A: Resend 사용

1. **HTTP Request** 노드 추가
2. 설정:
   - **Method**: POST
   - **URL**: `https://api.resend.com/emails`
   - **Authentication**: Header Auth
     - **Name**: `Authorization`
     - **Value**: `Bearer YOUR_RESEND_API_KEY`
   - **Body Content Type**: JSON
   - **Body**:

```json
{
  "from": "noreply@yourdomain.com",
  "to": ["teacher@example.com"],
  "subject": "🚨 긴급 불참 발생: {{ $json.studentName }}",
  "html": "<h2>긴급 불참 신고</h2><p><strong>학생:</strong> {{ $json.studentName }} {{ $json.baptismalName ? '(' + $json.baptismalName + ')' : '' }}</p><p><strong>날짜:</strong> {{ $json.date }}</p><p><strong>역할:</strong> {{ $json.role }}</p><p><strong>사유:</strong> {{ $json.reason }}</p><p><strong>신고 시각:</strong> {{ $json.reportedAt }}</p><hr><p>대타 후보를 조회하고 즉시 연락하세요.</p>"
}
```

#### 옵션 B: Gmail 사용

1. **Gmail** 노드 추가
2. Gmail API 인증 설정 (OAuth2)
3. 설정:
   - **Resource**: Message
   - **Operation**: Send
   - **To**: `teacher@example.com`
   - **Subject**: `🚨 긴급 불참 발생: {{ $json.studentName }}`
   - **Email Type**: HTML
   - **Message**: 위 HTML 템플릿 사용

### 4. 알림 로깅 (선택사항)

**Google Sheets** 또는 **Airtable** 노드를 추가하여 알림 이력 기록:

```
- 학생 이름
- 세례명
- 날짜
- 역할
- 사유
- 신고 시각
- 이메일 발송 성공 여부
```

### 5. 에러 핸들링

**IF** 노드를 추가하여 이메일 발송 실패 시 재시도 또는 Slack 알림:

```
IF 이메일 발송 실패
  → Slack 알림 (백업 채널)
  → 3초 대기 후 재시도
```

## Fish-Net 환경변수 설정

`.env` 파일에 n8n Webhook URL 추가:

```bash
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/emergency-absence
```

## 테스트

### 1. n8n 워크플로우 활성화

워크플로우를 **Active** 상태로 변경

### 2. Fish-Net에서 테스트

1. 학생 배정 확인 페이지 접속
2. 정배정 역할 카드에서 "🚨 긴급 불참 신고" 버튼 클릭
3. 사유 입력 후 제출
4. n8n 워크플로우 실행 확인
5. 교사 이메일 수신 확인

### 3. Webhook 페이로드 예시

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

## 보안 권장사항

1. **Webhook 인증 추가**: Bearer Token 또는 API Key 사용
2. **IP 화이트리스트**: Fish-Net 서버 IP만 허용
3. **HTTPS 사용**: 모든 통신은 HTTPS로 암호화
4. **Rate Limiting**: 과도한 요청 방지

## 추가 기능 아이디어

1. **SMS 알림**: Twilio 노드 추가하여 교사 휴대폰으로 문자 발송
2. **Slack 알림**: Slack 노드 추가하여 교사 채널에 메시지 전송
3. **자동 대타 조회**: Fish-Net API를 호출하여 백업 학생 정보 조회 후 이메일에 포함
4. **통계 대시보드**: 긴급 불참 빈도 분석 및 시각화

## 문제 해결

### Webhook이 트리거되지 않음

- n8n 워크플로우가 Active 상태인지 확인
- Webhook URL이 정확한지 확인
- Fish-Net 서버 로그에서 Webhook 호출 성공 여부 확인

### 이메일이 발송되지 않음

- Resend/Gmail API 키가 유효한지 확인
- 발신자 이메일 도메인이 인증되었는지 확인
- n8n 노드 실행 로그에서 에러 메시지 확인

### 지연 발송

- n8n 서버 리소스 확인
- Webhook 노드의 타임아웃 설정 확인
- 네트워크 연결 상태 확인

## 참고 자료

- [n8n 공식 문서](https://docs.n8n.io/)
- [Resend API 문서](https://resend.com/docs)
- [Gmail API 문서](https://developers.google.com/gmail/api)
