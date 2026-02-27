"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { signOutUser } from "@/lib/auth";
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
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

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

// SMS 전송 상태: idle | sending | sent | error
type SmsStatus = "idle" | "sending" | "sent" | "error";

interface SmsSendModal {
  isOpen: boolean;
  messageIndex: number | null; // messages 배열의 인덱스
  phone: string;
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
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// "2026-02-28" → "2월 28일(토)"
function formatDateKo(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${weekdays[d.getDay()]})`;
}

// 영문 roleId → 화면 표시 한글명 (저장 시 역탐색의 기준이 되므로 영문 키만 정의)
const ROLE_NAMES: Record<string, string> = {
  reading1: "1독서",
  reading2: "2독서",
  accompaniment: "반주",
  prayer1: "보편지향기도1",
  prayer2: "보편지향기도2",
};

// 한글 역할명 → 영문 roleId 역방향 맵 (저장 시 사용)
const ROLE_LABEL_TO_ID: Record<string, RoleType> = {
  "1독서": "reading1",
  "2독서": "reading2",
  "반주": "accompaniment",
  "보편지향기도1": "prayer1",
  "보편지향기도2": "prayer2",
};

function getRoleName(role: string): string {
  // 영문 roleId가 오면 한글로, 이미 한글이면 그대로
  return ROLE_NAMES[role] ?? role;
}

// ==================== Sub-components ====================

// ── Design Tokens ──
// #222831 = darkest navy  → var text, header bg
// #393E46 = dark gray     → subtext, secondary elements
// #00ADB5 = teal accent   → primary CTA, badges, focus rings
// #EEEEEE = light gray    → card bg tint, table header, dividers
// #FFFFFF = white         → page background, card surface

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
    <div className={`bg-white rounded-2xl shadow-sm border border-[#EEEEEE] ${className}`}>
      <div className="px-6 py-4 border-b border-[#EEEEEE] flex items-center gap-3">
        <span className="w-1 h-5 rounded-full bg-[#00ADB5] inline-block flex-shrink-0" />
        <h2 className="text-lg font-bold text-[#222831]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className={`${sizeClass} border-2 border-[#EEEEEE] border-t-[#00ADB5] rounded-full animate-spin`} />
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
  const router = useRouter();
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [students, setStudents] = useState<Student[]>([]);
  const [massDates, setMassDates] = useState<MassDate[]>([]);
  const [availabilities, setAvailabilities] = useState<StudentAvailability[]>([]);

  const [assignments, setAssignments] = useState<MonthlyAssignment[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editableAssignments, setEditableAssignments] = useState<AssignmentEdit[]>([]);

  const [messages, setMessages] = useState<MessageCard[]>([]);
  const [smsStatuses, setSmsStatuses] = useState<SmsStatus[]>([]);
  const [smsModal, setSmsModal] = useState<SmsSendModal>({ isOpen: false, messageIndex: null, phone: "" });

  const [selectedDate, setSelectedDate] = useState("");
  const [absentStudent, setAbsentStudent] = useState("");
  const [backupCandidates, setBackupCandidates] = useState<
    { name: string; role: string; type: string }[]
  >([]);
  const [substituteMessage, setSubstituteMessage] = useState("");
  // 대타 SMS 모달: 후보 이름과 메시지를 들고 전화번호 입력받음
  const [substituteSmsModal, setSubstituteSmsModal] = useState<{
    isOpen: boolean;
    candidateName: string;
    message: string;
    phone: string;
    status: SmsStatus;
  }>({ isOpen: false, candidateName: "", message: "", phone: "", status: "idle" });

  const [emergencyAbsences, setEmergencyAbsences] = useState<
    { studentName: string; date: string; role: string; reason: string; reportedAt: Date }[]
  >([]);

  // 교사가 수동으로 X 표시한 항목: "날짜-역할-학생명" 형식의 키 Set
  const [markedAbsent, setMarkedAbsent] = useState<Set<string>>(new Set());

  // 닫은 긴급 알림 ID Set (dismissed)
  const [dismissedAbsences, setDismissedAbsences] = useState<Set<string>>(new Set());

  const dismissAbsence = (key: string) => {
    setDismissedAbsences((prev) => new Set(prev).add(key));
  };

  const dismissAllAbsences = () => {
    const allKeys = emergencyAbsences.map((a) => `${a.date}-${a.role}-${a.studentName}`);
    setDismissedAbsences(new Set(allKeys));
  };

  const visibleAbsences = emergencyAbsences.filter(
    (a) => !dismissedAbsences.has(`${a.date}-${a.role}-${a.studentName}`)
  );

  const toggleAbsent = (date: string, role: string, studentName: string) => {
    const key = `${date}-${role}-${studentName}`;
    setMarkedAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isMarkedAbsent = (date: string, role: string, studentName: string) => {
    return markedAbsent.has(`${date}-${role}-${studentName}`);
  };

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOutUser();
    router.replace("/login");
  };

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

  // ── Real-time Emergency Absence Listener ──
  useEffect(() => {
    if (massDates.length === 0) return;

    const massDateIds = massDates.map((m) => m.id);
    
    const q = query(
      collection(firestore, "assignments"),
      where("status", "==", "absent")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const absences: typeof emergencyAbsences = [];
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        
        if (!massDateIds.includes(data.massDateId)) return;
        
        const massDate = massDates.find((m) => m.id === data.massDateId);
        if (!massDate) return;
        
        const student = students.find((s) => s.id === data.studentId);
        if (!student) return;

        const roleLabel = getRoleName(data.role);

        absences.push({
          studentName: student.baptismalName 
            ? `${student.name} (${student.baptismalName})` 
            : student.name,
          date: massDate.date.toISOString().slice(0, 10),
          role: roleLabel,
          reason: data.absentReason || "사유 없음",
          reportedAt: data.absentReportedAt?.toDate() || new Date(),
        });
      });

      absences.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
      setEmergencyAbsences(absences);
    });

