# 기도제목 API 가이드

본 문서는 기도제목 관리 기능과 관련된 API의 명세와 사용법을 안내합니다.

---

## ※ 중요 공통 규칙 (Important Common Rules)

**아래 두 규칙은 날짜 및 데이터 조회가 포함된 모든 기도제목 API에 일관되게 적용됩니다.**

### 1. 날짜 조회 기본 규칙 (Default Date Filtering)

- **별도의 날짜 관련 파라미터가 없는 경우**, API는 호출 시점의 **현재 연도(1월 1일 ~ 12월 31일)** 데이터를 기본값으로 조회합니다.
- `startDate` & `endDate` 또는 `year` 등의 파라미터를 명시하면 해당 기간의 데이터를 조회할 수 있으며, 과거 연도 데이터 조회도 가능합니다.

### 2. 셀 범위 보안 (Cell Scope Security)

- **셀장(CELL_LEADER)** 또는 **멤버(MEMBER)** 역할의 사용자는, API 호출 시 **자신이 속한 셀과 관련된 데이터만** 조회, 생성, 수정, 삭제할 수 있습니다.
- 파라미터로 다른 셀의 ID(`cellId`)나 다른 셀 멤버의 ID(`memberId`)를 명시적으로 요청하더라도, 서버에서 이를 차단하고 권한 오류를 반환하거나 자신의 셀 정보로 강제합니다.

---

## 1. 데이터 모델 (DTO)

### PrayerVisibility (Enum)

기도제목의 공개 범위를 지정하는 값입니다.

- `ALL`: 전체 공개 (모든 사람이 볼 수 있음)
- `LEADERS_ONLY`: 리더(순장) 이상 공개
- `CELL_ONLY`: 셀(다락방) 내 멤버에게만 공개

### CreatePrayerRequest

새로운 기도제목을 등록할 때 사용하는 요청 객체입니다.

- `memberId` (Long, NotNull): 기도제목의 주체인 멤버 ID
- `content` (String, NotBlank): 기도제목 내용
- `weekOfMonth` (Integer, Nullable): 해당 월의 주차 (예: 1, 2, 3, 4, 5)
- `visibility` (PrayerVisibility, NotNull): 공개 범위
- `createdById` (Long, NotNull): 기도제목을 등록한 사용자 ID (향후 인증 객체에서 자동 처리)

**Example:**

```json
{
  "memberId": 25,
  "content": "건강을 위해 기도해주세요.",
  "weekOfMonth": 2,
  "visibility": "CELL_ONLY",
  "createdById": 25
}
```

### UpdatePrayerRequest

기존 기도제목을 수정할 때 사용하는 요청 객체입니다. 수정하고 싶은 필드만 포함하여 보낼 수 있습니다.

- `content` (String, Nullable)
- `weekOfMonth` (Integer, Nullable)
- `visibility` (PrayerVisibility, Nullable)

**Example:**

```json
{
  "content": "가족의 건강을 위해 기도해주세요.",
  "visibility": "ALL"
}
```

### PrayerDto

기도제목 정보를 나타내는 기본 응답 객체입니다.

- `id` (Long): 기도제목 고유 ID
- `member` (MemberInfo): 기도제목 주체 멤버 정보
- `content` (String): 내용
- `weekOfMonth` (Integer): 해당 월의 주차
- `visibility` (PrayerVisibility): 공개 범위
- `isDeleted` (boolean): 삭제 여부 (논리적 삭제)
- `deletedAt` (LocalDateTime, Nullable): 삭제 시각
- `createdBy` (UserInfo): 등록한 사용자 정보
- `createdAt` (LocalDateTime): 생성 시각
- `updatedAt` (LocalDateTime): 마지막 수정 시각

#### MemberInfo

- `id` (Long): 멤버 ID
- `name` (String): 멤버 이름

#### UserInfo

- `id` (Long): 사용자 ID
- `username` (String): 사용자 로그인 ID
- `name` (String): 사용자 실제 이름

**Example:**

```json
{
  "id": 42,
  "member": {
    "id": 25,
    "name": "김청년"
  },
  "content": "건강을 위해 기도해주세요.",
  "weekOfMonth": 2,
  "visibility": "CELL_ONLY",
  "isDeleted": false,
  "deletedAt": null,
  "createdBy": {
    "id": 25,
    "username": "newbie95",
    "name": "김청년"
  },
  "createdAt": "2025-12-08T10:00:00",
  "updatedAt": "2025-12-08T10:00:00"
}
```

