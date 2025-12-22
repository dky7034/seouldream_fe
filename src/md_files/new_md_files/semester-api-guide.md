# 학기 관리 API 가이드

본 문서는 학기(Semester) 관리 기능과 관련된 API의 명세와 사용법을 안내합니다. 이 API는 임원단(ROLE_EXECUTIVE) 및 셀장(ROLE_CELL_LEADER)이 사용할 수 있습니다. 단, 학기 생성, 수정, 삭제는 임원단만 가능합니다.

---

## 1. 데이터 모델 (DTO)

### SemesterDto
학기 정보를 나타내는 기본 응답 객체입니다.

- `id` (Long): 학기 고유 ID
- `name` (String): 학기 이름 (예: "2025년 봄학기")
- `startDate` (LocalDate): 학기 시작일
- `endDate` (LocalDate): 학기 종료일
- `isActive` (boolean): 학기 활성화 상태. `true`이면 활성, `false`이면 비활성.

### CreateSemesterRequest
새로운 학기를 생성할 때 사용하는 요청 객체입니다. 생성 시 `isActive`는 자동으로 `true`로 설정됩니다.

- `name` (String, NotBlank)
- `startDate` (LocalDate, NotNull)
- `endDate` (LocalDate, NotNull)

### UpdateSemesterRequest
기존 학기의 정보를 수정할 때 사용하는 요청 객체입니다. 변경하려는 필드만 포함하여 요청할 수 있습니다.

- `name` (String, Nullable)
- `startDate` (LocalDate, Nullable)
- `endDate` (LocalDate, Nullable)
- `isActive` (Boolean, Nullable): 학기 활성화 상태 변경

---

## 2. API 엔드포인트

학기 조회(GET) 엔드포인트는 `ROLE_EXECUTIVE` 또는 `ROLE_CELL_LEADER` 권한이 필요하며, 학기 생성/수정/삭제(POST, PATCH, DELETE) 엔드포인트는 `ROLE_EXECUTIVE` 권한이 필요합니다.

### 1. 모든 학기 목록 조회
- **Method:** `GET`
- **URL:** `/api/semesters`
- **Query Parameters:**
  - `isActive` (Boolean, Optional): 학기 활성화 상태로 필터링합니다.
    - `?isActive=true`: 활성화된 학기만 조회
    - `?isActive=false`: 비활성화된 학기만 조회
    - 파라미터 미포함 시: 모든 학기 조회
- **Success Response:** `200 OK`
  - **Body:** `List<SemesterDto>`

### 2. 특정 학기 조회
- **Method:** `GET`
- **URL:** `/api/semesters/{id}`
- **Path Variable:** `id` (Long)
- **Success Response:** `200 OK`
  - **Body:** `SemesterDto`

### 3. 학기 생성
- **Method:** `POST`
- **URL:** `/api/semesters`
- **Request Body:** `CreateSemesterRequest`
- **Success Response:** `201 CREATED`
  - **Body:** `SemesterDto`

### 4. 학기 수정
부분 수정을 지원하므로 `PATCH` 메소드를 사용합니다.

- **Method:** `PATCH`
- **URL:** `/api/semesters/{id}`
- **Path Variable:** `id` (Long)
- **Request Body:** `UpdateSemesterRequest`
- **Success Response:** `200 OK`
  - **Body:** `SemesterDto`
- **Example Body (상태만 비활성으로 변경 시):**
  ```json
  {
    "isActive": false
  }
  ```

### 5. 학기 삭제
- **Method:** `DELETE`
- **URL:** `/api/semesters/{id}`
- **Path Variable:** `id` (Long)
- **Success Response:** `204 No Content`