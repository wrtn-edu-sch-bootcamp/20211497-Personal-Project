# Fish-Net 문서

이 폴더에는 Fish-Net 프로젝트의 주요 기능 문서가 포함되어 있습니다.

## 📚 문서 목록

### 긴급 불참 신고 시스템

1. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** ⭐ **시작하기**
   - 구현 완료 체크리스트
   - 다음 단계 가이드
   - 테스트 방법
   - 빠른 시작 가이드

2. **[emergency-absence-feature.md](./emergency-absence-feature.md)**
   - 기능 상세 설명
   - 구현된 기능 목록
   - 데이터 흐름
   - 생성/수정된 파일 목록
   - 향후 개선 계획

3. **[emergency-absence-architecture.md](./emergency-absence-architecture.md)**
   - 시스템 아키텍처 다이어그램
   - 컴포넌트 상호작용
   - 데이터 흐름 시퀀스
   - 기술 스택
   - 보안 계층

4. **[n8n-emergency-workflow.md](./n8n-emergency-workflow.md)**
   - n8n 워크플로우 설정 가이드
   - Webhook 노드 생성
   - 이메일 발송 설정 (Resend/Gmail)
   - 테스트 방법
   - 문제 해결

## 🚀 빠른 시작

### 1. 구현 확인
모든 기능이 구현되었습니다. [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)에서 체크리스트를 확인하세요.

### 2. n8n 설정
[n8n-emergency-workflow.md](./n8n-emergency-workflow.md)를 따라 n8n 워크플로우를 설정하세요.

### 3. 환경변수 설정
```bash
# fish-net/.env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/emergency-absence
```

### 4. 테스트
1. 개발 서버 실행: `npm run dev`
2. 학생 페이지 접속: http://localhost:3000/student/schedule
3. 긴급 불참 신고 테스트
4. 교사 대시보드 확인: http://localhost:3000/teacher

## 📖 문서 읽는 순서

처음 시작하는 경우:
1. **IMPLEMENTATION_SUMMARY.md** - 전체 개요 파악
2. **n8n-emergency-workflow.md** - n8n 설정
3. **emergency-absence-feature.md** - 상세 기능 이해
4. **emergency-absence-architecture.md** - 아키텍처 이해

## 🔗 관련 링크

- [Fish-Net 메인 README](../README.md)
- [n8n 공식 문서](https://docs.n8n.io/)
- [Firebase 문서](https://firebase.google.com/docs)
- [Next.js 문서](https://nextjs.org/docs)

## 📝 문서 업데이트

문서는 기능 추가 시 함께 업데이트됩니다. 최신 버전을 확인하세요.

**최종 업데이트**: 2026년 2월 26일
