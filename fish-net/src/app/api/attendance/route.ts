import { NextRequest, NextResponse } from "next/server";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AttendanceStatus } from "@/types";

// ==================== Types ====================

interface UpdateAttendanceRequest {
  studentId: string;
  studentName: string;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
}

interface UpdateAttendanceResponse {
  success: true;
  attendanceId: string;
}

interface UpdateAttendanceErrorResponse {
  success: false;
  error: string;
  code: "INVALID_REQUEST" | "FIRESTORE_ERROR";
}

const VALID_STATUSES: AttendanceStatus[] = ["present", "absent", "absent_with_reason", "unknown"];

// ==================== PUT /api/attendance ──────────────────────────────────
// 교사 원클릭 출석 토글 — Admin SDK 사용으로 Firestore 보안 규칙 우회

export async function PUT(
  request: NextRequest
): Promise<NextResponse<UpdateAttendanceResponse | UpdateAttendanceErrorResponse>> {
  try {
    const body = (await request.json()) as UpdateAttendanceRequest;
    const { studentId, studentName, date, status } = body;

    if (!studentId || !studentName || !date || !status) {
      return NextResponse.json(
        { success: false, error: "필수 정보가 누락되었습니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 출석 상태입니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const attendanceRef = db.collection("attendance");

    // upsert: 기존 문서 조회 후 update or create
    const existingSnap = await attendanceRef
      .where("studentId", "==", studentId)
      .where("date", "==", date)
      .limit(1)
      .get();

    let attendanceId: string;

    if (!existingSnap.empty) {
      attendanceId = existingSnap.docs[0].id;
      await attendanceRef.doc(attendanceId).update({
        status,
        confirmedBy: "teacher",
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      const docRef = await attendanceRef.add({
        studentId,
        studentName,
        date,
        status,
        confirmedBy: "teacher",
        updatedAt: FieldValue.serverTimestamp(),
      });
      attendanceId = docRef.id;
    }

    console.log(`[PUT /api/attendance] 교사 출석 기록 완료 - ${studentName} / ${date} / ${status}`);

    return NextResponse.json({ success: true, attendanceId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PUT /api/attendance] 처리 실패:", msg);
    return NextResponse.json(
      { success: false, error: `출석 업데이트 실패: ${msg}`, code: "FIRESTORE_ERROR" },
      { status: 500 }
    );
  }
}

// ==================== GET /api/attendance?date=YYYY-MM-DD ─────────────────
// 특정 날짜의 전체 출석 현황 조회

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { success: false, error: "date 파라미터가 필요합니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const snap = await db.collection("attendance").where("date", "==", date).get();

    const records = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        updatedAt: (data.updatedAt as Timestamp)?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ success: true, records });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/attendance] 조회 실패:", msg);
    return NextResponse.json(
      { success: false, error: `출석 조회 실패: ${msg}`, code: "FIRESTORE_ERROR" },
      { status: 500 }
    );
  }
}
