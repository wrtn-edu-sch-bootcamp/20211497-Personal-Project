import { NextRequest, NextResponse } from "next/server";
import { answerRoleQuestion } from "@/lib/langchain";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, question } = body;

    if (!role || !question) {
      return NextResponse.json(
        { error: "역할과 질문을 입력해주세요." },
        { status: 400 }
      );
    }

    const answer = await answerRoleQuestion(role, question);

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("RAG API Error:", error);
    return NextResponse.json(
      { error: "질문 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
