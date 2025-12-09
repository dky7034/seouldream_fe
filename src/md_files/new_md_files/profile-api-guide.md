# 내 프로필 API 가이드

본 문서는 로그인한 사용자가 자신의 프로필 정보를 관리하는 기능과 관련된 API의 명세와 사용법을 안내합니다.

**Base URL:** `http://localhost:8080`

---

## 1. 데이터 모델 (DTO)

### UpdateMyProfileRequest
자신의 프로필 정보를 수정할 때 사용하는 요청 객체입니다.

- `phone` (String, Nullable): 연락처
- `email` (String, Nullable, Email): 이메일 주소
- `address` (String, Nullable): 주소
- `note` (String, Nullable): 기타 메모

### ChangePasswordRequest
자신의 비밀번호를 변경할 때 사용하는 요청 객체입니다.

- `oldPassword` (String, NotBlank): 기존 비밀번호
- `newPassword` (String, NotBlank): 새 비밀번호

### PasswordVerificationRequest
현재 비밀번호가 올바른지 검증할 때 사용하는 요청 객체입니다.

- `password` (String, NotBlank): 검증할 현재 비밀번호

---

## 2. API 엔드포인트

### 1. 내 프로필 정보 조회

현재 로그인된 사용자의 상세 프로필 정보를 조회합니다.

- **Method:** `GET`
- **URL:** `/api/me/profile`
- **Authorization:** `isAuthenticated()` (로그인한 모든 사용자)
- **Success Response:** `200 OK`
  - **Body:** `MemberDto` (멤버 상세 정보)

### 2. 내 프로필 정보 수정

현재 로그인된 사용자의 프로필 정보를 수정합니다.

- **Method:** `PUT`
- **URL:** `/api/me/profile`
- **Authorization:** `isAuthenticated()`
- **Request Body:** `UpdateMyProfileRequest`
- **Success Response:** `200 OK`
  - **Body:** `MemberDto` (수정된 멤버 정보)

### 3. 내 비밀번호 변경

현재 로그인된 사용자의 비밀번호를 변경합니다.

- **Method:** `PUT`
- **URL:** `/api/me/password`
- **Authorization:** `isAuthenticated()`
- **Request Body:** `ChangePasswordRequest`
- **Success Response:** `204 No Content`
- **Error Response:**
  - `400 Bad Request`: 기존 비밀번호가 일치하지 않을 경우

### 4. 현재 비밀번호 검증

현재 로그인된 사용자가 입력한 비밀번호가 실제 비밀번호와 일치하는지 검증합니다. 비밀번호 변경 전이나 회원 탈퇴 전 본인 확인 용도로 사용됩니다.

- **Method:** `POST`
- **URL:** `/api/me/verify-password`
- **Authorization:** `isAuthenticated()`
- **Request Body:** `PasswordVerificationRequest`
- **Success Response:** `200 OK`
  - **Body:** `{"isValid": boolean}` (true: 일치, false: 불일치)

**Example Request:**
```json
{
  "password": "current-password"
}
```

**Example Response (Success):**
```json
{
  "isValid": true
}
```