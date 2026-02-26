import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { firestore } from "./firebase";
import type {
  Student,
  MassDate,
  StudentAvailability,
  Assignment,
  SwapRequest,
} from "@/types";

type Callback<T> = (data: T[]) => void;

export function subscribeToStudents(callback: Callback<Student>): Unsubscribe {
  const q = query(collection(firestore, "students"), orderBy("name"));

  return onSnapshot(q, (snapshot) => {
    const students = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      joinedAt: doc.data().joinedAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Student[];
    callback(students);
  });
}

export function subscribeToMassDates(callback: Callback<MassDate>): Unsubscribe {
  const q = query(collection(firestore, "massDates"), orderBy("date", "asc"));

  return onSnapshot(q, (snapshot) => {
    const massDates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
    })) as MassDate[];
    callback(massDates);
  });
}

export function subscribeToAvailabilities(
  callback: Callback<StudentAvailability>,
  massDateId?: string
): Unsubscribe {
  let q = query(collection(firestore, "availabilities"));

  if (massDateId) {
    q = query(q, where("massDateId", "==", massDateId));
  }

  return onSnapshot(q, (snapshot) => {
    const availabilities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as StudentAvailability[];
    callback(availabilities);
  });
}

export function subscribeToAssignments(
  callback: Callback<Assignment>,
  massDateId?: string
): Unsubscribe {
  let q = query(collection(firestore, "assignments"));

  if (massDateId) {
    q = query(q, where("massDateId", "==", massDateId));
  }

  return onSnapshot(q, (snapshot) => {
    const assignments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Assignment[];
    callback(assignments);
  });
}

export function subscribeToStudentAssignments(
  studentId: string,
  callback: Callback<Assignment>
): Unsubscribe {
  const q = query(
    collection(firestore, "assignments"),
    where("studentId", "==", studentId)
  );

  return onSnapshot(q, (snapshot) => {
    const assignments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Assignment[];
    callback(assignments);
  });
}

export function subscribeToSwapRequests(
  targetStudentId: string,
  callback: Callback<SwapRequest>
): Unsubscribe {
  const q = query(
    collection(firestore, "swapRequests"),
    where("targetStudentId", "==", targetStudentId),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as SwapRequest[];
    callback(requests);
  });
}
