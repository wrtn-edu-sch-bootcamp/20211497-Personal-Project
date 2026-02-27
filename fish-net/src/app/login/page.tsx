"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithGoogle, isTeacherEmail } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { user, isTeacher, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user && isTeacher) {
      router.replace("/teacher");
    }
  }, [user, isTeacher, isLoading, router]);

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const loggedInUser = await signInWithGoogle();
      if (!isTeacherEmail(loggedInUser.email)) {
        setError(`교사 계정으로만 접속할 수 있습니다. (로그인된 이메일: ${loggedInUser.email})`);
        setIsSigningIn(false);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.replace("/teacher");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
      if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        setError(null);
      } else {
        setError("로그인에 실패했습니다. 다시 시도해주세요.");
      }
      setIsSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F0F9FF" }}>
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#0077B6] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F0F9FF" }}>
      {/* 헤더 */}
      <header className="sticky top-0 z-20 shadow-sm" style={{ backgroundColor: "#0077B6" }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <Link
            href="/"
            className="text-lg font-bold text-white hover:text-cyan-100 transition-colors"
          >
            어망
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* 히어로 섹션 */}
          <div
            className="rounded-3xl px-6 py-8 text-white text-center shadow-lg mb-6"
            style={{ background: "linear-gradient(135deg, #0077B6 0%, #00ADB5 100%)" }}
          >
            {/* 물고기 로고 — 클릭 시 메인으로 */}
            <Link
              href="/"
              className="inline-block text-5xl mb-3 hover:scale-110 transition-transform"
              aria-label="메인 홈으로 이동"
            >
              🐟
            </Link>
            <h1 className="text-2xl font-bold">어망</h1>
            <p className="text-cyan-100 text-sm mt-1">Fish-Net · 병점 성당 중고등부</p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white rounded-3xl shadow-sm border border-blue-100 p-7">
            <h2 className="text-base font-bold text-gray-800 mb-0.5">교사 로그인</h2>
            <p className="text-sm text-gray-400 mb-6">
              등록된 Google 계정으로 로그인하세요.
            </p>

            {error && (
              <div
                className="rounded-2xl px-4 py-3 mb-5 border"
                style={{ backgroundColor: "#FFF1F2", borderColor: "#FECDD3" }}
              >
                <p className="text-sm" style={{ color: "#E11D48" }}>{error}</p>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3
                         bg-white hover:bg-gray-50 disabled:opacity-60
                         border-2 rounded-2xl px-5 py-3.5
                         text-sm font-medium text-gray-700
                         transition-all shadow-sm disabled:cursor-wait"
              style={{ borderColor: isSigningIn ? "#E5E7EB" : "#0077B6" }}
            >
              {isSigningIn ? (
                <>
                  <div
                    className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: "#BFDBFE", borderTopColor: "#0077B6" }}
                  />
                  로그인 중...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google로 로그인
                </>
              )}
            </button>
          </div>

          {/* 하단 링크 */}
          <p className="text-center text-xs text-gray-400 mt-5">
            학생이신가요?{" "}
            <Link href="/student" className="font-medium hover:underline" style={{ color: "#00ADB5" }}>
              학생 페이지로 이동 →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
