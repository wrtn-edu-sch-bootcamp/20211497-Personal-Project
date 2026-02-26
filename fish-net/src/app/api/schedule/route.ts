import { NextRequest, NextResponse } from "next/server";
import {
  generateAssignments,
  AssignmentRequest,
  AssignmentResult,
} from "@/lib/claude";
import {
  getStudents,
  getAvailabilities,
  getStudentAssignments,
} from "@/lib/firestore";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type {
  Student,
  StudentAvailability,
  MassDate,
  RoleType,
  AvailabilityStatus,
} from "@/types";

// ==================== Input/Output Interface Definitions ====================

/**
 * API 요청 body 인터페이스
 * scheduleId를 받아 Firestore에서 모든 데이터를 조회
 */
export interface ScheduleAPIRequest {
  scheduleId: string;
}

/**
 * 학생 응답 데이터 (Firestore에서 조회)
 */
export interface StudentResponseData {
  studentId: string;
  studentName: string;
  availability: AvailabilityStatus;
  comment?: string;
}

/**
 * 미사 일정 데이터 (Firestore에서 조회)
 */
export interface MassScheduleData {
  id: string;
  date: Date;
  roles: RoleType[];
}

/**
 * 역할 정보
 */
export interface RoleInfo {
  id: RoleType;
  name: string;
  requiresInstrument: boolean;
  difficulty: "easy" | "medium" | "hard";
}

/**
 * 배정 결과의 개별 역할 배정
 */
export interface RoleAssignment {
  role: string;
  primary: StudentAssignee;
  backup1: StudentAssignee | null;
  backup2: StudentAssignee | null;
}

/**
 * 배정된 학생 정보
 */
export interface StudentAssignee {
  studentId: string;
  studentName: string;
}

/**
 * API 응답 인터페이스 (성공 시)
 */
export interface ScheduleAPIResponse {
  success: true;
  data: {
    scheduleId: string;
    massDate: string;
    assignments: RoleAssignment[];
    warnings: string[];
    reasoning: string;
  };
}

/**
 * API 에러 응답 인터페이스
 */
export interface ScheduleAPIErrorResponse {
  success: false;
  error: string;
  code: ScheduleErrorCode;
}

/**
 * 에러 코드 정의
 */
export type ScheduleErrorCode =
  | "INVALID_REQUEST"
  | "SCHEDULE_NOT_FOUND"
  | "NO_AVAILABLE_STUDENTS"
  | "FIRESTORE_ERROR"
  | "CLAUDE_API_ERROR"
  | "INTERNAL_ERROR";

// ==================== Helper Functions ====================

/**
 * MassDate 문서 조회
 */
async function getMassDate(scheduleId: string): Promise<MassDate | null> {
  const docRef = doc(firestore, "massDates", scheduleId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    id: snapshot.id,
    date: data.date?.toDate(),
    roles: data.roles,
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate(),
  } as MassDate;
}

/**
 * 학생의 최근 배정 역할 조회 (최근 5회)
 */
async function getRecentRoles(studentId: string): Promise<string[]> {
  const assignments = await getStudentAssignments(studentId);
  return assignments
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((a) => a.role);
}

/**
 * 학생 데이터를 Claude API 요청 형식으로 변환
 */
async function buildStudentDataForClaude(
  students: Student[],
  availabilities: StudentAvailability[]
): Promise<AssignmentRequest["students"]> {
  const availabilityMap = new Map<string, StudentAvailability>();
  availabilities.forEach((a) => availabilityMap.set(a.studentId, a));

  const studentDataPromises = students.map(async (student) => {
    const availability = availabilityMap.get(student.id);
    const recentRoles = await getRecentRoles(student.id);
    const allAssignments = await getStudentAssignments(student.id);

    return {
      id: student.id,
      name: student.name,
      isNewMember: student.isNewMember,
      canPlayInstrument: student.canPlayInstrument,
      skills: student.skills,
      availability: availability?.status ?? ("unavailable" as AvailabilityStatus),
      comment: availability?.comment,
      recentRoles,
      totalAssignments: allAssignments.length,
    };
  });

  return Promise.all(studentDataPromises);
}

