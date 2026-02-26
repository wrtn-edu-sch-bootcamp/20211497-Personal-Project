import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface AnalyzeCommentResult {
  priority: number;
  reason: string;
  suggestedRoleWeight: {
    easy: number;
    medium: number;
    hard: number;
  };
  shouldExclude: boolean;
}

export async function analyzeStudentComment(
  comment: string
): Promise<AnalyzeCommentResult> {
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `학생이 미사 참석 가능 여부에 대해 다음과 같은 코멘트를 남겼습니다:
"${comment}"

이 코멘트를 분석하여 다음 JSON 형식으로 응답해주세요:
{
  "priority": 1-10 사이의 숫자 (10이 가장 높은 우선순위, 1이 가장 낮은 우선순위),
  "reason": "분석 이유",
  "suggestedRoleWeight": {
    "easy": 0-1 사이 (쉬운 역할 적합도),
    "medium": 0-1 사이 (중간 역할 적합도),
    "hard": 0-1 사이 (어려운 역할 적합도)
  },
  "shouldExclude": true/false (이번 배정에서 제외해야 하는지)
}

예시:
- "시험 기간이라 힘들어요" → 낮은 우선순위, 쉬운 역할 우선
- "이번 주만 늦어요" → 중간 우선순위
- "준비 많이 했어요!" → 높은 우선순위

JSON만 응답해주세요.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  try {
    return JSON.parse(content.text) as AnalyzeCommentResult;
  } catch {
    return {
      priority: 5,
      reason: "코멘트 분석 실패",
      suggestedRoleWeight: { easy: 0.5, medium: 0.5, hard: 0.5 },
      shouldExclude: false,
    };
  }
}

export interface AssignmentRequest {
  massDate: string;
  roles: string[];
  students: {
    id: string;
    name: string;
    isNewMember: boolean;
    canPlayInstrument: boolean;
    skills: string[];
    availability: "available" | "unavailable" | "uncertain";
    comment?: string;
    recentRoles: string[];
    totalAssignments: number;
  }[];
}

export interface AssignmentResult {
  assignments: {
    role: string;
    primary: { studentId: string; studentName: string };
    backup1: { studentId: string; studentName: string } | null;
    backup2: { studentId: string; studentName: string } | null;
  }[];
  warnings: string[];
  reasoning: string;
}

export async function generateAssignments(
  request: AssignmentRequest
): Promise<AssignmentResult> {
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `당신은 비영리 단체의 미사 역할 배정을 도와주는 AI입니다.

## 배정 원칙
1. 반주는 악기 가능자만 배정
2. 신입 학생은 쉬운 역할(우리의 기도) 우선 배정
3. 연속 배정 방지 (최근 2회 연속 같은 역할 금지)
4. 역할 쏠림 방지 (특정 학생에게 역할이 몰리지 않도록)
5. 1순위 백업 + 2순위 백업(백백업) 자동 지정
6. "불가능" 또는 "애매" 응답자는 제외 또는 후순위

## 배정 요청
날짜: ${request.massDate}
필요 역할: ${request.roles.join(", ")}

## 학생 정보
${request.students
  .map(
    (s) => `
- ${s.name} (ID: ${s.id})
  - 신입 여부: ${s.isNewMember ? "예" : "아니오"}
  - 악기 가능: ${s.canPlayInstrument ? "예" : "아니오"}
  - 가용성: ${s.availability}
  - 코멘트: ${s.comment || "없음"}
  - 최근 역할: ${s.recentRoles.join(", ") || "없음"}
  - 총 배정 횟수: ${s.totalAssignments}회
`
  )
  .join("")}

## 응답 형식 (JSON)
{
  "assignments": [
    {
      "role": "역할명",
      "primary": { "studentId": "ID", "studentName": "이름" },
      "backup1": { "studentId": "ID", "studentName": "이름" } 또는 null,
      "backup2": { "studentId": "ID", "studentName": "이름" } 또는 null
    }
  ],
  "warnings": ["경고 메시지 배열 (인원 부족 등)"],
  "reasoning": "배정 이유 설명"
}

JSON만 응답해주세요.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  return JSON.parse(content.text) as AssignmentResult;
}

export interface MessageGenerationRequest {
  studentName: string;
  role: string;
  massDate: string;
  isBackup: boolean;
  backupOrder?: number;
  additionalInfo?: string;
}

