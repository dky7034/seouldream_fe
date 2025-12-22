# 셀 관리 API 가이드

본 문서는 셀(다락방) 관리 기능과 관련된 API의 명세와 사용법을 안내합니다.

---

## ※ 중요 공통 규칙 (Important Common Rules)

**아래 두 규칙은 이 문서에 포함된 출석 통계 조회 등, 날짜 및 데이터 조회가 포함된 모든 API에 일관되게 적용됩니다.**

### 1. 날짜 조회 기본 규칙 (Default Date Filtering)
- **별도의 날짜 관련 파라미터가 없는 경우**, API는 **현재 활성화된 학기**의 기간을 기본값으로 조회합니다.
- `startDate` & `endDate` 또는 `year` 등의 파라미터를 명시하면 해당 기간의 데이터를 조회할 수 있으며, 과거 연도 데이터 조회도 가능합니다.

### 2. 셀 범위 보안 (Cell Scope Security)
- **셀리더(CELL_LEADER)** 역할의 사용자는, API 호출 시 **자신이 속한 셀의 데이터만** 조회, 생성, 수정, 삭제할 수 있습니다.
- `cellId` 또는 `memberId` 파라미터로 다른 셀의 정보를 명시적으로 요청하더라도, 서버에서 이를 차단하고 권한 오류를 반환합니다.

---

## 1. 데이터 모델 (DTO)

### CreateCellRequest
새로운 셀을 생성할 때 사용하는 요청 객체입니다.

- `name` (String, NotBlank): 셀 이름 (예: "기쁨셀")
- `leaderId` (Long, Nullable): 셀 리더(순장)의 멤버 ID
- `viceLeaderId` (Long, Nullable): 셀 부리더(부순장)의 멤버 ID
- `description` (String, Nullable): 셀에 대한 설명
- `memberIds` (List<Long>, Nullable): 셀에 소속시킬 멤버들의 ID 목록. `leaderId`나 `viceLeaderId`가 여기에 포함되어 있어도 중복 처리되므로 괜찮습니다.

**Example:**
```json
{
  "name": "사랑셀",
  "leaderId": 15,
  "memberIds": [15, 22, 31, 45]
}
```

### UpdateCellRequest
기존 셀의 정보를 수정할 때 사용하는 요청 객체입니다. 수정하고 싶은 필드만 포함하여 보낼 수 있습니다.

- `name` (String, Nullable): 새로운 셀 이름
- `leaderId` (Long, Nullable): 새로운 리더의 멤버 ID
- `viceLeaderId` (Long, Nullable): 새로운 부리더의 멤버 ID
- `description` (String, Nullable): 새로운 설명
- `active` (Boolean, Nullable): 셀 활성화 상태

**Example:**
```json
{
  "leaderId": 21,
  "viceLeaderId": 22
}
```

### CellDto
셀 정보를 나타내는 기본 응답 객체입니다.

- `id` (Long): 셀의 고유 ID
- `name` (String): 셀 이름
- `leader` (MemberInfo, Nullable): 리더 정보
- `viceLeader` (MemberInfo, Nullable): 부리더 정보
- `description` (String): 셀 설명
- `active` (boolean): 활성화 여부
- `memberCount` (Integer): 셀에 소속된 총 활성 멤버 수
- `maleCount` (Integer): 셀에 소속된 남성 멤버 수
- `femaleCount` (Integer): 셀에 소속된 여성 멤버 수
- `members` (List<MemberInfo>): 셀에 소속된 활성 멤버 목록
- `createdAt` (LocalDateTime): 생성 시각
- `updatedAt` (LocalDateTime): 마지막 수정 시각

#### MemberInfo
- `id` (Long): 멤버 고유 ID
- `name` (String): 멤버 이름
- `gender` (String): 멤버 성별 ("MALE" 또는 "FEMALE")
- `birthDate` (LocalDate): 생년월일

