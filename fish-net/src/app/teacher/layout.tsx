"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, isTeacher, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    // 미로그인 → 로그인 페이지로
    if (!user) {
      router.replace("/login");
      return;
    }
    // 로그인했지만 허용 이메일 아님 → 로그인 페이지로 (에러 표시는 login page에서)
    if (!isTeacher) {
      router.replace("/login");
    }
  }, [user, isTeacher, isLoading, router]);

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  // 인증 완료된 교사만 렌더
  if (!user || !isTeacher) return null;

  return <>{children}</>;
}
