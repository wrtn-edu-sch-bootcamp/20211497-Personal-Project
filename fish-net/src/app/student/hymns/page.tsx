"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GuideChatbot from "@/components/GuideChatbot";
import { getHymnAnnouncementsByMonth } from "@/lib/firestore";
import type { HymnAnnouncement, HymnSlotKey } from "@/types";
import { HYMN_SLOT_LABELS, HYMN_SLOT_ORDER } from "@/types";

// ==================== Helpers ====================

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateKo(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${weekdays[d.getDay()]})`;
}

function getMonthBefore(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthAfter(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthDisplay(month: string): string {
  const [year, mon] = month.split("-");
  return `${year}년 ${parseInt(mon)}월`;
}

// ==================== Slot color scheme ====================

const SLOT_COLORS: Record<HymnSlotKey, { bg: string; border: string; label: string }> = {
  entrance:   { bg: "bg-purple-50",  border: "border-purple-200", label: "text-purple-700" },
  offertory1: { bg: "bg-amber-50",   border: "border-amber-200",  label: "text-amber-700" },
  offertory2: { bg: "bg-amber-50",   border: "border-amber-200",  label: "text-amber-700" },
  communion1: { bg: "bg-blue-50",    border: "border-blue-200",   label: "text-blue-700" },
  communion2: { bg: "bg-blue-50",    border: "border-blue-200",   label: "text-blue-700" },
  dismissal:  { bg: "bg-green-50",   border: "border-green-200",  label: "text-green-700" },
};

// ==================== Announcement Card ====================

interface AnnouncementCardProps {
  announcement: HymnAnnouncement;
}

function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const dateStr = announcement.date;
  const filledCount = HYMN_SLOT_ORDER.filter((k) => announcement.slots[k]?.title).length;
  const isComplete = filledCount === 6;

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden"
         style={{ border: "1px solid #DBEAFE" }}>
      {/* Date header — teal 그라디언트 */}
      <div className="px-5 py-4 border-b"
           style={{
             background: "linear-gradient(135deg, #E0F7FA 0%, #F0F9FF 100%)",
             borderColor: "#B2EBF2",
           }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
               style={{ backgroundColor: isComplete ? "#00ADB5" : "#0077B6" }}>
            {parseInt(dateStr.split("-")[2])}
          </div>
          <div>
            <p className="font-bold text-gray-800">{formatDateKo(dateStr)}</p>
            <p className="text-xs text-gray-500 mt-0.5">토요 미사 19:30</p>
          </div>
          <div className="ml-auto">
            <span className="text-xs font-bold px-3 py-1 rounded-full"
                  style={isComplete
                    ? { backgroundColor: "#E0F7FA", color: "#00ADB5" }
                    : { backgroundColor: "#FFF8E1", color: "#B45309" }}>
              {filledCount}/6 성가
            </span>
          </div>
        </div>
      </div>

      {/* Hymn slots */}
      <div className="p-4 space-y-2">
        {HYMN_SLOT_ORDER.map((key) => {
          const entry = announcement.slots[key];
          if (!entry?.title) return null;
          const color = SLOT_COLORS[key];
          return (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-xl ${color.bg} border ${color.border} px-4 py-3`}
            >
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-bold ${color.label}`}>
                  {HYMN_SLOT_LABELS[key]}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  {entry.number && (
                    <span className="text-sm font-bold text-gray-600">{entry.number}번</span>
                  )}
                  <span className="text-base font-bold text-gray-800">{entry.title}</span>
                </div>
                {entry.note && (
                  <p className="text-xs text-gray-500 mt-1">{entry.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== Inner Page ====================

function StudentHymnsInner() {
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get("month") ?? getCurrentMonth());
  const [year, mon] = month.split("-").map(Number);

  const [announcements, setAnnouncements] = useState<HymnAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const monthAnnouncements = await getHymnAnnouncementsByMonth(month);
      setAnnouncements(monthAnnouncements);
    } catch (e) {
      console.error("성가 안내 로드 실패:", e);
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F0F9FF" }}>
      {/* Header — 오션 블루 */}
      <header className="sticky top-0 z-20 shadow-sm" style={{ backgroundColor: "#0077B6" }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/student?month=${month}`}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-base font-bold text-white">성가 안내</span>
          </div>
          <span className="text-xs font-bold text-white bg-white/20 px-3 py-1 rounded-full border border-white/30">
            {year}.{String(mon).padStart(2, "0")}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Banner — 앰버 골드 포인트 */}
        <div className="rounded-3xl px-5 py-5 text-white shadow-lg"
             style={{ background: "linear-gradient(135deg, #0077B6 0%, #00ADB5 100%)" }}>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎶</span>
            <div>
              <p className="font-bold text-lg">{year}년 {mon}월 성가 안내</p>
              <p className="text-cyan-100 text-sm mt-0.5">병점 성당 중고등부 토요 미사</p>
            </div>
          </div>
        </div>

        {/* Month navigation */}
        <div className="bg-white rounded-2xl shadow-sm p-3 flex items-center justify-between"
             style={{ border: "1px solid #DBEAFE" }}>
          <button
            type="button"
            onClick={() => setMonth(getMonthBefore(month))}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
            style={{ color: "#0077B6" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F9FF")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-800">{formatMonthDisplay(month)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{announcements.length}개 미사 등록됨</p>
          </div>
          <button
            type="button"
            onClick={() => setMonth(getMonthAfter(month))}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
            style={{ color: "#0077B6" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F9FF")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #DBEAFE" }}>
          <p className="text-xs font-bold mb-3" style={{ color: "#0077B6" }}>성가 구분</p>
          <div className="grid grid-cols-3 gap-2">
            {HYMN_SLOT_ORDER.map((key) => {
              const color = SLOT_COLORS[key];
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${color.bg} border ${color.border} flex-shrink-0`} />
                  <span className={`text-xs font-semibold ${color.label}`}>
                    {HYMN_SLOT_LABELS[key].replace(" 성가", "")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 rounded-full animate-spin"
                 style={{ border: "3px solid #DBEAFE", borderTopColor: "#0077B6" }} />
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-12 text-center"
               style={{ border: "1px solid #DBEAFE" }}>
            <p className="text-5xl mb-4">🎵</p>
            <p className="text-gray-600 font-semibold">아직 등록된 성가가 없습니다</p>
            <p className="text-sm text-gray-400 mt-2">선생님이 성가를 등록하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
              />
            ))}
          </div>
        )}

        <div className="pb-20 text-center">
          <p className="text-xs text-gray-400">어망 (Fish-Net) · 병점 성당 중고등부</p>
        </div>
      </main>

      <GuideChatbot />
    </div>
  );
}

// ==================== Export ====================

export default function StudentHymnsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F0F9FF" }}>
          <div className="w-10 h-10 rounded-full animate-spin"
               style={{ border: "3px solid #DBEAFE", borderTopColor: "#0077B6" }} />
        </div>
      }
    >
      <StudentHymnsInner />
    </Suspense>
  );
}
