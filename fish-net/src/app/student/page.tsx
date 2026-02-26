"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * /student → /student/response?month=YYYY-MM 으로 리다이렉트
 * month 파라미터가 없으면 현재 월을 기본값으로 사용
 */
export default function StudentIndexPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const month =
      searchParams.get("month") ??
      (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      })();

    router.replace(`/student/response?month=${month}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="text-center">
        <div className="relative mx-auto mb-6 h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#c8a84b]/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-[#c8a84b] animate-spin" />
        </div>
        <p className="text-[#4a6a9e] text-xs tracking-widest uppercase">Redirecting</p>
      </div>
    </div>
  );
}
