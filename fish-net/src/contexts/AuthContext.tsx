"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { isTeacherUid } from "@/lib/firestore";
import { isTeacherEmail } from "@/lib/auth";

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: "teacher" | "student" | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        // 1차: 이메일로 즉시 판단 → 로딩 블로킹 없이 완료
        const emailIsTeacher = isTeacherEmail(firebaseUser.email);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role: emailIsTeacher ? "teacher" : "student",
        });
        setLoading(false);

        // 2차: teachers/{uid} 문서로 최종 검증
        if (emailIsTeacher) {
          try {
            const docExists = await isTeacherUid(firebaseUser.uid);
            setUser((prev) =>
              prev ? { ...prev, role: docExists ? "teacher" : "student" } : prev
            );
          } catch {
            // 문서 미생성 또는 규칙 거부 시 이메일 판단 유지
          }
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(firebaseAuth, provider);
      const firebaseUser = credential.user;

      // 교사 이메일이면 서버 API를 통해 teachers/{uid} 문서 생성
      if (isTeacherEmail(firebaseUser.email)) {
        const idToken = await firebaseUser.getIdToken();
        await fetch("/api/auth/teacher-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        });
      }

      const teacherExists = await isTeacherUid(firebaseUser.uid);
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        role: teacherExists ? "teacher" : "student",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Google 로그인에 실패했습니다.";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await firebaseSignOut(firebaseAuth);
      setUser(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "로그아웃에 실패했습니다.";
      setError(errorMessage);
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut,
    isTeacher: user?.role === "teacher",
    isStudent: user?.role === "student",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
