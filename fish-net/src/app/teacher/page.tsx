"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type {
  Student,
  MassDate,
  StudentAvailability,
  MonthlyAssignment,
  MonthlyScheduleResult,
  RoleType,
} from "@/types";
import { ROLES } from "@/types";
import {
  getStudents,
  getMassDates,
  getAvailabilities,
  createMassDate,
  saveAssignments,
  getAssignmentsByMonth,
} from "@/lib/firestore";

// ==================== Types ====================

interface AssignmentEdit {
  date: string;
  role: string;
  primary: string;
  backup1: string;
  backup2: string;
}

interface MessageCard {
  studentName: string;
  role: string;
  date: string;
  message: string;
}

// ==================== Helpers ====================

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthDisplay(month: string): string {
  const [year, mon] = month.split("-");
  return `${year}년 ${parseInt(mon)}월`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const ROLE_NAMES: Record<string, string> = {
  reading1: "1독서",
  reading2: "2독서",
  commentary: "해설",
  accompaniment: "반주",
  prayer1: "우리의기도1",
  prayer2: "우리의기도2",
  prayer: "우리의기도",
  "1독서": "1독서",
  "2독서": "2독서",
  해설: "해설",
  반주: "반주",
  우리의기도: "우리의기도",
  우리의기도1: "우리의기도1",
  우리의기도2: "우리의기도2",
};

function getRoleName(role: string): string {
  return ROLE_NAMES[role] ?? role;
}

// ==================== Sub-components ====================

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className={`${sizeClass} border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin`} />
  );
}

function WarningBox({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
      <p className="text-sm font-medium text-amber-700 mb-2">경고</p>
      <ul className="text-sm text-amber-600 space-y-1">
        {warnings.map((w, i) => (
          <li key={i}>• {w}</li>
        ))}
      </ul>
    </div>
  );
}

// ==================== Main Component ====================

