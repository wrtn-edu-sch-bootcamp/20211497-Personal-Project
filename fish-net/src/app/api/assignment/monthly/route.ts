import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  generateMonthlyAssignments,
  MonthlyAssignmentInput,
} from "@/lib/claude";
import type {
  MonthlyAssignmentRequest,
  MonthlyScheduleResult,
  MonthlyAssignmentError,
  AvailabilityStatus,
} from "@/types";

// ==================== Helper ====================

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function inferGenderFromBaptismalName(baptismalName: string | undefined): "M" | "F" | "?" {
  if (!baptismalName || baptismalName === "없음" || baptismalName === "세례못받음") {
    return "?";
  }

  const name = baptismalName.trim();

  const femaleNames = [
    "마리아", "데레사", "소화데레사", "바르바라", "율리안나", "가브리엘라",
    "로사리아", "글라라", "클라라", "에스텔", "리디아", "엘리사벳", "카타리나",
    "아녜스", "안나", "루치아", "체칠리아", "모니카", "막달레나", "베로니카",
    "비비안나", "아가타", "레지나", "빅토리아", "노엘라", "스텔라", "펠리치타",
  ];

  const maleNames = [
    "바오로", "베드로", "요한", "사도요한", "요한보스코", "요한비안네",
    "다니엘", "미카엘", "브루노", "프란치스코", "요셉", "사비오", "아브라함",
    "토마스", "사도토마스", "사도 토마스", "알렉산델", "알렉산더", "가브리엘",
    "라파엘", "안드레아", "야고보", "마태오", "루카", "마르코", "스테파노",
    "아우구스티노", "암브로시오", "도미니코", "안토니오", "보나벤투라",
  ];

  const lowerName = name.toLowerCase().replace(/\s/g, "");

  for (const fn of femaleNames) {
    if (lowerName.includes(fn.toLowerCase().replace(/\s/g, ""))) {
      return "F";
    }
  }

  for (const mn of maleNames) {
    if (lowerName.includes(mn.toLowerCase().replace(/\s/g, ""))) {
      return "M";
    }
  }

  if (name.endsWith("아") || name.endsWith("나") || name.endsWith("라") || name.endsWith("사")) {
    return "F";
  }
  if (name.endsWith("오") || name.endsWith("엘")) {
    return "M";
  }

  return "?";
}

interface StudentData {
  id: string;
  name: string;
  baptismalName: string | null;
  isNew: boolean;
  canPlayInstrument: boolean;
  isSinger: boolean;
  gender: "M" | "F" | "?";
  grade: string;
}

async function getStudentsFromFirestore(): Promise<StudentData[]> {
  const db = getAdminFirestore();

  const mapStudentData = (d: FirebaseFirestore.DocumentSnapshot): StudentData => {
    const data = d.data() || {};

    let gender: "M" | "F" | "?" = "?";
    const rawGender = data.gender as string | undefined;
    if (rawGender === "male" || rawGender === "M" || rawGender === "남") {
      gender = "M";
    } else if (rawGender === "female" || rawGender === "F" || rawGender === "여") {
      gender = "F";
    } else {
      gender = inferGenderFromBaptismalName(data.baptismalName as string | undefined);
    }

    const canPlay = (data.canPlayInstrument as boolean) ?? false;
    const isAccompanist = (data.isAccompanist as boolean) ?? false;

    return {
      id: d.id,
      name: (data.name as string) ?? "",
      baptismalName: (data.baptismalName as string | null) ?? null,
      isNew: (data.isNewMember as boolean) ?? (data.isNewbie as boolean) ?? false,
      canPlayInstrument: canPlay || isAccompanist,
      isSinger: (data.isSinger as boolean) ?? canPlay ?? isAccompanist ?? false,
      gender,
      grade: (data.grade as string) ?? "",
    };
  };

  const snap = await db.collection("students").get();
  return snap.docs.map(mapStudentData);
}