// ==================== Route Handlers ====================

/**
 * POST /api/schedule
 *
 * scheduleId를 받아 Firestore에서 데이터를 조회하고
 * Claude API를 호출하여 자동 배정 결과를 반환
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ScheduleAPIResponse | ScheduleAPIErrorResponse>> {
  try {
    const body = await request.json();
    const { scheduleId } = body as ScheduleAPIRequest;

    // 1. 요청 유효성 검증
    if (!scheduleId || typeof scheduleId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "scheduleId가 필요합니다.",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    // 2. Firestore에서 MassDate 조회
    const massDate = await getMassDate(scheduleId);
    if (!massDate) {
      return NextResponse.json(
        {
          success: false,
          error: `일정을 찾을 수 없습니다: ${scheduleId}`,
          code: "SCHEDULE_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // 3. 학생 목록 및 가용성 응답 조회
    const [students, availabilities] = await Promise.all([
      getStudents(),
      getAvailabilities(scheduleId),
    ]);

    // 4. 가용 학생 필터링 (available 또는 uncertain만)
    const availableStudentIds = new Set(
      availabilities
        .filter((a) => a.status === "available" || a.status === "uncertain")
        .map((a) => a.studentId)
    );

    const availableStudents = students.filter((s) =>
      availableStudentIds.has(s.id)
    );

    if (availableStudents.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "배정 가능한 학생이 없습니다. 가용성 응답을 먼저 수집해주세요.",
          code: "NO_AVAILABLE_STUDENTS",
        },
        { status: 400 }
      );
    }

    // 5. Claude API 요청 데이터 구성
    const studentData = await buildStudentDataForClaude(
      availableStudents,
      availabilities
    );

    const claudeRequest: AssignmentRequest = {
      massDate: massDate.date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
      roles: massDate.roles,
      students: studentData,
    };

    // 6. Claude API 호출
    const result: AssignmentResult = await generateAssignments(claudeRequest);

    // 7. 응답 반환
    return NextResponse.json({
      success: true,
      data: {
        scheduleId,
        massDate: claudeRequest.massDate,
        assignments: result.assignments,
        warnings: result.warnings,
        reasoning: result.reasoning,
      },
    });
  } catch (error) {
    console.error("Schedule API Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    const isClaudeError = errorMessage.includes("anthropic");

    return NextResponse.json(
      {
        success: false,
        error: `배정 생성 중 오류가 발생했습니다: ${errorMessage}`,
        code: isClaudeError ? "CLAUDE_API_ERROR" : "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/schedule?scheduleId=xxx
 *
 * 기존 배정 결과 조회 (Claude 호출 없이 Firestore에서만 조회)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ScheduleAPIResponse | ScheduleAPIErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");

    if (!scheduleId) {
      return NextResponse.json(
        {
          success: false,
          error: "scheduleId 쿼리 파라미터가 필요합니다.",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const massDate = await getMassDate(scheduleId);
    if (!massDate) {
      return NextResponse.json(
        {
          success: false,
          error: `일정을 찾을 수 없습니다: ${scheduleId}`,
          code: "SCHEDULE_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // 현재는 Firestore에서 기존 배정 조회 로직이 필요하면 추가
    // 지금은 일정 정보만 반환
    return NextResponse.json({
      success: true,
      data: {
        scheduleId,
        massDate: massDate.date.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        }),
        assignments: [],
        warnings: [],
        reasoning: "",
      },
    });
  } catch (error) {
    console.error("Schedule GET API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "일정 조회 중 오류가 발생했습니다.",
        code: "FIRESTORE_ERROR",
      },
      { status: 500 }
    );
  }
}