**Example:**
```json
{
  "id": 5,
  "name": "사랑셀",
  "leader": {
    "id": 15,
    "name": "박순장",
    "gender": "MALE",
    "birthDate": "1992-05-10"
  },
  "viceLeader": null,
  "description": "",
  "active": true,
  "memberCount": 12,
  "maleCount": 5,
  "femaleCount": 7,
  "members": [
    {
      "id": 15,
      "name": "박순장",
      "gender": "MALE",
      "birthDate": "1992-05-10"
    },
    {
      "id": 32,
      "name": "이순원",
      "gender": "FEMALE",
      "birthDate": "1995-11-20"
    }
  ],
  "createdAt": "2025-02-01T14:00:00",
  "updatedAt": "2025-02-01T14:00:00"
}
```

### CellAttendanceSummaryDto
특정 셀의 출석 현황 요약 정보입니다. 기간별 상세 통계 (`periodSummaries`)와 함께 전체 기간에 대한 총 요약 정보 (`totalSummary`)를 포함합니다.

- `cellId` (Long): 셀의 고유 ID
- `cellName` (String): 셀 이름
- `periodSummaries` (List<OverallAttendanceSummaryDto.PeriodSummaryDto>): `groupBy` 파라미터에 따라 일별, 주별, 월별로 그룹화된 출석 통계 목록.
- `totalSummary` (TotalSummaryDto): 조회 기간 전체에 대한 출석 총 요약 정보.

#### TotalSummaryDto (CellAttendanceSummaryDto 내부)
- `totalPresent` (Long): 총 출석 수
- `totalAbsent` (Long): 총 결석 수
- `totalMembers` (Long): 기간 내 활성 상태였던 셀 멤버 수
- `totalRecordedDates` (Long): 출석이 기록된 고유한 날짜 수 (출석체크 기회)
- `attendanceRate` (Double): 전체 기간 출석률 (%). 계산식: `(totalPresent / (totalPresent + totalAbsent)) * 100`.

**Example:**
```json
{
  "cellId": 1,
  "cellName": "사랑셀",
  "periodSummaries": [
    {
      "dateGroup": "2025-01",
      "totalPresent": 10,
      "totalAbsent": 2,
      "totalMembers": 5,
      "attendanceRate": 83.33 // (10 / (10 + 2)) * 100
    }
  ],
  "totalSummary": {
    "totalPresent": 40,
    "totalAbsent": 8,
    "totalMembers": 5,
    "totalRecordedDates": 8, // 8번의 출석체크 기회
    "attendanceRate": 83.33 // (40 / (40 + 8)) * 100
  }
}
```

### SimpleAttendanceRateDto
특정 셀이나 멤버의 간단한 출석률 정보를 반환하는 DTO입니다.

- `targetId` (Long, Nullable): 대상의 ID (셀 또는 멤버)
- `targetName` (String): 대상의 이름
- `attendanceRate` (Double): 출석률 (%). 계산식: `(presentCount / totalDays) * 100`.
- `presentCount` (Long): 총 출석 수
- `absentCount` (Long): 총 결석 수
- `totalDays` (Long): 출석이 기록된 총 일수 (present + absent 합)
- `startDate` (LocalDate): 조회 시작일
- `endDate` (LocalDate): 조회 종료일

### CellMemberAttendanceSummaryDto
특정 셀에 속한 개별 멤버의 출석 요약 정보를 나타내는 DTO입니다.

- `memberId` (Long): 멤버 ID
- `memberName` (String): 멤버 이름
- `gender` (String): 성별 (`"MALE"` / `"FEMALE"`)
- `birthDate` (LocalDate): 생년월일
- `joinYear` (Integer): 가입 연도
- `active` (boolean): 멤버 활성 상태
- `lastAttendanceDate` (LocalDate, Nullable): 가장 최근에 '출석(PRESENT)'으로 기록된 날짜. 출석 기록이 전혀 없으면 `null`입니다.
- `consecutiveAbsences` (int): 가장 최근 출석일부터 현재까지 연속으로 '결석(ABSENT)'한 횟수.

### ProcessAttendanceWithPrayersRequest
셀 모임 보고서(은혜나눔, 셀장 근황 등)와 개별 출석/기도제목을 함께 저장하기 위한 통합 요청 객체입니다.

