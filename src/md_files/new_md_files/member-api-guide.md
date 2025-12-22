# 멤버 관리 API 가이드

본 문서는 멤버(청년) 관리 기능과 관련된 API의 명세와 사용법을 안내합니다. 멤버 생성 시 사용자 계정도 함께 생성됩니다.

---

## 1. 데이터 모델 (DTO)

### CreateMemberRequest
새로운 멤버를 등록할 때 사용하는 요청 객체입니다. 멤버 정보와 함께 로그인에 사용될 계정 정보(`username`, `password`)를 포함합니다.

- **제약사항:** `role`을 `CELL_LEADER`로 지정할 경우, `cellId`는 반드시 제공되어야 합니다.

- `name` (String, NotBlank): 이름
- `gender` (String, NotNull): 성별 (`MALE` 또는 `FEMALE`)
- `birthDate` (LocalDate, NotNull): 생년월일 (`YYYY-MM-DD`)
- `phone` (String, NotBlank): 연락처
- `email` (String, NotBlank, Email): 이메일
- `cellId` (Long, Nullable): 소속될 셀(다락방)의 ID
- `role` (String, NotNull): 부여할 권한 (`USER`, `LEADER`, `EXECUTIVE`)
- `joinYear` (Integer, NotNull): 등록 연도
- `address` (String, Nullable): 주소
- `note` (String, Nullable): 비고
- `username` (String, NotBlank): 로그인 시 사용할 아이디
- `password` (String, NotBlank): 로그인 시 사용할 비밀번호 (6자 이상)

**Example:**
```json
{
  "name": "김청년",
  "gender": "MALE",
  "birthDate": "1995-05-15",
  "phone": "010-1234-5678",
  "email": "newbie@example.com",
  "cellId": 5,
  "role": "USER",
  "joinYear": 2025,
  "username": "newbie95",
  "password": "password123"
}
```

### UpdateMemberRequest
기존 멤버의 정보를 수정할 때 사용하는 요청 객체입니다. 수정하고 싶은 필드만 포함하여 보낼 수 있습니다.

- **제약사항:** 멤버의 `role`을 `CELL_LEADER`로 변경하거나, `CELL_LEADER`인 멤버의 `cellId`를 `null`로 변경하는 요청은 허용되지 않습니다. 셀 리더는 반드시 셀에 소속되어야 합니다.

- `name` (String, Nullable)
- `gender` (String, Nullable)
- `birthDate` (LocalDate, Nullable)
- `phone` (String, Nullable)
- `email` (String, Nullable, Email)
- `cellId` (Long, Nullable): 소속 셀 변경.
  - **셀 배정/변경**: 변경할 셀의 ID를 숫자로 보냅니다 (예: `123`).
  - **셀 배정 해제**: `0`을 보냅니다.
  - **변경 안 함**: `null`을 보내거나 이 필드를 포함하지 않습니다.
- `role` (String, Nullable): 권한 변경
- `joinYear` (Integer, Nullable)
- `active` (Boolean, Nullable): 활동 상태 (휴식/탈퇴 처리 시 `false`로)
- `address` (String, Nullable)
- `note` (String, Nullable)

**Example (셀 변경):**
```json
{
  "cellId": 7,
  "note": "믿음셀로 소속 변경"
}
```

**Example (셀 배정 해제):**
```json
{
  "cellId": 0
}
```

### MemberDto
멤버 정보를 나타내는 기본 응답 객체입니다.

- `id` (Long): 멤버 고유 ID
- `name` (String): 이름
- `gender` (String): 성별
- `birthDate` (LocalDate): 생년월일
- `age` (Integer): 나이 (자동 계산)
- `phone` (String): 연락처
- `email` (String): 이메일
- `cell` (CellInfo, Nullable): 소속 셀 정보
- `cellAssignmentDate` (LocalDate, Nullable): 현재 셀에 배정된 날짜
- `role` (String): 권한
- `joinYear` (Integer): 등록 연도
- `active` (boolean): 활동 상태
- `address` (String): 주소
- `note` (String): 비고
- `username` (String): 사용자 아이디
- `createdAt` (LocalDateTime)
- `updatedAt` (LocalDateTime)

#### CellInfo
- `id` (Long): 셀 ID
- `name` (String): 셀 이름

