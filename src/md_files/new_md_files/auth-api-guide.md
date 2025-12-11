# 인증 API 가이드

본 문서는 사용자 인증(로그인, 로그아웃, 토큰 관리) 기능과 관련된 API의 명세와 사용법을 안내합니다.

## 1. 인증 흐름 (Token-based Authentication)

1.  **로그인**: 사용자가 아이디(username)와 비밀번호(password)로 로그인을 시도합니다.
2.  **토큰 발급**: 서버는 정보가 일치하면 API 접근에 필요한 `Access Token`과 `Refresh Token`을 함께 발급합니다.
3.  **API 요청**: 프론트엔드에서는 이후 모든 API 요청 시 HTTP 헤더에 `Access Token`을 담아 보냅니다.
    - `Authorization: Bearer {ACCESS_TOKEN}`
4.  **Access Token 만료**: `Access Token`은 보안을 위해 수명이 짧습니다. 만료 시 API 서버는 `401 Unauthorized` 에러를 반환합니다.
5.  **토큰 재발급**: 프론트엔드는 `Access Token`이 만료되었다는 응답을 받으면, 보관하고 있던 `Refresh Token`을 서버로 보내 새로운 `Access Token`을 재발급 받습니다.
6.  **로그아웃**: 사용자가 로그아웃하면 서버에서 `Refresh Token`을 무효화하여 더 이상 토큰 재발급이 불가능하게 만듭니다.

---

## 2. 데이터 모델 (DTO)

### LoginRequest
로그인 시 필요한 아이디와 비밀번호를 담는 요청 객체입니다.

- `username` (String, NotBlank): 사용자 아이디
- `password` (String, NotBlank): 비밀번호

**Example:**
```json
{
  "username": "leader1",
  "password": "password"
}
```

### JwtAuthenticationResponse
로그인 성공 시 서버가 반환하는 응답 객체입니다. 토큰 정보와 사용자 정보를 포함합니다.

- `accessToken` (String): API 접근에 사용되는 토큰
- `refreshToken` (String): `accessToken` 재발급에 사용되는 토큰
- `tokenType` (String): 토큰 타입 (항상 "Bearer")
- `userId` (Long): 로그인한 사용자의 고유 ID (User 엔티티의 ID)
- `role` (String): 사용자 권한 (예: `USER`, `LEADER`, `EXECUTIVE`)
- `name` (String): 사용자 이름
- `cellId` (Long, Nullable): 사용자가 셀 리더 또는 셀원일 경우 소속된 셀의 ID
- `cellName` (String, Nullable): 사용자가 셀에 소속되어 있을 경우, 해당 셀의 이름
- `memberId` (Long, Nullable): 로그인한 사용자의 Member 엔티티 ID (Member가 없는 User는 null)

**Example:**
```json
{
  "accessToken": "ey...",
  "refreshToken": "ey...",
  "tokenType": "Bearer",
  "userId": 101,
  "role": "LEADER",
  "name": "김리더",
  "cellId": 12,
  "cellName": "믿음셀",
  "memberId": 501
}
```

### TokenRefreshRequest
Access Token 재발급을 요청할 때 사용하는 객체입니다.

- `refreshToken` (String, NotBlank): 로그인 시 발급받았던 Refresh Token

**Example:**
```json
{
  "refreshToken": "ey..."
}
```

### TokenRefreshResponse
Access Token 재발급 성공 시 반환되는 객체입니다.

- `accessToken` (String): 새로 발급된 Access Token
- `tokenType` (String): 토큰 타입 (항상 "Bearer")

**Example:**
```json
{
  "accessToken": "ey_new...",
  "tokenType": "Bearer"
}
```

---

## 3. API 엔드포인트

### 1. 아이디 중복 확인

회원가입 시 사용할 아이디가 이미 존재하는지 확인합니다.

- **Method:** `GET`
- **URL:** `/api/auth/check-username`
- **Public Access**
- **Query Parameters:**
  - `username` (String, Required): 중복 확인할 아이디
- **Success Response:** `200 OK`
  - **Body:** `{"isAvailable": boolean}` (true: 사용 가능, false: 이미 존재)

### 2. 로그인

사용자 아이디와 비밀번호로 인증을 수행하고 토큰을 발급받습니다.

- **Method:** `POST`
- **URL:** `/api/auth/login`
- **Public Access**
- **Request Body:** `LoginRequest`
- **Success Response:** `200 OK`
  - **Body:** `JwtAuthenticationResponse`

### 3. Access Token 재발급

만료된 Access Token을 Refresh Token을 이용해 새로 발급받습니다.

- **Method:** `POST`
- **URL:** `/api/auth/refresh`
- **Public Access**
- **Request Body:** `TokenRefreshRequest`
- **Success Response:** `200 OK`
  - **Body:** `TokenRefreshResponse`
- **Error Response:**
  - `401 Unauthorized`: Refresh Token이 유효하지 않거나 만료된 경우

### 4. 로그아웃

서버에 저장된 사용자의 Refresh Token을 삭제하여 로그아웃 처리합니다.

- **Method:** `POST`
- **URL:** `/api/auth/logout`
- **Authorization:** `Bearer {ACCESS_TOKEN}` 필요
- **Success Response:** `200 OK`
  - **Body:** `"로그아웃 처리되었습니다."`
