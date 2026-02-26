/**
 * Firebase 초기 데이터 시드 스크립트
 * 
 * 사용법:
 * 1. Firebase Admin SDK 서비스 계정 키 다운로드
 *    - Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *    - 다운로드한 파일을 scripts/service-account.json 으로 저장
 * 
 * 2. 스크립트 실행
 *    npx ts-node scripts/seed-data.ts
 */

import * as admin from "firebase-admin";
import * as path from "path";

// 서비스 계정 키 파일 경로
const serviceAccountPath = path.join(__dirname, "service-account.json");

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

const db = admin.firestore();

// ==================== 학생 데이터 ====================
const STUDENTS = [
  {
    name: "김영희",
    email: "younghee@example.com",
    skills: ["reading"],
    canPlayInstrument: true,
    instrumentType: "piano",
    isNewMember: false,
  },
  {
    name: "이철수",
    email: "cheolsu@example.com",
    skills: [],
    canPlayInstrument: false,
    isNewMember: true,
  },
  {
    name: "박민수",
    email: "minsu@example.com",
    skills: ["reading", "commentary"],
    canPlayInstrument: false,
    isNewMember: false,
  },
  {
    name: "정수진",
    email: "sujin@example.com",
    skills: ["prayer"],
    canPlayInstrument: false,
    isNewMember: false,
  },
  {
    name: "최동현",
    email: "donghyun@example.com",
    skills: ["accompaniment"],
    canPlayInstrument: true,
    instrumentType: "guitar",
    isNewMember: false,
  },
  {
    name: "강지은",
    email: "jieun@example.com",
    skills: ["reading"],
    canPlayInstrument: false,
    isNewMember: false,
  },
  {
    name: "윤서연",
    email: "seoyeon@example.com",
    skills: [],
    canPlayInstrument: false,
    isNewMember: true,
  },
  {
    name: "임태호",
    email: "taeho@example.com",
    skills: ["commentary"],
    canPlayInstrument: false,
    isNewMember: false,
  },
  {
    name: "한미래",
    email: "mirae@example.com",
    skills: ["prayer", "reading"],
    canPlayInstrument: false,
    isNewMember: false,
  },
  {
    name: "조예은",
    email: "yeeun@example.com",
    skills: [],
    canPlayInstrument: true,
    instrumentType: "piano",
    isNewMember: true,
  },
];

// ==================== 야훼이레 성가 데이터 (일부) ====================
const HYMNS = [
  { number: 1, title: "주님은 나의 목자", source: "yahweh-ire" },
  { number: 2, title: "주님의 기도", source: "yahweh-ire" },
  { number: 15, title: "주님께 감사하리", source: "yahweh-ire" },
  { number: 32, title: "주여 나를 이끄소서", source: "yahweh-ire" },
  { number: 45, title: "사랑의 주님", source: "yahweh-ire" },
  { number: 57, title: "주님의 은총", source: "yahweh-ire" },
  { number: 68, title: "평화의 기도", source: "yahweh-ire" },
  { number: 72, title: "하늘에 가득 찬", source: "yahweh-ire" },
  { number: 88, title: "감사하며 드리는", source: "yahweh-ire" },
  { number: 95, title: "이 몸을 드리오니", source: "yahweh-ire" },
  { number: 100, title: "주를 찬미하리라", source: "yahweh-ire" },
  { number: 120, title: "성모찬가", source: "yahweh-ire" },
  { number: 150, title: "하느님을 찬미하여라", source: "yahweh-ire" },
  // 고정 성가
  { number: 0, title: "거룩하시도다", source: "fixed" },
  { number: 0, title: "하느님의 어린양", source: "fixed" },
];

async function seedStudents() {
  console.log("📚 학생 데이터 시드 시작...");

  const batch = db.batch();

  for (const student of STUDENTS) {
    const docRef = db.collection("students").doc();
    batch.set(docRef, {
      ...student,
      role: "student",
      joinedAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  await batch.commit();
  console.log(`✅ ${STUDENTS.length}명의 학생 데이터 추가 완료`);
}

async function seedHymns() {
  console.log("🎵 성가 데이터 시드 시작...");

  const batch = db.batch();

  for (const hymn of HYMNS) {
    const docRef = db.collection("hymns").doc();
    batch.set(docRef, {
      ...hymn,
      createdAt: admin.firestore.Timestamp.now(),
    });
  }

  await batch.commit();
  console.log(`✅ ${HYMNS.length}개의 성가 데이터 추가 완료`);
}

async function seedTeacher() {
  console.log("👨‍🏫 교사 계정 생성...");

  const teacherDoc = db.collection("users").doc("teacher-demo");
  await teacherDoc.set({
    role: "teacher",
    name: "홍길동 선생님",
    email: "teacher@example.com",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log("✅ 교사 계정 생성 완료");
}

async function main() {
  console.log("🚀 Firebase 초기 데이터 시드 시작\n");

  try {
    await seedStudents();
    await seedHymns();
    await seedTeacher();

    console.log("\n🎉 모든 초기 데이터 시드 완료!");
  } catch (error) {
    console.error("❌ 오류 발생:", error);
  } finally {
    process.exit();
  }
}

main();
