"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  getHymns,
  getHymnAnnouncementsByMonth,
  saveHymnAnnouncement,
  deleteHymnAnnouncement,
  getAllUsedHymnTitles,
  getAvailabilities,
  getStudents,
} from "@/lib/firestore";
import type { HymnAnnouncement, HymnSlotKey, HymnEntry, Hymn, Student, StudentAvailability } from "@/types";
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

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${weekdays[d.getDay()]}`;
}

function formatMonthDisplay(month: string): string {
  const [year, mon] = month.split("-");
  return `${year}년 ${parseInt(mon)}월`;
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

function getSaturdaysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const result: string[] = [];
  const d = new Date(y, m - 1, 1);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d.getMonth() === m - 1) {
    result.push(`${month}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 7);
  }
  return result;
}

// ==================== Slot color scheme ====================
// 테마 팔레트 (#222831 / #393E46 / #00ADB5 / #EEEEEE) 을 기반으로
// 각 슬롯이 시각적으로 명확히 구분되도록 accent 컬러만 차별화
const SLOT_COLORS: Record<HymnSlotKey, { bg: string; border: string; label: string; dot: string }> = {
  entrance:   { bg: "bg-[#00ADB5]/8",  border: "border-[#00ADB5]/40",  label: "text-[#00ADB5]",    dot: "bg-[#00ADB5]" },
  offertory1: { bg: "bg-amber-50",      border: "border-amber-300",      label: "text-amber-700",    dot: "bg-amber-400" },
  offertory2: { bg: "bg-amber-50",      border: "border-amber-200",      label: "text-amber-600",    dot: "bg-amber-300" },
  communion1: { bg: "bg-indigo-50",     border: "border-indigo-300",     label: "text-indigo-700",   dot: "bg-indigo-500" },
  communion2: { bg: "bg-indigo-50",     border: "border-indigo-200",     label: "text-indigo-600",   dot: "bg-indigo-400" },
  dismissal:  { bg: "bg-emerald-50",    border: "border-emerald-300",    label: "text-emerald-700",  dot: "bg-emerald-500" },
};

// ==================== Slot Editor ====================

interface SlotEditorProps {
  slotKey: HymnSlotKey;
  value: HymnEntry | undefined;
  onChange: (entry: HymnEntry | undefined) => void;
  hymnList: Hymn[];
  usedTitles: { title: string; slotKey: HymnSlotKey; date: string }[];
}

