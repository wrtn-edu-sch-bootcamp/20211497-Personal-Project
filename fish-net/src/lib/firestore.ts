import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  addDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "./firebase";
import type {
  Student,
  Teacher,
  MassDate,
  StudentAvailability,
  Assignment,
  SwapRequest,
  Hymn,
  MassHymns,
  HymnAnnouncement,
  HymnSlotKey,
  HymnEntry,
  RoleType,
  AvailabilityStatus,
  Attendance,
  AttendanceStatus,
} from "@/types";

// ==================== 컬렉션 참조 ====================
const COLLECTIONS = {
  teachers: "teachers",
  teachersWhitelist: "teachers_whitelist",
  students: "students",
  massDates: "massDates",
  availabilities: "availabilities",
  assignments: "assignments",
  swapRequests: "swapRequests",
  hymns: "hymns",
  massHymns: "massHymns",
  messages: "messages",
  hymnAnnouncements: "hymnAnnouncements",
  attendance: "attendance",
} as const;

// ==================== 학생 관련 ====================
export async function getStudents(): Promise<Student[]> {
  const q = query(
    collection(firestore, COLLECTIONS.students),
    orderBy("name")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    joinedAt: doc.data().joinedAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as Student[];
}

export async function getStudent(id: string): Promise<Student | null> {
  const docRef = doc(firestore, COLLECTIONS.students, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    joinedAt: data.joinedAt?.toDate(),
    createdAt: data.createdAt?.toDate(),
    updatedAt: data.updatedAt?.toDate(),
  } as Student;
}

export async function createStudent(
  student: Omit<Student, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const docRef = await addDoc(collection(firestore, COLLECTIONS.students), {
    ...student,
    role: "student",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateStudent(
  id: string,
  data: Partial<Student>
): Promise<void> {
  const docRef = doc(firestore, COLLECTIONS.students, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// ==================== 미사 날짜 관련 ====================
export async function getMassDates(): Promise<MassDate[]> {
  const q = query(
    collection(firestore, COLLECTIONS.massDates),
    orderBy("date", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
  })) as MassDate[];
}

export async function createMassDate(
  date: Date,
  roles: RoleType[],
  createdBy: string
): Promise<string> {
  const docRef = await addDoc(collection(firestore, COLLECTIONS.massDates), {
    date: Timestamp.fromDate(date),
    roles,
    createdBy,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function deleteMassDate(id: string): Promise<void> {
  await deleteDoc(doc(firestore, COLLECTIONS.massDates, id));
}

// ==================== 가용성 응답 관련 ====================
export async function getAvailabilities(
  massDateId?: string
): Promise<StudentAvailability[]> {
  let q = query(collection(firestore, COLLECTIONS.availabilities));

  if (massDateId) {
    q = query(q, where("massDateId", "==", massDateId));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as StudentAvailability[];
}

export async function getStudentAvailability(
  studentId: string,
  massDateId: string
): Promise<StudentAvailability | null> {
  const q = query(
    collection(firestore, COLLECTIONS.availabilities),
    where("studentId", "==", studentId),
    where("massDateId", "==", massDateId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  } as StudentAvailability;
}

export async function submitAvailability(
  studentId: string,
  massDateId: string,
  status: AvailabilityStatus,
  comment?: string
): Promise<string> {
  const existing = await getStudentAvailability(studentId, massDateId);

  if (existing) {
    await updateDoc(doc(firestore, COLLECTIONS.availabilities, existing.id), {
      status,
      comment: comment || null,
      updatedAt: Timestamp.now(),
    });
    return existing.id;
  }

  const docRef = await addDoc(collection(firestore, COLLECTIONS.availabilities), {
    studentId,
    massDateId,
    status,
    comment: comment || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function bulkSubmitAvailabilities(
  availabilities: {
    studentId: string;
    studentName: string;
    massDateId: string;
    status: AvailabilityStatus;
    comment?: string;
  }[]
): Promise<void> {
  const batch = writeBatch(firestore);

  for (const avail of availabilities) {
    const docRef = doc(collection(firestore, COLLECTIONS.availabilities));
    batch.set(docRef, {
      ...avail,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
}

// ==================== 배정 관련 ====================
export async function getAssignments(massDateId: string): Promise<Assignment[]> {
  const q = query(
    collection(firestore, COLLECTIONS.assignments),
    where("massDateId", "==", massDateId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as Assignment[];
}

export async function getStudentAssignments(
  studentId: string
): Promise<Assignment[]> {
  const q = query(
    collection(firestore, COLLECTIONS.assignments),
    where("studentId", "==", studentId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as Assignment[];
}

export async function saveAssignments(
  massDateId: string,
  assignments: {
    studentId: string;
    role: RoleType;
    isPrimary: boolean;
    backupOrder?: number;
  }[]
): Promise<void> {
  const batch = writeBatch(firestore);

  // 기존 배정 삭제
  const existing = await getAssignments(massDateId);
  for (const assignment of existing) {
    batch.delete(doc(firestore, COLLECTIONS.assignments, assignment.id));
  }

  // 새 배정 추가
  for (const assignment of assignments) {
    const docRef = doc(collection(firestore, COLLECTIONS.assignments));
    batch.set(docRef, {
      ...assignment,
      massDateId,
      status: "assigned",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: Assignment["status"]
): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.assignments, assignmentId), {
    status,
    updatedAt: Timestamp.now(),
  });
}

export async function getAssignmentsByMonth(month: string): Promise<{
  massDateId: string;
  date: Date;
  assignments: Assignment[];
}[]> {
  const [year, mon] = month.split("-").map(Number);
  
  const massDatesQuery = query(
    collection(firestore, COLLECTIONS.massDates),
    orderBy("date", "asc")
  );
  const massDatesSnapshot = await getDocs(massDatesQuery);
  
  const filteredMassDates = massDatesSnapshot.docs
    .map((doc) => ({
      id: doc.id,
      date: doc.data().date?.toDate() as Date,
    }))
    .filter((m) => {
      return m.date.getFullYear() === year && m.date.getMonth() === mon - 1;
    });

  const results: {
    massDateId: string;
    date: Date;
    assignments: Assignment[];
  }[] = [];

  for (const massDate of filteredMassDates) {
    const assignmentsQuery = query(
      collection(firestore, COLLECTIONS.assignments),
      where("massDateId", "==", massDate.id)
    );
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    
    const assignments = assignmentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Assignment[];

    if (assignments.length > 0) {
      results.push({
        massDateId: massDate.id,
        date: massDate.date,
        assignments,
      });
    }
  }

  return results;
}

// ==================== 역할 변경 요청 관련 ====================
export async function createSwapRequest(
  assignmentId: string,
  requesterId: string,
  targetStudentId: string
): Promise<string> {
  const docRef = await addDoc(collection(firestore, COLLECTIONS.swapRequests), {
    assignmentId,
    requesterId,
    targetStudentId,
    status: "pending",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateSwapRequestStatus(
  requestId: string,
  status: SwapRequest["status"]
): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.swapRequests, requestId), {
    status,
    updatedAt: Timestamp.now(),
  });
}

export async function getPendingSwapRequests(
  targetStudentId: string
): Promise<SwapRequest[]> {
  const q = query(
    collection(firestore, COLLECTIONS.swapRequests),
    where("targetStudentId", "==", targetStudentId),
    where("status", "==", "pending")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as SwapRequest[];
}

// ==================== 성가 관련 ====================
export async function getHymns(): Promise<Hymn[]> {
  // orderBy 제거 - 인덱스 없이도 동작하도록
  const snapshot = await getDocs(collection(firestore, COLLECTIONS.hymns));
  const hymns = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Hymn[];
  // 클라이언트에서 정렬
  return hymns.sort((a, b) => a.number - b.number);
}

export async function getMassHymns(massDateId: string): Promise<MassHymns | null> {
  const q = query(
    collection(firestore, COLLECTIONS.massHymns),
    where("massDateId", "==", massDateId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    confirmedAt: doc.data().confirmedAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  } as MassHymns;
}

export async function saveMassHymns(
  massDateId: string,
  hymns: { typeId: string; hymnId: string }[]
): Promise<string> {
  const existing = await getMassHymns(massDateId);

  if (existing) {
    await updateDoc(doc(firestore, COLLECTIONS.massHymns, existing.id), {
      hymns,
      updatedAt: Timestamp.now(),
    });
    return existing.id;
  }

  const docRef = await addDoc(collection(firestore, COLLECTIONS.massHymns), {
    massDateId,
    hymns,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function confirmMassHymns(massHymnsId: string): Promise<void> {
  await updateDoc(doc(firestore, COLLECTIONS.massHymns, massHymnsId), {
    confirmedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

// ==================== 성가 안내 관련 ====================

/** 특정 날짜(YYYY-MM-DD)의 성가 안내 조회 */
export async function getHymnAnnouncement(
  date: string
): Promise<HymnAnnouncement | null> {
  const q = query(
    collection(firestore, COLLECTIONS.hymnAnnouncements),
    where("date", "==", date)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate(),
    updatedAt: docSnap.data().updatedAt?.toDate(),
  } as HymnAnnouncement;
}

/** 특정 월(YYYY-MM)의 모든 성가 안내 조회 — 복합 인덱스 없이 단순 prefix 범위 쿼리 사용 */
export async function getHymnAnnouncementsByMonth(
  month: string
): Promise<HymnAnnouncement[]> {
  // "YYYY-MM-01" ~ "YYYY-MM-99" 범위로 date 필드를 조회 (복합 인덱스 불필요)
  const q = query(
    collection(firestore, COLLECTIONS.hymnAnnouncements),
    where("date", ">=", `${month}-01`),
    where("date", "<=", `${month}-99`),
    orderBy("date", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate(),
    updatedAt: docSnap.data().updatedAt?.toDate(),
  })) as HymnAnnouncement[];
}

/** 모든 성가 안내에서 사용된 곡 이력 조회 (중복 방지용) */
export async function getAllUsedHymnTitles(): Promise<
  { title: string; slotKey: HymnSlotKey; date: string }[]
> {
  const snapshot = await getDocs(
    collection(firestore, COLLECTIONS.hymnAnnouncements)
  );
  const results: { title: string; slotKey: HymnSlotKey; date: string }[] = [];
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const slots = data.slots as Partial<Record<HymnSlotKey, HymnEntry>>;
    for (const [key, entry] of Object.entries(slots)) {
      if (entry?.title) {
        results.push({
          title: entry.title,
          slotKey: key as HymnSlotKey,
          date: data.date as string,
        });
      }
    }
  }
  return results;
}

/** undefined 값을 제거하는 헬퍼 함수 */
function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as T;
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue; // undefined 필드 제거
    if (value !== null && typeof value === 'object') {
      cleaned[key] = cleanUndefined(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

/** 성가 안내 저장 (신규 or 수정) — date 필드를 고유 키로 사용 */
export async function saveHymnAnnouncement(
  date: string,
  slots: Partial<Record<HymnSlotKey, HymnEntry>>,
  createdBy: string
): Promise<string> {
  console.log("[Firestore] saveHymnAnnouncement 호출");
  console.log("[Firestore] date:", date);
  console.log("[Firestore] slots (원본):", slots);
  
  // undefined 값 제거
  const cleanedSlots = cleanUndefined(slots);
  console.log("[Firestore] slots (정제):", cleanedSlots);
  console.log("[Firestore] createdBy:", createdBy);

  const month = date.slice(0, 7); // "YYYY-MM"
  
  try {
    const existing = await getHymnAnnouncement(date);
    console.log("[Firestore] 기존 문서:", existing ? "있음" : "없음");

    if (existing) {
      console.log("[Firestore] 업데이트 시도:", existing.id);
      await updateDoc(
        doc(firestore, COLLECTIONS.hymnAnnouncements, existing.id),
        {
          slots: cleanedSlots,
          updatedAt: Timestamp.now(),
        }
      );
      console.log("[Firestore] 업데이트 성공");
      return existing.id;
    }

    console.log("[Firestore] 신규 생성 시도");
    const docRef = await addDoc(
      collection(firestore, COLLECTIONS.hymnAnnouncements),
      {
        date,
        month,
        slots: cleanedSlots,
        createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }
    );
    console.log("[Firestore] 신규 생성 성공:", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("[Firestore] 저장 실패:", error);
    console.error("[Firestore] 에러 코드:", error?.code);
    console.error("[Firestore] 에러 메시지:", error?.message);
    throw error;
  }
}

/** 성가 안내 삭제 */
export async function deleteHymnAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(firestore, COLLECTIONS.hymnAnnouncements, id));
}

// ==================== 출석 관련 ====================

/** 특정 날짜(YYYY-MM-DD)의 모든 학생 출석 조회 */
export async function getAttendanceByDate(date: string): Promise<Attendance[]> {
  const q = query(
    collection(firestore, COLLECTIONS.attendance),
    where("date", "==", date)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    updatedAt: d.data().updatedAt?.toDate(),
  })) as Attendance[];
}

/** 특정 학생의 특정 날짜 출석 조회 */
export async function getStudentAttendance(
  studentId: string,
  date: string
): Promise<Attendance | null> {
  const q = query(
    collection(firestore, COLLECTIONS.attendance),
    where("studentId", "==", studentId),
    where("date", "==", date)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return {
    id: d.id,
    ...d.data(),
    updatedAt: d.data().updatedAt?.toDate(),
  } as Attendance;
}

/** 특정 학생의 특정 월(YYYY-MM) 출석 전체 조회 */
export async function getStudentAttendanceByMonth(
  studentId: string,
  month: string
): Promise<Attendance[]> {
  const q = query(
    collection(firestore, COLLECTIONS.attendance),
    where("studentId", "==", studentId),
    where("date", ">=", `${month}-01`),
    where("date", "<=", `${month}-99`)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    updatedAt: d.data().updatedAt?.toDate(),
  })) as Attendance[];
}

/** 출석 기록 저장 또는 업데이트 (upsert) */
export async function upsertAttendance(data: {
  studentId: string;
  studentName: string;
  date: string;
  status: AttendanceStatus;
  reason?: string;
  confirmedBy: "auto" | "teacher";
}): Promise<string> {
  const existing = await getStudentAttendance(data.studentId, data.date);

  if (existing) {
    const updatePayload: Record<string, unknown> = {
      status: data.status,
      confirmedBy: data.confirmedBy,
      updatedAt: Timestamp.now(),
    };
    if (data.reason !== undefined) updatePayload.reason = data.reason;

    await updateDoc(
      doc(firestore, COLLECTIONS.attendance, existing.id),
      updatePayload
    );
    return existing.id;
  }

  const newDoc: Record<string, unknown> = {
    studentId: data.studentId,
    studentName: data.studentName,
    date: data.date,
    status: data.status,
    confirmedBy: data.confirmedBy,
    updatedAt: Timestamp.now(),
  };
  if (data.reason !== undefined) newDoc.reason = data.reason;

  const docRef = await addDoc(collection(firestore, COLLECTIONS.attendance), newDoc);
  return docRef.id;
}

// ==================== 교사 인증 관련 ====================

/**
 * teachers/{uid} 문서가 존재하는지 확인
 * Firestore rules의 isTeacher() 판단 기준과 동일
 */
export async function isTeacherUid(uid: string): Promise<boolean> {
  const docRef = doc(firestore, COLLECTIONS.teachers, uid);
  const snapshot = await getDoc(docRef);
  return snapshot.exists();
}

/**
 * teachers/{uid} 문서 조회
 */
export async function getTeacher(uid: string): Promise<Teacher | null> {
  const docRef = doc(firestore, COLLECTIONS.teachers, uid);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate(),
    updatedAt: data.updatedAt?.toDate(),
  } as Teacher;
}

/**
 * 로그인 시 이메일 화이트리스트 확인 후 teachers/{uid} 문서 자동 생성
 * - 이미 존재하면 updatedAt만 갱신 (멱등성 보장)
 * - 화이트리스트에 없는 이메일이면 null 반환
 */
export async function registerTeacherOnLogin(
  uid: string,
  email: string,
  displayName: string | null
): Promise<Teacher | null> {
  // teachers_whitelist는 서버(Admin SDK)만 읽을 수 있으므로
  // 클라이언트에서는 이미 생성된 teachers/{uid} 존재 여부로만 확인
  const existing = await getTeacher(uid);
  if (existing) return existing;

  // 신규 로그인: teachers/{uid} 문서 생성 (이메일만 저장, 이름은 Google 프로필에서)
  const teacherData = {
    name: displayName ?? email.split("@")[0],
    email: email.toLowerCase(),
    role: "teacher" as const,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(doc(firestore, COLLECTIONS.teachers, uid), teacherData);

  return {
    id: uid,
    ...teacherData,
    createdAt: teacherData.createdAt.toDate(),
    updatedAt: teacherData.updatedAt.toDate(),
  };
}
