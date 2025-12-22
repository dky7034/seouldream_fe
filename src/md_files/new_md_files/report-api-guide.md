# 리포트 API 가이드

본 문서는 특정 조건에 따라 집계된 데이터를 제공하는 리포트성 API의 명세와 사용법을 안내합니다.

---

## 1. API 엔드포인트

### 1.1. 미완료 출석 체크 리포트

- **Method:** `GET`
- **Endpoint:** `/api/reports/incomplete-checks`
- **설명:** 지정된 기간 동안, **셀원 전체에 대한 출석/결석 처리를 완료하지 않은** 셀장과 해당 날짜의 목록을 조회합니다. '미완료'의 기준은, 특정 일요일에 해당 셀의 활성 셀원 중 단 한 명이라도 출석/결석 기록이 없는 경우입니다.
- **필요 권한:** `ROLE_EXECUTIVE` (임원단 전용)

#### 요청 파라미터 (Query Parameters)

- **기간 필터링 (아래 중 한 가지 방식 또는 조합하여 사용):**
    - `startDate` (LocalDate, Optional): 조회 시작 날짜 (형식: `YYYY-MM-DD`)
    - `endDate` (LocalDate, Optional): 조회 종료 날짜 (형식: `YYYY-MM-DD`)
    - `year` (Integer, Optional): 특정 연도로 필터링
    - `month` (Integer, Optional): 특정 월로 필터링 (1~12)
    - `quarter` (Integer, Optional): 특정 분기로 필터링 (1~4)
| `half`       | `Integer`        | N         | 특정 반기로 필터링 (1~2)                  |
*참고: 기간 관련 파라미터가 없으면 **현재 활성화된 학기**를 기본 기간으로 사용합니다.*

#### 요청 예시
`GET http://localhost:8080/api/reports/incomplete-checks?year=2025`

---

## 2. 응답 데이터 모델 (DTO)

### `IncompleteCheckReportDto`

- API는 아래 `IncompleteCheckReportDto` 객체의 리스트 (`List`)를 반환합니다.
- 각 객체는 한 명의 셀장과, 그 셀장이 미완료한 출석 체크 날짜 목록을 나타냅니다.

| 필드               | 타입            | 설명                       |
|--------------------|-----------------|----------------------------|
| `leaderId`         | `Long`          | 리더의 멤버 ID             |
| `leaderName`       | `String`        | 리더 이름                  |
| `cellId`           | `Long`          | 셀 ID                      |
| `cellName`         | `String`        | 셀 이름                    |
| `missedDatesCount` | `int`           | 미완료된 출석 체크 횟수    |
| `missedDates`      | `List<LocalDate>` | 미완료된 출석 체크 날짜 목록 |

---

## 3. 응답 예시 (JSON)

```json
[
  {
    "leaderId": 15,
    "leaderName": "박순장",
    "cellId": 5,
    "cellName": "사랑셀",
    "missedDatesCount": 2,
    "missedDates": [
      "2025-11-30",
      "2025-12-07"
    ]
  },
  {
    "leaderId": 21,
    "leaderName": "최순장",
    "cellId": 8,
    "cellName": "믿음셀",
    "missedDatesCount": 1,
    "missedDates": [
      "2025-12-07"
    ]
  }
]
```

### 1.2. 리포트용 연도 목록 조회

- **Method:** `GET`
- **Endpoint:** `/api/reports/available-years`
- **설명:** 리포트 필터링에 사용할, 출석 데이터가 존재하는 모든 연도 목록을 반환합니다.
- **필요 권한:** `ROLE_EXECUTIVE` (임원단 전용)
- **요청 파라미터:** 없음
- **Success Response:** `200 OK`
  - **Body:** `[2025, 2024]` 와 같은 숫자 배열
