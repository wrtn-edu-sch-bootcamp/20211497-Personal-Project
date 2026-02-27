"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { AvailabilityStatus, AttendanceStatus } from "@/types";

// ==================== Types ====================

export interface DrawerStudent {
  id: string;
  name: string;
  baptismalName: string | null;
  grade: string;
  isNewMember: boolean;
}

interface CommentEntry {
  date: Date;
  massDateId: string;
  comment: string;
}

interface AssignmentSummary {
  primaryCount: number;
  backupCount: number;
}

/** availability 기반 (기존 응답 현황) */
interface AvailabilityStat {
  available: number;
  uncertain: number;
  unavailable: number;
  noResponse: number;
}

/** attendance 컬렉션 기반 (실제 출석 현황) */
interface AttendanceStat {
  present: number;
  absent: number;
  absentWithReason: number;
  total: number; // present + absent + absentWithReason (unknown 제외)
}

interface DrawerData {
  availability: AvailabilityStat;
  attendance: AttendanceStat;
  assignments: AssignmentSummary;
  comments: CommentEntry[];
}

interface Props {
  student: DrawerStudent | null;
  month: string; // "YYYY-MM"
  massDatesCount: number;
  onClose: () => void;
}

// ==================== Constants ====================

const DONUT_COLORS = {
  // availability 기반 색상
  available: "#06D6A0",
  uncertain: "#FFB703",
  unavailable: "#FF6B6B",
  noResponse: "#E5E7EB",
  // attendance 기반 색상
  present: "#06D6A0",
  absent: "#FF6B6B",
  absentWithReason: "#FB923C", // orange-400
};

