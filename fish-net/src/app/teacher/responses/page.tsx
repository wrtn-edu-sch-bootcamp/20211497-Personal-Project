"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { AvailabilityStatus, AttendanceStatus, Attendance } from "@/types";
import { getStudents, getMassDates, getAvailabilities } from "@/lib/firestore";
import StudentDrawer, { type DrawerStudent } from "@/components/StudentDrawer";

// ==================== Types ====================

interface StudentInfo {
  id: string;
  name: string;
  baptismalName: string | null;
  grade: string;
  phone?: string;
}

interface MassDateInfo {
  id: string;
  date: Date;
}

interface AvailabilityInfo {
  id: string;
  studentId: string;
  studentName: string;
  massDateId: string;
  status: AvailabilityStatus;
  isCopasadan: boolean;
  comment: string | null;
  updatedAt: Date;
}

interface StudentResponseSummary {
  student: StudentInfo;
  responses: {
    massDateId: string;
    date: Date;
    status: AvailabilityStatus;
    isCopasadan: boolean;
  }[];
  comment: string | null;
  totalResponses: number;
  availableCount: number;
  uncertainCount: number;
  unavailableCount: number;
  copasadanCount: number;
  lastUpdated: Date | null;
}

// attendance 상태별 UI 설정
const ATTENDANCE_CONFIG: Record<
  AttendanceStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  present: {
    label: "출석",
    bg: "bg-emerald-500",
    text: "text-white",
    border: "border-emerald-600",
    icon: "✓",
  },
  absent: {
    label: "결석",
    bg: "bg-red-500",
    text: "text-white",
    border: "border-red-600",
    icon: "✗",
  },
  absent_with_reason: {
    label: "사유결석",
    bg: "bg-orange-400",
    text: "text-white",
    border: "border-orange-500",
    icon: "!",
  },
  unknown: {
    label: "미확인",
    bg: "bg-gray-200",
    text: "text-gray-500",
    border: "border-gray-300",
    icon: "?",
  },
};

// ==================== Utils ====================

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateToString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDeadlineKey(month: string) {
  return `fishnet_deadline_${month}`;
}

// ==================== Sub-components ====================

const STATUS_CONFIG: Record<
  AvailabilityStatus,
  { label: string; emoji: string; bg: string; text: string; border: string }
> = {
  available: { label: "가능", emoji: "😊", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  uncertain: { label: "애매", emoji: "🤔", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  unavailable: { label: "불가", emoji: "😢", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
};

function StatusBadge({ status, isCopasadan }: { status: AvailabilityStatus; isCopasadan?: boolean }) {
  if (isCopasadan) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
        <span>✝️</span><span>복사단</span>
      </span>
    );
  }
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span>{cfg.emoji}</span><span>{cfg.label}</span>
    </span>
  );
}

function LoadingSpinner() {
  return <div className="w-5 h-5 border-2 border-[#EEEEEE] border-t-[#00ADB5] rounded-full animate-spin" />;
}

// ==================== Attendance Toggle ====================

interface AttendanceToggleProps {
  studentId: string;
  studentName: string;
  date: string;
  current: AttendanceStatus;
  reason?: string;
  onOptimisticUpdate: (studentId: string, status: AttendanceStatus) => void;
  onRollback: (studentId: string, prev: AttendanceStatus) => void;
  onToast: (msg: string, type: "error" | "success") => void;
}

