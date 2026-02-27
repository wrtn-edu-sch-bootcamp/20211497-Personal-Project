import { NextRequest, NextResponse } from "next/server";
import { answerRoleQuestion, answerGuideQuestion } from "@/lib/langchain";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, role } = body as { question?: string; role?: string };

    if (!question?.trim()) {
      return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
    }

    // role이 명시되면 해당 역할 가이드만 참조, 없으면 질문에서 자동 감지
    const answer = role
      ? await answerRoleQuestion(role, question)
      : await answerGuideQuestion(question);

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("[POST /api/rag] 오류:", error);
    return NextResponse.json(
      { error: "질문 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
