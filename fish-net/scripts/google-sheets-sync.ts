/**
 * 구글 시트 → Firebase 동기화 스크립트
 * 
 * 사용법:
 * 1. Google Cloud Console에서 서비스 계정 생성 및 Google Sheets API 활성화
 * 2. 서비스 계정 키를 scripts/google-credentials.json 으로 저장
 * 3. 구글 시트에서 서비스 계정 이메일에 "뷰어" 권한 부여
 * 4. 아래 SPREADSHEET_ID를 실제 스프레드시트 ID로 변경
 * 5. 스크립트 실행: npx ts-node scripts/google-sheets-sync.ts
 */

import * as admin from "firebase-admin";
import { google } from "googleapis";
import * as path from "path";

// ==================== 설정 ====================
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"; // 구글 시트 URL에서 복사
const SHEET_NAME = "응답"; // 시트 이름
const DATA_RANGE = "A2:E"; // 데이터 범위 (헤더 제외)

// 시트 컬럼 매핑 (0부터 시작)
const COLUMN_MAP = {
  timestamp: 0,    // A열: 타임스탬프
  studentName: 1,  // B열: 학생 이름
  massDate: 2,     // C열: 미사 날짜
  availability: 3, // D열: 참석 여부 (가능/불가능/애매)
  comment: 4,      // E열: 코멘트
};

// ==================== 초기화 ====================
const firebaseServiceAccount = path.join(__dirname, "service-account.json");
const googleCredentials = path.join(__dirname, "google-credentials.json");

// Firebase Admin 초기화
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseServiceAccount),
  });
}
const db = admin.firestore();

// Google Sheets API 초기화
async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: googleCredentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

// ==================== 헬퍼 함수 ====================
function convertAvailabilityStatus(korean: string): "available" | "unavailable" | "uncertain" {
  const statusMap: Record<string, "available" | "unavailable" | "uncertain"> = {
    "가능": "available",
    "불가능": "unavailable",
    "애매": "uncertain",
    "참석": "available",
    "불참": "unavailable",
  };
  return statusMap[korean?.trim()] || "uncertain";
}

function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  // 다양한 날짜 형식 처리
  const formats = [
    /(\d{4})-(\d{1,2})-(\d{1,2})/,           // 2026-3-1
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,         // 2026/3/1
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/, // 2026년 3월 1일
  ];

  for (const format of formats) {
    const match = dateString.match(format);
    if (match) {
      const [, year, month, day] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }

  // 기본 Date 파싱 시도
  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// 학생 이름으로 ID 찾기 (캐싱)
const studentCache = new Map<string, string>();

async function getStudentIdByName(name: string): Promise<string | null> {
  if (studentCache.has(name)) {
    return studentCache.get(name)!;
  }

  const snapshot = await db
    .collection("students")
    .where("name", "==", name.trim())
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.warn(`⚠️ 학생을 찾을 수 없음: ${name}`);
    return null;
  }

  const studentId = snapshot.docs[0].id;
  studentCache.set(name, studentId);
  return studentId;
}

// 미사 날짜로 ID 찾기 (캐싱)
const massDateCache = new Map<string, string>();

async function getMassDateId(date: Date): Promise<string | null> {
  const dateKey = date.toISOString().split("T")[0];
  
  if (massDateCache.has(dateKey)) {
    return massDateCache.get(dateKey)!;
  }

  // 날짜 범위로 검색 (해당 일의 시작~끝)
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const snapshot = await db
    .collection("massDates")
    .where("date", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
    .where("date", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.warn(`⚠️ 미사 날짜를 찾을 수 없음: ${dateKey}`);
    return null;
  }

  const massDateId = snapshot.docs[0].id;
  massDateCache.set(dateKey, massDateId);
  return massDateId;
}

// ==================== 동기화 로직 ====================
interface SheetRow {
  timestamp: string;
  studentName: string;
  massDate: string;
  availability: string;
  comment: string;
}

async function fetchSheetData(): Promise<SheetRow[]> {
  const sheets = await getGoogleSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!${DATA_RANGE}`,
  });

  const rows = response.data.values || [];
  
  return rows.map((row) => ({
    timestamp: row[COLUMN_MAP.timestamp] || "",
    studentName: row[COLUMN_MAP.studentName] || "",
    massDate: row[COLUMN_MAP.massDate] || "",
    availability: row[COLUMN_MAP.availability] || "",
    comment: row[COLUMN_MAP.comment] || "",
  }));
}

async function syncToFirebase(data: SheetRow[]): Promise<void> {
  console.log(`📊 총 ${data.length}개의 응답 처리 중...`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const row of data) {
    try {
      // 필수 필드 확인
      if (!row.studentName || !row.massDate || !row.availability) {
        skipCount++;
        continue;
      }

      // 학생 ID 조회
      const studentId = await getStudentIdByName(row.studentName);
      if (!studentId) {
        errorCount++;
        continue;
      }

      // 미사 날짜 파싱 및 ID 조회
      const massDate = parseDate(row.massDate);
      if (!massDate) {
        console.warn(`⚠️ 날짜 파싱 실패: ${row.massDate}`);
        errorCount++;
        continue;
      }

      const massDateId = await getMassDateId(massDate);
      if (!massDateId) {
        errorCount++;
        continue;
      }

      // 상태 변환
      const status = convertAvailabilityStatus(row.availability);

      // 기존 응답 확인
      const existingQuery = await db
        .collection("availabilities")
        .where("studentId", "==", studentId)
        .where("massDateId", "==", massDateId)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        // 기존 응답 업데이트
        await existingQuery.docs[0].ref.update({
          status,
          comment: row.comment || null,
          updatedAt: admin.firestore.Timestamp.now(),
          syncedFromSheets: true,
        });
      } else {
        // 새 응답 생성
        await db.collection("availabilities").add({
          studentId,
          studentName: row.studentName,
          massDateId,
          status,
          comment: row.comment || null,
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          syncedFromSheets: true,
        });
      }

      successCount++;
    } catch (error) {
      console.error(`❌ 오류 (${row.studentName}):`, error);
      errorCount++;
    }
  }

  console.log(`\n📈 동기화 결과:`);
  console.log(`   ✅ 성공: ${successCount}건`);
  console.log(`   ⏭️ 스킵: ${skipCount}건`);
  console.log(`   ❌ 오류: ${errorCount}건`);
}

// ==================== 메인 실행 ====================
async function main() {
  console.log("🔄 구글 시트 → Firebase 동기화 시작\n");

  try {
    // 1. 구글 시트 데이터 가져오기
    console.log("📥 구글 시트에서 데이터 가져오는 중...");
    const sheetData = await fetchSheetData();
    console.log(`   ${sheetData.length}개의 행 발견\n`);

    // 2. Firebase에 동기화
    await syncToFirebase(sheetData);

    console.log("\n🎉 동기화 완료!");
  } catch (error) {
    console.error("❌ 동기화 실패:", error);
  } finally {
    process.exit();
  }
}

main();
