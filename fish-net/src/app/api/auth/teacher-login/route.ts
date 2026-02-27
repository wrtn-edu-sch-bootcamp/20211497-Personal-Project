import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getApps } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/auth/teacher-login
 *
 * Google 로그인 직후 클라이언트에서 호출.
 * ID 토큰을 검증하고, 환경변수 화이트리스트 확인 후 teachers/{uid} 문서를 생성/갱신.
 * Firestore rules는 teachers/{uid} 존재 여부로 교사 권한을 판단하므로
 * 반드시 Admin SDK(서버)를 통해서만 이 문서를 생성해야 함.
 */

import { getAllowedTeacherEmails } from "@/lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authorization 헤더에서 ID 토큰 추출
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    // 2. Firebase Admin으로 토큰 검증
    const db = getAdminFirestore();
    const auth = getAuth(getApps()[0]);
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email, name } = decodedToken;

    if (!email) {
      return NextResponse.json({ error: "No email in token" }, { status: 400 });
    }

    // 3. 환경변수 화이트리스트 확인 (NEXT_PUBLIC_TEACHER_EMAILS)
    const normalizedEmail = email.toLowerCase();
    if (!getAllowedTeacherEmails().includes(normalizedEmail)) {
      return NextResponse.json(
        { error: "Not authorized as teacher", code: "NOT_TEACHER" },
        { status: 403 }
      );
    }

    // 4. teachers/{uid} 문서 생성 또는 갱신 (멱등성 보장)
    const teacherRef = db.collection("teachers").doc(uid);
    await teacherRef.set(
      {
        name: name ?? normalizedEmail.split("@")[0],
        email: normalizedEmail,
        role: "teacher",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const snapshot = await teacherRef.get();
    if (!snapshot.data()?.createdAt) {
      await teacherRef.update({ createdAt: FieldValue.serverTimestamp() });
    }

    return NextResponse.json({ success: true, uid });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[teacher-login] 오류:", message);
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }
}