export async function generateAssignmentMessage(
  request: MessageGenerationRequest
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `다음 정보로 카카오톡 메시지 초안을 작성해주세요:

학생 이름: ${request.studentName}
역할: ${request.role}
미사 날짜: ${request.massDate}
백업 여부: ${request.isBackup ? `예 (${request.backupOrder}순위 백업)` : "아니오 (정배정)"}
${request.additionalInfo ? `추가 정보: ${request.additionalInfo}` : ""}

친근하고 따뜻한 톤으로 작성해주세요. 메시지만 응답해주세요.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  return content.text;
}

export interface HymnMessageRequest {
  studentName: string;
  massDate: string;
  hymns: {
    type: string;
    number?: number;
    title: string;
    isFixed: boolean;
  }[];
}

export async function generateHymnMessage(
  request: HymnMessageRequest
): Promise<string> {
  const hymnList = request.hymns
    .map((h) =>
      h.isFixed ? `${h.type}: 고정` : `${h.type}: 야훼이레 ${h.number}번`
    )
    .join(" / ");

  return `${request.studentName}야, 이번 주 미사 성가 안내야! / ${hymnList} 준비해줘!`;
}

// ==================== 월간 배정 생성 ====================

export interface MonthlyAssignmentInput {
  month: string; // "YYYY-MM"
  dates: string[]; // ["2026-03-01", "2026-03-08", ...]
  students: {
    id: string;
    name: string;
    isNew: boolean;
    canPlayInstrument: boolean;
    isSinger: boolean; // 성가 연습/반주 담당 (독서 제외 대상)
    gender: "M" | "F" | "?"; // 남/여/미지정
    grade: string; // 학년 (예: "중1", "고2")
    availableDates: string[]; // 참석 가능한 날짜 목록
    uncertainDates: string[]; // 애매한 날짜 목록
    comment?: string;
    recentRoles: { date: string; role: string }[]; // 최근 배정 이력 (연속 배정 체크용)
    totalAssignments: number;
  }[];
}

export interface MonthlyAssignmentOutput {
  assignments: {
    date: string;
    role: string;
    primary: string;
    backup1: string;
    backup2: string;
  }[];
  warnings: string[];
}

/**
 * 월간 역할 배정 생성 (Claude API)
 * Vercel 10초 타임아웃 고려해 프롬프트 간결화 + max_tokens 제한
 *
 * 중고등부 미사: 매주 토요일 오후 7시 30분
 */
export async function generateMonthlyAssignments(
  input: MonthlyAssignmentInput
): Promise<MonthlyAssignmentOutput> {
  const roles = ["1독서", "2독서", "해설", "반주", "우리의기도1", "우리의기도2"];

  const studentSummary = input.students
    .map((s) => {
      const availStr = s.availableDates.length > 0 ? s.availableDates.join(",") : "없음";
      const uncertStr = s.uncertainDates.length > 0 ? `애매:${s.uncertainDates.join(",")}` : "";
      const recentStr =
        s.recentRoles.length > 0
          ? s.recentRoles.map((r) => `${r.date.slice(5)}:${r.role}`).join(",")
          : "";
      const genderStr = s.gender === "M" ? "남" : s.gender === "F" ? "여" : "?";
      return `${s.name}|${s.grade}|${genderStr}|${s.isNew ? "신입" : "기존"}|${s.canPlayInstrument ? "반주O" : "반주X"}|${s.isSinger ? "성가담당" : ""}|가능:[${availStr}]${uncertStr ? "|" + uncertStr : ""}${recentStr ? "|최근:" + recentStr : ""}|총${s.totalAssignments}회${s.comment ? "|메모:" + s.comment : ""}`;
    })
    .join("\n");

  const prompt = `역할배정AI. 중고등부미사(토요일19:30). 월:${input.month}, 날짜:${input.dates.join(",")}
역할:${roles.join(",")}

[핵심조건-반드시준수]
1.반주=canPlayInstrument(반주O)만 배정가능
2.신입=우리의기도/해설만 배정가능
3.정배정(primary)은 2주연속같은역할금지
4.백업은 저번주했어도 상관없음
5.쏠림방지(총배정수 적은학생 우선)
6.각역할:primary+backup1+backup2 지정
7.인원부족시warnings에경고추가

[독서배정규칙-중요]
8.성가담당(반주O/성가담당)학생은 1독서,2독서 최대한 제외
9.최근독서/우리의기도 안한학생 우선배정
10.1독서=고학년우선(고3>고2>고1>중3>중2>중1), 2독서=저학년가능
11.각날짜 1독서+2독서는 남녀각1명씩 배치(예:1독서남+2독서여 또는 1독서여+2독서남)
12.출석률낮은학생(가능날짜적음)은 배정제외 판단가능

[우리의기도]
13.우리의기도는 2명(우리의기도1, 우리의기도2)
14.신입학생 우선배정, 저학년도 가능

[학생데이터]
${studentSummary}

JSON응답:{"assignments":[{"date":"YYYY-MM-DD","role":"역할명","primary":"이름","backup1":"이름","backup2":"이름"}],"warnings":["경고"]}`;

  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const text = content.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`JSON 파싱 실패: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as MonthlyAssignmentOutput;

  if (!Array.isArray(parsed.assignments)) {
    throw new Error("assignments 배열이 없습니다");
  }

  return {
    assignments: parsed.assignments,
    warnings: parsed.warnings ?? [],
  };
}

export default anthropic;
