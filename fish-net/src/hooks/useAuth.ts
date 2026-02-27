"use client";

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { onAuthChange, isTeacherEmail } from "@/lib/auth";
import { isTeacherUid } from "@/lib/firestore";

export interface AuthState {
  user: User | null;
  isTeacher: boolean;
  isLoading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (u) => {
      setUser(u);

      if (u) {
        // 1차: 이메일 화이트리스트로 즉시 판단 → UI 블로킹 없이 로딩 완료
        const emailMatch = isTeacherEmail(u.email);
        setIsTeacher(emailMatch);
        setIsLoading(false);

        // 2차: teachers/{uid} 문서로 최종 검증 (문서 생성 직후 반영)
        // 이메일 매칭이 되는 사용자만 조회해서 불필요한 권한 오류 방지
        if (emailMatch) {
          try {
            const docExists = await isTeacherUid(u.uid);
            setIsTeacher(docExists);
          } catch {
            // 문서가 아직 없거나 규칙으로 거부된 경우 이메일 판단 유지
          }
        }
      } else {
        setIsTeacher(false);
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  return { user, isTeacher, isLoading };
}
