/**
 * Jehovah-jireh.json → Firestore `hymns` 컬렉션 초기화 스크립트
 *
 * 실행 방법:
 *   npx ts-node --project scripts/tsconfig.json scripts/seedHymns.ts
 *
 * 데이터 구조:
 *   - id: 야훼이레 고유 번호 (문서 ID로 사용)
 *   - category: 대분류 (미사곡 / 때제의 묵상노래 / 전례주년 / 일반 성가)
 *   - subcategory: 소분류 (거룩하시도다, @대림 등, 없으면 null)
 *   - title: 성가 제목
 *   - metadata: 작곡자 또는 출처 정보 (없으면 null)
 *   - source: "yahweh-ire" 고정 (앱 내 출처 식별용)
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// ==================== 경로 설정 ====================

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");
const HYMNS_JSON_PATH = path.join(__dirname, "..", "..", "Jehovah-jireh.json");

// ==================== 타입 정의 ====================

interface HymnJSON {
  id: number;
  category: string;
  subcategory?: string;
  title: string;
  metadata: string;
}

// ==================== Firebase Admin 초기화 ====================

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "❌ service-account.json 을 찾을 수 없습니다.\n" +
      `   ${SERVICE_ACCOUNT_PATH} 경로에 저장해주세요.`
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
});

const db = admin.firestore();

// ==================== 메인 로직 ====================

async function seedHymns(): Promise<void> {
  console.log("📂 Jehovah-jireh.json 로드 중...");

  if (!fs.existsSync(HYMNS_JSON_PATH)) {
    console.error(`❌ JSON 파일을 찾을 수 없습니다: ${HYMNS_JSON_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(HYMNS_JSON_PATH, "utf-8");
  const hymns: HymnJSON[] = JSON.parse(raw);
  console.log(`✅ ${hymns.length}개 성가 데이터 로드 완료\n`);

  // 기존 hymns 컬렉션 확인
  const existingSnap = await db.collection("hymns").get();
  if (!existingSnap.empty) {
    console.warn(
      `⚠️  hymns 컬렉션에 이미 ${existingSnap.size}개의 문서가 존재합니다.`
    );
    console.warn("   기존 데이터를 모두 삭제하고 새로 업로드합니다.\n");

    // 기존 데이터 삭제 (batch 단위)
    const deleteBatches: admin.firestore.WriteBatch[] = [];
    let deleteBatch = db.batch();
    let deleteCount = 0;

    for (const docSnap of existingSnap.docs) {
      deleteBatch.delete(docSnap.ref);
      deleteCount++;
      if (deleteCount % 499 === 0) {
        deleteBatches.push(deleteBatch);
        deleteBatch = db.batch();
      }
    }
    if (deleteCount % 499 !== 0) deleteBatches.push(deleteBatch);

    for (const batch of deleteBatches) {
      await batch.commit();
    }
    console.log(`   🗑️  기존 ${existingSnap.size}개 문서 삭제 완료\n`);
  }

  // Firestore batch write (한도: 500개/batch)
  const BATCH_SIZE = 499;
  let processed = 0;

  while (processed < hymns.length) {
    const chunk = hymns.slice(processed, processed + BATCH_SIZE);
    const batch = db.batch();

    for (const hymn of chunk) {
      // id를 문서 ID로 사용 → 조회 시 number로도 쉽게 접근 가능
      const docRef = db.collection("hymns").doc(String(hymn.id));

      batch.set(docRef, {
        number: hymn.id,
        category: hymn.category,
        // subcategory가 없는 항목(때제의 묵상노래, 일부 일반 성가)은 null
        subcategory: hymn.subcategory ?? null,
        title: hymn.title,
        // metadata 빈 문자열은 null로 정규화
        composer: hymn.metadata.trim() || null,
        // 출처 식별: yahweh-ire = 야훼이레 성가집
        source: "yahweh-ire",
        createdAt: admin.firestore.Timestamp.now(),
      });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  📝 ${processed} / ${hymns.length}개 처리 완료`);
  }

  // 카테고리별 요약 통계
  const categoryCount: Record<string, number> = {};
  for (const hymn of hymns) {
    categoryCount[hymn.category] = (categoryCount[hymn.category] ?? 0) + 1;
  }

  console.log(`\n🎉 총 ${hymns.length}개 성가를 Firestore hymns 컬렉션에 추가 완료!`);
  console.log("\n📊 카테고리별 요약:");
  for (const [cat, count] of Object.entries(categoryCount)) {
    console.log(`   ${cat}: ${count}개`);
  }
}

async function main() {
  console.log("🚀 Firestore 성가 데이터 시드 시작 (hymns 컬렉션)\n");

  try {
    await seedHymns();
  } catch (error) {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
