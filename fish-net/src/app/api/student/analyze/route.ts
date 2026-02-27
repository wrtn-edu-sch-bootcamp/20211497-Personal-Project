import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface AnalyzeRequest {
  studentName: string;
  baptismalName?: string | null;
  grade?: string;
  comments: string; // 날짜별 코멘트 텍스트
}

/**
 * POST /api/student/analyze
 * 학생 코멘트 히스토리를 Claude에게 넘겨 패턴 한 줄 요약 반환.
 * 코멘트가 없는 경우 호출하지 않도록 클라이언트(StudentDrawer)에서 보장.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API 키 없음" }, { status: 500 });
    }

    const body = (await req.json()) as AnalyzeRequest;
    const { studentName, baptismalName, grade, comments } = body;

    if (!comments?.trim()) {
      return NextResponse.json({ error: "코멘트 없음" }, { status: 400 });
    }

    const displayName = baptismalName
      ? `${studentName}(${baptismalName})`
      : studentName;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `병점 성당 중고등부 학생 ${displayName}(${grade ?? ""})의 최근 미사 참석 코멘트입니다:

${comments}

위 코멘트를 바탕으로 이 학생의 참석 패턴이나 특이사항을 한 문장(30자 이내)으로 요약해주세요.
예시: "주로 학원 일정으로 불참하는 패턴이 있습니다."
요약 문장만 출력하세요.`,
        },
      ],
    });

    const analysis =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : null;

    return NextResponse.json({ analysis });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/student/analyze] 오류:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
