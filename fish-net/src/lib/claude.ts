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
    baptismalName: string | null;
    isNew: boolean;
    canPlayInstrument: boolean;
    isSinger: boolean;
    gender: "M" | "F" | "?";
    grade: string;
    availableDates: string[];
    uncertainDates: string[];
    unavailableDates: string[];
    comment?: string;
    // 최근 정배정 이력 (날짜 내림차순)
    recentRoles: { date: string; role: string }[];
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
/**
 * 날짜 문자열 간 차이를 일(day) 단위로 반환
 */
function daysBetween(dateA: string, dateB: string): number {
  return Math.round(
    Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / 86_400_000
  );
}

export async function generateMonthlyAssignments(
  input: MonthlyAssignmentInput
): Promise<MonthlyAssignmentOutput> {
  const roles = ["1독서", "2독서", "반주", "보편지향기도1", "보편지향기도2"];

  // ── 고유 식별자 생성 함수 ──
  // 동일한 이름(성)을 가진 학생을 구분하기 위해 고유 식별자 사용
  // 세례명이 있으면: "이름 (세례명)"
  // 세례명이 없으면: "이름 (학년)" (예: "김XX (중2)")
  const getUniqueId = (s: MonthlyAssignmentInput["students"][number]): string => {
    if (s.baptismalName) {
      return `${s.name} (${s.baptismalName})`;
    }
    return s.grade ? `${s.name} (${s.grade})` : s.name;
  };

  // ── 서버에서 직접 제약 조건 계산 ──────────────────────────────────────────
  //
  // 각 날짜별로 아래를 미리 계산해서 Claude에게 전달:
  //   1. unavailable → 해당 날짜 후보에서 완전 제거 (이미 구현)
  //   2. 2주 정배정 쿨다운 → 직전 정배정일로부터 14일 이내인 학생을
  //      "정배정 불가(primary_blocked)" 목록으로 분리
  //   3. 동일 역할 연속 금지 → 이 달 내 이미 같은 역할로 정배정된 학생을
  //      해당 역할의 "연속_불가" 목록으로 분리
  //      * 단 Claude가 이 달 날짜를 순서대로 처리해야 하므로
  //        각 날짜의 후보 섹션에 "이전 날짜 정배정 학생" 정보를 포함

  // 각 학생의 가장 최근 정배정 날짜 (이 달 이전 이력에서)
  const lastPrimaryDateMap = new Map<string, string>(); // uniqueId → date
  for (const s of input.students) {
    if (s.recentRoles.length > 0) {
      // recentRoles는 날짜 내림차순 정렬되어 있음
      lastPrimaryDateMap.set(getUniqueId(s), s.recentRoles[0].date);
    }
  }

  // 각 학생의 가장 최근 정배정 역할 (이 달 이전 이력에서)
  const lastPrimaryRoleMap = new Map<string, string>(); // uniqueId → role
  for (const s of input.students) {
    if (s.recentRoles.length > 0) {
      lastPrimaryRoleMap.set(getUniqueId(s), s.recentRoles[0].role);
    }
  }

  // 날짜별 후보 계산 (이 달 내 배정 추적 포함)
  // inMonthPrimary: 이 달 내 이미 확정된 날짜별 정배정 결과를 누적
  // Claude가 날짜 순서대로 처리하도록 각 날짜에 이전 배정 정보를 명시
  const dateCandidates = input.dates.map((date) => {
    // 1) unavailable 제거
    const eligible = input.students.filter((s) => !s.unavailableDates.includes(date));

    // 2) 2주 쿨다운: 직전 정배정일로부터 14일 이내인 학생 → primary 불가
    const cooldownBlocked = eligible.filter((s) => {
      const lastDate = lastPrimaryDateMap.get(getUniqueId(s));
      if (!lastDate) return false;
      return daysBetween(lastDate, date) < 14;
    });

    // 3) 직전 날짜(이 달 내) 연속 역할 방지 정보는 prompt에서 Claude가 직접 처리하도록
    //    각 날짜에 "직전 날짜 정배정 학생 목록"을 명시

    const accompanists = eligible.filter((s) => s.canPlayInstrument);
    const nonNewbies = eligible.filter((s) => !s.isNew);
    const newbies = eligible.filter((s) => s.isNew);
    const uncertain = eligible.filter((s) => s.uncertainDates.includes(date));
    const available = eligible.filter((s) => s.availableDates.includes(date));

    // primary 가능 후보 = eligible - cooldownBlocked
    const cooldownUniqueIds = new Set(cooldownBlocked.map((s) => getUniqueId(s)));
    const primaryEligible = eligible.filter((s) => !cooldownUniqueIds.has(getUniqueId(s)));

    return {
      date,
      eligible: eligible.map((s) => getUniqueId(s)),
      primaryEligible: primaryEligible.map((s) => getUniqueId(s)),
      cooldownBlocked: cooldownBlocked.map((s) => {
        const uid = getUniqueId(s);
        const lastDate = lastPrimaryDateMap.get(uid) ?? "";
        const lastRole = lastPrimaryRoleMap.get(uid) ?? "";
        return `${uid}(직전:${lastDate.slice(5)} ${lastRole})`;
      }),
      // 반주 역할 전용 후보 (정배정 + 백업 모두 이 목록에서만 선택)
      accompanists: accompanists.map((s) => getUniqueId(s)),
      accompanistsPrimaryEligible: accompanists
        .filter((s) => !cooldownUniqueIds.has(getUniqueId(s)))
        .map((s) => getUniqueId(s)),
      nonNewbies: nonNewbies.map((s) => getUniqueId(s)),
      newbies: newbies.map((s) => getUniqueId(s)),
      available: available.map((s) => getUniqueId(s)),
      uncertain: uncertain.map((s) => getUniqueId(s)),
    };
  });

  const candidateSummary = dateCandidates
    .map((dc, idx) => {
      // 이전 날짜(이 달 내) 안내
      const prevDatesNote =
        idx > 0
          ? `  ※ 앞 날짜(${input.dates.slice(0, idx).join(", ")})에 이미 정배정된 학생은 이 날짜에 다시 정배정 금지`
          : "";

      const lines = [
        `날짜:${dc.date}`,
        prevDatesNote,
        `  [반주] 후보(정배정+백업 모두 이 목록에서만, ${dc.accompanists.length}명):${dc.accompanists.join(", ") || "없음"}`,
        `  [반주] 그 중 정배정가능(쿨다운 제외, ${dc.accompanistsPrimaryEligible.length}명):${dc.accompanistsPrimaryEligible.join(", ") || "없음"}`,
        dc.cooldownBlocked.length > 0
          ? `  [전체] 쿨다운으로 정배정불가(백업은 가능):${dc.cooldownBlocked.join(", ")}`
          : "",
        `  [전체] 정배정가능(${dc.primaryEligible.length}명):${dc.primaryEligible.join(", ") || "없음"}`,
        `  [전체] 후보(정배정불가자포함,백업용):${dc.eligible.join(", ") || "없음"}`,
        dc.newbies.length > 0 ? `  신입(보편지향기도만):${dc.newbies.join(", ")}` : "",
        dc.available.length > 0 ? `  가능응답:${dc.available.join(", ")}` : `  가능응답:없음(미응답자도 배정가능)`,
        dc.uncertain.length > 0 ? `  애매응답:${dc.uncertain.join(", ")}` : "",
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n\n");

  // 각 학생의 직전 정배정 역할 정보 (연속 동일 역할 방지용)
  const recentRoleSummary = input.students
    .filter((s) => s.recentRoles.length > 0)
    .map((s) => {
      const recent = s.recentRoles.slice(0, 2);
      return `${getUniqueId(s)}: ${recent.map((r) => `${r.date.slice(5)} ${r.role}`).join(" → ")}`;
    })
    .join("\n");

  // 코멘트 섹션
  const studentsWithComment = input.students.filter((s) => s.comment);
  const commentSection =
    studentsWithComment.length > 0
      ? `\n[학생 코멘트 - 배정 반영]\n` +
        studentsWithComment
          .map(
            (s) =>
              `- ${getUniqueId(s)}(${s.grade}): "${s.comment}"\n  → 시험/바쁨/늦게도착 → 쉬운역할(보편지향기도) 또는 backup만 / 열심히준비 → 우선배정`
          )
          .join("\n")
      : "";

  const studentSummary = input.students
    .map((s) => {
      const genderStr = s.gender === "M" ? "남" : s.gender === "F" ? "여" : "?";
      return `${getUniqueId(s)}|${s.grade}|${genderStr}|${s.isNew ? "신입" : "기존"}|${s.canPlayInstrument ? "반주O" : "반주X"}|누적${s.totalAssignments}회`;
    })
    .join("\n");

  const prompt = `당신은 병점 성당 중고등부 주일학교 미사 역할 배정 담당자입니다.
${input.month}월 매주 토요일 19:30 미사의 역할을 배정해주세요.
역할: ${roles.join(", ")}
배정 날짜(순서대로): ${input.dates.join(", ")}

━━━ 절대 규칙 (위반 불가) ━━━
1. 각 날짜 "[전체] 후보" 목록에 없는 학생은 정배정/백업 모두 배정 불가
2. 반주는 "[반주] 후보" 목록에 있는 학생만 정배정/백업1/백업2 모두 배정 가능 (반주 불가 학생은 반주 역할에 절대 배정 금지)
3. 신입학생은 보편지향기도1, 보편지향기도2만 배정 가능
4. 각 역할마다 primary, backup1, backup2 반드시 3명 지정 (인원 부족 시 중복 허용)
5. "[전체] 쿨다운으로 정배정불가" 학생은 primary 배정 불가 (backup1/2는 가능)

━━━ 연속 배정 방지 규칙 (중요) ━━━
6. 같은 날짜 내에서 1명의 학생이 2개 이상의 역할에 primary로 배정 불가
7. 이 달 내 날짜들 사이에서 동일 학생이 연속으로 primary 배정 금지
   - 예) 1주차에 정배정된 학생은 2주차에 다시 정배정 금지
   - 반드시 최소 2주(1번 건너뛰기) 이상 간격을 둘 것
8. 동일 학생이 같은 역할로 연속 2회 이상 primary 배정 금지
   - 아래 "최근 정배정 역할" 참고하여 같은 역할 반복 배정 금지

━━━ 우선순위 규칙 ━━━
9. 가능응답자 > 미응답자 > 애매응답자 순서로 우선 배정
10. 누적 배정 횟수가 적은 학생 우선 배정 (공평한 분배)
11. 1독서+2독서는 같은 날짜에 남녀 각 1명씩, 1독서는 고학년 우선(고3>고2>고1>중3>중2>중1)
12. 반주O 학생은 독서 배정 최대한 제외
${commentSection}

━━━ 규칙 우선순위 및 예외 처리 ━━━
[최우선 조항] 반주 역할은 반드시 canPlayInstrument: true인 학생 중에서만 배정하며, 인원 부족 시 쿨다운 규칙(2주 간격)보다 반주자 확보를 우선한다.

[신입생 조항] 신입(isNewMember: true)은 반드시 '보편지향기도1, 보편지향기도2'에만 배치하여 심리적 부담을 최소화한다.

[유연성 조항] 1·2독서의 성별/학년 배분 규칙은 최대한 준수하되, 가용 인원이 부족할 경우 가용성(available)이 높은 학생을 우선하여 배정표를 완성한다.

━━━ 비정형 코멘트 해석 로직 ━━━
[부정적 키워드] 코멘트에 '시험', '학원', '늦음', '힘듦', '바쁨'이 포함된 경우:
  → 정배정(primary)보다는 백업으로 배치하거나 가장 쉬운 역할(보편지향기도)로 배정
  → 단, 인원이 극도로 부족한 경우 정배정도 가능하되 warnings에 명시

[긍정적 키워드] '열심히', '자신 있음', '무엇이든', '준비했어요', '잘할게요' 등이 있으면:
  → 배정 우선순위를 높여 적극적으로 역할 부여
  → 어려운 역할(독서, 반주)도 고려 가능

[무응답 처리] 마감일까지 응답이 없는 학생(availableDates, uncertainDates, unavailableDates 모두 비어있음):
  → 배정 가능하나 낮은 우선순위로 처리
  → warnings에 "무응답자 배정: [학생명]" 형태로 명시하여 교사가 수동 확인 가능하도록

━━━ 메시지 생성 컨텍스트 ━━━
배정 결과 메시지 생성 시:
  - 학생의 코멘트에 대한 간단한 격려 포함 (예: "시험 기간이라 힘들 텐데 고마워!")
  - 친근하고 따뜻한 톤 유지
  - 성가 안내가 확정된 경우 곡 번호와 제목을 메시지 하단에 명시

━━━ 시스템 범위 및 한계 명시 ━━━
[교사 재량 영역] 다음 상황은 시스템이 자동 처리하지 않고 교사 판단에 맡김:
  - 당일 도착 시간이 모호한 경우
  - 학생끼리 사적으로 역할을 바꾼 경우
  - 시스템은 '백업 전환 버튼'까지만 지원하고 최종 판단은 교사에게 위임

[경고 생성 기준] 다음 상황 발생 시 반드시 warnings 배열에 포함:
  - 반주 가능 학생이 2명 미만일 때
  - 신입생만으로 보편지향기도 2개를 채워야 할 때
  - 무응답자를 정배정한 경우
  - 동일 학생이 한 달에 3회 이상 정배정될 때
  - 쿨다운 규칙을 위반하여 배정한 경우 (반주 인원 부족 등)

━━━ 날짜별 배정가능 후보 ━━━
${candidateSummary}

━━━ 최근 정배정 역할 (연속 역할 방지용) ━━━
${recentRoleSummary || "이전 배정 이력 없음"}

━━━ 전체 학생 정보 ━━━
${studentSummary}

위 규칙을 모두 반영하여 submit_assignments 툴을 호출해 배정 결과를 제출하세요.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    tools: [
      {
        name: "submit_assignments",
        description: "월간 미사 역할 배정 결과를 제출합니다.",
        input_schema: {
          type: "object" as const,
          properties: {
            assignments: {
              type: "array",
              description: "날짜별 역할 배정 목록",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", description: "배정 날짜 (YYYY-MM-DD)" },
                  role: { type: "string", description: "역할명 (1독서/2독서/반주/보편지향기도1/보편지향기도2)" },
                  primary: { type: "string", description: "정배정 학생 이름" },
                  backup1: { type: "string", description: "1순위 백업 학생 이름" },
                  backup2: { type: "string", description: "2순위 백업 학생 이름" },
                },
                required: ["date", "role", "primary", "backup1", "backup2"],
              },
            },
            warnings: {
              type: "array",
              description: "인원 부족 등 특이사항 목록",
              items: { type: "string" },
            },
          },
          required: ["assignments", "warnings"],
        },
      },
    ],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    // tool_use가 없으면 text 응답에서 JSON fallback 시도
    const textBlock = response.content.find((c) => c.type === "text");
    if (textBlock && textBlock.type === "text") {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as MonthlyAssignmentOutput;
        if (Array.isArray(parsed.assignments)) {
          return { assignments: parsed.assignments, warnings: parsed.warnings ?? [] };
        }
      }
    }
    throw new Error("Claude가 배정 결과를 반환하지 않았습니다.");
  }

  const result = toolUse.input as MonthlyAssignmentOutput;

  if (!Array.isArray(result.assignments)) {
    throw new Error("assignments 배열이 없습니다");
  }

  return {
    assignments: result.assignments,
    warnings: result.warnings ?? [],
  };
}

export default anthropic;
