# 출석 관리 API 가이드

이 문서는 셀드림셀 백엔드의 출석 관리 관련 API 엔드포인트들을 설명합니다.

**Base URL:** `http://localhost:8080`

---

## ※ 중요 공통 규칙 (Important Common Rules)

**아래 두 규칙은 날짜 및 데이터 조회가 포함된 모든 출석 API에 일관되게 적용됩니다.**

### 1. 날짜 조회 기본 규칙 (Default Date Filtering)
- **별도의 날짜 관련 파라미터가 없는 경우**, API는 **현재 활성화된 학기**의 기간을 기본값으로 조회합니다.
- `startDate` & `endDate` 또는 `year` 등의 파라미터를 명시하면 해당 기간의 데이터를 조회할 수 있으며, 과거 연도 데이터 조회도 가능합니다.

### 2. 셀 범위 보안 (Cell Scope Security)
- **셀리더(CELL_LEADER)** 또는 **멤버(MEMBER)** 역할의 사용자는, API 호출 시 **자신이 속한 셀의 데이터만** 조회, 생성, 수정, 삭제할 수 있습니다.
- 파라미터로 다른 셀의 ID(`cellId`)나 다른 셀 멤버의 ID(`memberId`)를 명시적으로 요청하더라도, 서버에서 이를 차단하고 권한 오류를 반환하거나 자신의 셀 정보로 강제합니다.

---

## 1. 엔드포인트 정보

### 1.1. 출석 기록 생성/수정 (Process Attendances)

-   **설명:** 여러 멤버의 출석 기록을 생성하거나 업데이트합니다.
-   **Endpoint:** `POST /api/attendances/process`
-   **필요 권한:** `@customSecurityEvaluator.canProcessAttendanceForMembers(authentication, #requests)` (임원 또는 자신의 셀 멤버에 대해 처리 권한 있는 셀장)
-   **요청 바디 (`List<ProcessAttendanceRequest>`):**
    -   `memberId` (Long): 멤버 ID
    -   `date` (LocalDate): 출석 날짜 (예: "2024-01-01")
    -   `status` (AttendanceStatus): 출석 상태 (`PRESENT`, `ABSENT`)
        - `memo` (String, Optional): 비고
    -   **특이사항:** **출석 기록은 일요일 날짜에 대해서만 처리가 가능합니다.** 다른 요일의 날짜로 요청 시 `400 Bad Request` 응답과 함께 오류 메시지가 반환됩니다.
    -   **응답:** `200 OK` (성공적으로 처리된 출석 기록 목록 `List<AttendanceDto>`)

### 1.2. 전체 출석 요약 조회 (Overall Attendance Summary)

-   **설명:** 전체 교회의 출석 요약 통계를 기간별, 그룹별로 조회합니다.
-   **Endpoint:** `GET /api/attendances/summary/overall`
-   **필요 권한:** `hasRole('EXECUTIVE')` (임원만 가능)
-   **쿼리 파라미터:**
    -   **기간 필터링 (아래 중 한 가지 방식 선택):**
        -   **방식 1: 기간 지정**
            - `startDate` (LocalDate, Optional): 조회 시작 날짜 (ISO_DATE 포맷: "YYYY-MM-DD")
            - `endDate` (LocalDate, Optional): 조회 종료 날짜 (ISO_DATE 포맷: "YYYY-MM-DD")
        -   **방식 2: 연/월/분기/반기 지정 (더 높은 우선순위)**
            - `year` (Integer, Optional): 조회할 연도 (예: `2024`)
            - `month` (Integer, Optional): 조회할 월 (1-12). `year` 파라미터와 함께 사용해야 합니다.
            - `quarter` (Integer, Optional): 조회할 분기 (1-4). `year` 파라미터와 함께 사용해야 합니다.
            - `half` (Integer, Optional): 조회할 반기 (1-2). `year` 파라미터와 함께 사용해야 합니다.
    -   `groupBy` (GroupBy, Optional): 그룹화 기준 (`DAY`, `WEEK`, `MONTH`, `QUARTER`, `HALF_YEAR`, `YEAR`, 기본값: `MONTH`)
