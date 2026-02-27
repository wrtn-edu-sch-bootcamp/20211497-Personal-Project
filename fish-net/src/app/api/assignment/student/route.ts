import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export interface StudentAssignmentRecord {
  massDateId: string;
  date: string;         // "YYYY-MM-DD"
  role: string;         // "1독서" | "2독서" | "해설" | "반주" | "보편지향기도1" | "보편지향기도2"
  isPrimary: boolean;
  backupOrder?: number; // 1 or 2 (isPrimary=false일 때)
  status: string;
}

export interface GetStudentAssignmentsResponse {
  success: true;
  month: string;
  studentId: string;
  studentName: string;
  assignments: StudentAssignmentRecord[];
}

export interface StudentAssignmentErrorResponse {
  success: false;
  error: string;
  code: "INVALID_REQUEST" | "STUDENT_NOT_FOUND" | "FIRESTORE_ERROR";
}

const ROLE_LABEL: Record<string, string> = {
  reading1: "1독서",
  reading2: "2독서",
  commentary: "해설",
  accompaniment: "반주",
  prayer1: "보편지향기도1",
  prayer2: "보편지향기도2",
  prayer: "보편지향기도",
  "1독서": "1독서",
  "2독서": "2독서",
  "해설": "해설",
  "반주": "반주",
  "보편지향기도": "보편지향기도",
  "보편지향기도1": "보편지향기도1",
  "보편지향기도2": "보편지향기도2",
};

function getRoleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

/**
 * GET /api/assignment/student?studentId=XXX&month=YYYY-MM
 * 특정 학생의 해당 월 배정 결과 조회
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GetStudentAssignmentsResponse | StudentAssignmentErrorResponse>> {
  try {
    const db = getAdminFirestore();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const month = searchParams.get("month");

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "studentId 파라미터가 필요합니다.", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { success: false, error: "month 파라미터가 필요합니다. (형식: YYYY-MM)", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    // 학생 정보 조회
    const studentDoc = await db.collection("students").doc(studentId).get();
    if (!studentDoc.exists) {
      return NextResponse.json(
        { success: false, error: "학생을 찾을 수 없습니다.", code: "STUDENT_NOT_FOUND" },
        { status: 404 }
      );
    }
    const studentData = studentDoc.data()!

    // 해당 월의 massDates 조회
    const [year, mon] = month.split("-").map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 1);

    const mdSnap = await db
      .collection("massDates")
      .where("date", ">=", Timestamp.fromDate(monthStart))
      .where("date", "<", Timestamp.fromDate(monthEnd))
      .get();

    if (mdSnap.empty) {
      return NextResponse.json({
        success: true,
        month,
        studentId,
        studentName: studentData.name ?? "",
        assignments: [],
      });
    }

    const massDateIdToDate = new Map<string, Date>();
    mdSnap.docs.forEach((d) => {
      massDateIdToDate.set(d.id, d.data().date?.toDate() as Date);
    });

    const massDateIds = mdSnap.docs.map((d) => d.id);

    // 해당 학생의 이번 달 assignments 조회
    const CHUNK = 30;
    const allAssignments: StudentAssignmentRecord[] = [];

    console.log(`[GET /api/assignment/student] studentId: ${studentId}, massDateIds:`, massDateIds);

    for (let i = 0; i < massDateIds.length; i += CHUNK) {
      const chunk = massDateIds.slice(i, i + CHUNK);
      const snap = await db
        .collection("assignments")
        .where("studentId", "==", studentId)
        .where("massDateId", "in", chunk)
        .get();

      console.log(`[GET /api/assignment/student] chunk query result: ${snap.size} docs`);

      snap.docs.forEach((d) => {
        const data = d.data();
        console.log(`[GET /api/assignment/student] found assignment:`, data);
        const massDate = massDateIdToDate.get(data.massDateId);
        if (!massDate) return;

        allAssignments.push({
          massDateId: data.massDateId,
          date: massDate.toISOString().slice(0, 10),
          role: getRoleLabel(data.role as string),
          isPrimary: data.isPrimary as boolean,
          backupOrder: data.backupOrder as number | undefined,
          status: data.status as string,
        });
      });
    }

    // 날짜 → 역할 순 정렬
    allAssignments.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      // isPrimary 먼저
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return (a.backupOrder ?? 0) - (b.backupOrder ?? 0);
    });

    return NextResponse.json({
      success: true,
      month,
      studentId,
      studentName: studentData.name ?? "",
      assignments: allAssignments,
    });
  } catch (error) {
    console.error("[GET /api/assignment/student] Error:", error);
    return NextResponse.json(
      { success: false, error: "조회 중 오류가 발생했습니다.", code: "FIRESTORE_ERROR" },
      { status: 500 }
    );
  }
}
