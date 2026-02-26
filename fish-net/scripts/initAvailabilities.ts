/**
 * Firestore `availabilities` 컬렉션 초기화 스크립트
 *
 * Firestore는 빈 컬렉션을 직접 만들 수 없으므로,
 * _placeholder 문서를 write한 뒤 즉시 delete하여 컬렉션을 생성함.
 *
 * 실행 방법:
 *   npx ts-node --project scripts/tsconfig.json scripts/initAvailabilities.ts
 *
 * 전제 조건:
 *   - scripts/service-account.json  (Firebase Admin 서비스 계정 키)
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// ==================== 초기화 ====================

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`[ERROR] service-account.json 을 찾을 수 없습니다: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const COLLECTION = "availabilities";

// ==================== 메인 ====================

async function main() {
  console.log(`\n[availabilities 컬렉션 초기화 시작]\n`);

  // 1. 이미 컬렉션에 문서가 있는지 확인
  const existing = await db.collection(COLLECTION).limit(1).get();
  if (!existing.empty) {
    console.log(`이미 '${COLLECTION}' 컬렉션에 문서가 존재합니다.`);
    console.log(`문서 수: ${(await db.collection(COLLECTION).get()).size}개`);
    console.log("초기화를 건너뜁니다.\n");
    process.exit(0);
  }

  // 2. 플레이스홀더 문서 write
  const placeholderRef = db.collection(COLLECTION).doc("_placeholder");
  await placeholderRef.set({
    _init: true,
    createdAt: admin.firestore.Timestamp.now(),
    note: "컬렉션 초기화용 문서 — 자동 삭제됨",
  });
  console.log(`플레이스홀더 문서 생성 완료: ${COLLECTION}/_placeholder`);

  // 3. 즉시 삭제 → 빈 컬렉션 확보
  await placeholderRef.delete();
  console.log(`플레이스홀더 문서 삭제 완료`);

  console.log(`\n'${COLLECTION}' 컬렉션이 Firestore에 준비되었습니다.`);
  console.log(
    "학생들이 /student/response 에서 응답을 제출하면 자동으로 문서가 추가됩니다.\n"
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ERROR]", err);
    process.exit(1);
  });
