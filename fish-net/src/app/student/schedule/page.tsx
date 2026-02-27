"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GuideChatbot from "@/components/GuideChatbot";
import { getStudents } from "@/lib/firestore";
import type { StudentAssignmentRecord } from "@/app/api/assignment/student/route";

// ==================== Types ====================

interface StudentInfo {
  id: string;
  name: string;
  baptismalName: string | null;
  grade: string;
}

// ==================== Helpers ====================

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function formatMonthDisplay(month: string): string {
  const [year, mon] = month.split("-");
  return `${year}년 ${parseInt(mon)}월`;
}

// ==================== Role Config ====================

const ROLE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  "1독서":      { color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   icon: "📖" },
  "2독서":      { color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", icon: "📗" },
  "반주":       { color: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200",   icon: "🎹" },
  "보편지향기도1": { color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  icon: "🙏" },
  "보편지향기도2": { color: "text-teal-700",   bg: "bg-teal-50",   border: "border-teal-200",   icon: "🙏" },
  "보편지향기도":  { color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  icon: "🙏" },
};

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200", icon: "📋" };
}

// ==================== Sub-components ====================

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F0F9FF" }}>
      <div className="text-center">
        <div className="relative mx-auto mb-4 h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#0077B6] animate-spin" />
        </div>
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    </div>
  );
}