- `meetingDate` (LocalDate, NotNull): 모임 날짜 (예: `2025-12-08`). 이 날짜는 하위 `items`의 모든 출석/기도제목에 일괄 적용됩니다.
- `cellShare` (String, NotBlank): 셀 은혜나눔 내용
- `leaderStatus` (String, NotBlank): 셀장 근황
- `leaderPrayerRequest` (String, NotBlank): 셀장 기도제목
- `specialNotes` (String, Nullable): 특이사항
- `items` (List<AttendanceAndPrayerItem>, NotNull): 처리할 개별 멤버의 출석 및 기도제목 항목 목록

#### AttendanceAndPrayerItem
각 멤버의 출석 및 기도제목 정보를 담는 객체입니다. `meetingDate`가 상위 객체로 이동함에 따라 `date` 필드는 제거되었습니다.

- `memberId` (Long, NotNull): 멤버 ID
- `status` (AttendanceStatus, NotNull): 출석 상태 (`PRESENT`, `ABSENT`)
- `memo` (String, Nullable): 출석 비고
- `prayerContent` (String, Nullable): 기도제목 내용 (비어있으면 기도제목은 저장되지 않음)

---

## 2. API 엔드포인트

### 1. 셀 생성

새로운 셀을 생성합니다.

- **Method:** `POST`
- **URL:** `/api/cells`
- **Authorization:** `ROLE_EXECUTIVE` (임원단) 권한 필요
- **Request Body:** `CreateCellRequest`
- **Success Response:** `201 CREATED`
  - **Body:** `CellDto` - 생성된 셀의 정보

### 2. 모든 셀 조회 (페이지네이션 및 필터링 지원)

현재 시스템에 존재하는 모든 셀의 목록을 페이지 단위로 조회하며, 다양한 조건으로 필터링 및 정렬할 수 있습니다.

- **Method:** `GET`
- **URL:** `/api/cells`
- **Authorization:** 로그인된 사용자

#### Query Parameters
- **필터링:**
  - `name` (String, Optional): 셀 이름 (부분 일치 검색)
  - `active` (Boolean, Optional): 활성 상태 (`true` 또는 `false`)
- **기간 필터링 (생성일 기준, 아래 중 한 가지 방식 선택):**
  - **방식 1: 기간 지정**
    - `startDate` (LocalDate, Optional): 조회 시작 날짜 (ISO_DATE 포맷: "YYYY-MM-DD")
    - `endDate` (LocalDate, Optional): 조회 종료 날짜 (ISO_DATE 포맷: "YYYY-MM-DD")
  - **방식 2: 연/월/분기/반기 지정 (더 높은 우선순위)**
    - `year` (Integer, Optional): 조회할 연도 (예: `2024`)
    - `month` (Integer, Optional): 조회할 월 (1-12). `year` 파라미터와 함께 사용해야 합니다.
    - `quarter` (Integer, Optional): 조회할 분기 (1-4). `year` 파라미터와 함께 사용해야 합니다.
    - `half` (Integer, Optional): 조회할 반기 (1-2). `year` 파라미터와 함께 사용해야 합니다.
- **페이지네이션:**
  - `page` (int, Optional, 기본값: `0`): 조회할 페이지 번호 (0부터 시작)
  - `size` (int, Optional, 기본값: `10`): 한 페이지에 보여줄 항목 수
- **정렬:**
  - `sort` (String, Optional, 기본값: `name,asc`): 정렬 기준. `(필드명),(asc|desc)` 형식.
    - **사용 가능 필드명:** `id`, `name`, `createdAt`, `memberCount` 등

##### 예시 URL
- **멤버 수 내림차순 정렬:**
  `GET http://localhost:8080/api/cells?sort=memberCount,desc`
- **2024년 2분기에 생성된 셀 조회:**
  `GET http://localhost:8080/api/cells?year=2024&quarter=2`

##### Success Response: `200 OK`
- **Body:** `Page<CellDto>`

