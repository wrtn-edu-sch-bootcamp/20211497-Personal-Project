"use client";

import { Suspense } from "react";
import StudentResponsePage from "@/app/student/[scheduleId]/page";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="relative mx-auto h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-[#c8a84b]/20" />
        <div className="absolute inset-0 rounded-full border-t-2 border-[#c8a84b] animate-spin" />
      </div>
    </div>
  );
}

/**
 * /student/response?month=YYYY-MM
 * scheduleId 없이 month 파라미터만으로 접근하는 범용 응답 페이지
 */
export default function StudentResponseRoute() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StudentResponsePage />
    </Suspense>
  );
}
