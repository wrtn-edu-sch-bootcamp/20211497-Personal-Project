import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { AvailabilityStatus } from "@/types";

// ==================== Interface Definitions ====================

/** POST 요청 body: 학생 한 명의 응답 배열 */
export interface SubmitAvailabilityRequest {
  studentId: string;
  studentName: string;
  /** 날짜별 응답 목록 */
  responses: {
    massDateId: string;
    status: AvailabilityStatus;
    /** 복사단 봉사로 인한 참석 불가 여부 */
    isCopasadan?: boolean;
  }[];
  /** 전체 공통 코멘트 (선택) */
  comment?: string;
}

/** 개별 응답 항목 */
export interface AvailabilityRecord {
  id: string;
  studentId: string;
  studentName: string;
  massDateId: string;
  status: AvailabilityStatus;
  isCopasadan: boolean;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST 성공 응답 */
export interface SubmitAvailabilityResponse {
  success: true;
  saved: number;
  updated: number;
}

/** GET 성공 응답 */
export interface GetAvailabilityResponse {
  success: true;
  month: string;
  total: number;
  records: AvailabilityRecord[];
}

/** 에러 응답 */
export interface AvailabilityErrorResponse {
  success: false;
  error: string;
  code: "INVALID_REQUEST" | "STUDENT_NOT_FOUND" | "MASSDATE_NOT_FOUND" | "FIRESTORE_ERROR";
}

// ==================== Helper ====================

function buildDocId(studentId: string, massDateId: string): string {
  return `${studentId}_${massDateId}`;
}

// ==================== POST /api/availability ====================

export async function POST(
  request: NextRequest
): Promise<NextResponse<SubmitAvailabilityResponse | AvailabilityErrorResponse>> {
  try {
    const db = getAdminFirestore();
    const body = (await request.json()) as SubmitAvailabilityRequest;
    const { studentId, studentName, responses, comment } = body;

    if (!studentId || typeof studentId !== "string") {
      return NextResponse.json(
        { success: false, error: "studentId가 필요합니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }
    if (!Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json(
        { success: false, error: "responses 배열이 비어있습니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const validStatuses: AvailabilityStatus[] = ["available", "unavailable", "uncertain"];
    for (const r of responses) {
      if (!r.massDateId || !validStatuses.includes(r.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `잘못된 응답 데이터: massDateId=${r.massDateId}, status=${r.status}`,
            code: "INVALID_REQUEST",
          },
          { status: 400 }
        );
      }
    }

    const studentDoc = await db.collection("students").doc(studentId).get();
    if (!studentDoc.exists) {
      return NextResponse.json(
        { success: false, error: `학생을 찾을 수 없습니다: ${studentId}`, code: "STUDENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const existingIds = new Set<string>();
    for (const r of responses) {
      const mdDoc = await db.collection("massDates").doc(r.massDateId).get();
      if (!mdDoc.exists) {
        return NextResponse.json(
          {
            success: false,
            error: `미사 일정을 찾을 수 없습니다: ${r.massDateId}`,
            code: "MASSDATE_NOT_FOUND",
          },
          { status: 404 }
        );
      }
      const existingDoc = await db
        .collection("availabilities")
        .doc(buildDocId(studentId, r.massDateId))
        .get();
      if (existingDoc.exists) {
        existingIds.add(buildDocId(studentId, r.massDateId));
      }
    }

    const now = Timestamp.now();
    const batch = db.batch();

    for (const r of responses) {
      const docId = buildDocId(studentId, r.massDateId);
      const docRef = db.collection("availabilities").doc(docId);
      batch.set(docRef, {
        studentId,
        studentName: studentName ?? "",
        massDateId: r.massDateId,
        status: r.status,
        isCopasadan: r.isCopasadan ?? false,
        comment: comment?.trim() || null,
        createdAt: existingIds.has(docId) ? now : now,
        updatedAt: now,
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      saved: responses.length,
      updated: existingIds.size,
    });
  } catch (error) {
    console.error("[POST /api/availability] Error:", error);
    return NextResponse.json(
      { success: false, error: "저장 중 오류가 발생했습니다.", code: "FIRESTORE_ERROR" },
      { status: 500 }
    );
  }
}

// ==================== GET /api/availability?month=YYYY-MM ====================

export async function GET(
  request: NextRequest
): Promise<NextResponse<GetAvailabilityResponse | AvailabilityErrorResponse>> {
  try {
    const db = getAdminFirestore();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const studentId = searchParams.get("studentId");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        {
          success: false,
          error: "month 파라미터가 필요합니다. (형식: YYYY-MM)",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const [year, mon] = month.split("-").map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 1);

    const mdSnapshot = await db
      .collection("massDates")
      .where("date", ">=", Timestamp.fromDate(monthStart))
      .where("date", "<", Timestamp.fromDate(monthEnd))
      .get();

    if (mdSnapshot.empty) {
      return NextResponse.json({
        success: true,
        month,
        total: 0,
        records: [],
      });
    }

    const massDateIds = mdSnapshot.docs.map((d) => d.id);

    const CHUNK = 30;
    const allRecords: AvailabilityRecord[] = [];

    for (let i = 0; i < massDateIds.length; i += CHUNK) {
      const chunk = massDateIds.slice(i, i + CHUNK);

      let q = db.collection("availabilities").where("massDateId", "in", chunk);

      if (studentId) {
        q = q.where("studentId", "==", studentId);
      }

      const snap = await q.get();
      snap.docs.forEach((d) => {
        const data = d.data();
        allRecords.push({
          id: d.id,
          studentId: data.studentId,
          studentName: data.studentName ?? "",
          massDateId: data.massDateId,
          status: data.status as AvailabilityStatus,
          isCopasadan: data.isCopasadan ?? false,
          comment: data.comment ?? null,
          createdAt: data.createdAt?.toDate().toISOString() ?? "",
          updatedAt: data.updatedAt?.toDate().toISOString() ?? "",
        });
      });
    }

    allRecords.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      month,
      total: allRecords.length,
      records: allRecords,
    });
  } catch (error) {
    console.error("[GET /api/availability] Error:", error);
    return NextResponse.json(
      { success: false, error: "조회 중 오류가 발생했습니다.", code: "FIRESTORE_ERROR" },
      { status: 500 }
    );
  }
}
