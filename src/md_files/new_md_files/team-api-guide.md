# 팀 관리 API 가이드

본 문서는 팀(청년부 내의 '팀', 예: 1팀, 2팀) 관리 기능과 관련된 API의 명세와 사용법을 안내합니다.

---

## 1. 데이터 모델 (DTO)

### CreateTeamRequest
새로운 팀을 생성할 때 사용하는 요청 객체입니다.

- `name` (String, NotBlank): 팀 이름 (예: "1팀")
- `description` (String, Nullable): 팀에 대한 설명

**Example:**
```json
{
  "name": "새신자팀",
  "description": "새신자 교육 및 관리를 담당하는 팀"
}
```

### UpdateTeamRequest
기존 팀의 정보를 수정할 때 사용하는 요청 객체입니다. 수정하고 싶은 필드만 포함하여 보낼 수 있습니다.

- `name` (String, Nullable): 새로운 팀 이름
- `code` (String, Nullable): 팀 고유 코드 (변경 시 주의 필요)
- `description` (String, Nullable): 새로운 설명
- `active` (Boolean, Nullable): 팀 활성화 상태 (false로 설정 시 비활성화)

**Example:**
```json
{
  "description": "새신자 및 방문자 케어 담당",
  "active": true
}
```

### TeamDto
팀 정보를 나타내는 기본 응답 객체입니다.

- `id` (Long): 팀의 고유 ID
- `name` (String): 팀 이름
- `code` (String): 팀 고유 코드
- `description` (String): 팀 설명
- `active` (boolean): 활성화 여부
- `createdAt` (LocalDateTime): 생성 시각
- `updatedAt` (LocalDateTime): 마지막 수정 시각

**Example:**
```json
{
  "id": 1,
  "name": "1팀",
  "code": "T01",
  "description": "청년 1팀",
  "active": true,
  "createdAt": "2025-12-01T10:00:00",
  "updatedAt": "2025-12-02T11:30:00"
}
```

### MemberDto
멤버 정보를 나타내는 응답 객체입니다. (`/api/teams/{teamId}/members` 에서 사용)

*(Member 기능 문서에서 더 자세히 다룰 예정)*

---

## 2. API 엔드포인트

### 1. 팀 생성

새로운 팀을 생성합니다.

- **Method:** `POST`
- **URL:** `/api/teams`
- **Authorization:** `ROLE_EXECUTIVE` (임원단) 권한 필요
- **Request Body:** `CreateTeamRequest`
- **Success Response:** `201 CREATED`
  - **Body:** `TeamDto` - 생성된 팀의 정보

### 2. 모든 팀 조회 (페이지네이션 및 필터링 지원)

현재 시스템에 존재하는 모든 팀의 목록을 페이지 단위로 조회하며, 다양한 조건으로 필터링 및 정렬할 수 있습니다.

- **Method:** `GET`
- **URL:** `/api/teams`
- **Authorization:** 로그인된 사용자

#### Query Parameters
- **필터링:**
  - `name` (String, Optional): 팀 이름 (부분 일치 검색)
  - `code` (String, Optional): 팀 코드 (부분 일치 검색)
  - `active` (Boolean, Optional): 활성 상태 (`true` 또는 `false`)
- **페이지네이션:**
  - `page` (int, Optional, 기본값: `0`): 조회할 페이지 번호 (0부터 시작)
  - `size` (int, Optional, 기본값: `10`): 한 페이지에 보여줄 항목 수
- **정렬:**
  - `sort` (String, Optional, 기본값: `name,asc`): 정렬 기준. `(필드명),(asc|desc)` 형식. (예: `createdAt,desc`)

##### 예시 URL
`GET http://localhost:8080/api/teams?active=true&page=0&size=5`
(활성 상태의 팀을 이름 오름차순으로 정렬하여 0번 페이지 5개 조회)

##### Success Response: `200 OK`
- **Body:** `Page<TeamDto>`

```json
{
  "content": [
    // TeamDto 객체 목록...
    {
      "id": 1,
      "name": "1팀",
      "code": "T01",
      // ...
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 5,
    "sort": {
      "sorted": true,
      "unsorted": false,
      "empty": false
    },
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "totalPages": 3,
  "totalElements": 12,
  "last": false,
  "size": 5,
  "number": 0,
  "sort": {
    "sorted": true,
    "unsorted": false,
    "empty": false
  },
  "numberOfElements": 5,
  "first": true,
  "empty": false
}
```

### 3. 특정 팀 조회

고유 ID를 사용하여 특정 팀의 상세 정보를 조회합니다.

- **Method:** `GET`
- **URL:** `/api/teams/{id}`
- **Authorization:** 로그인된 사용자
- **Path Variable:**
  - `id` (Long): 조회할 팀의 고유 ID
- **Success Response:** `200 OK`
  - **Body:** `TeamDto`
- **Error Response:**
  - `404 Not Found`: 해당 ID의 팀이 없을 경우

### 4. 팀 정보 수정

특정 팀의 정보를 수정합니다.

- **Method:** `PATCH`
- **URL:** `/api/teams/{id}`
- **Authorization:** `ROLE_EXECUTIVE` (임원단) 권한 필요
- **Path Variable:**
  - `id` (Long): 수정할 팀의 고유 ID
- **Request Body:** `UpdateTeamRequest`
- **Success Response:** `200 OK`
  - **Body:** `TeamDto` - 수정된 팀의 정보

### 5. 팀 삭제

특정 팀을 삭제합니다. (논리적 삭제, `active` 상태를 `false`로 변경하는 것을 권장)

- **Method:** `DELETE`
- **URL:** `/api/teams/{id}`
- **Authorization:** `ROLE_EXECUTIVE` (임원단) 권한 필요
- **Path Variable:**
  - `id` (Long): 삭제할 팀의 고유 ID
- **Success Response:** `204 No Content`

### 6. 특정 팀의 모든 멤버 조회

특정 팀에 소속된 모든 멤버의 목록을 조회합니다.

- **Method:** `GET`
- **URL:** `/api/teams/{teamId}/members`
- **Authorization:** 로그인된 사용자
- **Path Variable:**
  - `teamId` (Long): 멤버를 조회할 팀의 고유 ID
- **Success Response:** `200 OK`
  - **Body:** `List<MemberDto>`

### 7. 팀에 멤버 추가

특정 팀에 한 명 이상의 멤버를 추가합니다. 이미 팀에 속한 멤버는 무시됩니다.

- **Method:** `POST`
- **URL:** `/api/teams/{teamId}/members`
- **Authorization:** `ROLE_EXECUTIVE` (임원단) 권한 필요
- **Path Variable:**
  - `teamId` (Long): 멤버를 추가할 팀의 고유 ID
- **Request Body:** `List<Long>`

**Example Request Body:**
```json
[15, 23, 42]
```

- **Success Response:** `201 CREATED`
- **Error Responses:**
  - `400 Bad Request`: 요청 본문이 유효하지 않을 경우 (예: `memberIds`가 비어있음)
  - `403 Forbidden`: `EXECUTIVE` 권한이 없는 경우
  - `404 Not Found`: 해당 `teamId`의 팀이나 요청된 `memberIds` 중 일부 멤버를 찾을 수 없는 경우
