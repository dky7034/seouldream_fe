# 어드민 API 가이드

이 문서에서는 관리자(Admin) 권한이 필요한 API에 대해 설명합니다.

---

## 사용자 비밀번호 재설정

관리자가 특정 사용자의 비밀번호를 임시 비밀번호로 재설정합니다.

- **Endpoint:** `POST /api/admin/members/{memberId}/reset-password`
- **권한:** `EXECUTIVE`
- **요청 Content-Type:** `application/json`

### Path Variables

| 이름       | 타입   | 필수 | 설명                    |
| ---------- | ------ | ---- | ----------------------- |
| `memberId` | `Long` | O    | 비밀번호를 재설정할 멤버의 ID |

### Request Body

요청 본문(body)은 비어있습니다.

### Responses

- **200 OK**

  성공적으로 비밀번호가 재설정되었을 때 반환됩니다.

  **Response Body 예시:**
  ```json
  {
    "temporaryPassword": "sdc!381028"
  }
  ```

- **401 Unauthorized**

  로그인하지 않은 상태로 API를 호출했을 때 반환됩니다.

  ```json
  {
    "timestamp": "2023-10-27T06:49:57.199+00:00",
    "status": 401,
    "error": "Unauthorized",
    "message": "Full authentication is required to access this resource",
    "path": "/api/admin/members/1/reset-password"
  }
  ```

- **403 Forbidden**

  `ADMIN`이 아닌 다른 역할의 사용자가 API를 호출했을 때 반환됩니다.

  ```json
  {
    "timestamp": "2023-10-27T06:51:13.821+00:00",
    "status": 403,
    "error": "Forbidden",
    "message": "Access Denied",
    "path": "/api/admin/members/1/reset-password"
  }
  ```

- **404 Not Found**

  존재하지 않는 `memberId`로 요청했을 때 반환됩니다.

  ```json
  {
    "timestamp": "2023-10-27T06:52:01.488+00:00",
    "status": 404,
    "error": "Not Found",
    "message": "멤버를 찾을 수 없습니다. ID: 999",
    "path": "/api/admin/members/999/reset-password"
  }
  ```

- **500 Internal Server Error**

  해당 멤버에 연결된 사용자 계정이 없는 등 데이터 정합성에 문제가 있을 때 발생할 수 있습니다.

  ```json
  {
    "timestamp": "2023-10-27T06:53:10.123+00:00",
    "status": 500,
    "error": "Internal Server Error",
    "message": "해당 멤버에 연결된 사용자 계정이 없습니다. ID: 1",
    "path": "/api/admin/members/1/reset-password"
  }
  ```

---
## 기도제목 요약 (Prayer Summaries)

관리자 및 셀리더가 기도제목을 멤버별 또는 셀별로 그룹화하여 요약된 통계를 조회하는 API입니다.

### 1. 멤버별 기도제목 요약 조회

- **Endpoint:** `GET /api/admin/prayers/summary/members`
- **권한:** `EXECUTIVE`, `CELL_LEADER`
- **설명:** 다양한 조건으로 필터링된 기도제목을 멤버 기준으로 그룹화하여, 각 멤버의 기도제목 총 개수와 마지막 기도 등록일을 페이지네이션 형태로 반환합니다.
    - **`CELL_LEADER`의 경우:** 요청 파라미터와 관계없이 자신의 셀에 속한 데이터로 자동 필터링됩니다.

#### 쿼리 파라미터:
-   **기간 필터링 (우선순위 순):**
    -   `semesterId` (Long, Optional): 특정 학기 ID로 조회 (가장 높은 우선순위)
    -   `year`, `month`, `quarter`, `half`: 연, 월, 분기, 반기별 조회
    -   `startDate`, `endDate` (LocalDate, Optional): 임의의 기간으로 조회
    -   *참고: 모든 기간 관련 파라미터가 없으면 **현재 활성화된 학기**를 기본 기간으로 사용합니다.*
-   **기타 필터링:**
    -   `cellId` (Long, Optional): 특정 셀 ID로 필터링 (`EXECUTIVE` 전용)
    -   `memberId` (Long, Optional): 특정 멤버 ID로 필터링
    -   `createdById` (Long, Optional): 특정 작성자(User) ID로 필터링
    -   `isDeleted` (Boolean, Optional): 삭제된 기도제목 포함 여부 (기본값: `false` - 미포함)
-   **페이지네이션 및 정렬:**
    -   `page` (int, Optional): 페이지 번호 (기본값: `0`)
    -   `size` (int, Optional): 페이지 크기 (기본값: `10`)
    -   `sort` (String, Optional): 정렬 기준. 사용 가능한 필드: `memberName`, `cellName`, `totalCount`, `latestCreatedAt` (기본값: `totalCount,desc`)

#### 응답 (`Page<PrayerMemberSummaryDto>`):

**`PrayerMemberSummaryDto` 구조:**
- `memberId` (Long): 멤버 ID
- `memberName` (String): 멤버 이름
- `cellId` (Long, Nullable): 소속된 셀 ID
- `cellName` (String, Nullable): 소속된 셀 이름
- `totalCount` (Long): 해당 멤버의 기도제목 총 개수
- `latestCreatedAt` (LocalDateTime): 해당 멤버의 마지막 기도 등록일

**Response Body 예시:**
```json
{
  "content": [
    {
      "memberId": 101,
      "memberName": "강동균",
      "cellId": 11,
      "cellName": "믿음셀",
      "totalCount": 15,
      "latestCreatedAt": "2025-11-20T10:30:00"
    }
  ],
  "pageable": { ... },
  "totalElements": 1,
  ...
}
```

### 2. 셀별 기도제목 요약 조회

- **Endpoint:** `GET /api/admin/prayers/summary/cells`
- **권한:** `EXECUTIVE`, `CELL_LEADER`
- **설명:** `멤버별 기도제목 요약 조회`와 동일한 필터 로직을 사용하되, 셀 기준으로 그룹화하여 반환합니다.

#### 쿼리 파라미터:
- 위 `멤버별 기도제목 요약 조회`와 동일한 필터, 페이지네이션 파라미터를 사용합니다.

#### 정렬:
- `sort` (String, Optional): 정렬 기준. 사용 가능한 필드: `cellName`, `totalCount`, `latestCreatedAt` (기본값: `totalCount,desc`)

#### 응답 (`Page<PrayerCellSummaryDto>`):

**`PrayerCellSummaryDto` 구조:**
- `cellId` (Long): 셀 ID
- `cellName` (String): 셀 이름
- `totalCount` (Long): 해당 셀의 기도제목 총 개수
- `latestCreatedAt` (LocalDateTime): 해당 셀의 마지막 기도 등록일

**Response Body 예시:**
```json
{
  "content": [
    {
      "cellId": 11,
      "cellName": "믿음셀",
      "totalCount": 23,
      "latestCreatedAt": "2025-11-20T10:30:00"
    }
  ],
  "pageable": { ... },
  "totalElements": 1,
  ...
}
```