// ==================== Skeleton ====================

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className ?? ""}`} />
  );
}

// ==================== Donut Chart ====================

function AttendanceDonut({ stat }: { stat: AttendanceStat }) {
  // present만 분자, present+absent+absentWithReason이 분모 (unknown 제외)
  const rate = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;

  const data = [
    { name: "출석", value: stat.present, color: DONUT_COLORS.present },
    { name: "사유결석", value: stat.absentWithReason, color: DONUT_COLORS.absentWithReason },
    { name: "결석", value: stat.absent, color: DONUT_COLORS.absent },
  ].filter((d) => d.value > 0);

  const isEmpty = data.length === 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={isEmpty ? [{ name: "없음", value: 1 }] : data}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={42}
              dataKey="value"
              strokeWidth={0}
            >
              {isEmpty ? (
                <Cell fill={DONUT_COLORS.noResponse} />
              ) : (
                data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))
              )}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-800">{rate}%</span>
          <span className="text-[9px] text-gray-400">출석률</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        {(
          [
            { key: "present" as const, label: "출석", val: stat.present },
            { key: "absentWithReason" as const, label: "사유결석", val: stat.absentWithReason },
            { key: "absent" as const, label: "결석", val: stat.absent },
          ]
        ).map(({ key, label, val }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: DONUT_COLORS[key] }}
            />
            <span className="text-gray-500">{label}</span>
            <span className="font-semibold text-gray-700 ml-auto pl-2">{val}</span>
          </div>
        ))}
        {isEmpty && (
          <p className="text-gray-400 text-[11px]">이번 달 출석 기록 없음</p>
        )}
      </div>
    </div>
  );
}

// ==================== Main Component ====================

export default function StudentDrawer({
  student,
  month,
  massDatesCount,
  onClose,
}: Props) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isOpen = student !== null;

  // 바깥 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ESC 키 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Firestore 데이터 로드
  const loadDrawerData = useCallback(async (s: DrawerStudent) => {
    setIsLoadingData(true);
    setData(null);
    setAiAnalysis(null);

    try {
      const [year, mon] = month.split("-").map(Number);

      // 1. 이번 달 massDates 조회
      const massDatesSnap = await getDocs(collection(firestore, "massDates"));
      const monthMassDates = massDatesSnap.docs
        .map((d) => ({ id: d.id, date: d.data().date?.toDate() as Date }))
        .filter((d) => {
          const dt = d.date;
          return dt?.getFullYear() === year && dt?.getMonth() === mon - 1;
        });
      const massDateIds = new Set(monthMassDates.map((d) => d.id));

      // 2. availability 응답 조회 (응답 현황 참고용)
      const availSnap = await getDocs(
        query(collection(firestore, "availabilities"), where("studentId", "==", s.id))
      );
      const monthAvails = availSnap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((a) => massDateIds.has(a.massDateId as string));

      const availStatusCounts: Record<AvailabilityStatus, number> = {
        available: 0, uncertain: 0, unavailable: 0,
      };
      monthAvails.forEach((a) => {
        const status = a.status as AvailabilityStatus;
        if (status in availStatusCounts) availStatusCounts[status]++;
      });

      const availability: AvailabilityStat = {
        available: availStatusCounts.available,
        uncertain: availStatusCounts.uncertain,
        unavailable: availStatusCounts.unavailable,
        noResponse: Math.max(0, monthMassDates.length - monthAvails.length),
      };

      // 3. attendance 컬렉션에서 이번 달 실제 출석 기록 조회
      const attendanceSnap = await getDocs(
        query(
          collection(firestore, "attendance"),
          where("studentId", "==", s.id),
          where("date", ">=", `${month}-01`),
          where("date", "<=", `${month}-99`)
        )
      );

      let presentCount = 0;
      let absentCount = 0;
      let absentWithReasonCount = 0;

      attendanceSnap.docs.forEach((d) => {
        const status = d.data().status as AttendanceStatus;
        if (status === "present") presentCount++;
        else if (status === "absent") absentCount++;
        else if (status === "absent_with_reason") absentWithReasonCount++;
        // "unknown"은 분모에서 제외
      });

      const attendance: AttendanceStat = {
        present: presentCount,
        absent: absentCount,
        absentWithReason: absentWithReasonCount,
        total: presentCount + absentCount + absentWithReasonCount,
      };

      // 4. 배정 요약 (전체 기간)
      const assignSnap = await getDocs(
        query(collection(firestore, "assignments"), where("studentId", "==", s.id))
      );
      let primaryCount = 0;
      let backupCount = 0;
      assignSnap.docs.forEach((d) => {
        if (d.data().isPrimary) primaryCount++;
        else backupCount++;
      });

      // 5. 최근 코멘트 5개 (comment 있는 것만)
      const commentSnap = await getDocs(
        query(
          collection(firestore, "availabilities"),
          where("studentId", "==", s.id),
          orderBy("updatedAt", "desc"),
          limit(20)
        )
      );
      const comments: CommentEntry[] = commentSnap.docs
        .filter((d) => d.data().comment)
        .slice(0, 5)
        .map((d) => {
          const massDate = massDatesSnap.docs.find((md) => md.id === d.data().massDateId);
          return {
            date: massDate?.data().date?.toDate() ?? new Date(d.data().updatedAt?.toDate()),
            massDateId: d.data().massDateId as string,
            comment: d.data().comment as string,
          };
        });

      const drawerData: DrawerData = {
        availability,
        attendance,
        assignments: { primaryCount, backupCount },
        comments,
      };

      setData(drawerData);

      if (comments.length > 0) {
        triggerAiAnalysis(s, comments);
      }
    } catch (err) {
      console.error("[StudentDrawer] 데이터 로드 실패:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [month]);

  // AI 패턴 분석 — 코멘트 데이터가 준비된 후 호출
  const triggerAiAnalysis = useCallback(
    async (s: DrawerStudent, comments: CommentEntry[]) => {
      setIsAnalyzing(true);
      try {
        const commentText = comments
          .map((c) => {
            const d = c.date;
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
            return `[${dateStr}] ${c.comment}`;
          })
          .join("\n");

        const res = await fetch("/api/student/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: s.name,
            baptismalName: s.baptismalName,
            grade: s.grade,
            comments: commentText,
          }),
        });

        if (!res.ok) throw new Error("분석 실패");
        const json = await res.json();
        setAiAnalysis(json.analysis ?? null);
      } catch (err) {
        console.error("[StudentDrawer] AI 분석 실패:", err);
        setAiAnalysis(null);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // 학생 변경 시 데이터 로드
  useEffect(() => {
    if (student) {
      loadDrawerData(student);
    }
  }, [student, loadDrawerData]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={{ backdropFilter: "blur(2px)", backgroundColor: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={student ? `${student.name} 학생 상세` : "학생 상세"}
        className={`
          fixed z-50 bg-white shadow-2xl
          transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          overflow-y-auto

          /* 모바일: 하단 슬라이드업 */
          bottom-0 left-0 right-0 rounded-t-2xl max-h-[90vh]
          ${isOpen ? "translate-y-0" : "translate-y-full"}

          /* 데스크탑: 우측 슬라이드인 */
          md:bottom-auto md:top-0 md:left-auto md:right-0 md:rounded-none
          md:h-full md:w-[380px] md:max-h-none
          ${isOpen ? "md:translate-x-0 md:translate-y-0" : "md:translate-x-full md:translate-y-0"}
        `}
      >
        {student && (
          <div className="flex flex-col h-full">
            {/* ── 헤더 ── */}
            <div
              className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #0077B6 0%, #00ADB5 100%)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center
                                text-white font-bold text-lg border border-white/30">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{student.name}</h2>
                    {student.isNewMember && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                       bg-amber-400 text-amber-900">
                        신입
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-cyan-100 mt-0.5">
                    {student.grade}
                    {student.baptismalName && ` · ${student.baptismalName}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full
                           bg-white/20 hover:bg-white/30 text-white transition-colors"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* ── 본문 ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* 출석률 도넛 차트 — attendance 컬렉션 기반 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  이번 달 실제 출석 현황
                </h3>
                <p className="text-[10px] text-gray-400 mb-3">
                  출석률 = 출석 / (출석 + 결석 + 사유결석) · 미확인 제외
                </p>
                {isLoadingData ? (
                  <div className="flex items-center gap-4">
                    <SkeletonBlock className="w-24 h-24 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <SkeletonBlock className="h-3 w-3/4" />
                      <SkeletonBlock className="h-3 w-1/2" />
                      <SkeletonBlock className="h-3 w-2/3" />
                    </div>
                  </div>
                ) : data ? (
                  <AttendanceDonut stat={data.attendance} />
                ) : null}
              </section>

              {/* 배정 요약 배지 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  배정 이력 (전체)
                </h3>
                {isLoadingData ? (
                  <div className="flex gap-3">
                    <SkeletonBlock className="h-16 flex-1" />
                    <SkeletonBlock className="h-16 flex-1" />
                  </div>
                ) : data ? (
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-xl p-3 text-center border"
                         style={{ backgroundColor: "#FFF8E1", borderColor: "#FFB703" }}>
                      <p className="text-xl font-bold" style={{ color: "#B45309" }}>
                        {data.assignments.primaryCount}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#92400E" }}>정배정</p>
                    </div>
                    <div className="flex-1 rounded-xl p-3 text-center border"
                         style={{ backgroundColor: "#E0F7FA", borderColor: "#0077B6" }}>
                      <p className="text-xl font-bold" style={{ color: "#0077B6" }}>
                        {data.assignments.backupCount}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#005A8A" }}>백업 배정</p>
                    </div>
                  </div>
                ) : null}
              </section>

              {/* 최근 코멘트 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  최근 코멘트
                </h3>
                {isLoadingData ? (
                  <div className="space-y-2">
                    <SkeletonBlock className="h-10" />
                    <SkeletonBlock className="h-10" />
                    <SkeletonBlock className="h-10 w-3/4" />
                  </div>
                ) : data ? (
                  data.comments.length > 0 ? (
                    <ul className="space-y-2">
                      {data.comments.map((c, i) => (
                        <li
                          key={i}
                          className="rounded-xl px-3 py-2.5 border border-gray-100 bg-gray-50"
                        >
                          <p className="text-[10px] text-gray-400 mb-0.5">
                            {c.date.getMonth() + 1}월 {c.date.getDate()}일
                          </p>
                          <p className="text-sm text-gray-700 leading-snug">"{c.comment}"</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 py-3 text-center">코멘트 없음</p>
                  )
                ) : null}
              </section>

              {/* AI 패턴 분석 */}
              {data && data.comments.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    AI 패턴 분석
                  </h3>
                  {isAnalyzing ? (
                    <div className="rounded-xl px-4 py-3 border border-green-200 bg-green-50 flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin flex-shrink-0" />
                      <p className="text-sm text-green-700">AI 분석 중...</p>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="rounded-xl px-4 py-3 border border-green-200 bg-green-50">
                      <p className="text-sm text-green-800 leading-relaxed">
                        🤖 {aiAnalysis}
                      </p>
                    </div>
                  ) : null}
                </section>
              )}

            </div>
          </div>
        )}
      </div>
    </>
  );
}