-   **응답:** `200 OK` (`OverallAttendanceSummaryDto`)

### 1.3. 전체 출석률 조회 (Overall Attendance Rate)

-   **설명:** 전체 교회의 단순 출석률을 조회합니다.
-   **Endpoint:** `GET /api/attendances/rate/overall`
-   **필요 권한:** `hasRole('EXECUTIVE')` (임원만 가능)
-   **쿼리 파라미터:**
    -   `startDate` (LocalDate): 조회 시작일 (필수, ISO_DATE 포맷: "YYYY-MM-DD")
    -   `endDate` (LocalDate): 조회 종료일 (필수, ISO_DATE 포맷: "YYYY-MM-DD")
-   **응답:** `200 OK` (`SimpleAttendanceRateDto`)

### 1.4. 멤버별 출석 요약 조회 (Member Attendance Summary)

-   **설명:** 특정 멤버의 출석 요약 통계를 기간별, 그룹별로 조회합니다.
-   **Endpoint:** `GET /api/attendances/summary/members/{memberId}`
-   **필요 권한:** `@customSecurityEvaluator.canViewMemberAttendanceSummary(authentication, #memberId)` (임원, 자신의 셀 멤버를 조회하는 셀장, 본인 출석을 조회하는 일반 멤버)
-   **경로 변수 (`Path Variable`):**
    -   `memberId` (Long): 조회할 멤버 ID
-   **쿼리 파라미터:**
    -   **기간 필터링 (아래 중 한 가지 방식 선택):**
        -   **방식 1: 기간 지정**
            - `startDate` (LocalDate, Optional): 조회 시작 날짜 (ISO_DATE 포맷: "YYYY-MM-DD")
            - `endDate` (LocalDate, Optional): 조회 종료 날짜 (ISO_DATE 포맷: "YYYY-MM-DD")
        -   **방식 2: 연/월/분기/반기 지정 (더 높은 우선순위)**
            - `year` (Integer, Optional): 조회할 연도 (예: `2024`)
            - `month` (Integer, Optional): 조회할 월 (1-12). `year` 파라미터와 함께 사용해야 합니다.
            - `quarter` (Integer, Optional): 조회할 분기 (1-4). `year` 파라미터와 함께 사용해야 합니다.
            - `half` (Integer, Optional): 조회할 반기 (1-2). `year` 파라미터와 함께 사용해야 합니다.
    -   `groupBy` (GroupBy, Optional): 그룹화 기준 (`DAY`, `WEEK`, `MONTH`, `QUARTER`, `HALF_YEAR`, `YEAR`, 기본값: `MONTH`)
-   **응답:** `200 OK` (`MemberAttendanceSummaryDto`)

### 1.5. 출석 경고 조회 (Attendance Alerts)

-   **설명:** 연속 결석 멤버에 대한 경고 목록을 조회합니다.
-   **Endpoint:** `GET /api/attendances/alerts`
-   **필요 권한:** `hasAnyRole('EXECUTIVE', 'CELL_LEADER')` (임원 또는 셀장)
-   **쿼리 파라미터:**
    -   `consecutiveAbsences` (int, Optional): 연속 결석 기준 일수 (기본값: `3`)
-   **응답:** `200 OK` (`List<MemberAlertDto>`)

### 1.6. 출석 기록 조회 (고급 검색)