**Example:**
```json
{
  "id": 25,
  "name": "김청년",
  "gender": "MALE",
  "birthDate": "1995-05-15",
  "age": 30,
  "phone": "010-1234-5678",
  "email": "newbie@example.com",
  "cell": {
    "id": 5,
    "name": "사랑셀"
  },
  "cellAssignmentDate": "2025-03-01",
  "role": "USER",
  "joinYear": 2025,
  "active": true,
  "address": "서울시 은평구",
  "note": "",
  "username": "newbie95",
  "createdAt": "2025-03-01T18:00:00",
  "updatedAt": "2025-03-01T18:00:00"
}
```

---

## 2. API 엔드포인트

### 기본 CRUD

#### 1. 멤버 등록
새로운 멤버와 사용자 계정을 생성합니다.

- **Method:** `POST`
- **URL:** `/api/members`
- **Authorization:** `ROLE_EXECUTIVE`
- **Request Body:** `CreateMemberRequest`
- **Success Response:** `201 CREATED`
  - **Body:** `MemberDto`
- **Error Response:**
  - `400 Bad Request`: `username` 또는 `email`이 이미 사용 중인 경우.
    - **Body (예시 - 아이디 중복):**
      ```json
      {
        "error": "Bad Request",
        "message": "이미 사용 중인 아이디입니다."
      }
      ```
      또는
    - **Body (예시 - 이메일 중복):**
      ```json
      {
        "error": "Bad Request",
        "message": "이미 사용 중인 이메일입니다."
      }
      ```

#### 2. 모든 멤버 조회 (페이지네이션 및 필터링 지원)
모든 멤버의 목록을 페이지 단위로 조회하며, 다양한 조건으로 필터링 및 정렬할 수 있습니다.

- **Method:** `GET`
- **URL:** `/api/members`
- **Authorization:** 로그인된 사용자

##### Query Parameters
- **필터링:**
  - `name` (String, Optional): 이름 (부분 일치 검색)
  - `joinYear` (Integer, Optional): 가입 연도
  - `gender` (String, Optional): 성별 (`MALE` 또는 `FEMALE`)
  - `role` (String, Optional): 역할 (`MEMBER`, `CELL_LEADER`, `EXECUTIVE`)
  - `unassigned` (Boolean, Optional): 셀 미소속 멤버만 필터링 (`true`로 설정 시)
  - `cellId` (Long, Optional): 특정 셀 ID에 소속된 멤버만 필터링
  - `month` (Integer, Optional): 생일이 있는 월 (1-12)로 멤버 필터링
- **페이지네이션:**
  - `page` (int, Optional, 기본값: `0`): 조회할 페이지 번호 (0부터 시작)
  - `size` (int, Optional, 기본값: `10`): 한 페이지에 보여줄 항목 수
- **정렬:**
  - `sort` (String, Optional, 기본값: `name,asc`): 정렬 기준. `(필드명),(asc|desc)` 형식. (예: `joinYear,desc`)
  - **참고**: `month` 파라미터를 사용하여 월별 생일자를 조회할 경우, `sort` 파라미터를 따로 지정하지 않으면 `birthDate,asc` (생일 날짜 오름차순)로 자동 정렬됩니다.

##### 예시 URL
- 2024년에 가입한 남성 멤버를 이름 오름차순으로 정렬하여 0번 페이지 20개 조회:
  `GET http://localhost:8080/api/members?joinYear=2024&gender=MALE&page=0&size=20&sort=name,asc`
- 셀에 소속되지 않은 멤버 전체 조회:
  `GET http://localhost:8080/api/members?unassigned=true`
- 5번 셀에 소속된 멤버 조회:
  `GET http://localhost:8080/api/members?cellId=5`
- **12월 생일자 목록의 첫 페이지 (20명) 조회 (생일 날짜 오름차순 자동 정렬):**
  `GET http://localhost:8080/api/members?month=12&page=0&size=20`

##### Success Response: `200 OK`
- **Body:** `Page<MemberDto>`

