import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// ==================== Types ====================

export interface GenerateMessageRequest {
  studentName: string;
  baptismalName?: string;
  grade?: string;
  gender?: "male" | "female";
  isNewMember?: boolean;
  role: string;
  date: string;
  backup1?: string;
  backup2?: string;
}

export interface GenerateMessageResponse {
  success: true;
  message: string;
}

export interface GenerateMessageErrorResponse {
  success: false;
  error: string;
}

// ==================== POST /api/message/generate ====================

/**
 * Claude AI를 사용하여 학생 개인화 메시지 생성
 * - 학생의 학년, 성별, 신입 여부 등 특성을 반영
 * - 카카오톡 전송에 적합한 친근하고 자연스러운 톤
 * - 정해진 양식(역할, 날짜, 백업 정보)은 반드시 포함
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateMessageResponse | GenerateMessageErrorResponse>> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as GenerateMessageRequest;
    const { studentName, baptismalName, grade, gender, isNewMember, role, date, backup1, backup2 } = body;

    const client = new Anthropic({ apiKey });

    // 학생 특성 정보 구성
    const studentTraits: string[] = [];
    if (grade) studentTraits.push(`학년: ${grade}`);
    if (gender === "male") studentTraits.push("성별: 남학생");
    if (gender === "female") studentTraits.push("성별: 여학생");
    if (isNewMember) studentTraits.push("신입 부원 (처음 배정)");

    // 날짜 포맷
    const d = new Date(date + "T00:00:00");
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const dateFormatted = `${d.getMonth() + 1}월 ${d.getDate()}일(${weekdays[d.getDay()]})`;

    const prompt = `당신은 병점 성당 중고등부 주일학교 교사입니다.
학생에게 미사 역할 배정 안내 카카오톡 메시지를 작성해주세요.

**학생 정보:**
- 이름: ${studentName}${baptismalName ? ` (세례명: ${baptismalName})` : ""}
${studentTraits.length > 0 ? studentTraits.map(t => `- ${t}`).join("\n") : "- 특이사항 없음"}

**배정 정보:**
- 날짜: ${dateFormatted}
- 역할: ${role}
- 백업 1순위: ${backup1 || "없음"}
- 백업 2순위: ${backup2 || "없음"}

**메시지 작성 규칙:**
1. 반드시 "[중고등부 토요일 특전 미사 배정 안내]"로 시작
2. 학생 이름으로 자연스럽게 인사 (세례명이 있으면 세례명 사용 가능)
3. 날짜, 역할, 백업 정보 반드시 포함
4. "참석이 어렵다면 미리 연락 주세요"는 반드시 포함
5. 학생 특성 반영:
   - 신입 부원이면: 따뜻하고 격려하는 톤, 처음이라 걱정 말라는 말 추가
   - 고학년이면: 조금 더 격식체
   - 저학년이면: 더 친근하고 쉬운 표현
   - 여학생이면: 부드러운 표현
   - 남학생이면: 간결하고 명확한 표현
6. 이모지 1-2개만 자연스럽게 사용
7. 너무 길지 않게 (5-8줄 이내)
8. 양식 외에 창의적인 문구 1줄 추가 (역할에 맞는 응원 또는 감사 표현)

메시지만 출력하고 다른 설명은 하지 마세요.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const message = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    return NextResponse.json({ success: true, message });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/message/generate] 오류:", msg);
    return NextResponse.json(
      { success: false, error: `메시지 생성 실패: ${msg}` },
      { status: 500 }
    );
  }
}