    return () => unsubscribe();
  }, [massDates, students]);

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

      // ── 반주 역할 검증: canPlayInstrument가 false인 학생 제거 ──
      // 고유 식별자로 반주 가능 학생 Set 생성
      // 세례명이 있으면 "이름 (세례명)", 없으면 "이름 (학년)"
      const accompanistUniqueIds = new Set(
        students.filter((s) => s.canPlayInstrument).map((s) =>
          s.baptismalName ? `${s.name} (${s.baptismalName})` : (s.grade ? `${s.name} (${s.grade})` : s.name)
        )
      );

      const validatedAssignments = result.assignments.map((a) => {
        const isAccompaniment = a.role === "반주" || a.role === "accompaniment";
        if (!isAccompaniment) return a;

        // 반주 역할인 경우: canPlayInstrument가 true인 학생만 유지
        return {
          ...a,
          primary: accompanistUniqueIds.has(a.primary) ? a.primary : "",
          backup1: accompanistUniqueIds.has(a.backup1) ? a.backup1 : "",
          backup2: accompanistUniqueIds.has(a.backup2) ? a.backup2 : "",
        };
      });

      // 빈 반주 슬롯이 있으면 경고 추가
      const emptyAccompanimentSlots = validatedAssignments.filter(
        (a) =>
          (a.role === "반주" || a.role === "accompaniment") &&
          (!a.primary || !a.backup1 || !a.backup2)
      );
      const newWarnings = [...result.warnings];
      if (emptyAccompanimentSlots.length > 0) {
        newWarnings.push(
          "일부 반주 배정이 비어있습니다. 반주 가능 학생이 부족하여 수동 배정이 필요합니다."
        );
      }

      setAssignments(validatedAssignments);
      setWarnings(newWarnings);

      const editableData = validatedAssignments.map((a) => ({
        date: a.date,
        role: a.role,
        primary: a.primary,
        backup1: a.backup1,
        backup2: a.backup2,
      }));
      setEditableAssignments(editableData);

      // ── AI 배정 후 자동 저장 ──
      const dateToMassDateId = new Map(
        massDates.map((m) => [m.date.toISOString().slice(0, 10), m.id])
      );
      // 고유 식별자를 키로 사용하여 동일 이름 학생 구분
      // 세례명이 있으면 "이름 (세례명)", 없으면 "이름 (학년)"
      const studentUniqueIdToId = new Map(
        students.map((s) => [
          s.baptismalName ? `${s.name} (${s.baptismalName})` : (s.grade ? `${s.name} (${s.grade})` : s.name),
          s.id
        ])
      );

      const grouped = new Map<string, typeof editableData>();
      for (const a of editableData) {
        const mdId = dateToMassDateId.get(a.date);
        if (mdId) {
          if (!grouped.has(mdId)) grouped.set(mdId, []);
          grouped.get(mdId)!.push(a);
        }
      }

      for (const [massDateId, assigns] of grouped) {
        const toSave: {
          studentId: string;
          role: RoleType;
          isPrimary: boolean;
          backupOrder?: number;
        }[] = [];

        for (const a of assigns) {
          const roleId: RoleType | undefined =
            ROLE_LABEL_TO_ID[a.role] ??
            (Object.keys(ROLE_NAMES).includes(a.role) ? (a.role as RoleType) : undefined);

          if (!roleId) continue;

          if (a.primary) {
            const sid = studentUniqueIdToId.get(a.primary);
            if (sid) toSave.push({ studentId: sid, role: roleId, isPrimary: true });
          }
          if (a.backup1) {
            const sid = studentUniqueIdToId.get(a.backup1);
            if (sid) toSave.push({ studentId: sid, role: roleId, isPrimary: false, backupOrder: 1 });
          }
          if (a.backup2) {
            const sid = studentUniqueIdToId.get(a.backup2);
            if (sid) toSave.push({ studentId: sid, role: roleId, isPrimary: false, backupOrder: 2 });
          }
        }

        await saveAssignments(massDateId, toSave);
      }

      console.log("[AI 배정] 자동 저장 완료");
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

      // 학생 ID → 고유 식별자 매핑
      // 세례명이 있으면 "이름 (세례명)", 없으면 "이름 (학년)"
      const studentIdToUniqueId = new Map(
        students.map((s) => [
          s.id,
          s.baptismalName ? `${s.name} (${s.baptismalName})` : (s.grade ? `${s.name} (${s.grade})` : s.name)
        ])
      );

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
          const studentUniqueId = studentIdToUniqueId.get(a.studentId) || "";

          if (a.isPrimary) {
            group.primary = studentUniqueId;
          } else if (a.backupOrder === 1) {
            group.backup1 = studentUniqueId;
          } else if (a.backupOrder === 2) {
            group.backup2 = studentUniqueId;
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

  /** 기본 양식 메시지 (AI 없이 즉시 생성) */
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
          message: `[중고등부 토요일 특전 미사 배정 안내]\n\n${a.primary}님, 안녕하세요 🙏\n${formatDateKo(a.date)} 미사 역할 안내드립니다.\n\n담당 역할: ${getRoleName(a.role)}\n백업 1순위: ${a.backup1 || "-"}\n백업 2순위: ${a.backup2 || "-"}\n\n참석이 어렵다면 미리 연락 주세요. 감사합니다!`,
        });
      }
    }

    setMessages(generated);
    setSmsStatuses(generated.map(() => "idle"));
    setIsGeneratingMessages(false);
  };

  /**
   * AI 개인화 메시지 생성
   * students 목록에서 학생의 특성(학년, 성별, 신입 여부)을 참조하여
   * Claude API로 각 학생 맞춤 메시지를 생성
   */
  const [isGeneratingAiMessages, setIsGeneratingAiMessages] = useState(false);
  const [aiGenerationProgress, setAiGenerationProgress] = useState<{ current: number; total: number } | null>(null);

  const handleGenerateAiMessages = async () => {
    if (assignments.length === 0) {
      alert("배정 결과가 없습니다. 먼저 AI 배정을 실행해주세요.");
      return;
    }

    setIsGeneratingAiMessages(true);

    // primary 배정만 필터
    const primaryAssignments = assignments.filter((a) => a.primary);
    setAiGenerationProgress({ current: 0, total: primaryAssignments.length });

    // 학생 이름 → Student 객체 매핑 (이름 또는 "이름 (세례명)" 형식 모두 처리)
    const studentMap = new Map<string, Student>();
    for (const s of students) {
      const key1 = s.baptismalName
        ? `${s.name} (${s.baptismalName})`
        : s.grade
        ? `${s.name} (${s.grade})`
        : s.name;
      studentMap.set(key1, s);
      studentMap.set(s.name, s); // 이름만으로도 fallback 탐색
    }

    const generated: MessageCard[] = [];

    for (let idx = 0; idx < primaryAssignments.length; idx++) {
      const a = primaryAssignments[idx];
      const student = studentMap.get(a.primary) || null;

      try {
        const res = await fetch("/api/message/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: a.primary,
            baptismalName: student?.baptismalName,
            grade: student?.grade,
            gender: student?.gender,
            isNewMember: student?.isNewMember,
            role: getRoleName(a.role),
            date: a.date,
            backup1: a.backup1 || undefined,
            backup2: a.backup2 || undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        generated.push({
          studentName: a.primary,
          role: getRoleName(a.role),
          date: a.date,
          message: data.success
            ? data.message
            : `[중고등부 토요일 특전 미사 배정 안내]\n\n${a.primary}님, 안녕하세요 🙏\n${formatDateKo(a.date)} 미사 역할 안내드립니다.\n\n담당 역할: ${getRoleName(a.role)}\n백업 1순위: ${a.backup1 || "-"}\n백업 2순위: ${a.backup2 || "-"}\n\n참석이 어렵다면 미리 연락 주세요. 감사합니다!`,
        });
      } catch {
        // AI 실패 시 기본 양식으로 fallback
        generated.push({
          studentName: a.primary,
          role: getRoleName(a.role),
          date: a.date,
          message: `[중고등부 토요일 특전 미사 배정 안내]\n\n${a.primary}님, 안녕하세요 🙏\n${formatDateKo(a.date)} 미사 역할 안내드립니다.\n\n담당 역할: ${getRoleName(a.role)}\n백업 1순위: ${a.backup1 || "-"}\n백업 2순위: ${a.backup2 || "-"}\n\n참석이 어렵다면 미리 연락 주세요. 감사합니다!`,
        });
      }

      setAiGenerationProgress({ current: idx + 1, total: primaryAssignments.length });
    }

    setMessages(generated);
    setSmsStatuses(generated.map(() => "idle"));
    setIsGeneratingAiMessages(false);
    setAiGenerationProgress(null);
  };

  const copyMessage = async (msg: string) => {
    await navigator.clipboard.writeText(msg);
    alert("메시지가 클립보드에 복사되었습니다!");
  };

  const openSmsModal = (index: number) => {
    setSmsModal({ isOpen: true, messageIndex: index, phone: "" });
  };

  const closeSmsModal = () => {
    setSmsModal({ isOpen: false, messageIndex: null, phone: "" });
  };

  const handleSmsSend = async () => {
    const { messageIndex, phone } = smsModal;
    if (messageIndex === null || !phone.trim()) return;

    const m = messages[messageIndex];
    closeSmsModal();

    setSmsStatuses((prev) => {
      const next = [...prev];
      next[messageIndex] = "sending";
      return next;
    });

    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone.trim(),
          text: m.message,
          studentName: m.studentName,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "전송 실패");
      }

      setSmsStatuses((prev) => {
        const next = [...prev];
        next[messageIndex] = "sent";
        return next;
      });
    } catch (err) {
      console.error("SMS 전송 오류:", err);
      setSmsStatuses((prev) => {
        const next = [...prev];
        next[messageIndex] = "error";
        return next;
      });
    }
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

  const openSubstituteSmsModal = (candidateName: string) => {
    // 후보 이름에 맞게 메시지 생성 (substituteMessage 기반으로 이름만 교체)
    const absent = assignments.find(
      (a) => a.date === selectedDate && a.primary === absentStudent
    );
    const msg = absent
      ? `[긴급 대타 요청]\n\n안녕하세요, ${candidateName}님!\n${formatDateShort(selectedDate)} 주일 미사 "${getRoleName(absent.role)}" 역할의 정배정 학생(${absentStudent})이 불참하게 되어 대타를 요청드립니다.\n\n가능 여부를 알려주세요!`
      : substituteMessage;

    // 해당 학생의 전화번호 자동 완성
    const studentObj = students.find((s) => s.name === candidateName);
    setSubstituteSmsModal({
      isOpen: true,
      candidateName,
      message: msg,
      phone: studentObj?.phone ?? "",
      status: "idle",
    });
  };

  const handleSubstituteSmssend = async () => {
    const { candidateName, message, phone } = substituteSmsModal;
    if (!phone.trim()) return;

    setSubstituteSmsModal((prev) => ({ ...prev, status: "sending" }));

    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone.trim(), text: message, studentName: candidateName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "전송 실패");
      setSubstituteSmsModal((prev) => ({ ...prev, status: "sent" }));
    } catch (err) {
      console.error("대타 SMS 전송 오류:", err);
      setSubstituteSmsModal((prev) => ({ ...prev, status: "error" }));
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

      // 고유 식별자를 키로 사용하여 동일 이름 학생 구분
      // 세례명이 있으면 "이름 (세례명)", 없으면 "이름 (학년)"
      const studentUniqueIdToId = new Map(
        students.map((s) => [
          s.baptismalName ? `${s.name} (${s.baptismalName})` : (s.grade ? `${s.name} (${s.grade})` : s.name),
          s.id
        ])
      );

      for (const [massDateId, assigns] of grouped) {
        const toSave: {
          studentId: string;
          role: RoleType;
          isPrimary: boolean;
          backupOrder?: number;
        }[] = [];

        for (const a of assigns) {
          // 한글 역할명 → 영문 roleId 변환 (ROLE_NAMES의 영문 키도 그대로 허용)
          const roleId: RoleType | undefined =
            ROLE_LABEL_TO_ID[a.role] ??
            (Object.keys(ROLE_NAMES).includes(a.role) ? (a.role as RoleType) : undefined);

          if (!roleId) continue;

          if (a.primary) {
            const sid = studentUniqueIdToId.get(a.primary);
            if (sid) toSave.push({ studentId: sid, role: roleId, isPrimary: true });
          }
          if (a.backup1) {
            const sid = studentUniqueIdToId.get(a.backup1);
            if (sid)
              toSave.push({ studentId: sid, role: roleId, isPrimary: false, backupOrder: 1 });
          }
          if (a.backup2) {
            const sid = studentUniqueIdToId.get(a.backup2);
            if (sid)
              toSave.push({ studentId: sid, role: roleId, isPrimary: false, backupOrder: 2 });
          }
        }

        console.log(`[saveAssignments] massDateId: ${massDateId}, toSave:`, toSave);
        await saveAssignments(massDateId, toSave);
      }

      console.log("[saveAssignments] 저장 완료");
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-3 text-[#393E46] text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ── Main Render ──
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#222831] sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xl font-bold text-[#00ADB5] hover:text-[#00c4cd] transition-colors"
            >
              어망
            </Link>
            <span className="text-[#393E46]">|</span>
            <span className="text-[#EEEEEE] font-medium text-sm">교사 대시보드</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/teacher/responses"
              className="text-xs bg-[#393E46] text-[#00ADB5] hover:bg-[#00ADB5] hover:text-white
                         px-3 py-1.5 rounded-full font-medium transition-colors"
            >
              학생 응답 현황 →
            </Link>
            <Link
              href={`/teacher/hymns`}
              className="text-xs bg-[#393E46] text-[#EEEEEE] hover:bg-[#00ADB5] hover:text-white
                         px-3 py-1.5 rounded-full font-medium transition-colors"
            >
              🎵 성가 안내 →
            </Link>
            <span className="text-xs text-[#393E46] hidden sm:inline">학생 {students.length}명</span>
            <span className="text-xs text-[#393E46] hidden sm:inline">|</span>
            <span className="text-xs text-[#393E46] hidden sm:inline">
              {month} 응답 {availabilities.length}건
            </span>
            <span className="text-[#393E46] hidden sm:inline">|</span>
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ""}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-[#00ADB5]"
              />
            )}
            <span className="text-xs text-[#EEEEEE] hidden sm:inline">
              {user?.displayName ?? user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-xs bg-[#393E46] hover:bg-[#00ADB5] text-[#EEEEEE] hover:text-white
                         px-3 py-1.5 rounded-full font-medium transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 긴급 불참 알림 배너 */}
        {visibleAbsences.length > 0 && (
          <div className="bg-red-500 border-2 border-red-600 rounded-2xl p-5 shadow-lg animate-pulse">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🚨</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">
                    긴급 불참 발생! ({visibleAbsences.length}건)
                  </h3>
                  <button
                    onClick={dismissAllAbsences}
                    className="text-xs bg-red-400 hover:bg-red-300 text-white
                               px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0"
                  >
                    전체 닫기
                  </button>
                </div>
                <div className="space-y-2">
                  {visibleAbsences.map((absence, i) => {
                    const key = `${absence.date}-${absence.role}-${absence.studentName}`;
                    return (
                      <div key={i} className="bg-red-600 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">
                              {absence.studentName} · {formatDateKo(absence.date)} · {absence.role}
                            </p>
                            <p className="text-xs text-red-100 mt-1">사유: {absence.reason}</p>
                            <p className="text-xs text-red-200 mt-1">
                              신고 시각: {absence.reportedAt.toLocaleString("ko-KR")}
                            </p>
                          </div>
                          <button
                            onClick={() => dismissAbsence(key)}
                            className="w-6 h-6 bg-red-500 hover:bg-red-400 text-white
                                       rounded-full flex items-center justify-center
                                       text-xs font-bold transition-colors flex-shrink-0 mt-0.5"
                            title="이 알림 닫기"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-red-100 mt-3">
                  👇 아래 '당일 대응' 섹션에서 대타 후보를 조회하고 연락하세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4">
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
              <label className="block text-sm font-medium text-[#393E46] mb-1">
                월 선택
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-4 py-2 border border-[#EEEEEE] rounded-xl text-[#222831]
                           focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]
                           transition-colors"
              />
            </div>

            <button
              onClick={copyLink}
              className="px-4 py-2 bg-[#EEEEEE] hover:bg-[#e0e0e0] text-[#393E46] rounded-xl
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
              className="px-5 py-2 bg-[#00ADB5] hover:bg-[#009aa1] disabled:bg-[#00ADB5]/40
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
              className="px-5 py-2 bg-[#393E46] hover:bg-[#222831] disabled:bg-[#393E46]/40
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
          <div className="mb-4 text-sm text-[#393E46]">
            {formatMonthDisplay(month)} 미사 일정: {massDates.length}건 |{" "}
            학생 응답: {availabilities.length}건
          </div>

          {/* 배정 결과 테이블 */}
          {assignments.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-[#EEEEEE]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#EEEEEE]">
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">날짜</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">역할</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">담당</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">백업1</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">백업2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEEEE]">
                    {assignments.map((a, i) => {
                      const primaryAbsent = isMarkedAbsent(a.date, a.role, a.primary);
                      const isEmergencyAbsent = emergencyAbsences.some(
                        (e) => e.date === a.date && e.role === getRoleName(a.role)
                      );
                      const rowAbsent = primaryAbsent || isEmergencyAbsent;

                      return (
                        <tr key={i} className={`transition-colors ${rowAbsent ? "bg-red-50" : "hover:bg-[#EEEEEE]/40"}`}>
                          <td className="px-4 py-3 font-medium text-[#222831]">
                            {formatDateShort(a.date)}
                          </td>
                          <td className="px-4 py-3 text-[#393E46]">{getRoleName(a.role)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {rowAbsent ? (
                                <span className="text-red-400 line-through text-sm">{a.primary || "-"}</span>
                              ) : (
                                <span className="text-[#222831] font-medium">{a.primary || "-"}</span>
                              )}
                              {a.primary && (
                                <button
                                  onClick={() => toggleAbsent(a.date, a.role, a.primary)}
                                  title={primaryAbsent ? "불참 취소" : "불참 표시"}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center
                                    text-xs font-bold transition-colors flex-shrink-0
                                    ${primaryAbsent
                                      ? "bg-red-500 text-white hover:bg-red-400"
                                      : "bg-[#EEEEEE] text-[#393E46] hover:bg-red-100 hover:text-red-500"
                                    }`}
                                >
                                  ✕
                                </button>
                              )}
                              {isEmergencyAbsent && !primaryAbsent && (
                                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                                  긴급
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#393E46]">{a.backup1 || "-"}</td>
                          <td className="px-4 py-3 text-[#393E46]">{a.backup2 || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <WarningBox warnings={warnings} />
            </>
          ) : (
            <div className="text-center py-12 text-[#393E46]">
              <p className="font-medium">배정 결과가 없습니다.</p>
              <p className="text-sm mt-1">위에서 월을 선택하고 AI 배정을 실행해주세요.</p>
            </div>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════
            섹션 2: 카카오톡 메시지 생성
        ══════════════════════════════════════════════════════════ */}
        <SectionCard title="2. 카카오톡 메시지 생성">
          <div className="flex flex-wrap gap-3 mb-6">
            {/* 기본 양식 생성 버튼 */}
            <button
              onClick={handleGenerateMessages}
              disabled={isGeneratingMessages || isGeneratingAiMessages || assignments.length === 0}
              className="px-5 py-2 bg-[#EEEEEE] hover:bg-[#e0e0e0] disabled:opacity-50
                         text-[#222831] rounded-xl text-sm font-medium transition-colors
                         flex items-center gap-2"
            >
              {isGeneratingMessages ? (
                <>
                  <LoadingSpinner size="sm" />
                  생성 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  학생별 메시지 생성
                </>
              )}
            </button>

            {/* AI 개인화 메시지 생성 버튼 */}
            <button
              onClick={handleGenerateAiMessages}
              disabled={isGeneratingMessages || isGeneratingAiMessages || assignments.length === 0}
              className="px-5 py-2 bg-[#00ADB5] hover:bg-[#009aa1] disabled:opacity-50
                         text-white rounded-xl text-sm font-medium transition-colors
                         flex items-center gap-2"
            >
              {isGeneratingAiMessages ? (
                <>
                  <LoadingSpinner size="sm" />
                  {aiGenerationProgress
                    ? `AI 생성 중... (${aiGenerationProgress.current}/${aiGenerationProgress.total})`
                    : "AI 생성 중..."}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.5 3.5 0 00-1.035 2.475V19a2 2 0 11-4 0v-.518a3.5 3.5 0 00-1.035-2.475l-.347-.347z"
                    />
                  </svg>
                  AI 개인화 메시지 생성
                </>
              )}
            </button>
          </div>

          {messages.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {messages.map((m, i) => {
                const status = smsStatuses[i] ?? "idle";
                return (
                  <div
                    key={i}
                    className="bg-[#EEEEEE]/30 rounded-xl p-4 border border-[#EEEEEE]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#222831]">{m.studentName}</span>
                      <span className="text-xs bg-[#00ADB5]/10 text-[#00ADB5] border border-[#00ADB5]/20
                                       px-2 py-0.5 rounded-full font-medium">
                        {m.role}
                      </span>
                    </div>
                    <p className="text-xs text-[#393E46] mb-2">{formatDateShort(m.date)}</p>
                    <pre className="text-sm text-[#393E46] whitespace-pre-wrap bg-white rounded-lg
                                    p-3 border border-[#EEEEEE] mb-3">
                      {m.message}
                    </pre>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyMessage(m.message)}
                        className="flex-1 py-2 bg-[#EEEEEE] hover:bg-[#e0e0e0] text-[#393E46]
                                   rounded-lg text-xs font-medium transition-colors"
                      >
                        복사
                      </button>
                      <button
                        onClick={() => openSmsModal(i)}
                        disabled={status === "sending" || status === "sent"}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                          ${status === "sent"
                            ? "bg-green-100 text-green-700 cursor-default"
                            : status === "error"
                            ? "bg-red-100 text-red-600 hover:bg-red-200"
                            : status === "sending"
                            ? "bg-[#00ADB5]/20 text-[#00ADB5] cursor-wait"
                            : "bg-[#00ADB5] hover:bg-[#009aa1] text-white"
                          }`}
                      >
                        {status === "sent" ? "전송됨 ✓" : status === "sending" ? "전송 중..." : status === "error" ? "재전송" : "전송"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[#393E46] text-sm">
              배정 결과 기반으로 메시지를 생성합니다.
            </p>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════
            섹션 3: 당일 대응
        ══════════════════════════════════════════════════════════ */}
        <SectionCard title="3. 당일 대응 (불참/대타)">
          {visibleAbsences.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-1">
                    🔔 긴급 불참 {visibleAbsences.length}건이 발생했습니다!
                  </p>
                  <p className="text-xs text-amber-600">
                    아래에서 날짜와 불참 학생을 선택하여 대타 후보를 조회하세요.
                  </p>
                </div>
                <button
                  onClick={dismissAllAbsences}
                  className="w-6 h-6 bg-amber-200 hover:bg-amber-300 text-amber-700
                             rounded-full flex items-center justify-center
                             text-xs font-bold transition-colors flex-shrink-0"
                  title="알림 닫기"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-[#393E46] mb-1">
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
                className="px-4 py-2 border border-[#EEEEEE] rounded-xl min-w-[140px] text-[#222831]
                           focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
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
              <label className="block text-sm font-medium text-[#393E46] mb-1">
                불참 학생
              </label>
              <select
                value={absentStudent}
                onChange={(e) => setAbsentStudent(e.target.value)}
                disabled={!selectedDate}
                className="px-4 py-2 border border-[#EEEEEE] rounded-xl min-w-[140px] text-[#222831]
                           focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]
                           disabled:bg-[#EEEEEE] disabled:text-[#393E46]/50"
              >
                <option value="">선택</option>
                {assignedStudentsForDate.map((s, i) => {
                  const student = students.find((st) => st.name === s.name);
                  const label = student?.baptismalName
                    ? `${s.name} (${student.baptismalName}) — ${getRoleName(s.role)}`
                    : `${s.name} — ${getRoleName(s.role)}`;
                  return (
                    <option key={i} value={s.name}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={handleFindBackup}
              disabled={!selectedDate || !absentStudent}
              className="px-5 py-2 bg-[#393E46] hover:bg-[#222831] disabled:opacity-40
                         text-white rounded-xl text-sm font-medium transition-colors"
            >
              대타 후보 조회
            </button>
          </div>

          {backupCandidates.length > 0 && (
            <div className="bg-[#EEEEEE]/40 rounded-xl p-4 border border-[#EEEEEE] mb-4">
              <p className="text-sm font-semibold text-[#222831] mb-3">대타 후보</p>
              <ul className="space-y-2">
                {backupCandidates.map((c, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-sm text-[#393E46]">
                      • {c.name}
                      <span className="ml-1.5 text-xs bg-[#00ADB5]/10 text-[#00ADB5] border border-[#00ADB5]/20
                                       px-1.5 py-0.5 rounded-full font-medium">{c.type}</span>
                    </span>
                    <button
                      onClick={() => openSubstituteSmsModal(c.name)}
                      className="px-3 py-1 bg-[#00ADB5] hover:bg-[#009aa1] text-white
                                 rounded-lg text-xs font-medium transition-colors"
                    >
                      전송
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {substituteMessage && (
            <div className="bg-[#EEEEEE]/30 rounded-xl p-4 border border-[#EEEEEE]">
              <p className="text-sm font-semibold text-[#222831] mb-2">대타 요청 메시지 초안</p>
              <pre className="text-sm text-[#393E46] whitespace-pre-wrap bg-white rounded-lg
                              p-3 border border-[#EEEEEE] mb-3">
                {substituteMessage}
              </pre>
              <div className="flex gap-2">
                <button
                  onClick={() => copyMessage(substituteMessage)}
                  className="px-4 py-2 bg-[#EEEEEE] hover:bg-[#e0e0e0] text-[#393E46]
                             rounded-lg text-xs font-medium transition-colors"
                >
                  복사
                </button>
                {backupCandidates.length > 0 && (
                  <button
                    onClick={() => openSubstituteSmsModal(backupCandidates[0].name)}
                    className="px-4 py-2 bg-[#00ADB5] hover:bg-[#009aa1] text-white
                               rounded-lg text-xs font-medium transition-colors"
                  >
                    1순위 후보에게 전송
                  </button>
                )}
              </div>
            </div>
          )}

          {!selectedDate && (
            <p className="text-[#393E46] text-sm">날짜를 선택하면 배정된 학생 목록이 표시됩니다.</p>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════
            섹션 4: 배정표 수동 수정
        ══════════════════════════════════════════════════════════ */}
        <SectionCard title="4. 배정표 수동 수정">
          {editableAssignments.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-4 rounded-xl border border-[#EEEEEE]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#EEEEEE]">
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">날짜</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">역할</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">담당</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">백업1</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#393E46]">백업2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEEEE]">
                    {editableAssignments.map((a, i) => {
                      const isAccompaniment =
                        a.role === "accompaniment" || a.role === "반주";

                      const candidateStudents = isAccompaniment
                        ? students.filter((s) => s.canPlayInstrument)
                        : students;

                      const getStudentUniqueId = (s: typeof students[number]) =>
                        s.baptismalName ? `${s.name} (${s.baptismalName})` : (s.grade ? `${s.name} (${s.grade})` : s.name);

                      const renderOption = (s: typeof students[number]) => (
                        <option key={s.id} value={getStudentUniqueId(s)}>
                          {s.name}{s.baptismalName ? ` (${s.baptismalName})` : (s.grade ? ` (${s.grade})` : "")}
                        </option>
                      );

                      const getOptionsFor = (currentUniqueId: string) => {
                        const inList = candidateStudents.some((s) => getStudentUniqueId(s) === currentUniqueId);
                        const extra =
                          currentUniqueId && !inList
                            ? students.filter((s) => getStudentUniqueId(s) === currentUniqueId)
                            : [];
                        return [...candidateStudents, ...extra];
                      };

                      return (
                        <tr key={i} className="hover:bg-[#EEEEEE]/40 transition-colors">
                          <td className="px-4 py-2 text-[#222831] font-medium">{formatDateShort(a.date)}</td>
                          <td className="px-4 py-2 text-[#393E46]">{getRoleName(a.role)}</td>
                          <td className="px-2 py-2">
                            <select
                              value={a.primary ?? ""}
                              onChange={(e) => handleEditChange(i, "primary", e.target.value)}
                              className="w-full px-2 py-1.5 border border-[#EEEEEE] rounded-lg text-sm text-[#222831]
                                         focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
                            >
                              <option value="">-</option>
                              {getOptionsFor(a.primary).map(renderOption)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={a.backup1 ?? ""}
                              onChange={(e) => handleEditChange(i, "backup1", e.target.value)}
                              className="w-full px-2 py-1.5 border border-[#EEEEEE] rounded-lg text-sm text-[#222831]
                                         focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
                            >
                              <option value="">-</option>
                              {getOptionsFor(a.backup1).map(renderOption)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={a.backup2 ?? ""}
                              onChange={(e) => handleEditChange(i, "backup2", e.target.value)}
                              className="w-full px-2 py-1.5 border border-[#EEEEEE] rounded-lg text-sm text-[#222831]
                                         focus:outline-none focus:ring-2 focus:ring-[#00ADB5]/30 focus:border-[#00ADB5]"
                            >
                              <option value="">-</option>
                              {getOptionsFor(a.backup2).map(renderOption)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleSaveAssignments}
                disabled={isSaving}
                className="px-5 py-2 bg-[#00ADB5] hover:bg-[#009aa1] disabled:opacity-40
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
            <p className="text-[#393E46] text-sm">
              AI 배정을 실행하면 수동으로 수정할 수 있습니다.
            </p>
          )}
        </SectionCard>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-[#EEEEEE]/60">
            어망 (Fish-Net) · 병점 성당 중고등부 주일학교
          </p>
        </div>
      </main>

      {/* ── SMS 전송 모달 ── */}
      {smsModal.isOpen && smsModal.messageIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#222831]/60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-[#EEEEEE]">
            <h3 className="text-base font-bold text-[#222831] mb-1">문자 전송</h3>
            <p className="text-sm text-[#393E46] mb-4">
              <span className="font-semibold text-[#222831]">
                {messages[smsModal.messageIndex].studentName}
              </span>
              님의 번호를 입력하세요
            </p>

            <input
              type="tel"
              value={smsModal.phone}
              onChange={(e) => setSmsModal((prev) => ({ ...prev, phone: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleSmsSend()}
              placeholder="010-0000-0000"
              autoFocus
              className="w-full px-4 py-3 border-2 border-[#EEEEEE] rounded-xl text-sm text-[#222831]
                         focus:outline-none focus:border-[#00ADB5] transition-colors mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={closeSmsModal}
                className="flex-1 py-2.5 bg-[#EEEEEE] hover:bg-[#e0e0e0] text-[#393E46]
                           rounded-xl text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSmsSend}
                disabled={!smsModal.phone.trim()}
                className="flex-1 py-2.5 bg-[#00ADB5] hover:bg-[#009aa1]
                           disabled:opacity-40 disabled:cursor-not-allowed
                           text-white rounded-xl text-sm font-medium transition-colors"
              >
                전송
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 대타 요청 SMS 모달 ── */}
      {substituteSmsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#222831]/60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-[#EEEEEE]">
            <h3 className="text-base font-bold text-[#222831] mb-1">대타 요청 문자 전송</h3>
            <p className="text-sm text-[#393E46] mb-3">
              <span className="font-semibold text-[#222831]">{substituteSmsModal.candidateName}</span>
              님에게 전송합니다
            </p>

            <pre className="text-xs text-[#393E46] whitespace-pre-wrap bg-[#EEEEEE]/40 rounded-xl p-3
                            border border-[#EEEEEE] mb-3 max-h-40 overflow-y-auto">
              {substituteSmsModal.message}
            </pre>

            <input
              type="tel"
              value={substituteSmsModal.phone}
              onChange={(e) =>
                setSubstituteSmsModal((prev) => ({ ...prev, phone: e.target.value }))
              }
              onKeyDown={(e) => e.key === "Enter" && handleSubstituteSmssend()}
              placeholder="010-0000-0000"
              autoFocus
              className="w-full px-4 py-3 border-2 border-[#EEEEEE] rounded-xl text-sm text-[#222831]
                         focus:outline-none focus:border-[#00ADB5] transition-colors mb-4"
            />

            {substituteSmsModal.status === "sent" && (
              <p className="text-sm text-green-600 font-medium mb-3 text-center">전송 완료!</p>
            )}
            {substituteSmsModal.status === "error" && (
              <p className="text-sm text-red-500 font-medium mb-3 text-center">전송 실패. 다시 시도해주세요.</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() =>
                  setSubstituteSmsModal({ isOpen: false, candidateName: "", message: "", phone: "", status: "idle" })
                }
                className="flex-1 py-2.5 bg-[#EEEEEE] hover:bg-[#e0e0e0] text-[#393E46]
                           rounded-xl text-sm font-medium transition-colors"
              >
                {substituteSmsModal.status === "sent" ? "닫기" : "취소"}
              </button>
              {substituteSmsModal.status !== "sent" && (
                <button
                  onClick={handleSubstituteSmssend}
                  disabled={!substituteSmsModal.phone.trim() || substituteSmsModal.status === "sending"}
                  className="flex-1 py-2.5 bg-[#00ADB5] hover:bg-[#009aa1]
                             disabled:opacity-40 disabled:cursor-not-allowed
                             text-white rounded-xl text-sm font-medium transition-colors
                             flex items-center justify-center gap-2"
                >
                  {substituteSmsModal.status === "sending" ? (
                    <>
                      <LoadingSpinner size="sm" />
                      전송 중...
                    </>
                  ) : (
                    "전송"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
