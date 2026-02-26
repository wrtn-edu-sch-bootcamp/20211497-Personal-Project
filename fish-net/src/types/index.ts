export type AvailabilityStatus = "available" | "unavailable" | "uncertain";

export interface Student {
  id: string;
  name: string;
  baptismalName?: string;
  grade?: string;
  gender?: "male" | "female";
  email?: string;
  phone?: string;
  role: "student";
  skills: string[];
  canPlayInstrument: boolean;
  instrumentType?: string;
  isNewMember: boolean;
  isSinger?: boolean; // 성가 연습/반주 담당 여부
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "teacher";
  createdAt: Date;
  updatedAt: Date;
}

export type User = Student | Teacher;

export type RoleType =
  | "reading1"
  | "reading2"
  | "commentary"
  | "accompaniment"
  | "prayer1"
  | "prayer2";

export interface Role {
  id: RoleType;
  name: string;
  description: string;
  requiresInstrument: boolean;
  difficulty: "easy" | "medium" | "hard";
}

export const ROLES: Record<RoleType, Role> = {
  reading1: {
    id: "reading1",
    name: "1독서",
    description: "첫 번째 독서를 낭독합니다",
    requiresInstrument: false,
    difficulty: "medium",
  },
  reading2: {
    id: "reading2",
    name: "2독서",
    description: "두 번째 독서를 낭독합니다",
    requiresInstrument: false,
    difficulty: "medium",
  },
  commentary: {
    id: "commentary",
    name: "해설",
    description: "미사 진행을 해설합니다",
    requiresInstrument: false,
    difficulty: "hard",
  },
  accompaniment: {
    id: "accompaniment",
    name: "반주",
    description: "성가 반주를 담당합니다",
    requiresInstrument: true,
    difficulty: "hard",
  },
  prayer1: {
    id: "prayer1",
    name: "우리의기도1",
    description: "신자들의 기도를 낭독합니다 (1번)",
    requiresInstrument: false,
    difficulty: "easy",
  },
  prayer2: {
    id: "prayer2",
    name: "우리의기도2",
    description: "신자들의 기도를 낭독합니다 (2번)",
    requiresInstrument: false,
    difficulty: "easy",
  },
};

export interface MassDate {
  id: string;
  date: Date;
  roles: RoleType[];
  createdBy: string;
  createdAt: Date;
}

export interface StudentAvailability {
  id: string;
  studentId: string;
  studentName?: string;
  massDateId: string;
  status: AvailabilityStatus;
  comment?: string;
  analyzedPriority?: number;
  analyzedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Assignment {
  id: string;
  massDateId: string;
  studentId: string;
  role: RoleType;
  isPrimary: boolean;
  backupOrder?: number;
  status: "assigned" | "confirmed" | "declined" | "swapped";
  createdAt: Date;
  updatedAt: Date;
}

export interface SwapRequest {
  id: string;
  assignmentId: string;
  requesterId: string;
  targetStudentId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export interface HymnType {
  id: string;
  name: string;
  isFixed: boolean;
}

export const HYMN_TYPES: HymnType[] = [
  { id: "entrance", name: "입당", isFixed: false },
  { id: "holy", name: "거룩하시도다", isFixed: true },
  { id: "response", name: "화답송", isFixed: false },
  { id: "lamb", name: "하느님의 어린양", isFixed: true },
  { id: "communion", name: "영성체", isFixed: false },
  { id: "dismissal", name: "파견", isFixed: false },
];

export interface Hymn {
  id: string;
  number: number;
  title: string;
  source: "yahweh-ire" | "fixed";
}

export interface MassHymns {
  id: string;
  massDateId: string;
  hymns: {
    typeId: string;
    hymnId: string;
  }[];
  confirmedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  type: "assignment" | "hymn" | "backup_request" | "reminder";
  recipientId: string;
  content: string;
  massDateId: string;
  createdAt: Date;
  sentAt?: Date;
}

// ==================== 월간 배정 API 타입 ====================

/** 월간 배정 API 요청 body */
export interface MonthlyAssignmentRequest {
  month: string; // "YYYY-MM"
  availabilityData?: {
    studentId: string;
    studentName: string;
    dates: {
      massDateId: string;
      date: string; // "YYYY-MM-DD"
      status: AvailabilityStatus;
    }[];
    comment?: string;
  }[];
}

/** 개별 배정 결과 (날짜 + 역할별) */
export interface MonthlyAssignment {
  date: string;       // "YYYY-MM-DD"
  role: string;       // "1독서" | "2독서" | "해설" | "반주" | "우리의기도"
  primary: string;    // 1순위 학생 이름
  backup1: string;    // 1순위 백업
  backup2: string;    // 2순위 백업
}

/** 월간 배정 API 응답 */
export interface MonthlyScheduleResult {
  month: string;
  assignments: MonthlyAssignment[];
  warnings: string[];
}

/** 에러 응답 */
export interface MonthlyAssignmentError {
  success: false;
  error: string;
  code: "INVALID_REQUEST" | "NO_MASS_DATES" | "NO_STUDENTS" | "CLAUDE_ERROR" | "PARSE_ERROR";
}
