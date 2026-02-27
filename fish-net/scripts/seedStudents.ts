/**
 * students.json → Firestore `students` 컬렉션 초기화 스크립트
 *
 * 실행 방법:
 *   npx ts-node --project scripts/tsconfig.json scripts/seedStudents.ts
 *
 * 전제 조건:
 *   - scripts/service-account.json  (Firebase Admin 서비스 계정 키)
 *   - ../../students.json           (프로젝트 루트의 students.json)
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// ==================== 경로 설정 ====================

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "service-account.json");
// 프로젝트 루트(proj1/)의 students.json
const STUDENTS_JSON_PATH = path.join(__dirname, "..", "..", "students.json");

// ==================== 타입 정의 ====================

interface StudentJSON {
  name: string;
  baptismalName: string;
  grade: string;
  /** true인 학생은 배정 로직에서 '반주(accompaniment)' 역할에 우선순위를 가짐 */
  isAccompanist: boolean;
  isNewbie: boolean;
}

// ==================== Firebase Admin 초기화 ====================

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "❌ service-account.json 을 찾을 수 없습니다.\n" +
      "   Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 후\n" +
      `   ${SERVICE_ACCOUNT_PATH} 에 저장해주세요.`
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
});

const db = admin.firestore();

// ==================== 헬퍼 함수 ====================

/**
 * 세례명 정규화
 * "없음" / "세례못받음" 등은 null로 저장
 */
function normalizeBaptismalName(raw: string): string | null {
  const EMPTY_VALUES = ["없음", "세례못받음", "미세례", ""];
  const trimmed = raw.trim();
  return EMPTY_VALUES.includes(trimmed) ? null : trimmed;
}

/**
 * 신입 여부 판단
 * isNewbie 플래그가 true이거나 중1 학년이면 신입으로 처리
 * 신입은 배정 로직에서 난이도 '쉬움(우리의 기도)' 역할을 우선 배정받음
 */
function resolveIsNewMember(grade: string, isNewbie: boolean): boolean {
  return isNewbie || grade === "중1";
}

/**
 * isAccompanist → skills / canPlayInstrument 변환
 *
 * [배정 로직 우선순위 설명]
 * isAccompanist: true 인 학생은 아래 두 필드를 통해 Claude 배정 AI에 전달됨:
 *   - canPlayInstrument: true  → '반주(accompaniment)' 역할 배정 가능
 *   - skills: ["accompaniment"] → 반주 역할에 우선 배정되도록 가중치 부여
 *
 * Claude 프롬프트(lib/claude.ts)의 배정 원칙 #1:
 *   "반주는 악기 가능자만 배정" → canPlayInstrument: false 인 학생은 아예 후보 제외
 *
 * isAccompanist: false 인 학생은 canPlayInstrument: false, skills: [] 로 저장되어
 * 반주 역할 배정 대상에서 자동으로 제외됨
 */
function resolveInstrumentFields(isAccompanist: boolean): {
  canPlayInstrument: boolean;
  instrumentType: string | null;
  skills: string[];
} {
  if (isAccompanist) {
    return {
      canPlayInstrument: true,
      instrumentType: "piano", // 기본값 piano; 추후 개별 수정 가능
      skills: ["accompaniment"], // 배정 시 반주 역할 우선순위 부여
    };
  }
  return {
    canPlayInstrument: false,
    instrumentType: null,
    skills: [],
  };
}

// ==================== 메인 로직 ====================

async function seedStudents(): Promise<void> {
  console.log("📂 students.json 로드 중...");

  if (!fs.existsSync(STUDENTS_JSON_PATH)) {
    console.error(`❌ students.json 을 찾을 수 없습니다: ${STUDENTS_JSON_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(STUDENTS_JSON_PATH, "utf-8");
  const students: StudentJSON[] = JSON.parse(raw);
  console.log(`✅ ${students.length}명 데이터 로드 완료\n`);

  // 기존 students 컬렉션 문서 수 확인
  const existingSnap = await db
    .collection("students")
    .get();

  if (!existingSnap.empty) {
    console.warn(
      `⚠️  students 컬렉션에 이미 학생 문서 ${existingSnap.size}개가 존재합니다.`
    );
    console.warn("   기존 데이터는 유지하고 새 데이터를 추가합니다.\n");
  }

  // Firestore batch write 한도: 500개/batch
  const BATCH_SIZE = 499;
  let processed = 0;

  while (processed < students.length) {
    const chunk = students.slice(processed, processed + BATCH_SIZE);
    const batch = db.batch();

    for (const student of chunk) {
      const docRef = db.collection("students").doc(); // 자동 ID 생성
      const baptismalName = normalizeBaptismalName(student.baptismalName);
      const isNewMember = resolveIsNewMember(student.grade, student.isNewbie);
      const instrumentFields = resolveInstrumentFields(student.isAccompanist);

      batch.set(docRef, {
        // 기본 정보
        name: student.name,
        baptismalName,           // null = 세례명 없음
        grade: student.grade,
        role: "student",

        // 반주 관련 필드
        // isAccompanist: true → canPlayInstrument: true + skills: ["accompaniment"]
        // → Claude 배정 AI가 반주 역할 우선 배정 대상으로 인식
        canPlayInstrument: instrumentFields.canPlayInstrument,
        instrumentType: instrumentFields.instrumentType,
        skills: instrumentFields.skills,

        // 신입 여부 (중1 포함)
        // → 배정 로직에서 난이도 easy(우리의 기도) 역할 우선 배정
        isNewMember,

        // 타임스탬프
        joinedAt: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  📝 ${processed} / ${students.length}명 완료`);
  }

  // 결과 요약
  const accompanists = students.filter((s) => s.isAccompanist);
  const newbies = students.filter((s) => resolveIsNewMember(s.grade, s.isNewbie));
  const noBaptismal = students.filter((s) =>
    normalizeBaptismalName(s.baptismalName) === null
  );

  console.log(`\n🎉 총 ${students.length}명을 Firestore students 컬렉션에 추가 완료!`);
  console.log("\n📊 업로드 요약:");
  console.log(`   전체      : ${students.length}명`);
  console.log(`   반주자    : ${accompanists.length}명  ← 배정 시 반주 역할 우선`);
  console.log(`   신입(중1) : ${newbies.length}명  ← 배정 시 쉬운 역할 우선`);
  console.log(`   세례명 없음: ${noBaptismal.length}명`);

  if (accompanists.length > 0) {
    console.log("\n🎹 반주자 목록:");
    accompanists.forEach((s) =>
      console.log(`   - ${s.name} (${s.baptismalName}, ${s.grade})`)
    );
  }
}

async function main() {
  console.log("🚀 Firestore 학생 데이터 시드 시작 (students 컬렉션)\n");

  try {
    await seedStudents();
  } catch (error) {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
