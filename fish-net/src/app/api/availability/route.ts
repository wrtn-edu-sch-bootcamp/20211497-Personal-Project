import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
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
  comment: string | null;
  createdAt: string; // ISO 문자열
  updatedAt: string;
}

/** POST 성공 응답 */
export interface SubmitAvailabilityResponse {
  success: true;
  saved: number;   // 저장된 항목 수
  updated: number; // 덮어쓴 항목 수 (기존 응답 수정)
}

/** GET 성공 응답 */
export interface GetAvailabilityResponse {
  success: true;
  month: string;       // "YYYY-MM"
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

/**
 * studentId + massDateId 조합으로 기존 문서 ID를 결정적으로 생성
 * → 같은 학생이 같은 날짜에 다시 제출하면 자동으로 덮어씌워짐 (upsert)
 */
function buildDocId(studentId: string, massDateId: string): string {
  return `${studentId}_${massDateId}`;
}

// ==================== POST /api/availability ====================
/**
 * 학생 응답을 Firestore availabilities 컬렉션에 저장
 *
 * 동일한 (studentId, massDateId) 조합이 이미 존재하면 덮어씀 (upsert).
 * Firestore 문서 ID = "{studentId}_{massDateId}"
 *
 * @example
 * POST /api/availability
 * {
 *   "studentId": "abc123",
 *   "studentName": "홍XX",
 *   "responses": [
 *     { "massDateId": "md1", "status": "available" },
 *     { "massDateId": "md2", "status": "unavailable" }
 *   ],
 *   "comment": "시험 기간이에요"
 * }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SubmitAvailabilityResponse | AvailabilityErrorResponse>> {
  try {
    const body = (await request.json()) as SubmitAvailabilityRequest;
    const { studentId, studentName, responses, comment } = body;

    // 1. 유효성 검증
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

    // 2. 학생 존재 확인
    const studentDoc = await getDoc(doc(firestore, "students", studentId));
    const userDoc = await getDoc(doc(firestore, "users", studentId));
    if (!studentDoc.exists() && !userDoc.exists()) {
      return NextResponse.json(
        { success: false, error: `학생을 찾을 수 없습니다: ${studentId}`, code: "STUDENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 3. 각 massDateId 유효성 + 기존 문서 존재 여부 확인
    const existingIds = new Set<string>();
    for (const r of responses) {
      const mdDoc = await getDoc(doc(firestore, "massDates", r.massDateId));
      if (!mdDoc.exists()) {
        return NextResponse.json(
          {
            success: false,
            error: `미사 일정을 찾을 수 없습니다: ${r.massDateId}`,
            code: "MASSDATE_NOT_FOUND",
          },
          { status: 404 }
        );
      }
      // 기존 응답 존재 여부 체크
      const existingDoc = await getDoc(
        doc(firestore, "availabilities", buildDocId(studentId, r.massDateId))
      );
      if (existingDoc.exists()) {
        existingIds.add(buildDocId(studentId, r.massDateId));
      }
    }

    // 4. Upsert (setDoc with merge: false → 전체 덮어쓰기)
    const now = Timestamp.now();
    const savePromises = responses.map((r) => {
      const docId = buildDocId(studentId, r.massDateId);
      return setDoc(doc(firestore, "availabilities", docId), {
        studentId,
        studentName: studentName ?? "",
        massDateId: r.massDateId,
        status: r.status,
        comment: comment?.trim() || null,
        createdAt: existingIds.has(docId)
          ? now  // 기존 문서면 createdAt 유지 못하지만 단순화 위해 now 사용
          : now,
        updatedAt: now,
      });
    });

    await Promise.all(savePromises);

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
/**
 * 특정 월의 모든 학생 응답을 조회
 *
 * month 파라미터로 해당 월에 속한 massDates를 먼저 찾고,
 * 그 massDateId들에 해당하는 availabilities를 반환함.
 *
 * @example
 * GET /api/availability?month=2026-03
 * GET /api/availability?month=2026-03&studentId=abc123  (특정 학생만)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GetAvailabilityResponse | AvailabilityErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const studentId = searchParams.get("studentId"); // optional 필터

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

    // 1. 해당 월의 massDates 조회
    const [year, mon] = month.split("-").map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 1); // 다음 달 1일

    const mdSnapshot = await getDocs(
      query(
        collection(firestore, "massDates"),
        where("date", ">=", Timestamp.fromDate(monthStart)),
        where("date", "<", Timestamp.fromDate(monthEnd))
      )
    );

    if (mdSnapshot.empty) {
      // 등록된 일정 없어도 빈 배열로 정상 응답
      return NextResponse.json({
        success: true,
        month,
        total: 0,
        records: [],
      });
    }

    const massDateIds = mdSnapshot.docs.map((d) => d.id);

    // 2. 해당 massDateId 목록으로 availabilities 조회
    //    Firestore 'in' 연산자 한도: 30개 → chunk 처리
    const CHUNK = 30;
    const allRecords: AvailabilityRecord[] = [];

    for (let i = 0; i < massDateIds.length; i += CHUNK) {
      const chunk = massDateIds.slice(i, i + CHUNK);

      let q = query(
        collection(firestore, "availabilities"),
        where("massDateId", "in", chunk)
      );

      // 특정 학생 필터
      if (studentId) {
        q = query(q, where("studentId", "==", studentId));
      }

      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data();
        allRecords.push({
          id: d.id,
          studentId: data.studentId,
          studentName: data.studentName ?? "",
          massDateId: data.massDateId,
          status: data.status as AvailabilityStatus,
          comment: data.comment ?? null,
          createdAt: data.createdAt?.toDate().toISOString() ?? "",
          updatedAt: data.updatedAt?.toDate().toISOString() ?? "",
        });
      });
    }

    // 3. updatedAt 내림차순 정렬
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
