/**
 * 구글 시트 → Firebase 실시간 동기화 (Google Apps Script)
 * 
 * 설정 방법:
 * 1. 구글 시트 열기
 * 2. 상단 메뉴 "확장 프로그램" → "Apps Script" 클릭
 * 3. 이 코드를 복사하여 붙여넣기
 * 4. 아래 설정값들을 실제 값으로 변경
 * 5. 저장 후 "트리거" 아이콘 클릭
 * 6. "트리거 추가" → 함수: onFormSubmit → 이벤트: 양식 제출 시
 * 
 * Firebase REST API 설정:
 * - Firebase Console → 프로젝트 설정 → 서비스 계정
 * - "데이터베이스 비밀번호" 탭에서 비밀키 생성 (또는 Firebase Admin SDK 사용)
 */

// ==================== 설정 ====================
const CONFIG = {
  // Firebase 설정
  FIREBASE_PROJECT_ID: "YOUR_PROJECT_ID", // Firebase 프로젝트 ID
  FIREBASE_DATABASE_URL: "https://YOUR_PROJECT_ID.firebaseio.com",
  FIREBASE_API_KEY: "YOUR_WEB_API_KEY", // Firebase 웹 API 키
  
  // 시트 컬럼 매핑 (1부터 시작)
  COLUMNS: {
    TIMESTAMP: 1,     // A열
    STUDENT_NAME: 2,  // B열
    MASS_DATE: 3,     // C열
    AVAILABILITY: 4,  // D열
    COMMENT: 5,       // E열
  }
};

// ==================== 메인 함수 ====================

/**
 * 폼 제출 시 자동 실행되는 함수
 */
function onFormSubmit(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const row = e.range.getRow();
    
    // 데이터 추출
    const timestamp = sheet.getRange(row, CONFIG.COLUMNS.TIMESTAMP).getValue();
    const studentName = sheet.getRange(row, CONFIG.COLUMNS.STUDENT_NAME).getValue();
    const massDateRaw = sheet.getRange(row, CONFIG.COLUMNS.MASS_DATE).getValue();
    const availability = sheet.getRange(row, CONFIG.COLUMNS.AVAILABILITY).getValue();
    const comment = sheet.getRange(row, CONFIG.COLUMNS.COMMENT).getValue();
    
    // 날짜 포맷 변환
    const massDate = formatDate(massDateRaw);
    
    // 상태 변환
    const status = convertStatus(availability);
    
    // Firebase에 전송할 데이터
    const data = {
      studentName: studentName,
      massDate: massDate,
      status: status,
      comment: comment || "",
      submittedAt: new Date().toISOString(),
      syncedFromSheets: true
    };
    
    // Firebase에 저장
    saveToFirebase(data);
    
    Logger.log("✅ 동기화 완료: " + studentName + " - " + massDate);
    
  } catch (error) {
    Logger.log("❌ 오류 발생: " + error.toString());
  }
}

/**
 * 수동으로 전체 시트 동기화
 */
function syncAllData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  Logger.log("📊 총 " + (lastRow - 1) + "개의 행 동기화 시작...");
  
  for (let row = 2; row <= lastRow; row++) {
    try {
      const studentName = sheet.getRange(row, CONFIG.COLUMNS.STUDENT_NAME).getValue();
      const massDateRaw = sheet.getRange(row, CONFIG.COLUMNS.MASS_DATE).getValue();
      const availability = sheet.getRange(row, CONFIG.COLUMNS.AVAILABILITY).getValue();
      const comment = sheet.getRange(row, CONFIG.COLUMNS.COMMENT).getValue();
      
      if (!studentName || !massDateRaw || !availability) continue;
      
      const massDate = formatDate(massDateRaw);
      const status = convertStatus(availability);
      
      const data = {
        studentName: studentName,
        massDate: massDate,
        status: status,
        comment: comment || "",
        submittedAt: new Date().toISOString(),
        syncedFromSheets: true
      };
      
      saveToFirebase(data);
      
    } catch (error) {
      Logger.log("❌ 행 " + row + " 오류: " + error.toString());
    }
  }
  
  Logger.log("🎉 전체 동기화 완료!");
}

// ==================== 헬퍼 함수 ====================

/**
 * 한국어 상태를 영어로 변환
 */
function convertStatus(koreanStatus) {
  const statusMap = {
    "가능": "available",
    "불가능": "unavailable",
    "애매": "uncertain",
    "참석": "available",
    "불참": "unavailable",
    "O": "available",
    "X": "unavailable",
    "△": "uncertain"
  };
  
  const trimmed = (koreanStatus || "").toString().trim();
  return statusMap[trimmed] || "uncertain";
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
function formatDate(dateValue) {
  if (!dateValue) return null;
  
  let date;
  
  if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    // 문자열인 경우 파싱 시도
    date = new Date(dateValue);
  }
  
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd");
}

/**
 * Firebase REST API로 데이터 저장
 */
function saveToFirebase(data) {
  const url = CONFIG.FIREBASE_DATABASE_URL + "/availabilities.json";
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode !== 200) {
    throw new Error("Firebase 저장 실패: " + response.getContentText());
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Firebase Firestore REST API로 데이터 저장 (대안)
 */
function saveToFirestore(data) {
  const url = "https://firestore.googleapis.com/v1/projects/" + 
              CONFIG.FIREBASE_PROJECT_ID + 
              "/databases/(default)/documents/availabilities";
  
  // Firestore 문서 형식으로 변환
  const firestoreData = {
    fields: {
      studentName: { stringValue: data.studentName },
      massDate: { stringValue: data.massDate },
      status: { stringValue: data.status },
      comment: { stringValue: data.comment },
      submittedAt: { timestampValue: data.submittedAt },
      syncedFromSheets: { booleanValue: true }
    }
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(firestoreData),
    headers: {
      "Authorization": "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  
  if (response.getResponseCode() !== 200) {
    throw new Error("Firestore 저장 실패: " + response.getContentText());
  }
  
  return JSON.parse(response.getContentText());
}

// ==================== 메뉴 추가 ====================

/**
 * 스프레드시트 열 때 커스텀 메뉴 추가
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🐟 어망 동기화")
    .addItem("전체 동기화", "syncAllData")
    .addItem("연결 테스트", "testConnection")
    .addToUi();
}

/**
 * Firebase 연결 테스트
 */
function testConnection() {
  try {
    const testData = {
      test: true,
      timestamp: new Date().toISOString()
    };
    
    const result = saveToFirebase(testData);
    SpreadsheetApp.getUi().alert("✅ Firebase 연결 성공!\n\n응답: " + JSON.stringify(result));
    
  } catch (error) {
    SpreadsheetApp.getUi().alert("❌ 연결 실패!\n\n오류: " + error.toString());
  }
}