-   **설명:** 다양한 조건으로 출석 기록을 필터링하고 페이지네이션하여 조회합니다.
-   **Endpoint:** `GET /api/attendances`
-   **필요 권한:** `isAuthenticated()`
-   **쿼리 파라미터:**
    -   **기간 필터링 (아래 중 한 가지 방식 선택):**
        -   **방식 1: 기간 지정**
            - `startDate` (LocalDate, Optional): 조회 시작 날짜 (ISO_DATE 포맷)
            - `endDate` (LocalDate, Optional): 조회 종료 날짜 (ISO_DATE 포맷)
        -   **방식 2: 연/월/분기/반기 지정 (더 높은 우선순위)**
            - `year` (Integer, Optional): 조회할 연도 (예: `2024`)
            - `month` (Integer, Optional): 조회할 월 (1-12). `year` 파라미터와 함께 사용해야 합니다.
            - `quarter` (Integer, Optional): 조회할 분기 (1-4). `year` 파라미터와 함께 사용해야 합니다.
            - `half` (Integer, Optional): 조회할 반기 (1-2). `year` 파라미터와 함께 사용해야 합니다.
        -   *참고: 기간 관련 파라미터가 없으면 **현재 활성화된 학기**를 기본 기간으로 사용합니다.*
    -   **기타 필터링:**
        -   `memberId` (Long, Optional): 특정 멤버 ID로 필터링
        -   `cellId` (Long, Optional): 특정 셀 ID로 필터링
        -   `status` (AttendanceStatus, Optional): 특정 출석 상태로 필터링 (`PRESENT` 또는 `ABSENT`)
    -   **페이지네이션 및 정렬:**
        -   `page` (int, Optional, 기본값: `0`): 페이지 번호
        -   `size` (int, Optional, 기본값: `20`): 페이지 크기
        -   `sort` (String, Optional, 기본값: `date,desc`): 정렬 기준 (예: `member.name,asc`)
-   **응답:** `200 OK` (`Page<AttendanceDto>`)

### 1.7. 출석 기록 삭제 (Delete Attendance)

-   **설명:** 특정 출석 기록을 삭제합니다.
-   **Endpoint:** `DELETE /api/attendances/{id}`
-   **필요 권한:** `@customSecurityEvaluator.canManageAttendance(authentication, #id)` (임원 또는 자신의 셀 멤버에 대한 기록 처리 권한 있는 셀장)
-   **경로 변수 (`Path Variable`):**
    -   `id` (Long): 삭제할 출석 기록 ID
-   **응답:** `204 No Content`

---

## 2. 응답 데이터 모델 (DTO)

*(이 섹션은 `frontend-dtos.md` 파일과 중복될 수 있으므로, 간략하게 주요 DTO들을 명시합니다. 상세 정의는 `frontend-dtos.md`를 참조하세요.)*

-   `AttendanceDto`
-   `OverallAttendanceSummaryDto`
-   `MemberAttendanceSummaryDto`
    -   `memberId` (Long): 멤버 ID
    -   `memberName` (String): 멤버 이름
    -   `periodSummaries` (List<`MemberPeriodSummaryDto`>): 기간별 요약 목록
    -   `totalSummary` (`TotalSummaryDto`): 전체 기간에 대한 총 요약
        -   `totalPresent` (Long): 총 출석 수
        -   `totalAbsent` (Long): 총 결석 수
        -   `totalRecordedDates` (Long): 출석/결석이 기록된 총 횟수 (`totalPresent + totalAbsent`)
        -   `totalPossibleAttendances` (Long): 출석 가능 횟수 (위와 동일)
        -   `attendanceRate` (Double): 출석률 (%). 계산식: `(totalPresent / (totalPresent + totalAbsent)) * 100`
-   `CellAttendanceSummaryDto`
-   `MemberAlertDto`
-   `SimpleAttendanceRateDto`
-   `ProcessAttendanceRequest`
-   `GroupBy` Enum: `DAY`, `WEEK`, `MONTH`, `QUARTER`, `HALF_YEAR`, `YEAR`
-   `AttendanceStatus` Enum: `PRESENT`, `ABSENT`

---

## 3. 응답 예시 (JSON)

### 3.1. `GET /api/attendances/summary/members/{memberId}?year=2025&groupBy=QUARTER`

```json
{
  "memberId": 1,
  "memberName": "홍길동",
  "periodSummaries": [
    {
      "dateGroup": "2025-Q1",
      "status": null,
      "memo": null,
      "presentCount": 10,
      "absentCount": 2
    },
    {
      "dateGroup": "2025-Q2",
      "status": null,
      "memo": null,
      "presentCount": 12,
      "absentCount": 0
    }
  ],
  "totalSummary": {
    "totalPresent": 22,
    "totalAbsent": 2,
    "totalRecordedDates": 24,
    "totalPossibleAttendances": 24,
    "attendanceRate": 91.67
  }
}
```
