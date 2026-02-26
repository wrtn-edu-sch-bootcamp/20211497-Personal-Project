"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { AvailabilityStatus } from "@/types";
import { getStudents, getMassDates, getAvailabilities } from "@/lib/firestore";
import type {
  SubmitAvailabilityRequest,
  SubmitAvailabilityResponse,
  AvailabilityErrorResponse,
} from "@/app/api/availability/route";

// ==================== Types ====================

interface StudentInfo {
  id: string;
  name: string;
  baptismalName: string | null;
  grade: string;
}

interface MassDateInfo {
  id: string;
  date: Date;
}

interface AvailabilityEntry {
  massDateId: string;
  status: AvailabilityStatus;
}

// ==================== Helpers ====================

/**
 * 해당 월의 모든 토요일 반환 (중고등부 미사: 토요일 19:30)
 */
function getSaturdaysOfMonth(month: string): Date[] {
  const [year, mon] = month.split("-").map(Number);
  const saturdays: Date[] = [];
  const date = new Date(year, mon - 1, 1);
  while (date.getDay() !== 6) date.setDate(date.getDate() + 1);
  while (date.getMonth() === mon - 1) {
    saturdays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }
  return saturdays;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatSaturday(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

// ==================== Status Config ====================

const STATUS_CONFIG: Record<
  AvailabilityStatus,
  {
    label: string;
    emoji: string;
    activeBg: string;
    activeText: string;
    activeBorder: string;
    dotBg: string;
  }
> = {
  available: {
    label: "가능해요",
    emoji: "😊",
    activeBg: "bg-blue-50",
    activeText: "text-blue-600",
    activeBorder: "border-blue-400",
    dotBg: "bg-blue-400",
  },
  uncertain: {
    label: "애매해요",
    emoji: "🤔",
    activeBg: "bg-amber-50",
    activeText: "text-amber-600",
    activeBorder: "border-amber-400",
    dotBg: "bg-amber-400",
  },
  unavailable: {
    label: "못 가요",
    emoji: "😢",
    activeBg: "bg-red-50",
    activeText: "text-red-500",
    activeBorder: "border-red-400",
    dotBg: "bg-red-400",
  },
};

// ==================== Sub-components ====================

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative mx-auto mb-4 h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-4 border-t-orange-400 animate-spin" />
        </div>
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    </div>
  );
}

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-xs">
        <div className="text-4xl mb-3">😥</div>
        <p className="text-gray-600 text-sm mb-5">{message}</p>
        <button
          onClick={onRetry}
          className="bg-orange-400 hover:bg-orange-500 text-white
                     px-6 py-2.5 rounded-2xl text-sm font-medium transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}

