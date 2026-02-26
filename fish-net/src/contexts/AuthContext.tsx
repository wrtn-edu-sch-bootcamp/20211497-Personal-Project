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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { getUserRole, setUserRole } from "@/lib/firestore";

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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    name: string,
    role: "teacher" | "student"
  ) => Promise<void>;
  signInWithGoogle: (role: "teacher" | "student") => Promise<void>;
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
        const role = await getUserRole(firebaseUser.uid);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );
      const role = await getUserRole(credential.user.uid);
      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName,
        role,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: "teacher" | "student"
  ) => {
    try {
      setError(null);
      setLoading(true);
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );
      await setUserRole(credential.user.uid, role, name, email);
      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: name,
        role,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "회원가입에 실패했습니다.";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (role: "teacher" | "student") => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(firebaseAuth, provider);

      let existingRole = await getUserRole(credential.user.uid);

      if (!existingRole) {
        await setUserRole(
          credential.user.uid,
          role,
          credential.user.displayName || "사용자",
          credential.user.email || ""
        );
        existingRole = role;
      }

      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName,
        role: existingRole,
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
    signIn,
    signUp,
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