```json
{
  "content": [
    // CellDto 객체 목록...
    {
      "id": 5,
      "name": "사랑셀",
      "memberCount": 12,
      // ...
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 10,
    "sort": {
      "sorted": true,
      "unsorted": false,
      "empty": false
    },
    // ...
  },
  "totalPages": 2,
  "totalElements": 35,
  // ...
}
```

### 3. 특정 셀 조회

고유 ID를 사용하여 특정 셀의 상세 정보를 조회합니다.

- **Method:** `GET`
- **URL:** `/api/cells/{id}`
- **Authorization:** 로그인된 사용자
- **Path Variable:**
  - `id` (Long): 조회할 셀의 고유 ID
- **Success Response:** `200 OK`
  - **Body:** `CellDto`
- **Error Response:**
  - `404 Not Found`: 해당 ID의 셀이 없을 경우

### 4. 셀 정보 수정

특정 셀의 정보를 수정합니다.

- **Method:** `PATCH`
- **URL:** `/api/cells/{id}`
- **Authorization:** `ROLE_EXECUTIVE` (임원단) 권한 필요
- **Path Variable:**
  - `id` (Long): 수정할 셀의 고유 ID
- **Request Body:** `UpdateCellRequest`
- **Success Response:** `200 OK`
  - **Body:** `CellDto` - 수정된 셀의 정보

### 5. 셀 삭제

특정 셀을 삭제합니다. 삭제 시, 해당 셀에 소속되어 있던 모든 멤버들은 자동으로 '소속 없음' 상태가 됩니다. 만약 멤버 중 셀 리더가 있었다면, 역할이 일반 '멤버'로 변경됩니다.

- **Method:** `DELETE`
- **URL:** `/api/cells/{id}`
- **Authorization:** `ROLE_EXECUTIVE` (임원단) 권한 필요
- **Path Variable:**
  - `id` (Long): 삭제할 셀의 고유 ID
- **Success Response:** `204 No Content`

### 6. 특정 셀 상세 출석 현황 조회 (기간별 및 누적)

특정 셀의 지정된 기간 동안의 상세 출석 현황을 조회합니다. `groupBy` 파라미터로 기간별(일, 주, 월) 통계를, `totalSummary` 필드로 전체 기간에 대한 누적 통계를 제공합니다.

- **Method:** `GET`
- **URL:** `/api/cells/{cellId}/attendances/summary`
- **Authorization:** `ROLE_EXECUTIVE` 또는 해당 셀의 리더(`@customSecurityEvaluator.isCellLeaderOfCell`)
- **Path Variable:**
  - `cellId` (Long): 출석을 조회할 셀의 고유 ID
- **Query Parameters:**
  - `startDate` (LocalDate, Required): 조회 시작 날짜 (e.g., `2025-01-01`)
  - `endDate` (LocalDate, Required): 조회 종료 날짜 (e.g., `2025-03-31`)
  - `groupBy` (String, Optional, Default: `MONTH`): 그룹화 기준 (`DAY`, `WEEK`, `MONTH`)
- **Success Response:** `200 OK`
  - **Body:** `CellAttendanceSummaryDto`

### 7. 특정 셀 간단 출석률 조회

특정 셀의 지정된 기간 동안의 간단 출석률을 조회합니다.

- **Method:** `GET`
- **Query Parameters:**
  - **기간 필터링 (아래 중 한 가지 방식 또는 조합하여 사용):**
    - `startDate` (LocalDate, Optional): 조회 시작 날짜 (형식: `YYYY-MM-DD`)
    - `endDate` (LocalDate, Optional): 조회 종료 날짜 (형식: `YYYY-MM-DD`)
    - `year` (Integer, Optional): 특정 연도로 필터링
    - `month` (Integer, Optional): 특정 월로 필터링 (1~12)
    - `quarter` (Integer, Optional): 특정 분기로 필터링 (1~4)
    - `half` (Integer, Optional): 특정 반기로 필터링 (1~2)
  - *참고: 기간 관련 파라미터가 없으면 **현재 활성화된 학기**를 기본 기간으로 사용합니다.*
