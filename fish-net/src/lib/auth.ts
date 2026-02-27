import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

const provider = new GoogleAuthProvider();

/**
 * 허용된 교사 이메일 목록
 * 새 교사 추가 시 이 배열에 이메일을 추가하세요.
 */
const TEACHER_EMAILS: string[] = [
  "blacksky4275@gmail.com",
  "sliverwhite4275@gmail.com",
];

export function getAllowedTeacherEmails(): string[] {
  return TEACHER_EMAILS;
}

export function isTeacherEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return TEACHER_EMAILS.includes(email.toLowerCase());
}

/**
 * Google 로그인 후 교사 이메일이면 /api/auth/teacher-login을 호출하여
 * 서버(Admin SDK)가 teachers/{uid} 문서를 생성하도록 위임
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(firebaseAuth, provider);
  const user = result.user;

  if (isTeacherEmail(user.email)) {
    const idToken = await user.getIdToken();
    await fetch("/api/auth/teacher-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    });
  }

  return user;
}

export async function signOutUser(): Promise<void> {
  await signOut(firebaseAuth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}
