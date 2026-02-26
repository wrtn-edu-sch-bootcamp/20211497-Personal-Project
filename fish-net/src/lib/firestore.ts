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
  RoleType,
  AvailabilityStatus,
} from "@/types";

// ==================== 컬렉션 참조 ====================
const COLLECTIONS = {
  users: "users",
  students: "students",
  massDates: "massDates",
  availabilities: "availabilities",
  assignments: "assignments",
  swapRequests: "swapRequests",
  hymns: "hymns",
  massHymns: "massHymns",
  messages: "messages",
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
  const q = query(
    collection(firestore, COLLECTIONS.hymns),
    orderBy("number", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Hymn[];
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

// ==================== 사용자 인증 관련 ====================
export async function getUserRole(
  userId: string
): Promise<"teacher" | "student" | null> {
  const docRef = doc(firestore, COLLECTIONS.users, userId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return snapshot.data().role as "teacher" | "student";
}

export async function setUserRole(
  userId: string,
  role: "teacher" | "student",
  name: string,
  email: string
): Promise<void> {
  await setDoc(doc(firestore, COLLECTIONS.users, userId), {
    role,
    name,
    email,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}