export default function TeacherDashboard() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [students, setStudents] = useState<Student[]>([]);
  const [massDates, setMassDates] = useState<MassDate[]>([]);
  const [availabilities, setAvailabilities] = useState<StudentAvailability[]>([]);

  const [assignments, setAssignments] = useState<MonthlyAssignment[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editableAssignments, setEditableAssignments] = useState<AssignmentEdit[]>([]);

  const [messages, setMessages] = useState<MessageCard[]>([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [absentStudent, setAbsentStudent] = useState("");
  const [backupCandidates, setBackupCandidates] = useState<
    { name: string; role: string; type: string }[]
  >([]);
  const [substituteMessage, setSubstituteMessage] = useState("");

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Data Loading ──
  const loadData = useCallback(async () => {
    try {
      setIsLoadingData(true);
      setError(null);

      const [studentsData, massDatesData, availData] = await Promise.all([
        getStudents(),
        getMassDates(),
        getAvailabilities(),
      ]);

      setStudents(studentsData);

      const [year, mon] = month.split("-").map(Number);
      const filtered = massDatesData.filter((m) => {
        const d = m.date;
        return d.getFullYear() === year && d.getMonth() === mon - 1;
      });
      setMassDates(filtered);

      const massDateIds = new Set(filtered.map((m) => m.id));
      const filteredAvail = availData.filter((a) => massDateIds.has(a.massDateId));
      setAvailabilities(filteredAvail);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      setError("데이터를 불러오는 데 실패했습니다.");
    } finally {
      setIsLoadingData(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Section 1: 배정 관리 ──

  const studentResponseLink = `${typeof window !== "undefined" ? window.location.origin : ""}/student/response?month=${month}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(studentResponseLink);
    alert("링크가 클립보드에 복사되었습니다!");
  };

  const handleGenerateAssignments = async () => {
    if (massDates.length === 0) {
      alert("해당 월에 등록된 미사 일정이 없습니다.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAssignments([]);
    setWarnings([]);

    try {
      const res = await fetch("/api/assignment/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "배정 생성 실패");
      }

      const result = data.data as MonthlyScheduleResult;
      setAssignments(result.assignments);
      setWarnings(result.warnings);

      setEditableAssignments(
        result.assignments.map((a) => ({
          date: a.date,
          role: a.role,
          primary: a.primary,
          backup1: a.backup1,
          backup2: a.backup2,
        }))
      );
    } catch (err) {
      console.error("배정 생성 오류:", err);
      setError(err instanceof Error ? err.message : "배정 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadSavedAssignments = async () => {
    setIsLoadingAssignments(true);
    setError(null);

    try {
      const savedData = await getAssignmentsByMonth(month);

      if (savedData.length === 0) {
        alert("해당 월에 저장된 배정이 없습니다.");
        return;
      }

      const studentIdToName = new Map(students.map((s) => [s.id, s.name]));

      const loadedAssignments: MonthlyAssignment[] = [];

      for (const { date, assignments: assigns } of savedData) {
        const dateStr = date.toISOString().slice(0, 10);
        
        const roleGroups = new Map<string, {
          primary?: string;
          backup1?: string;
          backup2?: string;
        }>();

        for (const a of assigns) {
          const roleName = getRoleName(a.role);
          if (!roleGroups.has(roleName)) {
            roleGroups.set(roleName, {});
          }
          const group = roleGroups.get(roleName)!;
          const studentName = studentIdToName.get(a.studentId) || "";

          if (a.isPrimary) {
            group.primary = studentName;
          } else if (a.backupOrder === 1) {
            group.backup1 = studentName;
          } else if (a.backupOrder === 2) {
            group.backup2 = studentName;
          }
        }

        for (const [role, group] of roleGroups) {
          loadedAssignments.push({
            date: dateStr,
            role,
            primary: group.primary || "",
            backup1: group.backup1 || "",
            backup2: group.backup2 || "",
          });
        }
      }

      loadedAssignments.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.role.localeCompare(b.role);
      });

      setAssignments(loadedAssignments);
      setWarnings([]);
      setEditableAssignments(
        loadedAssignments.map((a) => ({
          date: a.date,
          role: a.role,
          primary: a.primary,
          backup1: a.backup1,
          backup2: a.backup2,
        }))
      );

      alert(`${loadedAssignments.length}건의 배정을 불러왔습니다.`);
    } catch (err) {
      console.error("배정 불러오기 오류:", err);
      setError(err instanceof Error ? err.message : "배정 불러오기 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  // ── Section 2: 카카오톡 메시지 생성 ──

  const handleGenerateMessages = async () => {
    if (assignments.length === 0) {
      alert("배정 결과가 없습니다. 먼저 AI 배정을 실행해주세요.");
      return;
    }

    setIsGeneratingMessages(true);
    const generated: MessageCard[] = [];

    for (const a of assignments) {
      if (a.primary) {
        generated.push({
          studentName: a.primary,
          role: getRoleName(a.role),
          date: a.date,
          message: `[어망 미사 배정 안내]\n\n안녕하세요, ${a.primary}님!\n${formatDateShort(a.date)} 주일 미사에서 "${getRoleName(a.role)}" 역할을 맡게 되었습니다.\n\n백업 1순위: ${a.backup1 || "-"}\n백업 2순위: ${a.backup2 || "-"}\n\n참석이 어려우시면 미리 알려주세요!`,
        });
      }
    }

    setMessages(generated);
    setIsGeneratingMessages(false);
  };

  const copyMessage = async (msg: string) => {
    await navigator.clipboard.writeText(msg);
    alert("메시지가 클립보드에 복사되었습니다!");
  };

  // ── Section 3: 당일 대응 ──

  const assignedStudentsForDate = assignments
    .filter((a) => a.date === selectedDate)
    .map((a) => ({ name: a.primary, role: a.role }));

  const handleFindBackup = () => {
    if (!selectedDate || !absentStudent) {
      alert("날짜와 불참 학생을 선택해주세요.");
      return;
    }

    const absent = assignments.find(
      (a) => a.date === selectedDate && a.primary === absentStudent
    );

    if (!absent) {
      setBackupCandidates([]);
      setSubstituteMessage("");
      return;
    }

    const candidates: { name: string; role: string; type: string }[] = [];
    if (absent.backup1) {
      candidates.push({ name: absent.backup1, role: absent.role, type: "1순위 백업" });
    }
    if (absent.backup2) {
      candidates.push({ name: absent.backup2, role: absent.role, type: "2순위 백업" });
    }

    setBackupCandidates(candidates);

    if (candidates.length > 0) {
      const first = candidates[0];
      setSubstituteMessage(
        `[긴급 대타 요청]\n\n안녕하세요, ${first.name}님!\n${formatDateShort(selectedDate)} 주일 미사 "${getRoleName(absent.role)}" 역할의 정배정 학생(${absentStudent})이 불참하게 되어 대타를 요청드립니다.\n\n가능 여부를 알려주세요!`
      );
    }
  };

  // ── Section 4: 수동 수정 ──

  const handleEditChange = (
    index: number,
    field: "primary" | "backup1" | "backup2",
    value: string
  ) => {
    setEditableAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  };

  const handleSaveAssignments = async () => {
    if (editableAssignments.length === 0) {
      alert("저장할 배정이 없습니다.");
      return;
    }

    setIsSaving(true);

    try {
      const dateToMassDateId = new Map(
        massDates.map((m) => [m.date.toISOString().slice(0, 10), m.id])
      );

      const grouped = new Map<string, AssignmentEdit[]>();
      for (const a of editableAssignments) {
        const mdId = dateToMassDateId.get(a.date);
        if (mdId) {
          if (!grouped.has(mdId)) grouped.set(mdId, []);
          grouped.get(mdId)!.push(a);
        }
      }

      const studentNameToId = new Map(students.map((s) => [s.name, s.id]));

      for (const [massDateId, assigns] of grouped) {
        const toSave: {
          studentId: string;
          role: RoleType;
          isPrimary: boolean;
          backupOrder?: number;
        }[] = [];

        for (const a of assigns) {
          const roleId = Object.entries(ROLE_NAMES).find(
            ([, v]) => v === a.role
          )?.[0] as RoleType | undefined;

          if (!roleId) continue;

          if (a.primary) {
            const sid = studentNameToId.get(a.primary);
            if (sid) toSave.push({ studentId: sid, role: roleId, isPrimary: true });
          }
          if (a.backup1) {
            const sid = studentNameToId.get(a.backup1);
            if (sid)
              toSave.push({ studentId: sid, role: roleId, isPrimary: false, backupOrder: 1 });
          }
          if (a.backup2) {
            const sid = studentNameToId.get(a.backup2);
            if (sid)
              toSave.push({ studentId: sid, role: roleId, isPrimary: false, backupOrder: 2 });
          }
        }

        await saveAssignments(massDateId, toSave);
      }

      alert("배정이 저장되었습니다!");
    } catch (err) {
      console.error("저장 실패:", err);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading guard ──
  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-3 text-gray-500 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ── Main Render ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              어망
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 font-medium">교사 대시보드</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">학생 {students.length}명</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-400">
              {month} 응답 {availabilities.length}건
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            섹션 1: 배정 관리
        ══════════════════════════════════════════════════════════ */}
        <SectionCard title="1. 배정 관리">
          {/* 월 선택 + 링크 + AI 버튼 */}
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                월 선택
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                           transition-colors"
              />
            </div>

            <button
              onClick={copyLink}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl
                         text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              학생 응답 링크 복사
            </button>

            <button
              onClick={handleGenerateAssignments}
              disabled={isGenerating}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                         text-white rounded-xl text-sm font-medium transition-colors
                         flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <LoadingSpinner size="sm" />
                  생성 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  AI 배정 실행
                </>
              )}
            </button>

            <button
              onClick={handleLoadSavedAssignments}
              disabled={isLoadingAssignments}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300
                         text-white rounded-xl text-sm font-medium transition-colors
                         flex items-center gap-2"
            >
              {isLoadingAssignments ? (
                <>
                  <LoadingSpinner size="sm" />
                  불러오는 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  저장된 배정 불러오기
                </>
              )}
            </button>
          </div>

          {/* 미사 일정 현황 */}
          <div className="mb-4 text-sm text-gray-500">
            {formatMonthDisplay(month)} 미사 일정: {massDates.length}건 |{" "}
            학생 응답: {availabilities.length}건
          </div>

          {/* 배정 결과 테이블 */}
          {assignments.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600 rounded-tl-xl">
                        날짜
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">역할</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">담당</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">백업1</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 rounded-tr-xl">
                        백업2
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assignments.map((a, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {formatDateShort(a.date)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{getRoleName(a.role)}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {a.primary || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{a.backup1 || "-"}</td>
                        <td className="px-4 py-3 text-gray-500">{a.backup2 || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <WarningBox warnings={warnings} />
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>배정 결과가 없습니다.</p>
              <p className="text-sm mt-1">위에서 월을 선택하고 AI 배정을 실행해주세요.</p>
            </div>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════
            섹션 2: 카카오톡 메시지 생성
        ══════════════════════════════════════════════════════════ */}
        <SectionCard title="2. 카카오톡 메시지 생성">
          <button
            onClick={handleGenerateMessages}
            disabled={isGeneratingMessages || assignments.length === 0}
            className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-200
                       text-gray-900 rounded-xl text-sm font-medium transition-colors
                       flex items-center gap-2 mb-6"
          >
            {isGeneratingMessages ? (
              <>
                <LoadingSpinner size="sm" />
                생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                학생별 메시지 생성
              </>
            )}
          </button>

          {messages.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">{m.studentName}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {m.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{formatDateShort(m.date)}</p>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-100 mb-3">
                    {m.message}
                  </pre>
                  <button
                    onClick={() => copyMessage(m.message)}
                    className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700
                               rounded-lg text-xs font-medium transition-colors"
                  >
                    복사
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              배정 결과 기반으로 메시지를 생성합니다.
            </p>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════
            섹션 3: 당일 대응
        ══════════════════════════════════════════════════════════ */}
        <SectionCard title="3. 당일 대응 (불참/대타)">
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                날짜 선택
              </label>
              <select
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setAbsentStudent("");
                  setBackupCandidates([]);
                  setSubstituteMessage("");
                }}
                className="px-4 py-2 border border-gray-200 rounded-xl min-w-[140px]
                           focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">선택</option>
                {[...new Set(assignments.map((a) => a.date))].map((d) => (
                  <option key={d} value={d}>
                    {formatDateShort(d)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                불참 학생
              </label>
              <select
                value={absentStudent}
                onChange={(e) => setAbsentStudent(e.target.value)}
                disabled={!selectedDate}
                className="px-4 py-2 border border-gray-200 rounded-xl min-w-[140px]
                           focus:outline-none focus:ring-2 focus:ring-blue-200
                           disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">선택</option>
                {assignedStudentsForDate.map((s, i) => (
                  <option key={i} value={s.name}>
                    {s.name} ({getRoleName(s.role)})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleFindBackup}
              disabled={!selectedDate || !absentStudent}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200
                         text-white rounded-xl text-sm font-medium transition-colors"
            >
              대타 후보 조회
            </button>
          </div>

          {backupCandidates.length > 0 && (
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mb-4">
              <p className="text-sm font-medium text-orange-700 mb-2">대타 후보</p>
              <ul className="space-y-1">
                {backupCandidates.map((c, i) => (
                  <li key={i} className="text-sm text-orange-600">
                    • {c.name} ({c.type})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {substituteMessage && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-2">대타 요청 메시지 초안</p>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-100 mb-3">
                {substituteMessage}
              </pre>
              <button
                onClick={() => copyMessage(substituteMessage)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700
                           rounded-lg text-xs font-medium transition-colors"
              >
                복사
              </button>
            </div>
          )}

          {!selectedDate && (
            <p className="text-gray-400 text-sm">날짜를 선택하면 배정된 학생 목록이 표시됩니다.</p>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════
            섹션 4: 배정표 수동 수정
        ══════════════════════════════════════════════════════════ */}
        <SectionCard title="4. 배정표 수동 수정">
          {editableAssignments.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">날짜</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">역할</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">담당</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">백업1</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">백업2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {editableAssignments.map((a, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-gray-800">{formatDateShort(a.date)}</td>
                        <td className="px-4 py-2 text-gray-700">{getRoleName(a.role)}</td>
                        <td className="px-2 py-2">
                          <select
                            value={a.primary}
                            onChange={(e) => handleEditChange(i, "primary", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="">-</option>
                            {students.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={a.backup1}
                            onChange={(e) => handleEditChange(i, "backup1", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="">-</option>
                            {students.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={a.backup2}
                            onChange={(e) => handleEditChange(i, "backup2", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="">-</option>
                            {students.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleSaveAssignments}
                disabled={isSaving}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300
                           text-white rounded-xl text-sm font-medium transition-colors
                           flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    변경 사항 저장
                  </>
                )}
              </button>
            </>
          ) : (
            <p className="text-gray-400 text-sm">
              AI 배정을 실행하면 수동으로 수정할 수 있습니다.
            </p>
          )}
        </SectionCard>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-300">
            어망 (Fish-Net) · 병점 성당 중고등부 주일학교
          </p>
        </div>
      </main>
    </div>
  );
}
