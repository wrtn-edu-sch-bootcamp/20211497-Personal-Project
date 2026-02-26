/**
 * 특정 월의 토요일 미사 일정을 Firestore `massDates` 컬렉션에 등록
 *
 * 실행 방법:
 *   npx ts-node --project scripts/tsconfig.json scripts/seedMassDates.ts
 *
 * 전제 조건:
 *   - scripts/service-account.json (Firebase Admin 서비스 계정 키)
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// ==================== 설정 ====================

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");

// 생성할 연도
const TARGET_YEAR = 2026;

// 역할 목록
const DEFAULT_ROLES = [
  "reading1",
  "reading2",
  "commentary",
  "accompaniment",
  "prayer1",
  "prayer2",
];

// ==================== 초기화 ====================

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`[ERROR] service-account.json을 찾을 수 없습니다: ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ==================== 헬퍼 ====================

function getSaturdaysOfYear(year: number): Date[] {
  const saturdays: Date[] = [];
  const date = new Date(year, 0, 1); // 1월 1일
  
  // 첫 번째 토요일 찾기
  while (date.getDay() !== 6) {
    date.setDate(date.getDate() + 1);
  }
  
  // 해당 연도의 모든 토요일
  while (date.getFullYear() === year) {
    saturdays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }
  
  return saturdays;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ==================== 메인 ====================

async function main() {
  console.log(`\n[${TARGET_YEAR}년 전체 미사 일정 생성 시작]\n`);

  const saturdays = getSaturdaysOfYear(TARGET_YEAR);
  console.log(`${TARGET_YEAR}년 토요일: 총 ${saturdays.length}일\n`);

  // 월별로 그룹화해서 출력
  const byMonth: Record<number, Date[]> = {};
  for (const sat of saturdays) {
    const mon = sat.getMonth() + 1;
    if (!byMonth[mon]) byMonth[mon] = [];
    byMonth[mon].push(sat);
  }
  
  for (let mon = 1; mon <= 12; mon++) {
    const dates = byMonth[mon] || [];
    console.log(`  ${mon}월: ${dates.length}일 - ${dates.map(d => d.getDate() + "일").join(", ")}`);
  }

  // 기존 일정 확인 (2026년 전체)
  const start = new Date(TARGET_YEAR, 0, 1);
  const end = new Date(TARGET_YEAR + 1, 0, 1);

  const existingSnap = await db
    .collection("massDates")
    .where("date", ">=", admin.firestore.Timestamp.fromDate(start))
    .where("date", "<", admin.firestore.Timestamp.fromDate(end))
    .get();

  if (!existingSnap.empty) {
    console.log(`\n기존 ${existingSnap.size}개의 일정이 존재합니다. 삭제 후 재생성합니다.`);
    
    // Firestore batch는 500개 제한이 있으므로 나눠서 삭제
    const docs = existingSnap.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    console.log(`기존 일정 삭제 완료`);
  }

  // 새 일정 생성 (batch 500개 제한 고려)
  console.log(`\n새 일정 생성 중...`);
  
  for (let i = 0; i < saturdays.length; i += 500) {
    const batch = db.batch();
    const chunk = saturdays.slice(i, i + 500);
    
    for (const saturday of chunk) {
      const docRef = db.collection("massDates").doc();
      batch.set(docRef, {
        date: admin.firestore.Timestamp.fromDate(saturday),
        roles: DEFAULT_ROLES,
        createdBy: "system",
        createdAt: admin.firestore.Timestamp.now(),
      });
    }
    
    await batch.commit();
    console.log(`  ${i + 1} ~ ${Math.min(i + 500, saturdays.length)}번째 일정 생성 완료`);
  }

  console.log(`\n[완료] ${TARGET_YEAR}년 총 ${saturdays.length}개의 미사 일정이 생성되었습니다.`);
  console.log(`이제 /teacher 페이지에서 아무 월이나 선택하고 AI 배정을 실행할 수 있습니다.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ERROR]", err);
    process.exit(1);
  });