function SlotEditor({ slotKey, value, onChange, hymnList, usedTitles }: SlotEditorProps) {
  const color = SLOT_COLORS[slotKey];
  const label = HYMN_SLOT_LABELS[slotKey];
  const [numberInput, setNumberInput] = useState(value?.number ?? "");

  const matchedHymn = numberInput
    ? hymnList.find((h) => String(h.number) === numberInput.trim())
    : null;

  useEffect(() => {
    if (numberInput && hymnList.length > 0) {
      console.log(`[${slotKey}] 검색 번호:`, numberInput);
      console.log(`[${slotKey}] hymnList 개수:`, hymnList.length);
      console.log(`[${slotKey}] 매칭 결과:`, matchedHymn);
    }
  }, [numberInput, hymnList.length, matchedHymn, slotKey]);

  useEffect(() => {
    if (matchedHymn) {
      onChange({
        number: numberInput,
        title: matchedHymn.title,
        note: value?.note,
      });
    }
  }, [matchedHymn?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const duplicates = value?.title
    ? usedTitles.filter((u) => u.title.trim() === value.title.trim())
    : [];
  const isDuplicate = duplicates.length > 0;

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const num = e.target.value;
    setNumberInput(num);
    if (!num) onChange(undefined);
  }

  function handleClear() {
    setNumberInput("");
    onChange(undefined);
  }

  return (
    <div className={`rounded-xl border-2 ${color.border} ${color.bg} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${color.dot} flex-shrink-0`} />
          <span className={`text-sm font-bold ${color.label}`}>{label}</span>
        </div>
        {value?.title && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-[#393E46] hover:text-red-500 transition-colors font-medium"
          >
            초기화
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-3 items-center">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="번호"
              value={numberInput}
              onChange={handleNumberChange}
              className={`w-24 text-base font-bold border-2 ${color.border} rounded-lg px-3 py-2.5 bg-white
                          focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]
                          text-[#222831] placeholder:text-[#393E46]/30 placeholder:font-normal`}
            />
            {numberInput && !matchedHymn && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 text-xs">?</span>
            )}
          </div>
          <div className="flex-1">
            {matchedHymn ? (
              <p className="text-base font-semibold text-[#222831]">{matchedHymn.title}</p>
            ) : numberInput ? (
              <p className="text-sm text-red-400">번호를 찾을 수 없습니다</p>
            ) : (
              <p className="text-sm text-[#393E46]/50">번호를 입력하면 자동으로 곡명이 표시됩니다</p>
            )}
          </div>
        </div>

        <input
          type="text"
          placeholder="메모 (선택사항)"
          value={value?.note ?? ""}
          onChange={(e) =>
            onChange({ ...(value ?? { title: "" }), note: e.target.value || undefined })
          }
          className={`w-full text-sm border-2 ${color.border} rounded-lg px-3 py-2 bg-white
                      focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]
                      text-[#222831] placeholder:text-[#393E46]/30`}
        />

        {isDuplicate && value?.title && (
          <p className="text-xs text-amber-700 font-medium flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
            <span>⚠</span>
            <span>이전 사용: {duplicates.map((u) => `${formatDateKo(u.date)}`).join(", ")}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ==================== Hymn Date Card ====================

interface HymnDateCardProps {
  dateStr: string;
  announcement: HymnAnnouncement | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (dateStr: string, slots: Partial<Record<HymnSlotKey, HymnEntry>>) => Promise<void>;
  onDelete: (announcementId: string, dateStr: string) => Promise<void>;
  hymnList: Hymn[];
  usedTitles: { title: string; slotKey: HymnSlotKey; date: string }[];
  isSaving: boolean;
  onGenerateMessages: (dateStr: string, slots: Partial<Record<HymnSlotKey, HymnEntry>>) => void;
}

function HymnDateCard({
  dateStr,
  announcement,
  isExpanded,
  onToggle,
  onSave,
  onDelete,
  hymnList,
  usedTitles,
  isSaving,
  onGenerateMessages,
}: HymnDateCardProps) {
  const [slots, setSlots] = useState<Partial<Record<HymnSlotKey, HymnEntry>>>(
    announcement?.slots ?? {}
  );

  useEffect(() => {
    setSlots(announcement?.slots ?? {});
  }, [announcement]);

  const filledCount = HYMN_SLOT_ORDER.filter((k) => slots[k]?.title).length;
  const hasContent = filledCount > 0;
  const isComplete = filledCount === 6;

  function updateSlot(key: HymnSlotKey, entry: HymnEntry | undefined) {
    setSlots((prev) => {
      const next = { ...prev };
      if (!entry || !entry.title) {
        delete next[key];
      } else {
        next[key] = entry;
      }
      return next;
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#EEEEEE] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#EEEEEE]/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
            isComplete
              ? "bg-emerald-500"
              : hasContent
              ? "bg-[#00ADB5]"
              : "bg-[#EEEEEE] !text-[#393E46]"
          }`}>
            {parseInt(dateStr.split("-")[2])}
          </div>
          <div>
            <p className="font-semibold text-[#222831]">{formatDateKo(dateStr)}</p>
            {hasContent ? (
              <p className={`text-xs mt-0.5 font-medium ${isComplete ? "text-emerald-500" : "text-[#00ADB5]"}`}>
                {filledCount}/6 성가 입력됨 {isComplete && "✓"}
              </p>
            ) : (
              <p className="text-xs text-[#393E46]/50 mt-0.5">성가 미입력</p>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-[#393E46]/50 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="border-t border-[#EEEEEE] p-5 space-y-3">
          {HYMN_SLOT_ORDER.map((key) => (
            <SlotEditor
              key={key}
              slotKey={key}
              value={slots[key]}
              onChange={(entry) => updateSlot(key, entry)}
              hymnList={hymnList}
              usedTitles={usedTitles}
            />
          ))}

          <div className="flex flex-col gap-3 pt-3">
            <button
              type="button"
              onClick={() => onSave(dateStr, slots)}
              disabled={isSaving || !hasContent}
              className="w-full bg-[#00ADB5] hover:bg-[#009aa1] disabled:bg-[#EEEEEE] disabled:text-[#393E46]/40
                         text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  저장하기
                </>
              )}
            </button>

            {announcement && isComplete && (
              <button
                type="button"
                onClick={() => onGenerateMessages(dateStr, slots)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold
                           py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                참석자 메시지 생성
              </button>
            )}

            {announcement && (
              <button
                type="button"
                onClick={() => onDelete(announcement.id, dateStr)}
                disabled={isSaving}
                className="w-full py-3 text-sm text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                삭제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Add Date Modal ====================

interface AddDateModalProps {
  month: string;
  existingDates: Set<string>;
  onAdd: (dateStr: string) => void;
  onClose: () => void;
}

function AddDateModal({ month, existingDates, onAdd, onClose }: AddDateModalProps) {
  const saturdays = getSaturdaysInMonth(month);
  const [selected, setSelected] = useState<string>("");
  const [custom, setCustom] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);

  const value = useCustom ? custom : selected;
  const alreadyAdded = value ? existingDates.has(value) : false;

  function handleConfirm() {
    if (!value || alreadyAdded) return;
    onAdd(value);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-[#222831]/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-[#EEEEEE]">
        <div className="px-5 pt-5 pb-3 border-b border-[#EEEEEE]">
          <h3 className="font-bold text-[#222831] text-lg">날짜 추가</h3>
          <p className="text-sm text-[#393E46] mt-1">{formatMonthDisplay(month)}</p>
        </div>

        <div className="p-5 space-y-4">
          {saturdays.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[#393E46] mb-2">토요일 선택</p>
              <div className="flex flex-wrap gap-2">
                {saturdays.map((sat) => (
                  <button
                    key={sat}
                    type="button"
                    onClick={() => { setSelected(sat); setUseCustom(false); }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      !useCustom && selected === sat
                        ? "bg-[#00ADB5] text-white shadow-md"
                        : existingDates.has(sat)
                        ? "bg-[#EEEEEE] text-[#393E46]/40 line-through cursor-not-allowed"
                        : "bg-[#EEEEEE] text-[#393E46] hover:bg-[#00ADB5]/10 hover:text-[#00ADB5]"
                    }`}
                    disabled={existingDates.has(sat)}
                  >
                    {formatDateKo(sat)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-[#393E46] mb-2">직접 입력</p>
            <input
              type="date"
              value={useCustom ? custom : ""}
              min={`${month}-01`}
              max={`${month}-31`}
              onChange={(e) => { setCustom(e.target.value); setUseCustom(true); setSelected(""); }}
              className="w-full text-base border-2 border-[#EEEEEE] rounded-xl px-4 py-3 text-[#222831]
                         focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
            />
          </div>

          {alreadyAdded && (
            <p className="text-sm text-amber-600 font-medium">이미 추가된 날짜입니다.</p>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border-2 border-[#EEEEEE] text-[#393E46]
                       hover:bg-[#EEEEEE]/40 transition-colors font-semibold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!value || alreadyAdded}
            className="flex-1 py-3 rounded-xl bg-[#00ADB5] hover:bg-[#009aa1]
                       disabled:bg-[#EEEEEE] disabled:text-[#393E46]/40
                       text-white font-semibold transition-colors"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Message Modal ====================

interface MessageModalProps {
  dateStr: string;
  slots: Partial<Record<HymnSlotKey, HymnEntry>>;
  students: Student[];
  availabilities: StudentAvailability[];
  onClose: () => void;
}

function MessageModal({ dateStr, slots, students, availabilities, onClose }: MessageModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [additionalNote, setAdditionalNote] = useState(
    "미사 전 연습 시간: 오후 6시 00분 (장소: 소리교리실)\n미사 후에는 짧게 교사-학생 간담회가 있을 예정이니 참고해줘.\n우리의 찬양이 주님께 기쁘게 닿을 수 있도록 마음 모아 준비하자."
  );

  const attendingStudents = students.filter((student) => {
    const avail = availabilities.find((a) => a.studentId === student.id);
    return avail?.status === "available";
  });

  function generateMessage(): string {
    const hymnLines = HYMN_SLOT_ORDER
      .map((key) => {
        const entry = slots[key];
        if (!entry?.title) return null;
        const slotName = HYMN_SLOT_LABELS[key].replace(" 성가", "").replace(" ", "");
        return `${slotName}: ${entry.number ? `${entry.number}번` : ""} (${entry.title})`;
      })
      .filter(Boolean)
      .join("\n\n");

    return `이번 주 미사 성가 안내야! 🐟\n\n[${formatDateFull(dateStr)}]\n\n${hymnLines}\n\n[추가 안내사항]\n\n${additionalNote}\n\n준비해줘 :)`;
  }

  const message = generateMessage();

  async function handleCopy(index: number) {
    await navigator.clipboard.writeText(message);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  async function handleCopyAll() {
    await navigator.clipboard.writeText(message);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="fixed inset-0 bg-[#222831]/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto border border-[#EEEEEE]">
        <div className="px-5 pt-5 pb-4 border-b border-[#EEEEEE] sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#222831] text-lg">성가 안내 메시지</h3>
              <p className="text-sm text-[#393E46] mt-1">
                {formatDateKo(dateStr)} · 참석자 {attendingStudents.length}명
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-[#EEEEEE] flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5 text-[#393E46]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#222831] mb-2">추가 안내사항</label>
            <textarea
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              rows={3}
              className="w-full border-2 border-[#EEEEEE] rounded-xl px-4 py-3 text-sm text-[#222831]
                         focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5] resize-none"
            />
          </div>

          <div className="bg-[#EEEEEE]/30 rounded-xl p-4 border border-[#EEEEEE]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#222831]">메시지 미리보기</span>
              <button
                type="button"
                onClick={handleCopyAll}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  copiedIndex === -1
                    ? "bg-emerald-500 text-white"
                    : "bg-[#00ADB5] hover:bg-[#009aa1] text-white"
                }`}
              >
                {copiedIndex === -1 ? "복사됨 ✓" : "메시지 복사"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-[#393E46] font-sans leading-relaxed">
              {message}
            </pre>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#222831] mb-3">
              참석 예정 학생 ({attendingStudents.length}명)
            </p>
            {attendingStudents.length === 0 ? (
              <p className="text-sm text-[#393E46]/50 text-center py-4">참석 응답한 학생이 없습니다</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attendingStudents.map((student, idx) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between bg-white border border-[#EEEEEE] rounded-xl px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-[#222831]">{student.name}</p>
                      <p className="text-xs text-[#393E46]/60">
                        {student.baptismalName && `${student.baptismalName} · `}
                        {student.grade}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        copiedIndex === idx
                          ? "bg-emerald-500 text-white"
                          : "bg-[#EEEEEE] hover:bg-[#00ADB5]/10 text-[#393E46] hover:text-[#00ADB5]"
                      }`}
                    >
                      {copiedIndex === idx ? "복사됨" : "복사"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-xl border-2 border-[#EEEEEE] text-[#393E46]
                       hover:bg-[#EEEEEE]/40 transition-colors font-semibold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Main Page ====================

export default function TeacherHymnsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());

  const [registeredDates, setRegisteredDates] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<HymnAnnouncement[]>([]);
  const [hymnList, setHymnList] = useState<Hymn[]>([]);
  const [usedTitles, setUsedTitles] = useState<
    { title: string; slotKey: HymnSlotKey; date: string }[]
  >([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [availabilities, setAvailabilities] = useState<StudentAvailability[]>([]);

  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [messageModal, setMessageModal] = useState<{
    dateStr: string;
    slots: Partial<Record<HymnSlotKey, HymnEntry>>;
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [monthAnnouncements, allUsed, hymns, studentsData, availData] = await Promise.all([
        getHymnAnnouncementsByMonth(month),
        getAllUsedHymnTitles(),
        getHymns(),
        getStudents(),
        getAvailabilities(),
      ]);

      const announcedDates = monthAnnouncements.map((a) => a.date).sort();

      setRegisteredDates((prev) => {
        const merged = Array.from(new Set([...announcedDates, ...prev])).sort();
        return merged;
      });

      setAnnouncements(monthAnnouncements);
      setUsedTitles(allUsed);
      setHymnList(hymns);
      setStudents(studentsData);
      setAvailabilities(availData);

      console.log("=== 성가 데이터 로드 완료 ===");
      console.log("총 성가 개수:", hymns.length);
    } catch (e) {
      console.error("데이터 로드 실패:", e);
      showToast("데이터 로드에 실패했습니다", "error");
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    setRegisteredDates([]);
    loadData();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddDate(dateStr: string) {
    setRegisteredDates((prev) => Array.from(new Set([...prev, dateStr])).sort());
    setExpandedDate(dateStr);
  }

  function handleRemoveUnregisteredDate(dateStr: string) {
    const hasAnnouncement = announcements.some((a) => a.date === dateStr);
    if (hasAnnouncement) return;
    setRegisteredDates((prev) => prev.filter((d) => d !== dateStr));
  }

  async function handleSave(dateStr: string, slots: Partial<Record<HymnSlotKey, HymnEntry>>) {
    setSavingDate(dateStr);
    try {
      console.log("=== 저장 시도 ===", dateStr, JSON.stringify(slots, null, 2));
      await saveHymnAnnouncement(dateStr, slots, user?.uid ?? "teacher");
      showToast("성가 안내가 저장되었습니다");
      await loadData();
    } catch (e: any) {
      console.error("=== 저장 실패 ===", e);
      showToast(`저장 실패: ${e?.message || "알 수 없는 오류"}`, "error");
    } finally {
      setSavingDate(null);
    }
  }

  async function handleDelete(announcementId: string, dateStr: string) {
    if (!confirm("이 성가 안내를 삭제하시겠습니까?")) return;
    try {
      await deleteHymnAnnouncement(announcementId);
      setRegisteredDates((prev) => prev.filter((d) => d !== dateStr));
      showToast("삭제되었습니다");
      await loadData();
    } catch (e) {
      console.error("삭제 실패:", e);
      showToast("삭제에 실패했습니다", "error");
    }
  }

  function handleGenerateMessages(dateStr: string, slots: Partial<Record<HymnSlotKey, HymnEntry>>) {
    setMessageModal({ dateStr, slots });
  }

  function getAnnouncementForDate(dateStr: string): HymnAnnouncement | undefined {
    return announcements.find((a) => a.date === dateStr);
  }

  const existingDatesSet = new Set(registeredDates);
  const filledCount = announcements.filter(
    (a) => Object.values(a.slots).some((s) => s?.title)
  ).length;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <header className="bg-[#222831] sticky top-0 z-20 shadow-md">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher"
              className="text-[#EEEEEE]/60 hover:text-[#EEEEEE] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="text-base font-bold text-[#EEEEEE]">성가 안내 관리</span>
          </div>
          <span className="bg-[#00ADB5]/20 text-[#00ADB5] border border-[#00ADB5]/30 text-xs font-bold px-3 py-1 rounded-full">
            교사
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* ── Month navigation ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#EEEEEE] p-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(getMonthBefore(month))}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#EEEEEE] transition-colors text-[#393E46]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="font-bold text-[#222831] text-lg">{formatMonthDisplay(month)}</p>
            <p className="text-sm text-[#393E46] mt-0.5">
              {registeredDates.length}개 미사 ·{" "}
              <span className={filledCount > 0 ? "text-[#00ADB5] font-medium" : ""}>
                {filledCount}개 성가 입력됨
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMonth(getMonthAfter(month))}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#EEEEEE] transition-colors text-[#393E46]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ── Usage guide ── */}
        <div className="bg-[#00ADB5]/8 rounded-2xl border border-[#00ADB5]/25 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-4 rounded-full bg-[#00ADB5] flex-shrink-0" />
            <p className="text-sm text-[#222831] font-bold">사용 방법</p>
          </div>
          <p className="text-sm text-[#393E46] leading-relaxed pl-3">
            <strong className="text-[#222831]">1.</strong> "미사 날짜 추가" 버튼으로 날짜 등록<br/>
            <strong className="text-[#222831]">2.</strong> 각 슬롯에 <strong className="text-[#222831]">번호만 입력</strong>하면 야훼이레 성가집에서 곡명 자동 표시<br/>
            <strong className="text-[#222831]">3.</strong> 저장 후 "참석자 메시지 생성"으로 안내 메시지 일괄 복사
          </p>
          {hymnList.length > 0 ? (
            <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1 pl-3">
              ✓ 야훼이레 성가집 {hymnList.length}곡 로드 완료
            </p>
          ) : (
            <p className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1 pl-3">
              ⏳ 성가 목록 로딩 중...
            </p>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-3 border-[#EEEEEE] border-t-[#00ADB5] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Date cards */}
            {registeredDates.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-[#EEEEEE] p-12 text-center">
                <p className="text-5xl mb-4">🎵</p>
                <p className="text-[#222831] font-semibold text-lg">등록된 미사가 없습니다</p>
                <p className="text-sm text-[#393E46]/60 mt-2">아래 버튼을 눌러 날짜를 추가하세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {registeredDates.map((dateStr) => {
                  const ann = getAnnouncementForDate(dateStr);
                  return (
                    <div key={dateStr} className="relative group">
                      <HymnDateCard
                        dateStr={dateStr}
                        announcement={ann}
                        isExpanded={expandedDate === dateStr}
                        onToggle={() =>
                          setExpandedDate((prev) => (prev === dateStr ? null : dateStr))
                        }
                        onSave={handleSave}
                        onDelete={handleDelete}
                        hymnList={hymnList}
                        usedTitles={usedTitles.filter((u) => u.date !== dateStr)}
                        isSaving={savingDate === dateStr}
                        onGenerateMessages={handleGenerateMessages}
                      />
                      {!ann && expandedDate !== dateStr && (
                        <button
                          type="button"
                          onClick={() => handleRemoveUnregisteredDate(dateStr)}
                          className="absolute top-3 right-14 text-[#EEEEEE] hover:text-red-400
                                     opacity-0 group-hover:opacity-100 transition-all"
                          title="날짜 제거"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add date button */}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-[#00ADB5]/40
                         text-[#00ADB5] hover:border-[#00ADB5] hover:bg-[#00ADB5]/5
                         transition-all font-bold flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              미사 날짜 추가
            </button>

            {/* History section */}
            {usedTitles.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-[#EEEEEE] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#EEEEEE] flex items-center gap-3">
                  <span className="w-1 h-5 rounded-full bg-[#00ADB5] inline-block flex-shrink-0" />
                  <div>
                    <h2 className="font-bold text-[#222831]">최근 사용 이력</h2>
                    <p className="text-xs text-[#393E46]/60 mt-0.5">중복 선곡 방지 참고</p>
                  </div>
                </div>
                <div className="divide-y divide-[#EEEEEE] max-h-64 overflow-y-auto">
                  {[...usedTitles]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 30)
                    .map((item, idx) => (
                      <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-[#EEEEEE]/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#222831]">{item.title}</span>
                          <span className="text-xs text-[#393E46] bg-[#EEEEEE] px-2 py-0.5 rounded">
                            {HYMN_SLOT_LABELS[item.slotKey]}
                          </span>
                        </div>
                        <span className="text-xs text-[#393E46]/60 whitespace-nowrap">
                          {formatDateKo(item.date)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="pb-8 text-center">
          <p className="text-xs text-[#EEEEEE]/50">어망 (Fish-Net) · 병점 성당 중고등부</p>
        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddDateModal
          month={month}
          existingDates={existingDatesSet}
          onAdd={handleAddDate}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {messageModal && (
        <MessageModal
          dateStr={messageModal.dateStr}
          slots={messageModal.slots}
          students={students}
          availabilities={availabilities}
          onClose={() => setMessageModal(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-lg
                      text-white text-sm font-semibold z-50 ${
            toast.type === "success" ? "bg-[#222831]" : "bg-red-500"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
