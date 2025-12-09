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