function AttendanceToggle({
  studentId,
  studentName,
  date,
  current,
  reason,
  onOptimisticUpdate,
  onRollback,
  onToast,
}: AttendanceToggleProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 토글 순서: unknown → present → absent → unknown
  // absent_with_reason은 동일 사이클로 진입: absent_with_reason → present → absent → unknown
  const nextStatus = (s: AttendanceStatus): AttendanceStatus => {
    if (s === "unknown") return "present";
    if (s === "present") return "absent";
    // absent 또는 absent_with_reason → unknown (사유결석을 교사가 재확인하여 상태 초기화 가능)
    return "unknown";
  };

  const handleToggle = async () => {
    const prev = current;
    const next = nextStatus(current);

    onOptimisticUpdate(studentId, next);

    try {
      const res = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, studentName, date, status: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "저장 실패");
    } catch (err) {
      console.error("[AttendanceToggle] 저장 실패:", err);
      onRollback(studentId, prev);
      onToast("출석 저장에 실패했습니다. 다시 시도해주세요.", "error");
    }
  };

  const cfg = ATTENDANCE_CONFIG[current];
  const hasReason = current === "absent_with_reason" && reason;

  return (
    <div className="flex items-center gap-1.5">
      {/* 출석 토글 버튼 — 최소 44px (모바일 터치) */}
      <button
        onClick={handleToggle}
        title={`현재: ${cfg.label} (클릭해서 변경)`}
        className={`
          min-w-[44px] min-h-[44px] rounded-xl border font-bold text-sm
          flex items-center justify-center gap-1 px-2
          transition-all active:scale-95
          ${cfg.bg} ${cfg.text} ${cfg.border}
        `}
        aria-label={`${studentName} 출석 상태: ${cfg.label}`}
      >
        <span className="text-base leading-none">{cfg.icon}</span>
        <span className="text-xs hidden sm:inline">{cfg.label}</span>
      </button>

      {/* 사유 말풍선 아이콘 */}
      {hasReason && (
        <div className="relative">
          <button
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            onClick={() => setTooltipOpen((v) => !v)}
            className="w-7 h-7 rounded-full bg-orange-100 border border-orange-300
                       text-orange-600 text-xs flex items-center justify-center
                       hover:bg-orange-200 transition-colors"
            aria-label="결석 사유 보기"
          >
            💬
          </button>
          {tooltipOpen && (
            <div
              ref={tooltipRef}
              className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
                         bg-gray-900 text-white text-xs rounded-xl px-3 py-2
                         max-w-[200px] shadow-lg whitespace-pre-wrap"
            >
              <p className="font-semibold text-orange-300 mb-1">결석 사유</p>
              <p className="leading-relaxed">{reason}</p>
              {/* 아래 화살표 */}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4
                               border-transparent border-t-gray-900" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Attendance Summary Bar ====================

interface AttendanceSummaryBarProps {
  attendanceMap: Map<string, Attendance>;
  students: StudentInfo[];
  selectedDate: string;
  massDates: MassDateInfo[];
  onDateChange: (date: string) => void;
}

function AttendanceSummaryBar({
  attendanceMap,
  students,
  selectedDate,
  massDates,
  onDateChange,
}: AttendanceSummaryBarProps) {
  const counts = { present: 0, absent: 0, absent_with_reason: 0, unknown: 0 };
  students.forEach((s) => {
    const rec = attendanceMap.get(s.id);
    const status: AttendanceStatus = rec?.status ?? "unknown";
    counts[status]++;
  });

  return (
    <div className="bg-white border border-[#EEEEEE] rounded-2xl shadow-sm p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold text-[#222831] flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-[#00ADB5] inline-block" />
          당일 출석 현황
        </h2>
        <select
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="px-3 py-1.5 border border-[#EEEEEE] rounded-lg text-sm text-[#222831]
                     focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
        >
          {massDates.length === 0 ? (
            <option value={selectedDate}>{selectedDate}</option>
          ) : (
            massDates.map((md) => {
              const ds = dateToString(md.date);
              return (
                <option key={md.id} value={ds}>
                  {md.date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}
                </option>
              );
            })
          )}
        </select>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl p-3 text-center bg-emerald-50 border border-emerald-200">
          <p className="text-xl font-bold text-emerald-600">{counts.present}</p>
          <p className="text-xs text-emerald-700 mt-0.5">출석</p>
        </div>
        <div className="rounded-xl p-3 text-center bg-red-50 border border-red-200">
          <p className="text-xl font-bold text-red-500">{counts.absent}</p>
          <p className="text-xs text-red-600 mt-0.5">결석</p>
        </div>
        <div className="rounded-xl p-3 text-center bg-orange-50 border border-orange-200">
          <p className="text-xl font-bold text-orange-500">{counts.absent_with_reason}</p>
          <p className="text-xs text-orange-600 mt-0.5">사유결석</p>
        </div>
        <div className="rounded-xl p-3 text-center bg-gray-50 border border-gray-200">
          <p className="text-xl font-bold text-gray-400">{counts.unknown}</p>
          <p className="text-xs text-gray-500 mt-0.5">미확인</p>
        </div>
      </div>
    </div>
  );
}

// ==================== Toast ====================

interface ToastProps {
  message: string;
  type: "error" | "success";
  onDismiss: () => void;
}

function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl
                  shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2
                  ${type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}
    >
      <span>{type === "error" ? "⚠️" : "✓"}</span>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

// ==================== Main Page ====================

export default function TeacherResponsesPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [studentsData, setStudentsData] = useState<import("@/types").Student[]>([]);
  const [massDates, setMassDates] = useState<MassDateInfo[]>([]);
  const [availabilities, setAvailabilities] = useState<AvailabilityInfo[]>([]);
  const [summaries, setSummaries] = useState<StudentResponseSummary[]>([]);

  // 출석 상태
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  // Map<studentId, Attendance>
  const [attendanceMap, setAttendanceMap] = useState<Map<string, Attendance>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [filterStatus, setFilterStatus] = useState<"all" | "responded" | "not_responded">("all");
  const [sortBy, setSortBy] = useState<"name" | "responses" | "updated">("name");

  const [deadline, setDeadline] = useState<string>("");
  const [reminderStatuses, setReminderStatuses] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [drawerStudent, setDrawerStudent] = useState<DrawerStudent | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const [year, mon] = month.split("-").map(Number);

  // ── 마감일 로컬스토리지 ──
  useEffect(() => {
    const saved = localStorage.getItem(getDeadlineKey(month));
    setDeadline(saved ?? "");
  }, [month]);

  const handleDeadlineChange = (value: string) => {
    setDeadline(value);
    if (value) localStorage.setItem(getDeadlineKey(month), value);
    else localStorage.removeItem(getDeadlineKey(month));
  };

  const isDeadlinePassed = deadline ? new Date() > new Date(deadline + "T23:59:59") : false;

  // ── Firestore 실시간 출석 구독 (onSnapshot) ──
  useEffect(() => {
    if (!selectedDate) return;

    const q = query(
      collection(firestore, "attendance"),
      where("date", "==", selectedDate)
    );

    const unsub = onSnapshot(q, (snap) => {
      const newMap = new Map<string, Attendance>();
      snap.docs.forEach((d) => {
        const data = d.data();
        newMap.set(data.studentId as string, {
          id: d.id,
          studentId: data.studentId as string,
          studentName: data.studentName as string,
          date: data.date as string,
          status: data.status as AttendanceStatus,
          reason: data.reason as string | undefined,
          confirmedBy: data.confirmedBy as "auto" | "teacher",
          updatedAt: data.updatedAt?.toDate() ?? new Date(),
        });
      });
      setAttendanceMap(newMap);
    }, (err) => {
      console.error("[responses] attendance onSnapshot 오류:", err);
    });

    return () => unsub();
  }, [selectedDate]);

  // ── 학생/미사/가용성 데이터 로드 ──
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [studentsRaw, massDatesData, availData] = await Promise.all([
        getStudents(),
        getMassDates(),
        getAvailabilities(),
      ]);

      const studentList: StudentInfo[] = studentsRaw.map((s) => ({
        id: s.id,
        name: s.name,
        baptismalName: s.baptismalName ?? null,
        grade: s.grade ?? "",
        phone: s.phone ?? undefined,
      }));
      setStudents(studentList);
      setStudentsData(studentsRaw);

      const filtered = massDatesData.filter((m) => {
        const d = m.date;
        return d.getFullYear() === year && d.getMonth() === mon - 1;
      });
      const massDateList: MassDateInfo[] = filtered.map((m) => ({ id: m.id, date: m.date }));
      setMassDates(massDateList);

      // 당일 날짜가 이번 달 미사 날짜 중 하나면 유지, 아니면 첫 번째 날짜로
      const today = getTodayDate();
      const todayInMonth = massDateList.some((md) => dateToString(md.date) === today);
      if (!todayInMonth && massDateList.length > 0) {
        setSelectedDate(dateToString(massDateList[0].date));
      }

      const massDateIds = new Set(massDateList.map((m) => m.id));
      const filteredAvail: AvailabilityInfo[] = availData
        .filter((a) => massDateIds.has(a.massDateId))
        .map((a) => ({
          id: a.id,
          studentId: a.studentId,
          studentName: a.studentName ?? "",
          massDateId: a.massDateId,
          status: a.status,
          isCopasadan: a.isCopasadan ?? false,
          comment: a.comment ?? null,
          updatedAt: a.updatedAt,
        }));
      setAvailabilities(filteredAvail);

      const massDateIdToDate = new Map(massDateList.map((m) => [m.id, m.date]));

      const studentSummaries: StudentResponseSummary[] = studentList.map((student) => {
        const studentAvails = filteredAvail.filter((a) => a.studentId === student.id);
        const responses = studentAvails.map((a) => ({
          massDateId: a.massDateId,
          date: massDateIdToDate.get(a.massDateId) ?? new Date(),
          status: a.status,
          isCopasadan: a.isCopasadan,
        }));

        const comment = studentAvails.find((a) => a.comment)?.comment ?? null;
        const copasadanCount = responses.filter((r) => r.isCopasadan).length;
        const availableCount = responses.filter((r) => r.status === "available" && !r.isCopasadan).length;
        const uncertainCount = responses.filter((r) => r.status === "uncertain").length;
        const unavailableCount = responses.filter((r) => r.status === "unavailable" && !r.isCopasadan).length;
        const lastUpdated = studentAvails.length > 0
          ? new Date(Math.max(...studentAvails.map((a) => a.updatedAt.getTime())))
          : null;

        return {
          student, responses, comment, totalResponses: responses.length,
          availableCount, uncertainCount, unavailableCount, copasadanCount, lastUpdated,
        };
      });

      setSummaries(studentSummaries);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      setError("데이터를 불러오는 데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [month, year, mon]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── 출석 낙관적 업데이트 ──
  const handleOptimisticUpdate = useCallback((studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(studentId);
      next.set(studentId, {
        id: existing?.id ?? "",
        studentId,
        studentName: existing?.studentName ?? "",
        date: selectedDate,
        status,
        reason: existing?.reason,
        confirmedBy: "teacher",
        updatedAt: new Date(),
      });
      return next;
    });
  }, [selectedDate]);

  const handleRollback = useCallback((studentId: string, prev: AttendanceStatus) => {
    setAttendanceMap((map) => {
      const next = new Map(map);
      const existing = next.get(studentId);
      if (existing) next.set(studentId, { ...existing, status: prev });
      return next;
    });
  }, []);

  const showToast = useCallback((msg: string, type: "error" | "success") => {
    setToast({ msg, type });
  }, []);

  // ── 리마인더 ──
  const sendReminder = async (studentId: string, studentName: string, phone?: string) => {
    if (!phone) { alert(`${studentName} 학생의 전화번호가 등록되어 있지 않습니다.`); return; }
    setReminderStatuses((prev) => ({ ...prev, [studentId]: "sending" }));
    const deadlineText = deadline ? `응답 마감일은 ${deadline.replace(/-/g, "/")}입니다. ` : "";
    const text = `[어망] ${studentName}님, ${year}년 ${mon}월 미사 참석 여부 응답을 아직 하지 않으셨어요!\n${deadlineText}아래 링크에서 응답해 주세요 🙏\n${process.env.NEXT_PUBLIC_APP_URL ?? ""}/student`;
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, text, studentName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "전송 실패");
      setReminderStatuses((prev) => ({ ...prev, [studentId]: "sent" }));
    } catch {
      setReminderStatuses((prev) => ({ ...prev, [studentId]: "error" }));
    }
  };

  const sendAllReminders = async () => {
    const notResponded = summaries.filter((s) => s.totalResponses === 0);
    if (notResponded.length === 0) { alert("미응답 학생이 없습니다."); return; }

    const phoneMap = new Map(students.map((s) => [s.id, s.phone]));
    const withPhone = notResponded.filter((s) => phoneMap.get(s.student.id));
    const withoutPhone = notResponded.filter((s) => !phoneMap.get(s.student.id));

    if (withPhone.length === 0) { alert("미응답 학생들의 전화번호가 등록되어 있지 않습니다."); return; }

    const confirmed = window.confirm(
      `미응답 학생 ${notResponded.length}명 중 전화번호가 있는 ${withPhone.length}명에게 리마인더를 전송합니다.` +
      (withoutPhone.length > 0 ? `\n(전화번호 미등록 ${withoutPhone.length}명 제외)` : "")
    );
    if (!confirmed) return;

    setIsSendingAll(true);
    for (const s of withPhone) {
      await sendReminder(s.student.id, s.student.name, phoneMap.get(s.student.id));
    }
    setIsSendingAll(false);
  };

  // ── 필터/정렬 ──
  const filteredSummaries = summaries.filter((s) => {
    if (filterStatus === "responded") return s.totalResponses > 0;
    if (filterStatus === "not_responded") return s.totalResponses === 0;
    return true;
  });

  const sortedSummaries = [...filteredSummaries].sort((a, b) => {
    if (sortBy === "name") return a.student.name.localeCompare(b.student.name);
    if (sortBy === "responses") return b.totalResponses - a.totalResponses;
    if (sortBy === "updated") {
      return (b.lastUpdated?.getTime() ?? 0) - (a.lastUpdated?.getTime() ?? 0);
    }
    return 0;
  });

  const respondedCount = summaries.filter((s) => s.totalResponses > 0).length;
  const notRespondedCount = summaries.filter((s) => s.totalResponses === 0).length;
  const totalAvailable = summaries.reduce((acc, s) => acc + s.availableCount, 0);
  const totalUncertain = summaries.reduce((acc, s) => acc + s.uncertainCount, 0);
  const totalUnavailable = summaries.reduce((acc, s) => acc + s.unavailableCount, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-3 text-[#393E46] text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <header className="bg-[#222831] sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold text-[#00ADB5] hover:text-[#00c4cd] transition-colors">어망</Link>
            <span className="text-[#393E46]">|</span>
            <Link href="/teacher" className="text-[#EEEEEE]/70 hover:text-[#EEEEEE] text-sm transition-colors">교사 대시보드</Link>
            <span className="text-[#393E46]">|</span>
            <span className="text-[#EEEEEE] font-medium text-sm">학생 응답 현황</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* ── 당일 출석 현황 요약 바 ── */}
        <AttendanceSummaryBar
          attendanceMap={attendanceMap}
          students={students}
          selectedDate={selectedDate}
          massDates={massDates}
          onDateChange={setSelectedDate}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-[#EEEEEE] p-6">
          {/* ── Title + Month picker ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="w-1 h-6 rounded-full bg-[#00ADB5] inline-block" />
              <h1 className="text-xl font-bold text-[#222831]">{year}년 {mon}월 학생 응답 현황</h1>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-4 py-2 border border-[#EEEEEE] rounded-xl text-[#222831]
                           focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]
                           transition-colors text-sm"
              />
              <button
                onClick={loadData}
                className="px-4 py-2 bg-[#00ADB5] hover:bg-[#009aa1] text-white rounded-xl text-sm font-medium transition-colors"
              >
                새로고침
              </button>
            </div>
          </div>

          {/* ── Stats Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="rounded-xl p-4 text-center border border-[#EEEEEE] bg-[#EEEEEE]/30">
              <p className="text-2xl font-bold text-[#222831]">{students.length}</p>
              <p className="text-xs text-[#393E46] mt-0.5">전체 학생</p>
            </div>
            <div className="rounded-xl p-4 text-center border border-[#00ADB5]/30 bg-[#00ADB5]/10">
              <p className="text-2xl font-bold text-[#00ADB5]">{respondedCount}</p>
              <p className="text-xs text-[#393E46] mt-0.5">응답 완료</p>
            </div>
            <div className="rounded-xl p-4 text-center border border-red-200 bg-red-50">
              <p className="text-2xl font-bold text-red-500">{notRespondedCount}</p>
              <p className="text-xs text-[#393E46] mt-0.5">미응답</p>
            </div>
            <div className="rounded-xl p-4 text-center border border-emerald-200 bg-emerald-50">
              <p className="text-2xl font-bold text-emerald-600">{totalAvailable}</p>
              <p className="text-xs text-[#393E46] mt-0.5">가능 응답</p>
            </div>
            <div className="rounded-xl p-4 text-center border border-amber-200 bg-amber-50">
              <p className="text-2xl font-bold text-amber-600">{totalUncertain + totalUnavailable}</p>
              <p className="text-xs text-[#393E46] mt-0.5">애매/불가</p>
            </div>
          </div>

          {/* ── 응답 마감일 + 리마인더 ── */}
          <div className="bg-[#EEEEEE]/40 border border-[#EEEEEE] rounded-xl p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#222831]">응답 마감일</span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => handleDeadlineChange(e.target.value)}
                  className="px-3 py-1.5 border border-[#EEEEEE] rounded-lg text-sm text-[#222831]
                             bg-white focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
                />
                {deadline && (
                  <button onClick={() => handleDeadlineChange("")} className="text-[#393E46] hover:text-red-500 text-xs transition-colors">
                    ✕ 초기화
                  </button>
                )}
              </div>
              {deadline && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isDeadlinePassed ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                  {isDeadlinePassed ? "⚠️ 마감 지남" : "✅ 마감 전"}
                </span>
              )}
              {notRespondedCount > 0 && (
                <button
                  onClick={sendAllReminders}
                  disabled={isSendingAll}
                  className="ml-auto px-4 py-2 bg-[#393E46] hover:bg-[#222831]
                             disabled:opacity-40 text-white rounded-xl text-sm
                             font-medium transition-colors flex items-center gap-2"
                >
                  {isSendingAll ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>전송 중...</>
                  ) : <>📨 미응답 {notRespondedCount}명에게 리마인더 전송</>}
                </button>
              )}
            </div>
          </div>

          {/* ── Filter / Sort / View ── */}
          <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-[#EEEEEE]">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#393E46]">필터:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="px-3 py-1.5 border border-[#EEEEEE] rounded-lg text-sm text-[#222831]
                           focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
              >
                <option value="all">전체</option>
                <option value="responded">응답 완료</option>
                <option value="not_responded">미응답</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#393E46]">정렬:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 border border-[#EEEEEE] rounded-lg text-sm text-[#222831]
                           focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
              >
                <option value="name">이름순</option>
                <option value="responses">응답 수</option>
                <option value="updated">최근 업데이트</option>
              </select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-[#393E46]">보기:</span>
              {(["table", "cards"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === mode ? "bg-[#00ADB5] text-white" : "bg-[#EEEEEE] text-[#393E46] hover:bg-[#e0e0e0]"
                  }`}
                >
                  {mode === "table" ? "테이블" : "카드"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Content ── */}
          {massDates.length === 0 ? (
            <div className="text-center py-12 text-[#393E46]">
              <p className="text-lg mb-2">📅</p>
              <p>{mon}월에 등록된 미사 일정이 없습니다.</p>
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto rounded-xl border border-[#EEEEEE]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#EEEEEE]">
                    <th className="px-4 py-3 text-left font-semibold text-[#393E46] sticky left-0 bg-[#EEEEEE] z-10">학생</th>
                    {massDates.map((md) => (
                      <th key={md.id} className="px-3 py-3 text-center font-semibold text-[#393E46] whitespace-nowrap">
                        {formatDate(md.date)}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left font-semibold text-[#393E46]">코멘트</th>
                    <th className="px-4 py-3 text-center font-semibold text-[#393E46]">최근 업데이트</th>
                    {/* 출석 토글 컬럼 — 선택된 날짜 기준 */}
                    <th className="px-4 py-3 text-center font-semibold text-[#393E46] whitespace-nowrap min-w-[100px]">
                      출석 ({selectedDate.slice(5)})
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-[#393E46]">리마인더</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEEEE]">
                  {sortedSummaries.map((summary) => {
                    const attendanceRec = attendanceMap.get(summary.student.id);
                    const attendanceStatus: AttendanceStatus = attendanceRec?.status ?? "unknown";

                    return (
                      <tr key={summary.student.id} className="hover:bg-[#EEEEEE]/30 transition-colors">
                        <td className="px-4 py-3 sticky left-0 bg-white z-10">
                          <button
                            onClick={() => {
                              const full = studentsData.find((st) => st.id === summary.student.id);
                              setDrawerStudent({
                                id: summary.student.id,
                                name: summary.student.name,
                                baptismalName: summary.student.baptismalName,
                                grade: summary.student.grade,
                                isNewMember: full?.isNewMember ?? false,
                              });
                            }}
                            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity w-full"
                          >
                            <div className="w-8 h-8 bg-[#00ADB5]/15 rounded-full flex items-center justify-center
                                            text-[#00ADB5] font-bold text-xs border border-[#00ADB5]/20 flex-shrink-0">
                              {summary.student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-[#222831] hover:text-[#00ADB5] transition-colors underline-offset-2 hover:underline">
                                {summary.student.name}
                              </p>
                              <p className="text-xs text-[#393E46]/60">
                                {summary.student.grade}
                                {summary.student.baptismalName && ` · ${summary.student.baptismalName}`}
                              </p>
                            </div>
                          </button>
                        </td>
                        {massDates.map((md) => {
                          const response = summary.responses.find((r) => r.massDateId === md.id);
                          return (
                            <td key={md.id} className="px-3 py-3 text-center">
                              {response ? (
                                <StatusBadge status={response.status} isCopasadan={response.isCopasadan} />
                              ) : (
                                <span className="text-[#EEEEEE]">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3">
                          {summary.comment ? (
                            <p className="text-xs text-[#393E46] max-w-[200px] truncate" title={summary.comment}>
                              {summary.comment}
                            </p>
                          ) : <span className="text-[#EEEEEE]">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {summary.lastUpdated ? (
                            <span className="text-xs text-[#393E46]">{formatDateTime(summary.lastUpdated)}</span>
                          ) : <span className="text-[#EEEEEE]">-</span>}
                        </td>
                        {/* 출석 토글 */}
                        <td className="px-4 py-3 text-center">
                          <AttendanceToggle
                            studentId={summary.student.id}
                            studentName={summary.student.name}
                            date={selectedDate}
                            current={attendanceStatus}
                            reason={attendanceRec?.reason}
                            onOptimisticUpdate={handleOptimisticUpdate}
                            onRollback={handleRollback}
                            onToast={showToast}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {summary.totalResponses === 0 ? (() => {
                            const phone = students.find((s) => s.id === summary.student.id)?.phone;
                            const status = reminderStatuses[summary.student.id] ?? "idle";
                            return (
                              <button
                                onClick={() => sendReminder(summary.student.id, summary.student.name, phone)}
                                disabled={status === "sending" || status === "sent"}
                                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                                  status === "sent" ? "bg-emerald-100 text-emerald-700 cursor-default" :
                                  status === "error" ? "bg-red-100 text-red-600 hover:bg-red-200" :
                                  "bg-[#393E46] text-white hover:bg-[#222831] disabled:opacity-50"
                                }`}
                              >
                                {status === "sending" ? "..." : status === "sent" ? "✓" : status === "error" ? "재전송" : phone ? "📨" : "📵"}
                              </button>
                            );
                          })() : <span className="text-[#EEEEEE]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── 카드 뷰 ── */
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedSummaries.map((summary) => {
                const attendanceRec = attendanceMap.get(summary.student.id);
                const attendanceStatus: AttendanceStatus = attendanceRec?.status ?? "unknown";
                const attCfg = ATTENDANCE_CONFIG[attendanceStatus];

                return (
                  <div
                    key={summary.student.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      summary.totalResponses > 0 ? "bg-white border-[#EEEEEE]" : "bg-red-50/40 border-red-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <button
                        onClick={() => {
                          const full = studentsData.find((st) => st.id === summary.student.id);
                          setDrawerStudent({
                            id: summary.student.id,
                            name: summary.student.name,
                            baptismalName: summary.student.baptismalName,
                            grade: summary.student.grade,
                            isNewMember: full?.isNewMember ?? false,
                          });
                        }}
                        className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="w-10 h-10 bg-[#00ADB5]/15 rounded-full flex items-center justify-center
                                        text-[#00ADB5] font-bold border border-[#00ADB5]/20 flex-shrink-0">
                          {summary.student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#222831] hover:text-[#00ADB5] transition-colors hover:underline underline-offset-2">
                            {summary.student.name}
                          </p>
                          <p className="text-xs text-[#393E46]/60">
                            {summary.student.grade}
                            {summary.student.baptismalName && ` · ${summary.student.baptismalName}`}
                          </p>
                        </div>
                      </button>

                      {/* 카드 우상단 출석 토글 */}
                      <AttendanceToggle
                        studentId={summary.student.id}
                        studentName={summary.student.name}
                        date={selectedDate}
                        current={attendanceStatus}
                        reason={attendanceRec?.reason}
                        onOptimisticUpdate={handleOptimisticUpdate}
                        onRollback={handleRollback}
                        onToast={showToast}
                      />
                    </div>

                    {/* 출석 상태 레이블 */}
                    <div className={`text-xs font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1 mb-3 ${attCfg.bg} ${attCfg.text} border ${attCfg.border}`}>
                      <span>{attCfg.icon}</span>
                      <span>{selectedDate.slice(5)} {attCfg.label}</span>
                    </div>

                    {summary.totalResponses > 0 ? (
                      <>
                        <div className="flex gap-2 mb-3">
                          <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-emerald-600">{summary.availableCount}</p>
                            <p className="text-xs text-[#393E46]">가능</p>
                          </div>
                          <div className="flex-1 bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-600">{summary.uncertainCount}</p>
                            <p className="text-xs text-[#393E46]">애매</p>
                          </div>
                          <div className="flex-1 bg-red-50 border border-red-100 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-red-500">{summary.unavailableCount}</p>
                            <p className="text-xs text-[#393E46]">불가</p>
                          </div>
                          {summary.copasadanCount > 0 && (
                            <div className="flex-1 bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
                              <p className="text-lg font-bold text-purple-600">{summary.copasadanCount}</p>
                              <p className="text-xs text-[#393E46]">복사단</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {massDates.map((md) => {
                            const response = summary.responses.find((r) => r.massDateId === md.id);
                            if (!response) return null;
                            const cfg = STATUS_CONFIG[response.status];
                            return (
                              <div
                                key={md.id}
                                className={`px-2 py-1 rounded text-xs border ${
                                  response.isCopasadan
                                    ? "bg-purple-100 text-purple-700 border-purple-200"
                                    : `${cfg.bg} ${cfg.text} ${cfg.border}`
                                }`}
                              >
                                {md.date.getDate()}일 {response.isCopasadan ? "✝️" : cfg.emoji}
                              </div>
                            );
                          })}
                        </div>

                        {summary.comment && (
                          <div className="bg-[#EEEEEE]/40 rounded-lg p-2 mb-2 border border-[#EEEEEE]">
                            <p className="text-xs text-[#393E46]">&quot;{summary.comment}&quot;</p>
                          </div>
                        )}
                        <p className="text-xs text-[#393E46]/50 text-right">
                          {summary.lastUpdated && formatDateTime(summary.lastUpdated)}
                        </p>
                      </>
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-sm text-[#393E46] mb-3">아직 응답하지 않았습니다.</p>
                        {(() => {
                          const phone = students.find((s) => s.id === summary.student.id)?.phone;
                          const status = reminderStatuses[summary.student.id] ?? "idle";
                          return (
                            <button
                              onClick={() => sendReminder(summary.student.id, summary.student.name, phone)}
                              disabled={status === "sending" || status === "sent"}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                status === "sent" ? "bg-emerald-100 text-emerald-700 cursor-default" :
                                status === "error" ? "bg-red-100 text-red-600 hover:bg-red-200" :
                                "bg-[#393E46] hover:bg-[#222831] text-white"
                              }`}
                            >
                              {status === "sending" ? "전송 중..." : status === "sent" ? "✓ 전송 완료" :
                               status === "error" ? "재전송" : phone ? "📨 리마인더 전송" : "📵 번호 없음"}
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-center py-4">
          <p className="text-xs text-[#EEEEEE]/50">어망 (Fish-Net) · 병점 성당 중고등부 주일학교</p>
        </div>
      </main>

      {/* ── 학생 상세 Drawer ── */}
      <StudentDrawer
        student={drawerStudent}
        month={month}
        massDatesCount={massDates.length}
        onClose={() => setDrawerStudent(null)}
      />

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