function SubmitSuccess({
  studentName,
  month,
  onReset,
}: {
  studentName: string;
  month: string;
  onReset: () => void;
}) {
  const [, mon] = month.split("-").map(Number);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">응답 완료!</h2>
          <p className="text-gray-500 text-sm mb-6">
            <span className="font-medium text-gray-700">{studentName}</span>님의{" "}
            {mon}월 응답이 저장됐어요.
            <br />
            배정 결과는 교사 선생님께서 확인 후 안내해 드릴게요.
          </p>
          <button
            onClick={onReset}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600
                       py-3 rounded-2xl text-sm font-medium transition-colors"
          >
            다른 학생 응답 입력하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Main Page ====================

export default function StudentResponsePage() {
  const searchParams = useSearchParams();
  const rawMonth = searchParams.get("month");
  const month = rawMonth ?? getCurrentMonth();
  const [year, mon] = month.split("-").map(Number);

  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [massDates, setMassDates] = useState<MassDateInfo[]>([]);
  const [saturdaysOfMonth, setSaturdaysOfMonth] = useState<Date[]>([]);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [availabilities, setAvailabilities] = useState<AvailabilityEntry[]>([]);
  const [comment, setComment] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [studentsData, massDatesData] = await Promise.all([
        getStudents(),
        getMassDates(),
      ]);
      setStudents(
        studentsData.map((s) => ({
          id: s.id,
          name: s.name,
          baptismalName: s.baptismalName ?? null,
          grade: s.grade ?? "",
        }))
      );
      const filtered = massDatesData.filter((m) => {
        const d = m.date;
        return d.getFullYear() === year && d.getMonth() === mon - 1;
      });
      setMassDates(filtered.map((m) => ({ id: m.id, date: m.date })));
      setSaturdaysOfMonth(getSaturdaysOfMonth(month));
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      setError("데이터를 불러오는 데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [month, year, mon]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedStudentId) return;
    async function loadExisting() {
      try {
        const all = await getAvailabilities();
        const mine = all.filter((a) => a.studentId === selectedStudentId);
        if (mine.length > 0) {
          setAvailabilities(
            mine.map((a) => ({ massDateId: a.massDateId, status: a.status }))
          );
          if (mine[0].comment) setComment(mine[0].comment);
        }
      } catch {
        // silent
      }
    }
    loadExisting();
  }, [selectedStudentId]);

  const handleStudentSelect = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    setSelectedStudentId(studentId);
    setSelectedStudentName(student?.name ?? "");
    setAvailabilities([]);
    setComment("");
    setSubmitted(false);
  };

  const handleAvailabilityChange = (
    massDateId: string,
    status: AvailabilityStatus
  ) => {
    setAvailabilities((prev) => {
      const exists = prev.find((a) => a.massDateId === massDateId);
      if (exists)
        return prev.map((a) =>
          a.massDateId === massDateId ? { ...a, status } : a
        );
      return [...prev, { massDateId, status }];
    });
  };

  const handleSubmit = async () => {
    if (!selectedStudentId || availabilities.length === 0) return;
    try {
      setIsSubmitting(true);
      setError(null);

      const payload: SubmitAvailabilityRequest = {
        studentId: selectedStudentId,
        studentName: selectedStudentName,
        responses: availabilities.map((a) => ({
          massDateId: a.massDateId,
          status: a.status,
        })),
        comment: comment.trim() || undefined,
      };

      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: SubmitAvailabilityResponse | AvailabilityErrorResponse =
        await res.json();

      if (!res.ok || !data.success) {
        const errMsg = !data.success ? data.error : "알 수 없는 오류가 발생했습니다.";
        throw new Error(errMsg);
      }

      setSubmitted(true);
    } catch (err) {
      console.error("제출 실패:", err);
      setError(
        err instanceof Error
          ? err.message
          : "응답 제출에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const datesForDisplay: { id: string | null; date: Date }[] =
    massDates.length > 0
      ? massDates.map((m) => ({ id: m.id, date: m.date }))
      : saturdaysOfMonth.map((d) => ({ id: null, date: d }));

  const answeredCount = availabilities.length;
  const totalCount = massDates.length;
  const allAnswered = totalCount > 0 && answeredCount === totalCount;
  const partialAnswered = answeredCount > 0;
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // ── render guards ──
  if (isLoading) return <LoadingScreen />;
  if (error && students.length === 0)
    return <ErrorScreen message={error} onRetry={loadData} />;
  if (submitted)
    return (
      <SubmitSuccess
        studentName={selectedStudentName}
        month={month}
        onReset={() => {
          setSelectedStudentId("");
          setSelectedStudentName("");
          setAvailabilities([]);
          setComment("");
          setSubmitted(false);
        }}
      />
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 헤더 바 ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-lg font-bold text-orange-400 hover:text-orange-500 transition-colors"
            >
              어망
            </Link>
            <span className="text-gray-300 text-sm">/</span>
            <span className="text-sm text-gray-500">미사 참석 응답</span>
          </div>
          <span className="bg-orange-50 text-orange-500 text-xs font-semibold
                           px-3 py-1 rounded-full border border-orange-100">
            {year}.{String(mon).padStart(2, "0")}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── 안내 배너 ── */}
        <div className="bg-orange-400 rounded-3xl px-5 py-4 text-white">
          <p className="font-bold text-base mb-0.5">
            {year}년 {mon}월 미사 응답
          </p>
          <p className="text-orange-100 text-sm">
            병점 성당 중고등부 토요 미사 (19:30) 역할 배정을 위해<br />
            참석 가능 여부를 알려주세요.
          </p>
        </div>

        {/* ── STEP 1: 이름 선택 ── */}
        <div className="bg-white rounded-3xl shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            내 이름 선택
          </p>

          <div className="relative">
            <select
              value={selectedStudentId}
              onChange={(e) => handleStudentSelect(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl
                         px-4 py-3.5 text-base text-gray-800 appearance-none
                         focus:outline-none focus:border-orange-300
                         transition-colors cursor-pointer"
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
              <svg
                width="12"
                height="8"
                viewBox="0 0 12 8"
                fill="none"
                className="text-gray-400"
              >
                <path
                  d="M1 1.5L6 6.5L11 1.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* 선택된 학생 정보 */}
          {selectedStudent && (
            <div className="mt-3 bg-orange-50 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center
                              justify-center text-orange-500 font-bold text-sm flex-shrink-0">
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
                  <p className="text-xs text-gray-400">{selectedStudent.grade}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── STEP 2: 날짜별 응답 ── */}
        {selectedStudentId && (
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {/* 섹션 타이틀 */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                날짜별 참석 여부
              </p>
              {massDates.length === 0 && (
                <span className="bg-amber-50 text-amber-500 text-xs
                                 px-2.5 py-1 rounded-full border border-amber-100">
                  일정 미등록
                </span>
              )}
            </div>

            {datesForDisplay.length === 0 ? (
              <div className="px-5 pb-5 text-center text-sm text-gray-400">
                해당 월에 토요일이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {datesForDisplay.map(({ id, date }, idx) => {
                  const availability = id
                    ? availabilities.find((a) => a.massDateId === id)
                    : undefined;
                  const isRegistered = id !== null;

                  return (
                    <div key={id ?? idx} className="px-5 py-4">
                      {/* 날짜 행 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 bg-gray-50 rounded-2xl flex flex-col
                                          items-center justify-center flex-shrink-0">
                            <span className="text-[9px] text-gray-400 leading-none">
                              {date.getMonth() + 1}월
                            </span>
                            <span className="text-base font-bold text-gray-700 leading-none mt-0.5">
                              {date.getDate()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {formatSaturday(date)}
                            </p>
                            {!isRegistered && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                교사 일정 등록 후 응답 가능해요
                              </p>
                            )}
                          </div>
                        </div>
                        {/* 선택된 상태 배지 */}
                        {availability && (
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full
                                        ${STATUS_CONFIG[availability.status].activeBg}
                                        ${STATUS_CONFIG[availability.status].activeText}`}
                          >
                            {STATUS_CONFIG[availability.status].emoji}{" "}
                            {STATUS_CONFIG[availability.status].label}
                          </span>
                        )}
                      </div>

                      {/* 상태 선택 버튼 3개 */}
                      {isRegistered && (
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              "available",
                              "uncertain",
                              "unavailable",
                            ] as AvailabilityStatus[]
                          ).map((status) => {
                            const cfg = STATUS_CONFIG[status];
                            const isActive = availability?.status === status;
                            return (
                              <button
                                key={status}
                                onClick={() =>
                                  handleAvailabilityChange(id!, status)
                                }
                                className={`py-2.5 rounded-2xl text-sm font-medium
                                           border-2 transition-all duration-150 flex items-center
                                           justify-center gap-1.5
                                           ${
                                             isActive
                                               ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder}`
                                               : "bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100"
                                           }`}
                              >
                                <span>{cfg.emoji}</span>
                                <span className="text-xs">{cfg.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 진행 표시 */}
            {massDates.length > 0 && (
              <div className="mx-5 mb-4 bg-gray-50 rounded-2xl px-4 py-3
                              flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {answeredCount}
                  </span>
                  /{totalCount} 응답 완료
                </p>
                <div className="flex gap-1.5">
                  {massDates.map((m) => {
                    const done = availabilities.find(
                      (a) => a.massDateId === m.id
                    );
                    return (
                      <div
                        key={m.id}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          done ? STATUS_CONFIG[done.status].dotBg : "bg-gray-200"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: 코멘트 ── */}
        {selectedStudentId && massDates.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              한마디 남기기 <span className="text-gray-300 font-normal normal-case">(선택)</span>
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="시험 기간이라 늦게 도착할 것 같아요, 이번 달은 조금 어렵네요... 등"
              rows={3}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl
                         px-4 py-3 text-sm text-gray-800 resize-none
                         placeholder-gray-300
                         focus:outline-none focus:border-orange-300
                         transition-colors"
            />
            <p className="mt-2 text-xs text-gray-400">
              AI가 역할 배정 시 참고해요.
            </p>
          </div>
        )}

        {/* ── 에러 메시지 ── */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* ── 제출 버튼 ── */}
        {selectedStudentId && massDates.length > 0 && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !partialAnswered}
            className={`w-full py-4 rounded-3xl text-base font-bold
                       transition-all duration-200
                       ${
                         isSubmitting || !partialAnswered
                           ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                           : allAnswered
                           ? "bg-orange-400 hover:bg-orange-500 text-white shadow-md shadow-orange-200 active:scale-[0.98]"
                           : "bg-orange-300 hover:bg-orange-400 text-white active:scale-[0.98]"
                       }`}
          >
            {isSubmitting
              ? "제출 중..."
              : allAnswered
              ? "응답 제출하기"
              : `응답 제출하기 (${answeredCount}/${totalCount})`}
          </button>
        )}

        {/* 부분 응답 안내 */}
        {selectedStudentId &&
          massDates.length > 0 &&
          partialAnswered &&
          !allAnswered && (
            <p className="text-center text-xs text-gray-400">
              모든 날짜에 응답하지 않아도 제출할 수 있어요.
            </p>
          )}

        {/* 일정 미등록 안내 */}
        {selectedStudentId && massDates.length === 0 && (
          <div className="bg-white rounded-3xl shadow-sm p-6 text-center">
            <div className="text-3xl mb-3">📅</div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              {mon}월 미사 일정이 아직 없어요
            </p>
            <p className="text-xs text-gray-400">
              교사 선생님이 일정을 등록하면 자동으로 표시돼요.
            </p>
          </div>
        )}

        {/* ── 푸터 ── */}
        <div className="pt-2 pb-4 text-center">
          <p className="text-xs text-gray-300">
            어망 (Fish-Net) · 병점 성당 중고등부 주일학교
          </p>
        </div>
      </main>
    </div>
  );
}