---

## 2. API 엔드포인트

### 1. 기도제목 등록

- **Method:** `POST`
- **URL:** `/api/prayers`
- **Authorization:** 자신의 기도제목 또는 셀 리더가 셀원의 기도제목을 등록할 수 있음.
- **Request Body:** `CreatePrayerRequest`
- **Success Response:** `201 CREATED`
  - **Body:** `PrayerDto`

### 2. 특정 기도제목 조회

- **Method:** `GET`
- **URL:** `/api/prayers/{id}`
- **Authorization:** 해당 기도제목을 볼 수 있는 권한이 필요.
- **Path Variable:** `id` (Long)
- **Success Response:** `200 OK`
  - **Body:** `PrayerDto`

### 3. 기도제목 목록 조회 (페이지네이션 및 필터링 지원)

다양한 조건으로 기도제목 목록을 페이지 단위로 조회합니다.

- **Method:** `GET`
- **URL:** `/api/prayers`
- **Authorization:** 로그인된 사용자.

#### 보안 규칙

- 이 API는 문서 상단의 **'중요 공통 규칙'**에 따라, 사용자의 역할(임원단/셀장)에 맞춰 접근 가능한 데이터 범위가 자동으로 필터링 및 제한됩니다.

#### Query Parameters

- **필터링:**
  - `memberId` (Long, Optional): 특정 멤버의 기도제목 조회
  - `cellId` (Long, Optional): 특정 셀에 속한 멤버들의 기도제목 조회
  - `createdById` (Long, Optional): 특정 사용자가 등록한 기도제목 조회
  - `isDeleted` (Boolean, Optional): 삭제 여부 필터링 (`true` 또는 `false`)
- **기간 필터링 (아래 중 한 가지 방식 선택):**
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
  - `sort` (String, Optional, 기본값: `createdAt,desc`): 정렬 기준. `(필드명),(asc|desc)` 형식.

##### 예시 URL

- **기본 조회:**
  `GET http://localhost:8080/api/prayers?cellId=5&page=0&size=10&sort=createdAt,desc`
  (5번 셀의 기도제목을 최신순으로 정렬하여 0번 페이지 10개 조회)
- **기간 지정 조회:**
  `GET http://localhost:8080/api/prayers?startDate=2024-01-01&endDate=2024-03-31`
- **연/분기 지정 조회:**
  `GET http://localhost:8080/api/prayers?year=2024&quarter=1`
  (2024년 1분기의 모든 기도제목 조회)

##### Success Response: `200 OK`

- **Body:** `Page<PrayerDto>`

### 4. 데이터가 있는 연도 목록 조회

- **Method:** `GET`
- **URL:** `/api/prayers/available-years`
- **설명:** 기도제목 데이터가 한 건이라도 존재하는 모든 연도를 중복 없이, 내림차순으로 정렬하여 반환합니다. 이 API는 사용자의 역할에 따라 다른 결과를 반환합니다.
- **필요 권한:** `isAuthenticated()` (로그인된 모든 사용자)
  - **`ROLE_EXECUTIVE`:** 전체 기도제목 기준
  - **`ROLE_CELL_LEADER`:** 전체 공개 + 자기 셀 기도제목 기준
  - **`MEMBER`:** 전체 공개 + 자기 셀 + 자기 기도제목 기준
- **Success Response:** `200 OK`
  - **Body:** `[2025, 2024]` 과 같은 숫자 배열

### 5. 기도제목 수정

- **Method:** `PATCH`
- **URL:** `/api/prayers/{id}`
- **Authorization:** 기도제목을 등록한 본인 또는 셀 리더, 임원단.
- **Path Variable:** `id` (Long)
- **Request Body:** `UpdatePrayerRequest`
- **Success Response:** `200 OK`
  - **Body:** `PrayerDto`

### 6. 기도제목 삭제

기도제목을 논리적으로 삭제 처리합니다. (`isDeleted` 플래그를 `true`로 설정)

- **Method:** `DELETE`
- **URL:** `/api/prayers/{id}`
- **Authorization:** 기도제목을 등록한 본인 또는 셀 리더, 임원단.
- **Path Variable:** `id` (Long)
- **Success Response:** `204 No Content`
