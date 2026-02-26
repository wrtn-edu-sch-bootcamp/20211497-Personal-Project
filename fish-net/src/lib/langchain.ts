import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

let chatModel: ChatAnthropic | null = null;

function getChatModel(): ChatAnthropic {
  if (!chatModel) {
    chatModel = new ChatAnthropic({
      model: "claude-sonnet-4-20250514",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      maxTokens: 1000,
    });
  }
  return chatModel;
}

const ROLE_GUIDES: Record<string, string> = {
  reading1: `
# 1독서 가이드

## 준비사항
- 미사 전 최소 30분 전 도착
- 독서 내용 3회 이상 연습
- 발음이 어려운 단어 확인

## 진행 순서
1. 사제가 "첫째 독서입니다"라고 안내하면 독서대로 이동
2. 잠시 묵상 후 "~에서 나온 말씀입니다" 시작
3. 독서 완료 후 "주님의 말씀입니다" 마무리
4. 회중이 "하느님 감사합니다" 응답

## 주의사항
- 천천히, 또박또박 발음
- 마이크와 적절한 거리 유지
- 독서대 조명 확인
`,
  reading2: `
# 2독서 가이드

## 준비사항
- 1독서와 동일하게 준비
- 화답송 후 진행되므로 타이밍 숙지

## 진행 순서
1. 화답송이 끝나면 독서대로 이동
2. "~에서 나온 말씀입니다" 시작
3. 독서 완료 후 "주님의 말씀입니다" 마무리

## 주의사항
- 1독서보다 조금 더 힘 있게 읽기
- 복음 전 환호송 직전이므로 적절한 여유 두기
`,
  commentary: `
# 해설 가이드

## 준비사항
- 해설문 숙지
- 성당 음향 시스템 확인
- 미사 전체 흐름 파악

## 주요 해설 시점
1. 미사 시작 전 인사말
2. 입당 전 간략한 안내
3. 필요시 특별 안내사항 전달

## 주의사항
- 간결하고 명료하게
- 미사의 흐름을 방해하지 않도록
- 적절한 톤과 속도 유지
`,
  accompaniment: `
# 반주 가이드

## 준비사항
- 성가 악보 완벽 숙지
- 30분 전 도착하여 악기 점검
- 성가대와 호흡 맞추기

## 성가 순서
1. 입당성가
2. 거룩하시도다
3. 화답송
4. 복음 환호송
5. 하느님의 어린양
6. 영성체 성가
7. 파견성가

## 주의사항
- 회중이 따라부를 수 있는 속도
- 전주는 적절한 길이로
- 악기 볼륨 조절 주의
`,
  prayer: `
# 우리의 기도 가이드

## 준비사항
- 기도문 숙지
- 발음 연습

## 진행 순서
1. 사제의 안내 후 독서대로 이동
2. 각 지향별 기도 낭독
3. 회중: "주님, 저희의 기도를 들어주소서"

## 주의사항
- 진심을 담아 읽기
- 각 지향 사이 적절한 간격
- 마지막 지향 후 잠시 묵상 시간
`,
};

export async function answerRoleQuestion(
  role: string,
  question: string
): Promise<string> {
  const model = getChatModel();
  const roleGuide = ROLE_GUIDES[role] || "해당 역할의 가이드가 없습니다.";

  const messages = [
    new SystemMessage(`당신은 가톨릭 미사의 역할 수행을 도와주는 교육 비서입니다.
다음은 "${role}" 역할에 대한 가이드입니다:

${roleGuide}

학생의 질문에 친절하고 명확하게 답변해주세요.
가이드에 없는 내용이라면 일반적인 지식을 바탕으로 답변하되, 
확실하지 않은 내용은 교사에게 확인하도록 안내해주세요.`),
    new HumanMessage(question),
  ];

  const response = await model.invoke(messages);
  return response.content as string;
}

export async function analyzeDocumentAndAnswer(
  documentContent: string,
  question: string
): Promise<string> {
  const model = getChatModel();

  const messages = [
    new SystemMessage(`당신은 문서 내용을 기반으로 질문에 답변하는 AI 비서입니다.
다음 문서 내용을 참고하여 질문에 답변해주세요:

${documentContent}

문서에 없는 내용은 "문서에서 해당 정보를 찾을 수 없습니다"라고 답변해주세요.`),
    new HumanMessage(question),
  ];

  const response = await model.invoke(messages);
  return response.content as string;
}

export { ROLE_GUIDES };