```json
{
  "content": [
    // MemberDto 객체 목록...
    {
      "id": 25,
      "name": "김청년",
      // ...
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 20,
    "sort": {
      "sorted": true,
      "unsorted": false,
      "empty": false
    },
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "totalPages": 5,
  "totalElements": 98,
  "last": false,
  "size": 20,
  "number": 0,
  "sort": {
    "sorted": true,
    "unsorted": false,
    "empty": false
  },
    "numberOfElements": 20,
    "first": true,
    "empty": false
  }
  ```
  
  ### 2.1. 데이터가 있는 등록 연도 목록 조회
  멤버 데이터가 한 건이라도 존재하는 모든 등록 연도(`joinYear`)를 중복 없이, 내림차순으로 정렬하여 반환합니다. 멤버 관리 페이지의 '등록 연도' 필터 옵션을 동적으로 생성하는 데 사용됩니다.
  
  - **Method:** `GET`
  - **URL:** `/api/members/available-join-years`
  - **Authorization:** `isAuthenticated()` (로그인된 모든 사용자)
  - **Success Response:** `200 OK`
    - **Body:** `[2025, 2024, 2023]` 과 같은 숫자 배열
  
  #### 3. 특정 멤버 조회
고유 ID로 특정 멤버의 상세 정보를 조회합니다.

- **Method:** `GET`
- **URL:** `/api/members/{id}`
- **Authorization:** 로그인된 사용자
- **Path Variable:** `id` (Long)
- **Success Response:** `200 OK`
  - **Body:** `MemberDto`

#### 4. 멤버 정보 수정
특정 멤버의 정보를 수정합니다.

- **Method:** `PATCH`
- **URL:** `/api/members/{id}`
- **Authorization:** `ROLE_EXECUTIVE`, 자기 자신, 또는 자신이 속한 셀의 멤버를 수정하는 셀리더
- **Path Variable:** `id` (Long)
- **Request Body:** `UpdateMemberRequest`
- **Success Response:** `200 OK`
  - **Body:** `MemberDto`

#### 5. 멤버 삭제
특정 멤버를 삭제합니다.

- **Method:** `DELETE`
- **URL:** `/api/members/{id}`
- **Authorization:** `ROLE_EXECUTIVE`
- **Path Variable:** `id` (Long)
- **Success Response:** `204 No Content`

### 부가 기능

#### 6. 멤버를 셀에서 제외하기 (Unassign from Cell)
특정 멤버의 소속 셀 정보를 제거하여 미소속 상태로 변경합니다. 셀리더는 셀에서 제외할 수 없습니다.

- **참고:** 이 기능은 이제 멤버 정보 수정 API (`PATCH /api/members/{id}`)에 통합되었습니다. 해당 API에 `cellId`를 `0`으로 보내는 것이 권장되는 방식입니다. 이 엔드포인트는 하위 호환성을 위해 유지됩니다.

- **Method:** `DELETE`
- **URL:** `/api/members/{memberId}/cell`
- **Authorization:** `ROLE_EXECUTIVE`
- **Path Variable:** `memberId` (Long): 셀에서 제외할 멤버의 ID
- **Success Response:** `204 No Content`
- **Error Response:** `400 Bad Request` (멤버가 셀리더인 경우)

#### 7. 특정 멤버 출석 현황 조회
특정 멤버의 지정된 기간 동안의 출석 현황을 조회합니다.

- **Method:** `GET`
- **URL:** `/api/members/{memberId}/attendances/summary`
- **Authorization:** `ROLE_EXECUTIVE`, 또는 자신의 정보, 또는 자신이 속한 셀의 리더
- **Path Variable:** `memberId` (Long)
- **Query Parameters:** `startDate`, `endDate`, `groupBy`
- **Success Response:** `200 OK`
  - **Body:** `MemberAttendanceSummaryDto` (구조는 `출석 관리 API` 문서 참고)

#### 8. 멤버를 팀에 소속시키기
- **Method:** `POST`
- **URL:** `/api/members/{memberId}/teams/{teamId}`
- **Authorization:** `ROLE_EXECUTIVE`
- **Path Variables:** `memberId` (Long), `teamId` (Long)
- **Success Response:** `201 CREATED`

#### 9. 멤버를 팀에서 제외하기
- **Method:** `DELETE`
- **URL:** `/api/members/{memberId}/teams/{teamId}`
- **Authorization:** `ROLE_EXECUTIVE`
- **Path Variables:** `memberId` (Long), `teamId` (Long)
- **Success Response:** `204 No Content`

#### 10. 특정 멤버가 소속된 모든 팀 조회
- **Method:** `GET`
- **URL:** `/api/members/{memberId}/teams`
- **Authorization:** 로그인된 사용자
- **Path Variable:** `memberId` (Long)
- **Success Response:** `200 OK`
  - **Body:** `List<TeamDto>`