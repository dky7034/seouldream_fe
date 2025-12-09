# 출석 알림 API 가이드 (관심 그룹 식별)

이 문서는 출석 기록을 기반으로 목회적 관심이 필요한 멤버(예: 장기 결석자)를 식별하는 API에 대한 명세와 사용법을 안내합니다.

**Base URL:** `http://localhost:8080`

---

## 1. 엔드포인트 정보

### 1.1. 연속 결석 멤버 조회

-   **설명:** 지정된 횟수만큼 가장 최근 출석 기록부터 연속으로 '결석'이 기록된 멤버 목록을 조회합니다.
-   **Endpoint:** `GET /api/attendances/alerts`
-   **필요 권한:** `EXECUTIVE`, `CELL_LEADER`
    -   `EXECUTIVE`: 모든 활성 멤버를 대상으로 조회합니다.
    -   `CELL_LEADER`: 자신이 속한 셀의 멤버들만 대상으로 조회합니다.
-   **핵심 로직:** 각 멤버의 출석 기록을 최신순으로 정렬한 후, 가장 최근 기록부터 연속적으로 '결석'인 경우만 카운트합니다. 중간에 '출석'이 있으면 카운트를 중단합니다.

---

## 2. 요청 (Request)

#### Query Parameters
-   `consecutiveAbsences` (int, 선택, 기본값: `3`): 조회하고자 하는 최소 연속 결석 횟수. 예를 들어 `3`으로 설정하면, 3회 이상 연속 결석한 멤버를 찾습니다.

#### 예시
`GET http://localhost:8080/api/attendances/alerts?consecutiveAbsences=4`
(최근 4회 이상 연속으로 결석이 기록된 멤버를 조회)

---

## 3. 응답 데이터 모델 (DTO)

### `MemberAlertDto`
-   `memberId` (Long): 멤버 ID
-   `memberName` (String): 멤버 이름
-   `cellName` (String): 소속된 셀 이름 (없을 경우 "N/A")
-   `lastAttendanceDate` (LocalDate): 마지막으로 '출석' 했던 날짜. (결석 기록만 계속 있는 경우 `null`)
-   `consecutiveAbsences` (int): 가장 최근부터 집계된 연속 결석 횟수.

---

## 4. 응답 예시 (JSON)

### `GET /api/attendances/alerts`
```json
[
  {
    "memberId": 25,
    "memberName": "김장기",
    "cellName": "청년2셀",
    "lastAttendanceDate": "2025-11-02",
    "consecutiveAbsences": 4
  },
  {
    "memberId": 31,
    "memberName": "나새신",
    "cellName": "새가족셀",
    "lastAttendanceDate": null,
    "consecutiveAbsences": 5
  }
]
```