- **Success Response:** `200 OK`
  - **Body:** `SimpleAttendanceRateDto`

### 8. 특정 셀의 모든 멤버별 출석률 조회

특정 셀에 속한 모든 활성 멤버 각각의 출석 통계(출석률, 횟수 등) 목록을 조회합니다.

- **Method:** `GET`
- **URL:** `/api/cells/{cellId}/members/attendance-rate`
- **Authorization:** `ROLE_EXECUTIVE` 또는 해당 셀의 리더(`@customSecurityEvaluator.isCellLeaderOfCell`)
- **Path Variable:**
  - `cellId` (Long): 통계를 조회할 셀의 고유 ID
- **Query Parameters:**
  - **기간 필터링 (아래 중 한 가지 방식 또는 조합하여 사용):**
    - `startDate` (LocalDate, Optional): 조회 시작 날짜 (형식: `YYYY-MM-DD`)
    - `endDate` (LocalDate, Optional): 조회 종료 날짜 (형식: `YYYY-MM-DD`)
    - `year` (Integer, Optional): 특정 연도로 필터링
    - `month` (Integer, Optional): 특정 월로 필터링 (1~12)
    - `quarter` (Integer, Optional): 특정 분기로 필터링 (1~4)
    - `half` (Integer, Optional): 특정 반기로 필터링 (1~2)
  - *참고: 기간 관련 파라미터가 없으면 **현재 활성화된 학기**를 기본 기간으로 사용합니다.*
- **Success Response:** `200 OK`
  - **Body:** `List<SimpleAttendanceRateDto>` - 각 멤버의 출석 통계 DTO가 담긴 배열

### 9. 특정 셀 멤버별 상세 출석 요약 조회 (NEW)

특정 셀에 속한 모든 활성 멤버 각각의 상세 출석 요약 정보(최근 출석일, 연속 결석 횟수 등)를 조회합니다.

- **Method:** `GET`
- **URL:** `/api/cells/{cellId}/members/attendance-summary`
- **Authorization:** `ROLE_EXECUTIVE` 또는 해당 셀의 리더 (`@customSecurityEvaluator.isCellLeaderOfCell`)
- **Path Variable:**
  - `cellId` (Long): 요약 정보를 조회할 셀의 고유 ID
- **Query Parameters:** 없음
- **Success Response:** `200 OK`
  - **Body:** `List<CellMemberAttendanceSummaryDto>`

#### 응답 예시 (JSON)
```json
[
  {
    "memberId": 15,
    "memberName": "박순장",
    "gender": "MALE",
    "birthDate": "1992-05-10",
    "joinYear": 2020,
    "active": true,
    "lastAttendanceDate": "2025-11-30",
    "consecutiveAbsences": 0
  },
  {
    "memberId": 32,
    "memberName": "이순원",
    "gender": "FEMALE",
    "birthDate": "1995-11-20",
    "joinYear": 2022,
    "active": true,
    "lastAttendanceDate": "2025-11-16",
    "consecutiveAbsences": 2
  },
  {
    "memberId": 45,
    "memberName": "김신입",
    "gender": "MALE",
    "birthDate": "2001-03-01",
    "joinYear": 2025,
    "active": true,
    "lastAttendanceDate": null,
    "consecutiveAbsences": 4
  }
]
```

### 10. 특정 셀의 데이터가 있는 연도 목록 조회

특정 셀의 출석 데이터가 한 건이라도 존재하는 모든 연도를 중복 없이, 내림차순으로 정렬하여 반환합니다.

- **Method:** `GET`
- **URL:** `/api/cells/{cellId}/available-years`
- **Authorization:** `ROLE_EXECUTIVE` 또는 해당 셀의 리더(`@customSecurityEvaluator.isCellLeaderOfCell`)
- **Path Variable:**
  - `cellId` (Long): 연도를 조회할 셀의 고유 ID
- **Query Parameters:** 없음
- **Success Response:** `200 OK`
  - **Body:** `[2025, 2024]` 과 같은 숫자 배열