async function getMassDatesForMonth(
  year: number,
  month: number
): Promise<{ id: string; date: Date }[]> {
  const db = getAdminFirestore();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const snap = await db
    .collection("massDates")
    .where("date", ">=", Timestamp.fromDate(start))
    .where("date", "<", Timestamp.fromDate(end))
    .get();

  return snap.docs
    .map((d) => ({
      id: d.id,
      date: d.data().date?.toDate() as Date,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function getAvailabilitiesForMassDates(
  massDateIds: string[]
): Promise<
  Map<
    string,
    {
      studentId: string;
      studentName: string;
      status: AvailabilityStatus;
      comment?: string;
    }[]
  >
> {
  if (massDateIds.length === 0) return new Map();

  const db = getAdminFirestore();
  const CHUNK = 30;
  const result = new Map<
    string,
    {
      studentId: string;
      studentName: string;
      status: AvailabilityStatus;
      comment?: string;
    }[]
  >();

  for (let i = 0; i < massDateIds.length; i += CHUNK) {
    const chunk = massDateIds.slice(i, i + CHUNK);
    const snap = await db
      .collection("availabilities")
      .where("massDateId", "in", chunk)
      .get();

    snap.docs.forEach((d) => {
      const data = d.data();
      const mdId = data.massDateId as string;
      if (!result.has(mdId)) result.set(mdId, []);
      result.get(mdId)!.push({
        studentId: data.studentId,
        studentName: data.studentName ?? "",
        status: data.status as AvailabilityStatus,
        comment: data.comment ?? undefined,
      });
    });
  }

  return result;
}

async function getRecentAssignments(
  studentIds: string[],
  beforeDate: Date
): Promise<Map<string, { date: string; role: string }[]>> {
  if (studentIds.length === 0) return new Map();

  const db = getAdminFirestore();
  const result = new Map<string, { date: string; role: string }[]>();
  const CHUNK = 30;

  for (let i = 0; i < studentIds.length; i += CHUNK) {
    const chunk = studentIds.slice(i, i + CHUNK);
    const snap = await db
      .collection("assignments")
      .where("studentId", "in", chunk)
      .where("isPrimary", "==", true)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    for (const d of snap.docs) {
      const data = d.data();
      const sid = data.studentId as string;
      if (!result.has(sid)) result.set(sid, []);

      const mdSnap = await db.collection("massDates").doc(data.massDateId).get();
      if (mdSnap.exists) {
        const mdDate = mdSnap.data()?.date?.toDate() as Date;
        if (mdDate < beforeDate) {
          result.get(sid)!.push({
            date: formatDate(mdDate),
            role: data.role,
          });
        }
      }
    }
  }

  for (const [, arr] of result) {
    arr.sort((a, b) => b.date.localeCompare(a.date));
    arr.splice(4);
  }

  return result;
}

async function getTotalAssignmentCounts(
  studentIds: string[]
): Promise<Map<string, number>> {
  if (studentIds.length === 0) return new Map();

  const db = getAdminFirestore();
  const result = new Map<string, number>();
  const CHUNK = 30;

  for (let i = 0; i < studentIds.length; i += CHUNK) {
    const chunk = studentIds.slice(i, i + CHUNK);
    const snap = await db
      .collection("assignments")
      .where("studentId", "in", chunk)
      .where("isPrimary", "==", true)
      .get();

    snap.docs.forEach((d) => {
      const sid = d.data().studentId as string;
      result.set(sid, (result.get(sid) ?? 0) + 1);
    });
  }

  return result;
}

// ==================== POST /api/assignment/monthly ====================

export async function POST(
  request: NextRequest
): Promise<
  NextResponse<
    { success: true; data: MonthlyScheduleResult } | MonthlyAssignmentError
  >
> {
  try {
    const body = (await request.json()) as MonthlyAssignmentRequest;
    const { month, availabilityData } = body;

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

    const massDates = await getMassDatesForMonth(year, mon);
    if (massDates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${month}월에 등록된 미사 일정이 없습니다.`,
          code: "NO_MASS_DATES",
        },
        { status: 400 }
      );
    }

    const studentsRaw = await getStudentsFromFirestore();
    if (studentsRaw.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "등록된 학생이 없습니다.",
          code: "NO_STUDENTS",
        },
        { status: 400 }
      );
    }

    let availMap: Map<
      string,
      {
        studentId: string;
        studentName: string;
        status: AvailabilityStatus;
        comment?: string;
      }[]
    >;

    if (availabilityData && availabilityData.length > 0) {
      availMap = new Map();
      for (const av of availabilityData) {
        for (const d of av.dates) {
          if (!availMap.has(d.massDateId)) availMap.set(d.massDateId, []);
          availMap.get(d.massDateId)!.push({
            studentId: av.studentId,
            studentName: av.studentName,
            status: d.status,
            comment: av.comment,
          });
        }
      }
    } else {
      availMap = await getAvailabilitiesForMassDates(massDates.map((m) => m.id));
    }

    const studentIds = studentsRaw.map((s) => s.id);
    const firstMassDate = massDates[0].date;
    const [recentMap, totalMap] = await Promise.all([
      getRecentAssignments(studentIds, firstMassDate),
      getTotalAssignmentCounts(studentIds),
    ]);

    const dateStrings = massDates.map((m) => formatDate(m.date));
    const massDateIdToStr = new Map(
      massDates.map((m) => [m.id, formatDate(m.date)])
    );

    // 응답한 학생 ID 집합 — 하나라도 응답이 있으면 응답한 것으로 간주
    const respondedStudentIds = new Set<string>();
    for (const avails of availMap.values()) {
      for (const a of avails) {
        respondedStudentIds.add(a.studentId);
      }
    }

    const studentsForClaude: MonthlyAssignmentInput["students"] =
      studentsRaw.map((s) => {
        const availableDates: string[] = [];
        const uncertainDates: string[] = [];
        const unavailableDates: string[] = [];
        let comment: string | undefined;

        for (const [mdId, avails] of availMap) {
          const dateStr = massDateIdToStr.get(mdId);
          if (!dateStr) continue;
          const mine = avails.find((a) => a.studentId === s.id);
          if (mine) {
            if (mine.status === "available") availableDates.push(dateStr);
            else if (mine.status === "uncertain") uncertainDates.push(dateStr);
            else if (mine.status === "unavailable") unavailableDates.push(dateStr);
            if (mine.comment && !comment) comment = mine.comment;
          }
        }

        // 무응답 학생: 모든 날짜를 uncertain으로 간주하여 배정 가능하되 우선순위 낮춤
        const isNoResponse = !respondedStudentIds.has(s.id);
        if (isNoResponse) {
          for (const dateStr of dateStrings) {
            if (!uncertainDates.includes(dateStr)) {
              uncertainDates.push(dateStr);
            }
          }
          comment = (comment ? comment + " / " : "") + "[무응답: 확인 필요]";
        }

        return {
          id: s.id,
          name: s.name,
          baptismalName: s.baptismalName,
          isNew: s.isNew,
          canPlayInstrument: s.canPlayInstrument,
          isSinger: s.isSinger,
          gender: s.gender,
          grade: s.grade,
          availableDates,
          uncertainDates,
          unavailableDates,
          comment,
          recentRoles: recentMap.get(s.id) ?? [],
          totalAssignments: totalMap.get(s.id) ?? 0,
        };
      });

    const claudeInput: MonthlyAssignmentInput = {
      month,
      dates: dateStrings,
      students: studentsForClaude,
    };

    let result: Awaited<ReturnType<typeof generateMonthlyAssignments>>;
    try {
      result = await generateMonthlyAssignments(claudeInput);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("JSON 파싱") || msg.includes("assignments 배열")) {
        return NextResponse.json(
          { success: false, error: msg, code: "PARSE_ERROR" },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: `Claude API 오류: ${msg}`,
          code: "CLAUDE_ERROR",
        },
        { status: 500 }
      );
    }

    const response: MonthlyScheduleResult = {
      month,
      assignments: result.assignments,
      warnings: result.warnings,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[POST /api/assignment/monthly] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        code: "CLAUDE_ERROR",
      },
      { status: 500 }
    );
  }
}
