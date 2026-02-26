import { NextRequest, NextResponse } from "next/server";
import {
  generateAssignmentMessage,
  generateHymnMessage,
  MessageGenerationRequest,
  HymnMessageRequest,
} from "@/lib/claude";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    if (type === "assignment") {
      const messageRequest: MessageGenerationRequest = {
        studentName: body.studentName,
        role: body.role,
        massDate: body.massDate,
        isBackup: body.isBackup || false,
        backupOrder: body.backupOrder,
        additionalInfo: body.additionalInfo,
      };

      const message = await generateAssignmentMessage(messageRequest);
      return NextResponse.json({ message });
    }

    if (type === "hymn") {
      const hymnRequest: HymnMessageRequest = {
        studentName: body.studentName,
        massDate: body.massDate,
        hymns: body.hymns,
      };

      const message = await generateHymnMessage(hymnRequest);
      return NextResponse.json({ message });
    }

    return NextResponse.json(
      { error: "지원하지 않는 메시지 타입입니다." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Message API Error:", error);
    return NextResponse.json(
      { error: "메시지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