### 11. 셀장 대시보드 요약 정보 조회

셀장 대시보드에 필요한 핵심 지표들(출석 인원, 총 인원, 출석률, 미완료 출석 체크 주수)을 한 번에 조회합니다.

- **Method:** `GET`
- **URL:** `/api/cells/{cellId}/dashboard-summary`
- **Authorization:** `ROLE_EXECUTIVE` 또는 해당 셀의 리더(`@customSecurityEvaluator.isCellLeaderOfCell`)
- **Path Variable:**
  - `cellId` (Long): 요약 정보를 조회할 셀의 고유 ID
- **Query Parameters:**
  - **기간 필터링 (아래 중 한 가지 방식 또는 조합하여 사용):**
    - `startDate` (LocalDate, Optional): 조회 시작 날짜 (형식: `YYYY-MM-DD`)
    - `endDate` (LocalDate, Optional): 조회 종료 날짜 (형식: `YYYY-MM-DD`)
    - `year` (Integer, Optional): 특정 연도로 필터링 (셀장의 경우 현재 연도로 제한됨)
    - `month` (Integer, Optional): 특정 월로 필터링 (1~12). `year` 파라미터와 함께 사용해야 합니다.
    - `quarter` (Integer, Optional): 특정 분기로 필터링 (1~4). `year` 파라미터와 함께 사용해야 합니다.
    - `half` (Integer, Optional): 특정 반기로 필터링 (1~2). `year` 파라미터와 함께 사용해야 합니다.
  - *참고: 기간 관련 파라미터가 없으면 **현재 활성화된 학기**를 기본 기간으로 사용합니다.*
- **Success Response:** `200 OK`
  - **Body:** `CellLeaderDashboardDto`

#### 응답 예시 (JSON)
```json
{
  "presentRecords": 85,
  "totalMembers": 12,
  "attendanceRate": 90.5,
  "incompleteCheckCount": 2
}
```

### 12. 출석, 기도제목, 셀 보고서 통합 저장 (UPDATED)

특정 셀의 멤버들에 대한 출석 정보, 기도제목, 그리고 셀 모임 보고서를 단일 요청으로 함께 저장합니다.

- **Method:** `POST`
- **URL:** `/api/cells/{cellId}/attendance-with-prayers`
- **Authorization:** `ROLE_EXECUTIVE` 또는 해당 셀의 리더(`@customSecurityEvaluator.isCellLeaderOfCell`)
- **Path Variable:**
  - `cellId` (Long): 출석 및 기도제목을 저장할 셀의 고유 ID
- **Request Body:** `ProcessAttendanceWithPrayersRequest`
- **Success Response:** `204 No Content`
  - *성공 시 본문 없음*
- **Error Response:**
  - `400 Bad Request`: 요청 데이터 유효성 검증 실패 (예: 멤버가 해당 셀에 속하지 않음, 날짜 규칙 위반 등)
  - `403 Forbidden`: 권한 없음 (예: 셀장이 자신의 셀이 아닌 다른 셀에 저장 시도)
  - `404 Not Found`: 셀을 찾을 수 없음

**Example Request Body:**
```json
{
  "meetingDate": "2025-12-08",
  "cellShare": "다니엘서 말씀을 통해 많은 은혜를 나누었습니다.",
  "leaderStatus": "감기 기운이 있었지만 괜찮습니다.",
  "leaderPrayerRequest": "가족의 건강을 위해 기도해주세요.",
  "specialNotes": "김순원 형제가 다음 주에 이사를 갑니다.",
  "items": [
    {
      "memberId": 1,
      "status": "PRESENT",
      "memo": "컨디션 좋음",
      "prayerContent": "가족 건강을 위한 기도"
    },
    {
      "memberId": 2,
      "status": "ABSENT",
      "memo": "개인 사정",
      "prayerContent": null
    },
    {
      "memberId": 3,
      "status": "PRESENT",
      "memo": null,
      "prayerContent": "시험 합격을 위한 기도"
    }
  ]
}
```
