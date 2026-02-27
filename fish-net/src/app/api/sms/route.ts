import { NextRequest, NextResponse } from "next/server";
import { SolapiMessageService } from "solapi";

// ==================== Types ====================

export interface SmsSendRequest {
  to: string;       // 수신자 전화번호 (예: "01012345678")
  text: string;     // 전송할 메시지 내용
  studentName: string; // 로그용 학생 이름
}

export interface SmsSendResponse {
  success: true;
  messageId: string;
  studentName: string;
}

export interface SmsSendErrorResponse {
  success: false;
  error: string;
  code: "INVALID_REQUEST" | "SEND_FAILED" | "ENV_MISSING";
}

// ==================== Helpers ====================

function normalizePhone(phone: string): string {
  // 하이픈, 공백 제거 후 숫자만 유지
  return phone.replace(/[^0-9]/g, "");
}

// ==================== POST /api/sms ====================

export async function POST(
  request: NextRequest
): Promise<NextResponse<SmsSendResponse | SmsSendErrorResponse>> {
  try {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const sender = process.env.SOLAPI_SENDER;

    if (!apiKey || !apiSecret || !sender) {
      console.error("[POST /api/sms] 솔라피 환경변수 누락");
      return NextResponse.json(
        { success: false, error: "SMS 서비스 설정이 올바르지 않습니다.", code: "ENV_MISSING" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as SmsSendRequest;
    const { to, text, studentName } = body;

    if (!to || !text) {
      return NextResponse.json(
        { success: false, error: "수신자 번호와 메시지 내용이 필요합니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const toNormalized = normalizePhone(to);
    if (toNormalized.length < 10 || toNormalized.length > 11) {
      return NextResponse.json(
        { success: false, error: "올바른 전화번호 형식이 아닙니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const messageService = new SolapiMessageService(apiKey, apiSecret);

    const result = await messageService.sendOne({
      to: toNormalized,
      from: normalizePhone(sender),
      text,
    });

    console.log(`[POST /api/sms] 전송 완료 - 수신자: ${studentName}, messageId: ${result.messageId}`);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      studentName,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/sms] 전송 실패:", msg);
    return NextResponse.json(
      { success: false, error: `메시지 전송 실패: ${msg}`, code: "SEND_FAILED" },
      { status: 500 }
    );
  }
}
