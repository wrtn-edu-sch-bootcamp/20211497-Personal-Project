/**
 * students.json 파일을 읽어 Firestore students 컬렉션에 bulk import하는 스크립트
 *
 * 사용법:
 * 1. Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *    다운로드한 파일을 scripts/service-account.json 으로 저장
 *
 * 2. 이 스크립트와 같은 폴더(scripts/)에 students.json 배치 또는
 *    아래 STUDENTS_JSON_PATH 변수를 수정
 *
 * 3. 실행:
 *    npx ts-node scripts/import-students.ts
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// ==================== 설정 ====================

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");
const STUDENTS_JSON_PATH = path.join(__dirname, "..", "..", "students.json");

// ==================== 타입 정의 ====================

interface StudentJSON {
  name: string;
  baptismalName: string;
  grade: string;
  isAccompanist: boolean;
  isNewbie: boolean;
}

// ==================== Firebase 초기화 ====================

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "❌ service-account.json 파일이 없습니다.\n" +
      "   Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후\n" +
      `   ${SERVICE_ACCOUNT_PATH} 경로에 저장해주세요.`
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
});

const db = admin.firestore();

// ==================== 메인 로직 ====================

/**
 * 학년 문자열(중1, 고3 등)을 isNewMember 여부로 변환
 * 중1은 신입으로 처리
 */
function resolveIsNewMember(grade: string, isNewbie: boolean): boolean {
  if (isNewbie) return true;
  return grade === "중1";
}

/**
 * 세례명이 없는 경우 null 처리
 */
function resolveBaptismalName(name: string): string | null {
  const empty = ["없음", "세례못받음", "미세례", ""];
  return empty.includes(name.trim()) ? null : name.trim();
}

async function importStudents(): Promise<void> {
  console.log("📂 students.json 로드 중...");

  if (!fs.existsSync(STUDENTS_JSON_PATH)) {
    console.error(`❌ JSON 파일을 찾을 수 없습니다: ${STUDENTS_JSON_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(STUDENTS_JSON_PATH, "utf-8");
  const students: StudentJSON[] = JSON.parse(raw);

  console.log(`✅ ${students.length}명의 학생 데이터 로드 완료\n`);

  // 기존 데이터 확인
  const existingSnapshot = await db.collection("students").get();
  if (!existingSnapshot.empty) {
    console.warn(
      `⚠️  경고: 이미 students 컬렉션에 ${existingSnapshot.size}개의 문서가 있습니다.`
    );
    console.warn(
      "   기존 데이터를 유지한 채 새 데이터를 추가합니다. 중복이 생길 수 있습니다.\n"
    );
  }

  // Firestore는 한 번에 500개까지 batch write 가능
  const BATCH_SIZE = 499;
  let processed = 0;

  while (processed < students.length) {
    const chunk = students.slice(processed, processed + BATCH_SIZE);
    const batch = db.batch();

    for (const student of chunk) {
      const docRef = db.collection("students").doc();
      const baptismalName = resolveBaptismalName(student.baptismalName);
      const isNewMember = resolveIsNewMember(student.grade, student.isNewbie);

      batch.set(docRef, {
        name: student.name,
        baptismalName,
        grade: student.grade,
        role: "student",
        skills: [],
        canPlayInstrument: student.isAccompanist,
        instrumentType: student.isAccompanist ? "piano" : null,
        isNewMember,
        joinedAt: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  📝 ${processed}/${students.length}명 처리 완료`);
  }

  console.log(`\n🎉 총 ${students.length}명의 학생 데이터를 Firestore에 추가했습니다!`);

  // 결과 요약 출력
  const accompanists = students.filter((s) => s.isAccompanist);
  const newbies = students.filter(
    (s) => s.isNewbie || s.grade === "중1"
  );
  const noBaptismal = students.filter((s) =>
    ["없음", "세례못받음"].includes(s.baptismalName)
  );

  console.log("\n📊 데이터 요약:");
  console.log(`   - 전체: ${students.length}명`);
  console.log(`   - 반주자: ${accompanists.length}명`);
  console.log(`   - 신입(중1 포함): ${newbies.length}명`);
  console.log(`   - 세례명 없음: ${noBaptismal.length}명`);
}

async function main() {
  console.log("🚀 학생 데이터 Firestore Import 시작\n");

  try {
    await importStudents();
  } catch (error) {
    console.error("❌ 오류 발생:", error);
  } finally {
    process.exit();
  }
}

main();
