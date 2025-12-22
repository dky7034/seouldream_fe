# 데이터 추출 API 가이드 (XLSX Export)

이 문서는 서버의 데이터를 XLSX(Excel) 파일 형태로 다운로드하는 API에 대한 명세와 사용법을 안내합니다. 이 API들은 JSON이 아닌 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 형식의 파일을 직접 반환합니다.

**Base URL:** `http://localhost:8080`

---

## 1. 셀 멤버 명단 추출

-   **설명:** 특정 셀에 소속된 모든 활성 멤버의 기본 정보를 XLSX(Excel) 파일로 다운로드합니다.
-   **Endpoint:** `GET /api/export/cells/{cellId}/members.xlsx`
-   **필요 권한:** `EXECUTIVE`, 해당 셀의 `CELL_LEADER`.
-   **응답 형식:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 요청 (Request)

#### Path Variable
-   `cellId` (Long, **필수**): 멤버 명단을 추출할 셀의 ID.

#### 예시
`GET http://localhost:8080/api/export/cells/1/members.xlsx`
(브라우저에서 이 주소로 접근하면 `cell-1-members.xlsx` 파일이 다운로드됩니다.)

### 엑셀 파일 내용

"ID", "Name", "Gender", "BirthDate", "Phone", "Email", "JoinYear", "Address" 등의 헤더를 가진 엑셀 시트가 생성됩니다.

---

## 2. 셀 출석 현황 추출

-   **설명:** 특정 셀의 지정된 기간 동안의 모든 출석 기록을 XLSX(Excel) 파일로 다운로드합니다.
-   **Endpoint:** `GET /api/export/cells/{cellId}/attendances.xlsx`
-   **필요 권한:** `EXECUTIVE`, 해당 셀의 `CELL_LEADER`.
-   **응답 형식:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 요청 (Request)

#### Path Variable
-   `cellId` (Long, **필수**): 출석 현황을 추출할 셀의 ID.

#### Query Parameters
-   `startDate` (String, **필수**): 조회 시작 날짜 (형식: `YYYY-MM-DD`).
-   `endDate` (String, **필수**): 조회 종료 날짜 (형식: `YYYY-MM-DD`).

#### 예시
`GET http://localhost:8080/api/export/cells/1/attendances.xlsx?startDate=2025-01-01&endDate=2025-03-31`
(브라우저에서 접근 시 `cell-1-attendances-2025-01-01-to-2025-03-31.xlsx` 파일이 다운로드됩니다.)

### 엑셀 파일 내용

"Date", "MemberName", "Status", "Memo", "RecordedBy" 등의 헤더를 가진 엑셀 시트가 생성됩니다.

