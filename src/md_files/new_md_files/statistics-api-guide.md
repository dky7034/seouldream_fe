# 통계 API 가이드

본 문서는 각종 통계 데이터 조회와 관련된 API의 명세와 사용법을 안내합니다.

---

## 1. API 엔드포인트

### 1.1. 전체 출석 통계 조회

- **Method:** `GET`
- **Endpoint:** `/api/statistics/overall-attendance`
- **설명:** 사용자가 선택한 다양한 필터 조건에 따라 동적으로 계산된 전체 출석 통계(총 기록 수, 출석률)를 조회합니다. 이 API는 프론트엔드의 출석 기록 관리 페이지에서 필터링된 결과에 대한 요약 정보를 표시하는 데 사용됩니다.
    - **셀 제한:** 자신이 속한 셀의 통계만 조회할 수 있습니다. (`cellId` 파라미터를 명시하지 않아도 자신의 셀로 자동 한정)
- **필요 권한:** `ROLE_EXECUTIVE` 또는 `ROLE_CELL_LEADER`
  - **`ROLE_EXECUTIVE` (임원):** 모든 필터 조건으로 자유롭게 조회 가능합니다.
  - **`ROLE_CELL_LEADER` (셀장):** 아래와 같은 제약 조건이 백엔드에서 자동으로 적용됩니다.
    - **셀 제한:** 자신이 속한 셀의 통계만 조회할 수 있습니다. (`cellId` 파라미터를 명시하지 않아도 자신의 셀로 자동 한정)
    - **기간 제한:** **현재 연도(`current year`)**의 데이터만 조회할 수 있습니다. (다른 연도 조회 시 접근 거부)

#### 요청 파라미터 (Query Parameters)

기존 출석 기록 조회 API(`GET /api/attendances`)와 동일한 필터링 파라미터를 지원합니다.

| 파라미터     | 타입             | 필수 여부 | 설명                                      |
|--------------|------------------|-----------|-------------------------------------------|
| `startDate`  | `LocalDate`      | N         | 조회 시작 날짜 (형식: `YYYY-MM-DD`)         |
| `endDate`    | `LocalDate`      | N         | 조회 종료 날짜 (형식: `YYYY-MM-DD`)         |
| `year`       | `Integer`        | N         | 특정 연도로 필터링                        |
| `month`      | `Integer`        | N         | 특정 월로 필터링 (1~12)                   |
| `quarter`    | `Integer`        | N         | 특정 분기로 필터링 (1~4)                  |
| `half`       | `Integer`        | N         | 특정 반기로 필터링 (1~2)                  |
| `cellId`     | `Long`           | N         | 특정 셀(다락방) ID로 필터링               |
| `memberId`   | `Long`           | N         | 특정 멤버 ID로 필터링                     |
| `status`     | `AttendanceStatus` | N         | 특정 출석 상태로 필터링 (`PRESENT`, `ABSENT`) |

*참고: 날짜 관련 파라미터(`startDate`, `endDate`, `year` 등)가 없으면 **현재 활성화된 학기**를 기본 기간으로 사용합니다.*

#### 응답 데이터 모델 (`OverallAttendanceStatDto`)

- **성공:** `200 OK`
- **응답 본문:**

| 필드             | 타입   | 설명                                          |
|------------------|--------|-----------------------------------------------|
| `totalRecords`   | `long`   | 주어진 필터 조건에 해당하는 전체 출석 기록 수 |
| `attendanceRate` | `double` | 주어진 필터 조건에 해당하는 출석률 (%, 소수점 둘째 자리까지 반올림) |

#### 요청 및 응답 예시

- **요청 URL:** 2025년 5번 셀의 전체 통계 조회
  ```
  GET http://localhost:8080/api/statistics/overall-attendance?year=2025&cellId=5
  ```

- **응답 본문 (JSON):**
  ```json
  {
    "totalRecords": 150,
    "attendanceRate": 88.5
  }
  ```

- **요청 URL:** 2024년 10월, '출석' 상태인 기록만 필터링하여 통계 조회
  ```
  GET http://localhost:8080/api/statistics/overall-attendance?year=2024&month=10&status=PRESENT
  ```

- **응답 본문 (JSON):**
  ```json
    {
      "totalRecords": 75,
      "attendanceRate": 100.0
    }
    ```
  
### 1.2. 그룹화된 출석 통계 추이 조회

