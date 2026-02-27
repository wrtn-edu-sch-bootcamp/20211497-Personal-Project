/**
 * teachers 컬렉션 초기화 스크립트
 *
 * - 이메일 기반으로 교사를 미리 등록해둠
 * - 교사가 Google 로그인 시, auth.ts에서 이메일 확인 후 teachers/{uid} 문서를 자동 생성함
 * - 이 스크립트는 "허용된 이메일 목록"을 teachers_whitelist 컬렉션에 저장
 *   → Firestore rules에서 teachers/{uid} 문서 유무로 권한을 최종 판단
 *
 * 실행 방법:
 *   npx ts-node --project scripts/tsconfig.json scripts/seedTeachers.ts
 *
 * 전제 조건:
 *   - scripts/service-account.json (Firebase Admin 서비스 계정 키)
 */

import * as admin from "firebase-admin";
import * as path from "path";

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");

// ==================== 교사 데이터 ====================
// 이름(세례명 포함) + 이메일. 이메일은 Google 계정 이메일로 업데이트 필요.
const TEACHERS: {
  name: string;
  baptismalName: string;
  email: string;
  phone?: string;
}[] = [
  { name: "김XX", baptismalName: "시몬",    email: "REPLACE_김시몬@gmail.com" },
  { name: "김XX", baptismalName: "다비드",  email: "REPLACE_김다비드@gmail.com" },
  { name: "배XX", baptismalName: "즈카르야", email: "REPLACE_배즈카르야@gmail.com" },
  { name: "이XX", baptismalName: "카타리나", email: "REPLACE_이카타리나@gmail.com" },
  { name: "이XX", baptismalName: "모니카",  email: "REPLACE_이모니카@gmail.com" },
  { name: "한XX", baptismalName: "라파엘",  email: "REPLACE_한라파엘@gmail.com" },
  { name: "이XX", baptismalName: "라파엘",  email: "REPLACE_이라파엘@gmail.com" },
];

// ==================== Firebase Admin 초기화 ====================
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ==================== 메인 ====================
async function seedTeachers(): Promise<void> {
  console.log("🔑 teachers_whitelist 컬렉션 초기화 시작...\n");
  console.log("⚠️  이메일 주소를 실제 Google 계정 이메일로 교체했는지 확인하세요!\n");

  const COLLECTION = "teachers_whitelist";
  const batch = db.batch();

  for (const teacher of TEACHERS) {
    if (teacher.email.startsWith("REPLACE_")) {
      console.warn(`  ⚠️  ${teacher.name} ${teacher.baptismalName}: 이메일 미설정 (${teacher.email})`);
    }

    // 이메일을 문서 ID로 사용 (소문자 정규화)
    const docId = teacher.email.toLowerCase().replace(/[@.]/g, "_");
    const docRef = db.collection(COLLECTION).doc(docId);

    batch.set(docRef, {
      name: teacher.name,
      baptismalName: teacher.baptismalName,
      email: teacher.email.toLowerCase(),
      phone: teacher.phone ?? null,
      role: "teacher",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  ✅ ${teacher.name} ${teacher.baptismalName} (${teacher.email})`);
  }

  await batch.commit();

  console.log(`\n✅ ${TEACHERS.length}명의 교사 화이트리스트 등록 완료`);
  console.log("\n📌 다음 단계:");
  console.log("  1. 위 이메일 주소를 실제 Google 계정 이메일로 수정 후 재실행");
  console.log("  2. 각 선생님이 로그인하면 teachers/{uid} 문서가 자동 생성됨");
  console.log("  3. Firestore rules는 teachers/{uid} 존재 여부로 권한 판단");
}

seedTeachers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ 오류:", err);
    process.exit(1);
  });
