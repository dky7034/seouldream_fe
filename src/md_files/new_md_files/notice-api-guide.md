# 공지사항 API 가이드

본 문서는 공지사항 관리 기능과 관련된 API의 명세와 사용법을 안내합니다.

---

## 1. 데이터 모델 (DTO)

### NoticeTarget (Enum)
공지사항의 게시 대상을 지정하는 값입니다.

- `ALL`: 전체 공지
- `LEADERS`: 리더(순장) 이상 공지
- `CELL`: 특정 셀 대상 공지

### CreateNoticeRequest
새로운 공지사항을 작성할 때 사용하는 요청 객체입니다.

- `title` (String, NotBlank): 제목
- `content` (String, NotBlank): 내용
- `target` (NoticeTarget, NotNull): 게시 대상 (`ALL`, `LEADERS`, `CELL`)
- `targetCellId` (Long, Nullable): `target`이 `CELL`일 경우, 대상 셀의 ID
- `pinned` (Boolean, Nullable): 상단 고정 여부 (기본값: `false`)
- `publishAt` (LocalDateTime, Nullable): 게시 시작 시각 (예약 발행. `YYYY-MM-DDTHH:mm`)
- `expireAt` (LocalDateTime, Nullable): 게시 종료 시각 (`YYYY-MM-DDTHH:mm`)
- `createdById` (Long, NotNull): 작성자 ID (향후 인증 객체에서 자동 처리)

**Example:**
```json
{
  "title": "리더 모임 안내",
  "content": "이번 주 금요일 저녁 8시에 리더 모임이 있습니다.",
  "target": "LEADERS",
  "pinned": true,
  "createdById": 101,
  "publishAt": "2025-12-10T09:00",
  "expireAt": "2025-12-12T23:00"
}
```

### UpdateNoticeRequest
기존 공지사항을 수정할 때 사용하는 요청 객체입니다. 수정하고 싶은 필드만 포함하여 보낼 수 있습니다.

- `title` (String, Nullable)
- `content` (String, Nullable)
- `target` (NoticeTarget, Nullable)
- `targetCellId` (Long, Nullable)
- `pinned` (Boolean, Nullable)
- `publishAt` (LocalDateTime, Nullable): `YYYY-MM-DDTHH:mm`
- `expireAt` (LocalDateTime, Nullable): `YYYY-MM-DDTHH:mm`

**Example:**
```json
{
  "content": "이번 주 금요일 저녁 8시에 온라인(Zoom)으로 리더 모임이 있습니다.",
  "pinned": false
}
```

### NoticeDto
공지사항 정보를 나타내는 기본 응답 객체입니다.

- `id` (Long): 공지사항 고유 ID
- `title` (String): 제목
- `content` (String): 내용
- `target` (NoticeTarget): 게시 대상
- `targetCell` (CellInfo, Nullable): 대상 셀 정보
- `pinned` (boolean): 상단 고정 여부
- `publishAt` (LocalDateTime): 게시 시작 시각
- `expireAt` (LocalDateTime): 게시 종료 시각
- `isDeleted` (boolean): 삭제 여부 (논리적 삭제)
- `createdBy` (UserInfo): 작성자 정보
- `createdAt` (LocalDateTime): 생성 시각
- `updatedAt` (LocalDateTime): 마지막 수정 시각

#### UserInfo
- `id` (Long): 사용자 ID
- `username` (String): 사용자 로그인 ID
- `name` (String): 사용자 실제 이름

#### CellInfo
- `id` (Long): 셀 ID
- `name` (String): 셀 이름

**Example:**
```json
{
  "id": 12,
  "title": "리더 모임 안내",
  "content": "이번 주 금요일 저녁 8시에 리더 모임이 있습니다.",
  "target": "LEADERS",
  "targetCell": null,
  "pinned": true,
  "publishAt": null,
  "expireAt": null,
  "isDeleted": false,
  "createdBy": {
    "id": 101,
    "username": "executive1",
    "name": "김임원"
  },
  "createdAt": "2025-11-28T15:00:00",
  "updatedAt": "2025-11-28T15:00:00"
}
```

---

## 2. API 엔드포인트

### 1. 공지사항 생성
- **Method:** `POST`
- **URL:** `/api/notices`
- **Authorization:** `ROLE_EXECUTIVE`
- **Request Body:** `CreateNoticeRequest`
- **Success Response:** `201 CREATED`
  - **Body:** `NoticeDto`

### 2. 모든 공지사항 조회 (페이지네이션 및 필터링 지원)
- **Method:** `GET`
- **URL:** `/api/notices`
- **Authorization:** 로그인된 사용자

#### Query Parameters
- **콘텐츠 필터링:**
  - `title` (String, Optional): 제목 (부분 일치 검색)
  - `target` (NoticeTarget, Optional): 공지 대상 (`ALL`, `LEADERS`, `CELL`)
  - `pinned` (Boolean, Optional): 상단 고정 여부 (`true` 또는 `false`)
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
  - `sort` (String, Optional): 정렬 기준. `(필드명),(asc|desc)` 형식. **`createdAt` 필드만 지원합니다.**
  - **기본 정렬 순서:**
    1. **고정 공지**가 항상 최상단에 위치합니다. (`pinned,desc`)
    2. 그 다음, `sort` 파라미터로 받은 `createdAt` 정렬(오름/내림차순)이 적용됩니다.
    3. `sort` 파라미터가 없으면, **최신 작성일** 순서(`createdAt,desc`)로 기본 정렬됩니다.
  - **예시:**
    - `.../api/notices?sort=createdAt,asc` (오래된 순으로 정렬)
    - `.../api/notices?sort=createdAt,desc` (최신 순으로 정렬)

##### 예시 URL
- **리더 대상의 상단 고정 공지 조회:**
  `GET http://localhost:8080/api/notices?target=LEADERS&pinned=true`
- **2024년 1분기에 작성된 공지 조회:**
  `GET http://localhost:8080/api/notices?year=2024&quarter=1`

##### Success Response: `200 OK`
- **Body:** `Page<NoticeDto>`

### 3. 데이터가 있는 연도 목록 조회
- **Method:** `GET`
- **URL:** `/api/notices/available-years`
- **설명:** 공지사항 데이터가 한 건이라도 존재하는 모든 연도를 중복 없이, 내림차순으로 정렬하여 반환합니다.
- **필요 권한:** `isAuthenticated()` (로그인된 모든 사용자)
- **Success Response:** `200 OK`
  - **Body:** `[2025, 2024, 2023]` 과 같은 숫자 배열

### 4. 특정 공지사항 조회
- **Method:** `GET`
- **URL:** `/api/notices/{id}`
- **Authorization:** 로그인된 사용자
- **Path Variable:** `id` (Long)
- **Success Response:** `200 OK`
  - **Body:** `NoticeDto`

### 5. 공지사항 수정
- **Method:** `PATCH`
- **URL:** `/api/notices/{id}`
- **Authorization:** `ROLE_EXECUTIVE`
- **Path Variable:** `id` (Long)
- **Request Body:** `UpdateNoticeRequest`
- **Success Response:** `200 OK`
  - **Body:** `NoticeDto`

### 6. 공지사항 삭제
- **Method:** `DELETE`
- **URL:** `/api/notices/{id}`
- **Authorization:** `ROLE_EXECUTIVE`
- **Path Variable:** `id` (Long)
- **Success Response:** `204 No Content`