- **Method:** `GET`
- **Endpoint:** `/api/statistics/attendance-trend`
- **설명:** 필터 조건에 따라 그룹화된 출석 통계 추이를 조회합니다. 차트 표시에 사용될 수 있습니다.
- **필요 권한:** `isAuthenticated()` (로그인된 모든 사용자)
  - *참고: 임원(EXECUTIVE)이 아닌 사용자는 자신의 셀 데이터만 조회할 수 있도록 서버에서 데이터 범위가 자동으로 제한됩니다.*

#### 요청 파라미터 (Query Parameters)

- **기간 필터링 (위와 동일):**
    - `startDate`, `endDate`, `year`, `month`, `quarter`, `half`
    - *참고: 기간 관련 파라미터가 없으면 **현재 활성화된 학기**를 기본 기간으로 사용합니다.*
- **콘텐츠 필터링 (위와 동일):**
    - `cellId`, `memberId`, `status`
- **그룹화:**
    - `groupBy` (`GroupBy`, Optional, 기본값: `DAY`): 통계를 그룹화할 기준. (`DAY`, `WEEK`, `MONTH`, `QUARTER`, `HALF_YEAR`, `YEAR`, `SEMESTER`)
    - *참고: `groupBy=SEMESTER` 사용 시, 응답의 `dateGroup` 필드에는 학기 이름 (예: "2025년 1학기") 또는 특정 학기에 속하지 않는 경우 "미분류"가 포함됩니다.*



#### 요청 예시
`GET http://localhost:8080/api/statistics/attendance-trend?year=2025&cellId=5&groupBy=WEEK`

#### 응답 데이터 모델 (`List<AggregatedTrendDto>`)

- **성공:** `200 OK`
- **응답 본문:**

| 필드             | 타입   | 설명                               |
|------------------|--------|------------------------------------|
| `dateGroup`      | `String` | 날짜 그룹 (예: '2025-W01', '2025-01') |
| `totalRecords`   | `Long` | 해당 그룹의 총 기록 수 (출석 + 결석) |
| `presentRecords` | `Long` | 해당 그룹의 출석 수                |
| `attendanceRate` | `double` | 해당 그룹의 출석률 (%)             |

#### 응답 예시 (JSON)
```json
[
  {
    "dateGroup": "2025-W01",
    "totalRecords": 20,
    "presentRecords": 18,
    "attendanceRate": 90.0
  },
  {
    "dateGroup": "2025-W02",
    "totalRecords": 22,
    "presentRecords": 20,
    "attendanceRate": 90.91
  }
]
```

### 1.3. 출석 데이터가 있는 연도 목록 조회

- **Method:** `GET`
- **Endpoint:** `/api/statistics/available-years`
- **설명:** 출석 데이터가 한 건이라도 존재하는 연도를 중복 없이, 내림차순으로 정렬하여 반환합니다. 프론트엔드의 '연도' 필터 옵션을 동적으로 생성하는 데 사용됩니다.
- **필요 권한:** `ROLE_EXECUTIVE` 또는 `ROLE_CELL_LEADER`

#### 역할별 동작 방식

- **`ROLE_EXECUTIVE` (교역자):**
  - `cellId` 파라미터 **없이** 요청: 시스템 전체의 출석 데이터가 있는 모든 연도를 반환합니다.
  - `cellId` 파라미터 **와 함께** 요청: 해당 `cellId`를 가진 특정 셀의 연도 목록만 반환합니다.
- **`ROLE_CELL_LEADER` (셀장):**
  - `cellId` 파라미터와 **상관없이** 항상 **자신이 속한 셀**의 연도 목록을 반환합니다. (보안을 위해 서버에서 자동으로 셀 ID가 고정됩니다.)

#### 요청 파라미터 (Query Parameters)
| 파라미터 | 타입 | 필수 여부 | 설명                                                                    |
|----------|------|-----------|-------------------------------------------------------------------------|
| `cellId` | `Long` | N         | **교역자 전용.** 특정 셀의 연도 목록을 조회할 때 사용합니다. |


#### 요청 예시
- **전체 연도 조회 (교역자):**
  `GET http://localhost:8080/api/statistics/available-years`
- **특정 셀의 연도 조회 (교역자):**
  `GET http://localhost:8080/api/statistics/available-years?cellId=15`
- **자신의 셀 연도 조회 (셀장):**
  `GET http://localhost:8080/api/statistics/available-years` 또는 `GET http://localhost:8080/api/statistics/available-years?cellId=<자기셀ID>`

#### 응답 데이터 모델 (`List<Integer>`)

- **성공:** `200 OK`
- **응답 본문:** `[2025, 2024, 2023]` 과 같은 연도 숫자 배열

#### 응답 예시 (JSON)
```json
[
  2025,
  2024
]
```  