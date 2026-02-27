"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import GuideChatbot from "@/components/GuideChatbot";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function offsetMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function StudentHomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const month = searchParams.get("month") ?? getCurrentMonth();
  const [year, mon] = month.split("-").map(Number);

  const goMonth = (delta: number) => {
    router.push(`/student?month=${offsetMonth(month, delta)}`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F0F9FF" }}>
      {/* 헤더 — 오션 블루 */}
      <header className="sticky top-0 z-20 shadow-sm" style={{ backgroundColor: "#0077B6" }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/student"
            className="text-lg font-bold text-white hover:text-cyan-100 transition-colors"
          >
            어망
          </Link>
          {/* 월 탐색 컨트롤 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goMonth(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-full
                         hover:bg-white/20 text-white transition-colors"
              aria-label="이전 달"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-semibold text-white bg-white/20
                             px-3 py-1 rounded-full min-w-[60px] text-center border border-white/30">
              {year}.{String(mon).padStart(2, "0")}
            </span>
            <button
              onClick={() => goMonth(1)}
              className="w-7 h-7 flex items-center justify-center rounded-full
                         hover:bg-white/20 text-white transition-colors"
              aria-label="다음 달"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* 히어로 배너 — 오션 블루 그라디언트 */}
        <div
          className="rounded-3xl px-5 py-6 text-white text-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #0077B6 0%, #00ADB5 100%)" }}
        >
          <div className="text-4xl mb-2">⛪</div>
          <p className="font-bold text-lg">병점 성당 중고등부</p>
          <p className="text-cyan-100 text-sm mt-1">토요 미사 (19:30)</p>
        </div>

        {/* 메뉴 카드 1 — 참석 여부 응답 (teal 포인트) */}
        <Link href={`/student/response?month=${month}`} className="block">
          <div className="bg-white rounded-3xl shadow-sm border-2 border-transparent
                          hover:border-[#00ADB5] transition-all p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                   style={{ backgroundColor: "#E0F7FA" }}>
                ✏️
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-800">참석 여부 응답</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {year}년 {mon}월 미사 참석 가능 여부를 알려주세요
                </p>
              </div>
              <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#00ADB5" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>

        {/* 메뉴 카드 2 — 역할 배정 확인 (오션 블루 포인트) */}
        <Link href={`/student/schedule?month=${month}`} className="block">
          <div className="bg-white rounded-3xl shadow-sm border-2 border-transparent
                          hover:border-[#0077B6] transition-all p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                   style={{ backgroundColor: "#DBEAFE" }}>
                📋
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-800">내 역할 배정 확인</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {year}년 {mon}월 배정된 역할을 확인하세요
                </p>
              </div>
              <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#0077B6" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>

        {/* 메뉴 카드 3 — 성가 안내 (앰버 골드 포인트) */}
        <Link href={`/student/hymns?month=${month}`} className="block">
          <div className="bg-white rounded-3xl shadow-sm border-2 border-transparent
                          hover:border-[#FFB703] transition-all p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                   style={{ backgroundColor: "#FFF8E1" }}>
                🎵
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-800">성가 안내</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {year}년 {mon}월 미사 성가를 확인하세요
                </p>
              </div>
              <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#FFB703" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>

        <div className="pt-2 pb-20 text-center">
          <p className="text-xs text-gray-400">어망 (Fish-Net) · 병점 성당 중고등부 주일학교</p>
        </div>
      </main>

      <GuideChatbot />
    </div>
  );
}

export default function StudentIndexPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F0F9FF" }}>
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#0077B6] animate-spin" />
        </div>
      </div>
    }>
      <StudentHomeInner />
    </Suspense>
  );
}
