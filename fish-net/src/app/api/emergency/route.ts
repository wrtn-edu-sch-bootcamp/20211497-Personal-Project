import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";

// ==================== Types ====================

export interface EmergencyAbsenceRequest {
  studentId: string;
  studentName: string;
  baptismalName?: string;
  massDateId: string;
  date: string; // "YYYY-MM-DD"
  role: string;
  reason: string;
}

export interface EmergencyAbsenceResponse {
  success: true;
  assignmentId: string;
  webhookTriggered: boolean;
}

export interface EmergencyAbsenceErrorResponse {
  success: false;
  error: string;
  code: "INVALID_REQUEST" | "ASSIGNMENT_NOT_FOUND" | "FIRESTORE_ERROR" | "WEBHOOK_ERROR";
}

// ==================== POST /api/emergency ====================

/**
 * 학생의 긴급 불참 신고 처리
 *
 * 1. Firestore assignments 컬렉션의 해당 문서 상태를 'absent'로 변경하고 사유 기록
 * 2. attendance 컬렉션에 absent_with_reason 자동 기록 (confirmedBy: "auto")
 * 3. n8n Webhook을 호출하여 교사에게 실시간 알림 전송
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<EmergencyAbsenceResponse | EmergencyAbsenceErrorResponse>> {
  try {
    const body = (await request.json()) as EmergencyAbsenceRequest;
    const { studentId, studentName, baptismalName, massDateId, date, role, reason } = body;

    if (!studentId || !studentName || !massDateId || !date || !role || !reason) {
      return NextResponse.json(
        { success: false, error: "필수 정보가 누락되었습니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    // ── Step 1: assignments 업데이트 ──
    const assignmentsSnap = await db
      .collection("assignments")
      .where("massDateId", "==", massDateId)
      .where("studentId", "==", studentId)
      .where("isPrimary", "==", true)
      .limit(1)
      .get();

    if (assignmentsSnap.empty) {
      return NextResponse.json(
        { success: false, error: "해당 날짜에 배정된 역할을 찾을 수 없습니다.", code: "ASSIGNMENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const assignmentId = assignmentsSnap.docs[0].id;

    await db.collection("assignments").doc(assignmentId).update({
      status: "absent",
      absentReason: reason,
      absentReportedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[POST /api/emergency] assignments 업데이트 완료 - assignmentId: ${assignmentId}`);

    // ── Step 2: attendance 컬렉션 upsert ──
    try {
      const existingSnap = await db
        .collection("attendance")
        .where("studentId", "==", studentId)
        .where("date", "==", date)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        await db.collection("attendance").doc(existingSnap.docs[0].id).update({
          status: "absent_with_reason",
          reason,
          confirmedBy: "auto",
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        await db.collection("attendance").add({
          studentId,
          studentName,
          date,
          status: "absent_with_reason",
          reason,
          confirmedBy: "auto",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      console.log(`[POST /api/emergency] attendance 자동 기록 완료 - ${studentName} / ${date}`);
    } catch (attendanceError) {
      // attendance 실패는 핵심 로직을 막지 않음
      console.error("[POST /api/emergency] attendance 기록 실패:", attendanceError);
    }

    // ── Step 3: n8n Webhook 호출 ──
    let webhookTriggered = false;
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (webhookUrl) {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            type: "emergency_absence",
            timestamp: new Date().toISOString(),
            student: { id: studentId, name: studentName, baptismalName: baptismalName || null },
            assignment: { massDateId, date, role },
            absence: { reason, reportedAt: new Date().toISOString() },
          }),
        });

        if (webhookResponse.ok) {
          webhookTriggered = true;
          console.log(`[POST /api/emergency] n8n Webhook 호출 성공 - ${studentName}`);
        } else {
          console.error(`[POST /api/emergency] n8n Webhook 호출 실패 - Status: ${webhookResponse.status}`);
        }
      } catch (webhookError) {
        console.error("[POST /api/emergency] n8n Webhook 호출 오류:", webhookError);
      }
    } else {
      console.warn("[POST /api/emergency] N8N_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
    }

    return NextResponse.json({ success: true, assignmentId, webhookTriggered });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/emergency] 처리 실패:", msg);
    return NextResponse.json(
      { success: false, error: `긴급 불참 신고 처리 실패: ${msg}`, code: "FIRESTORE_ERROR" },
      { status: 500 }
    );
  }
}
