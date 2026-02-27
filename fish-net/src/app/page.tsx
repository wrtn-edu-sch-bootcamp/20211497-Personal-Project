"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getMassDates, getStudents, getAvailabilities } from "@/lib/firestore";

// ==================== Types ====================

interface MassWeekStatus {
  massDateId: string;
  date: Date;
  respondedCount: number;   // 이 미사에 응답한 학생 수
  totalStudents: number;    // 전체 학생 수
  rate: number;             // 응답률 0~100
}

interface StatusData {
  nextMassDate: Date | null;
  dDay: number | null;
  weeks: MassWeekStatus[];  // 이번 달 미사별 현황
  totalStudents: number;
  isLoaded: boolean;
}

// ==================== Helpers ====================

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatNextMass(date: Date): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${weekdays[date.getDay()]})`;
}

function calcDDay(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ==================== Sub-components ====================

function StatusHero({ status }: { status: StatusData }) {
  const month = getCurrentMonth();
  const [year, mon] = month.split("-").map(Number);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  const dDayLabel =
    status.dDay === null
      ? "—"
      : status.dDay === 0
      ? "D-Day"
      : status.dDay > 0
      ? `D-${status.dDay}`
      : `D+${Math.abs(status.dDay)}`;

  // 전체 평균 응답률
  const avgRate =
    status.weeks.length > 0
      ? Math.round(status.weeks.reduce((sum, w) => sum + w.rate, 0) / status.weeks.length)
      : 0;

  return (
    <div
      className="rounded-3xl text-white px-6 py-6 shadow-lg"
      style={{ background: "linear-gradient(135deg, #0077B6 0%, #00ADB5 100%)" }}
    >
      {/* 브랜드 + 다음 미사 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🐟</span>
          <div>
            <p className="font-extrabold text-lg leading-none">어망 Fish-Net</p>
            <p className="text-cyan-100 text-xs mt-0.5">병점 성당 중고등부</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/60">다음 미사</p>
          {status.nextMassDate ? (
            <>
              <p className="font-bold text-sm text-white">{formatNextMass(status.nextMassDate)}</p>
              <p
                className="text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full inline-block"
                style={{
                  backgroundColor: status.dDay !== null && status.dDay <= 3 ? "#FFB703" : "rgba(255,255,255,0.2)",
                  color: status.dDay !== null && status.dDay <= 3 ? "#1a1a1a" : "white",
                }}
              >
                {dDayLabel}
              </p>
            </>
          ) : (
            <p className="text-sm text-white/50">일정 없음</p>
          )}
        </div>
      </div>

      {/* 월 헤더 + 평균 응답률 */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-white/70">{year}년 {mon}월 미사별 응답 현황</p>
        {status.isLoaded && status.weeks.length > 0 && (
          <span className="text-xs font-bold text-white">평균 {avgRate}%</span>
        )}
      </div>

      {/* 미사별 주차 행 */}
      {!status.isLoaded ? (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          불러오는 중...
        </div>
      ) : status.weeks.length === 0 ? (
        <p className="text-xs text-white/50">이번 달 미사 일정이 아직 없어요</p>
      ) : (
        <div className="space-y-2.5">
          {status.weeks.map((week) => (
            <div key={week.massDateId}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-white/80 font-medium">
                  {week.date.getMonth() + 1}월 {week.date.getDate()}일({weekdays[week.date.getDay()]})
                </span>
                <span className="font-bold text-white">
                  {week.respondedCount}/{week.totalStudents}명 · {week.rate}%
                </span>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{
                    width: `${week.rate}%`,
                    backgroundColor: week.rate >= 80 ? "#FFB703" : "rgba(255,255,255,0.7)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Quick Chat (인라인 챗) ====================

const SUGGESTED_QUESTIONS = [
  "1독서 시작 멘트가 뭐야?",
  "반주 준비할 때 뭐 해야 해?",
  "보편지향기도 순서 알려줘",
  "배정 결과 어디서 확인해?",
];

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

function QuickChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const send = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || isLoading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setIsLoading(true);
    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer ?? "답변을 가져오지 못했어요." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "오류가 발생했어요. 잠시 후 다시 시도해주세요." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden" style={{ border: "1px solid #DBEAFE" }}>
      {/* 헤더 */}
      <div className="px-5 py-4 border-b" style={{ backgroundColor: "#F0F9FF", borderColor: "#DBEAFE" }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <div>
            <p className="font-bold text-sm" style={{ color: "#0077B6" }}>역할 가이드 도우미</p>
            <p className="text-xs text-gray-400">어망_역할수행_가이드 기반 AI</p>
          </div>
        </div>
      </div>

      {/* 대화 내역 */}
      {messages.length > 0 && (
        <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed"
                style={
                  m.role === "user"
                    ? { backgroundColor: "#0077B6", color: "white", borderBottomRightRadius: "4px" }
                    : { backgroundColor: "#F0F9FF", color: "#1f2937", borderBottomLeftRadius: "4px" }
                }
              >
                {m.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-2xl rounded-bl-sm text-sm flex items-center gap-2"
                   style={{ backgroundColor: "#F0F9FF", color: "#6b7280" }}>
                <div className="w-3 h-3 rounded-full border-2 border-t-[#0077B6] border-blue-100 animate-spin" />
                답변 생성 중...
              </div>
            </div>
          )}
        </div>
      )}

      {/* 추천 질문 버튼 */}
      {messages.length === 0 && (
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs text-gray-400 mb-2">추천 질문</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:opacity-80 disabled:opacity-40"
                style={{
                  backgroundColor: "#F0F9FF",
                  borderColor: "#DBEAFE",
                  color: "#0077B6",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력창 */}
      <div className="px-4 py-3 flex gap-2 border-t" style={{ borderColor: "#DBEAFE" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="역할 수행에 대해 질문하세요..."
          disabled={isLoading}
          className="flex-1 px-3 py-2 rounded-xl text-sm text-gray-900
                     placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
          style={{ backgroundColor: "#F0F9FF", border: "1.5px solid #DBEAFE" }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: "#0077B6" }}
        >
          전송
        </button>
      </div>
    </div>
  );
}

// ==================== Main Page ====================

export default function HomePage() {
  const [status, setStatus] = useState<StatusData>({
    nextMassDate: null,
    dDay: null,
    weeks: [],
    totalStudents: 0,
    isLoaded: false,
  });

  const month = getCurrentMonth();
  const [year, mon] = month.split("-").map(Number);

  useEffect(() => {
    async function loadStatus() {
      try {
        const [massDates, students, availabilities] = await Promise.all([
          getMassDates(),
          getStudents(),
          getAvailabilities(),
        ]);

        const now = new Date();

        // 다음 미사일 (오늘 이후 가장 가까운 날)
        const upcoming = massDates
          .filter((m) => m.date >= now)
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        const nextMassDate = upcoming[0]?.date ?? null;
        const dDay = nextMassDate ? calcDDay(nextMassDate) : null;

        // 이번 달 미사 목록 (날짜 오름차순)
        const thisMonthMasses = massDates
          .filter((m) => m.date.getFullYear() === year && m.date.getMonth() === mon - 1)
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        // 미사별 응답 현황 — 학생 단위 (1명이 같은 미사에 중복 응답해도 1명으로 집계)
        const totalStudents = students.length;
        const weeks: MassWeekStatus[] = thisMonthMasses.map((mass) => {
          const respondedStudentIds = new Set(
            availabilities
              .filter((a) => a.massDateId === mass.id)
              .map((a) => a.studentId)
          );
          const respondedCount = respondedStudentIds.size;
          const rate = totalStudents > 0
            ? Math.min(100, Math.round((respondedCount / totalStudents) * 100))
            : 0;
          return {
            massDateId: mass.id,
            date: mass.date,
            respondedCount,
            totalStudents,
            rate,
          };
        });

        setStatus({
          nextMassDate,
          dDay,
          weeks,
          totalStudents,
          isLoaded: true,
        });
      } catch (err) {
        console.error("홈 상태 로드 실패:", err);
        setStatus((prev) => ({ ...prev, isLoaded: true }));
      }
    }
    loadStatus();
  }, [year, mon]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F0F9FF" }}>
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* 1. 상태 히어로 */}
        <StatusHero status={status} />

        {/* 2. 역할 카드 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 교사 카드 */}
          <Link href="/teacher" className="block">
            <div
              className="bg-white rounded-3xl p-5 h-full transition-all hover:shadow-md active:scale-[0.98]"
              style={{ border: "2px solid transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1D3461")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                style={{ backgroundColor: "#EFF6FF" }}
              >
                👨‍🏫
              </div>
              <p className="font-bold text-gray-800 text-sm mb-1">교사 대시보드</p>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                배정 실행 및<br />메시지 전송
              </p>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: "#EFF6FF", color: "#1D3461" }}
              >
                대시보드 →
              </span>
            </div>
          </Link>

          {/* 학생 카드 */}
          <Link href="/student" className="block">
            <div
              className="bg-white rounded-3xl p-5 h-full transition-all hover:shadow-md active:scale-[0.98]"
              style={{ border: "2px solid transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00ADB5")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                style={{ backgroundColor: "#E0F7FA" }}
              >
                🙋
              </div>
              <p className="font-bold text-gray-800 text-sm mb-1">학생 홈</p>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                참석 여부 제출 및<br />성가 확인
              </p>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: "#E0F7FA", color: "#00ADB5" }}
              >
                홈으로 →
              </span>
            </div>
          </Link>
        </div>

        {/* 이번 달 현황 요약 바 — 다음 미사 응답률 기준 */}
        {status.isLoaded && status.weeks.length > 0 && (() => {
          // 다음 미사(오늘 이후 첫 번째)의 응답률을 대표로 표시
          const now = new Date();
          const nextWeek = status.weeks.find((w) => w.date >= now) ?? status.weeks[status.weeks.length - 1];
          const avgRate = Math.round(
            status.weeks.reduce((sum, w) => sum + w.rate, 0) / status.weeks.length
          );
          return (
            <div
              className="bg-white rounded-2xl px-5 py-3 flex items-center justify-between"
              style={{ border: "1px solid #DBEAFE" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0"
                  style={{
                    backgroundColor: avgRate >= 80 ? "#00ADB5" : "#0077B6",
                    fontSize: avgRate >= 100 ? "9px" : "11px",
                  }}
                >
                  {avgRate}%
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{year}년 {mon}월 평균 응답률</p>
                  <p className="text-xs text-gray-400">
                    다음 미사 {nextWeek.respondedCount}/{nextWeek.totalStudents}명 응답
                  </p>
                </div>
              </div>
              <Link
                href="/teacher"
                className="text-xs font-medium px-3 py-1.5 rounded-xl transition-colors flex-shrink-0"
                style={{ backgroundColor: "#F0F9FF", color: "#0077B6" }}
              >
                배정 실행 →
              </Link>
            </div>
          );
        })()}

        {/* 3. 역할 가이드 챗 */}
        <QuickChat />

        {/* 푸터 */}
        <div className="pt-2 pb-6 text-center">
          <p className="text-xs text-gray-400">어망 (Fish-Net) · 병점 성당 중고등부 주일학교</p>
        </div>
      </main>
    </div>
  );
}