function AssignmentCard({ 
  record, 
  onEmergencyReport 
}: { 
  record: StudentAssignmentRecord;
  onEmergencyReport?: (record: StudentAssignmentRecord) => void;
}) {
  const cfg = getRoleConfig(record.role);
  const isBackup = !record.isPrimary;
  const isAbsent = record.status === "absent";
  const backupLabel = record.backupOrder === 1 ? "1순위 백업" : record.backupOrder === 2 ? "2순위 백업" : "백업";

  // 불참 신고된 카드는 회색으로 표시
  if (isAbsent) {
    return (
      <div className="rounded-2xl border-2 p-4 bg-gray-100 border-gray-200 opacity-60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-gray-200 border border-gray-300">
              ❌
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-gray-400 line-through">{record.role}</span>
                <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                  불참 신고 완료
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{formatDateFull(record.date)}</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400 bg-white/60 rounded-xl px-3 py-2">
          담당 선생님이 대타를 찾고 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 p-4 ${cfg.bg} ${cfg.border} ${isBackup ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
            {cfg.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-base font-bold ${cfg.color}`}>{record.role}</span>
              {isBackup ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: "#F0F9FF", color: "#0077B6" }}>
                  {backupLabel}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: "#FFF8E1", color: "#B45309" }}>
                  ✦ 정배정
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{formatDateFull(record.date)}</p>
          </div>
        </div>
      </div>

      {isBackup && (
        <p className="mt-3 text-xs text-gray-500 bg-white/60 rounded-xl px-3 py-2">
          정배정 학생이 불참할 경우 연락을 드릴 수 있어요.
        </p>
      )}

      {!isBackup && onEmergencyReport && (
        <button
          onClick={() => onEmergencyReport(record)}
          className="mt-3 w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600
                     text-xs font-medium px-3 py-2 rounded-xl transition-colors"
        >
          🚨 긴급 불참 신고
        </button>
      )}
    </div>
  );
}

// ==================== Main Page (Inner) ====================

function SchedulePageInner() {
  const searchParams = useSearchParams();
  const rawMonth = searchParams.get("month");
  const month = rawMonth ?? getCurrentMonth();

  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");

  const [assignments, setAssignments] = useState<StudentAssignmentRecord[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(month);

  const [emergencyModal, setEmergencyModal] = useState<{
    isOpen: boolean;
    record: StudentAssignmentRecord | null;
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    record: null,
    reason: "",
    isSubmitting: false,
  });

  const [year, mon] = currentMonth.split("-").map(Number);

  // 학생 목록 로드
  useEffect(() => {
    async function loadStudents() {
      try {
        const data = await getStudents();
        setStudents(
          data.map((s) => ({
            id: s.id,
            name: s.name,
            baptismalName: s.baptismalName ?? null,
            grade: s.grade ?? "",
          }))
        );
      } catch (err) {
        console.error("학생 목록 로드 실패:", err);
        setError("학생 목록을 불러오는 데 실패했습니다.");
      } finally {
        setIsLoadingStudents(false);
      }
    }
    loadStudents();
  }, []);

  // 배정 조회
  const loadAssignments = useCallback(async (studentId: string, monthStr: string) => {
    if (!studentId) return;
    try {
      setIsLoadingAssignments(true);
      setError(null);
      const res = await fetch(
        `/api/assignment/student?studentId=${encodeURIComponent(studentId)}&month=${monthStr}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "배정 조회 실패");
      }
      setAssignments(data.assignments);
    } catch (err) {
      console.error("배정 조회 실패:", err);
      setError(err instanceof Error ? err.message : "배정 정보를 불러오는 데 실패했습니다.");
      setAssignments([]);
    } finally {
      setIsLoadingAssignments(false);
    }
  }, []);

  const handleStudentSelect = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    setSelectedStudentId(studentId);
    setSelectedStudentName(student?.name ?? "");
    setAssignments([]);
    if (studentId) loadAssignments(studentId, currentMonth);
  };

  const handleMonthChange = (newMonth: string) => {
    setCurrentMonth(newMonth);
    setAssignments([]);
    if (selectedStudentId) loadAssignments(selectedStudentId, newMonth);
  };

  const handleOpenEmergencyModal = (record: StudentAssignmentRecord) => {
    setEmergencyModal({
      isOpen: true,
      record,
      reason: "",
      isSubmitting: false,
    });
  };

  const handleCloseEmergencyModal = () => {
    setEmergencyModal({
      isOpen: false,
      record: null,
      reason: "",
      isSubmitting: false,
    });
  };

  const handleSubmitEmergency = async () => {
    if (!emergencyModal.record || !emergencyModal.reason.trim()) {
      alert("불참 사유를 입력해주세요.");
      return;
    }

    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return;

    setEmergencyModal((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const res = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          studentName: student.name,
          baptismalName: student.baptismalName,
          massDateId: emergencyModal.record.massDateId,
          date: emergencyModal.record.date,
          role: emergencyModal.record.role,
          reason: emergencyModal.reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "긴급 불참 신고 실패");
      }

      alert("긴급 불참 신고가 완료되었습니다.\n교사에게 알림이 전송되었습니다.");
      handleCloseEmergencyModal();
      
      if (selectedStudentId) {
        loadAssignments(selectedStudentId, currentMonth);
      }
    } catch (err) {
      console.error("긴급 불참 신고 오류:", err);
      alert(err instanceof Error ? err.message : "긴급 불참 신고 중 오류가 발생했습니다.");
    } finally {
      setEmergencyModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // 정배정 / 백업 분리
  const primaryAssignments = assignments.filter((a) => a.isPrimary);
  const backupAssignments = assignments.filter((a) => !a.isPrimary);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  if (isLoadingStudents) return <LoadingSpinner />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F0F9FF" }}>
      {/* 헤더 — 오션 블루 */}
      <header className="sticky top-0 z-20 shadow-sm" style={{ backgroundColor: "#0077B6" }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/student"
              className="text-lg font-bold text-white hover:text-cyan-100 transition-colors"
            >
              어망
            </Link>
            <span className="text-white/50 text-sm">/</span>
            <span className="text-sm text-white/80">배정 확인</span>
          </div>
          <span className="text-xs font-semibold text-white bg-white/20
                           px-3 py-1 rounded-full border border-white/30">
            {year}.{String(mon).padStart(2, "0")}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* 안내 배너 — 오션→teal 그라디언트 */}
        <div
          className="rounded-3xl px-5 py-4 text-white shadow-md"
          style={{ background: "linear-gradient(135deg, #0077B6 0%, #00ADB5 100%)" }}
        >
          <p className="font-bold text-base mb-0.5">내 역할 배정 확인</p>
          <p className="text-cyan-100 text-sm">
            이름을 선택하면 이번 달 배정된 역할을 확인할 수 있어요.
          </p>
        </div>

        {/* STEP 1: 이름 선택 + 월 선택 */}
        <div className="bg-white rounded-3xl shadow-sm p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#0077B6" }}>
              내 이름 선택
            </p>
            <div className="relative">
              <select
                value={selectedStudentId}
                onChange={(e) => handleStudentSelect(e.target.value)}
                className="w-full border-2 rounded-2xl
                           px-4 py-3.5 text-base text-gray-800 appearance-none
                           focus:outline-none transition-colors cursor-pointer"
                style={{
                  backgroundColor: "#F0F9FF",
                  borderColor: selectedStudentId ? "#00ADB5" : "#DBEAFE",
                }}
              >
                <option value="">이름을 선택해주세요</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.baptismalName ? ` (${s.baptismalName})` : ""}
                    {s.grade ? ` · ${s.grade}` : ""}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ color: "#0077B6" }}>
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* 선택된 학생 정보 */}
            {selectedStudent && (
              <div className="mt-3 rounded-2xl px-4 py-3 flex items-center gap-3"
                   style={{ backgroundColor: "#E0F7FA" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center
                                font-bold text-sm flex-shrink-0 text-white"
                     style={{ backgroundColor: "#00ADB5" }}>
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {selectedStudent.name}
                    {selectedStudent.baptismalName && (
                      <span className="font-normal text-gray-500 ml-1.5">
                        {selectedStudent.baptismalName}
                      </span>
                    )}
                  </p>
                  {selectedStudent.grade && (
                    <p className="text-xs text-gray-500">{selectedStudent.grade}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 월 선택 */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#0077B6" }}>
              월 선택
            </p>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full border-2 rounded-2xl
                         px-4 py-3 text-sm text-gray-800
                         focus:outline-none transition-colors"
              style={{ backgroundColor: "#F0F9FF", borderColor: "#DBEAFE" }}
            />
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* 로딩 중 */}
        {isLoadingAssignments && (
          <div className="bg-white rounded-3xl shadow-sm p-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-100 border-t-[#0077B6] rounded-full animate-spin" />
            <p className="text-sm text-gray-400">배정 정보 불러오는 중...</p>
          </div>
        )}

        {/* 배정 결과 */}
        {!isLoadingAssignments && selectedStudentId && (
          <>
            {assignments.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {formatMonthDisplay(currentMonth)} 배정 내역이 없어요
                </p>
                <p className="text-xs text-gray-400">
                  선생님이 배정을 완료하면 여기에 표시됩니다.
                </p>
              </div>
            ) : (
              <>
                {/* 요약 카드 */}
                <div className="bg-white rounded-3xl shadow-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#0077B6" }}>
                    {formatMonthDisplay(currentMonth)} 배정 요약
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* 정배정 — 앰버 골드 */}
                    <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: "#FFF8E1" }}>
                      <p className="text-2xl font-bold" style={{ color: "#FFB703" }}>{primaryAssignments.length}</p>
                      <p className="text-xs text-gray-500 mt-1">정배정</p>
                    </div>
                    {/* 백업 — 아이스 블루 */}
                    <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: "#F0F9FF" }}>
                      <p className="text-2xl font-bold" style={{ color: "#0077B6" }}>{backupAssignments.length}</p>
                      <p className="text-xs text-gray-500 mt-1">백업 배정</p>
                    </div>
                  </div>
                </div>

                {/* 정배정 목록 */}
                {primaryAssignments.length > 0 && (
                  <div className="bg-white rounded-3xl shadow-sm p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#0077B6" }}>
                      정배정 ({primaryAssignments.length}건)
                    </p>
                    <div className="space-y-3">
                      {primaryAssignments.map((a, i) => (
                        <AssignmentCard 
                          key={i} 
                          record={a} 
                          onEmergencyReport={handleOpenEmergencyModal}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 백업 배정 목록 */}
                {backupAssignments.length > 0 && (
                  <div className="bg-white rounded-3xl shadow-sm p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#0077B6" }}>
                      백업 배정 ({backupAssignments.length}건)
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                      정배정 학생이 불참하면 연락이 올 수 있어요.
                    </p>
                    <div className="space-y-3">
                      {backupAssignments.map((a, i) => (
                        <AssignmentCard key={i} record={a} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 안내 — teal */}
                <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#E0F7FA", border: "1px solid #B2EBF2" }}>
                  <p className="text-xs" style={{ color: "#0077B6" }}>
                    역할 변경이 필요하면 담당 선생님께 문의해주세요.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* 학생 미선택 안내 */}
        {!selectedStudentId && !isLoadingAssignments && (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
            <div className="text-4xl mb-3">👆</div>
            <p className="text-sm text-gray-400">위에서 이름을 선택해주세요</p>
          </div>
        )}

        {/* 응답 제출 링크 */}
        <div className="bg-white rounded-3xl shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">아직 참석 여부를 입력 안 했나요?</p>
            <p className="text-xs text-gray-400 mt-0.5">응답을 제출해야 배정에 반영돼요</p>
          </div>
          <Link
            href={`/student/response?month=${currentMonth}`}
            className="flex-shrink-0 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl transition-colors hover:opacity-90"
            style={{ backgroundColor: "#00ADB5" }}
          >
            응답하기 →
          </Link>
        </div>

        {/* 푸터 */}
        <div className="pt-2 pb-4 text-center">
          <p className="text-xs text-gray-400">어망 (Fish-Net) · 병점 성당 중고등부 주일학교</p>
        </div>
      </main>

      {/* 긴급 불참 신고 모달 */}
      {emergencyModal.isOpen && emergencyModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🚨</span>
              <h3 className="text-lg font-bold text-gray-800">긴급 불참 신고</h3>
            </div>

            <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: "#F0F9FF" }}>
              <p className="text-sm text-gray-700 mb-2">
                <span className="font-semibold">날짜:</span> {formatDateFull(emergencyModal.record.date)}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">역할:</span> {emergencyModal.record.role}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                불참 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={emergencyModal.reason}
                onChange={(e) =>
                  setEmergencyModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="예: 갑작스러운 가족 행사로 인해 참석이 어렵습니다."
                rows={4}
                className="w-full px-4 py-3 border-2 rounded-2xl text-sm text-gray-900
                           placeholder:text-gray-400 focus:outline-none
                           transition-colors resize-none"
                style={{ borderColor: "#DBEAFE" }}
              />
            </div>

            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4">
              <p className="text-xs text-red-600">
                신고 즉시 교사에게 알림이 전송되며, 대타 학생에게 연락이 갑니다.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCloseEmergencyModal}
                disabled={emergencyModal.isSubmitting}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50
                           text-gray-700 rounded-2xl text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmitEmergency}
                disabled={emergencyModal.isSubmitting || !emergencyModal.reason.trim()}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-200
                           text-white rounded-2xl text-sm font-medium transition-colors
                           flex items-center justify-center gap-2"
              >
                {emergencyModal.isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    신고 중...
                  </>
                ) : (
                  "신고하기"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <GuideChatbot />
    </div>
  );
}

// ==================== Export with Suspense ====================

export default function StudentSchedulePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F0F9FF" }}>
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#0077B6] animate-spin" />
        </div>
      </div>
    }>
      <SchedulePageInner />
    </Suspense>
  );
}
