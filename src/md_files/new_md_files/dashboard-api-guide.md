# 종합 대시보드 API 가이드

이 문서는 메인 대시보드 화면에 필요한 여러 정보를 한 번에 제공하는 `GET /api/dashboard` API에 대한 명세와 사용법을 안내합니다.

**Base URL:** `http://localhost:8080`

---

## 1. 엔드포인트 정보

-   **설명:** 로그인한 사용자의 역할(임원단, 셀리더 등)에 따라 맞춤형 대시보드 데이터를 조회합니다.
-   **Endpoint:** `GET /api/dashboard`
-   **필요 권한:** `isAuthenticated()` (로그인한 모든 사용자가 접근 가능)
-   **쿼리 파라미터 (Query Parameters):**
    -   `period` (String, Optional): 출석 통계 조회 기간을 지정합니다. (기본값: "3m")
        -   `"1m"`: 최근 1개월
        -   `"3m"`: 최근 3개월
        -   `"6m"`: 최근 6개월
        -   `"12m"`: 최근 12개월
-   **주요 로직 (Role-based Filtering):**
    -   **`활동 연도 필터링`**: 사용자가 어떤 기간(`period`)을 선택하든, 모든 데이터는 **현재 연도의 1월 1일부터 12월 31일 사이**로 자동으로 필터링됩니다. 예를 들어, 2025년 3월에 '최근 12개월'을 조회해도, 실제 데이터는 2025년 1월 1일 이후의 것만 사용됩니다.
    -   **`EXECUTIVE` (임원단):** 교회 전체의 데이터를 기준으로 모든 필드가 집계됩니다.
    -   **`CELL_LEADER` (셀리더) / `MEMBER` (멤버):** 사용자가 속한 셀의 데이터를 기준으로 필터링됩니다.

---

## 2. 응답 데이터 모델 (DTO)

### `DashboardDto` (메인 응답 객체)

-   `todayBirthdays`, `weeklyBirthdays`, `monthlyBirthdays` (List<`BirthdayInfo`>): 생일자 목록.
    -   **임원단:** 전체 멤버 중 생일자
    -   **셀리더:** 소속 셀 멤버 중 생일자
-   `totalTodayBirthdays` (Integer): 오늘 생일인 총 인원수
-   `totalWeeklyBirthdays` (Integer): 주간 생일인 총 인원수
-   `totalMonthlyBirthdays` (Integer): 월간 생일인 총 인원수
-   `recentPrayers` (List<`RecentPrayerInfo`>): 최신 기도제목 목록 (최대 6개).
    -   **N+1 조회 방식**: '더보기' 버튼 표시 여부를 위해 6개를 조회합니다. (화면에는 5개만 표시)
    -   **임원단:** 모든 공개범위의 최신 기도제목
    -   **셀리더:** '전체공개'이거나, '셀공개'인 소속 셀의 기도제목
-   `weeklyPrayerCount` (Integer): 이번 주(일~토)에 등록된 기도제목의 총 개수입니다.
    -   **임원단:** 전체 기도제목 수
    -   **셀리더:** 소속 셀의 기도제목 수 ('전체공개' 또는 '셀공개')
-   `recentNotices` (List<`RecentNoticeInfo`>): 전체 공지 중 최신 공지사항 목록 (최대 6개).
    -   **정렬 순서**: 고정 공지(`pinned: true`)가 항상 상단에 먼저 오고, 그 안에서 최신순으로 정렬됩니다. 일반 공지는 그 뒤를 이어 최신순으로 정렬됩니다.
    -   **N+1 조회 방식**: '더보기' 버튼 표시 여부를 위해 6개를 조회합니다. (화면에는 5개만 표시)
-   `weeklyNoticeCount` (Integer): 이번 주(일~토)에 등록된 공지사항의 총 개수입니다. (전체 대상 공지만 해당)
-   `overallAttendanceSummary` (OverallAttendanceSummaryDto): 출석 요약 통계.
    -   **임원단:** 전체 교회 출석 요약
    -   **셀리더:** 소속 셀의 출석 요약
-   `cellAttendanceSummaries` (List<CellAttendanceSummaryDto>): 각 셀별 출석 요약 목록.
    -   **임원단:** 모든 셀의 목록
    -   **셀리더:** 빈 배열 (`[]`)
-   `attendanceKeyMetrics` (AttendanceKeyMetricsDto): 핵심 출석 지표.
    -   **임원단:** 전체 교회 기준 핵심 지표
    -   **셀리더:** `null`

#### `BirthdayInfo`
-   `memberId` (Long): 멤버 ID
-   `memberName` (String): 멤버 이름
-   `birthDate` (LocalDate): 생년월일

#### `RecentPrayerInfo`
-   `prayerId` (Long): 기도제목 ID
-   `memberId` (Long): 기도제목 작성자 멤버 ID
-   `memberName` (String): 기도제목 작성자 멤버 이름
-   `content` (String): 기도제목 내용
-   `createdAt` (LocalDateTime): 기도제목 생성 시각

#### `RecentNoticeInfo`
-   `noticeId` (Long): 공지사항 ID
-   `title` (String): 공지사항 제목
-   `createdAt` (LocalDateTime): 공지사항 생성 시각
-   `pinned` (boolean): 고정 공지 여부 (true/false)

#### `OverallAttendanceSummaryDto`
기간별 및 누적 출석 현황 요약입니다. (셀리더에게는 소속 셀의 데이터가 이 형식으로 반환됩니다.)
- `periodSummaries` (List<PeriodSummaryDto>): `groupBy` 파라미터에 따라 주별 또는 월별로 그룹화된 출석 통계 목록.
- `totalSummary` (TotalSummaryDto): 조회 기간 전체에 대한 출석 총 요약 정보.

##### PeriodSummaryDto (OverallAttendanceSummaryDto 내부)
- `dateGroup` (String): 날짜 그룹 (e.g., "2024-W01", "2024-01")
- `totalPresent` (Long): 총 출석 수
- `totalAbsent` (Long): 총 결석 수
- `totalMembers` (Long): 해당 기간의 활성 멤버 수
- `attendanceRate` (Double): 해당 기간의 출석률 (%). 계산식: `(totalPresent / (totalPresent + totalAbsent)) * 100`.

##### TotalSummaryDto (OverallAttendanceSummaryDto 내부)
- `totalPresent` (Long): 총 출석 수
- `totalAbsent` (Long): 총 결석 수
- `totalMembersInPeriod` (Long): 기간 내 활성 멤버 수
- `totalRecordedDates` (Long): 출석이 기록된 고유한 날짜 수
- `attendanceRate` (Double): 전체 기간 출석률 (%). 계산식: `(totalPresent / (totalPresent + totalAbsent)) * 100`.

#### `CellAttendanceSummaryDto`
특정 셀의 기간별 및 누적 출석 현황 요약입니다. (임원단에게만 제공됩니다.)
- `cellId` (Long): 셀의 고유 ID
- `cellName` (String): 셀 이름
- `periodSummaries` (List<PeriodSummaryDto>): `groupBy` 파라미터에 따라 그룹화된 출석 통계 목록.
- `totalSummary` (TotalSummaryDto): 조회 기간 전체에 대한 출석 총 요약 정보.

#### `AttendanceKeyMetricsDto`
핵심 출석 지표입니다. (임원단에게만 제공됩니다.)

-   `thisWeekAttendanceRate` (double): 이번 주 출석률
-   `periodAverageAttendanceRate` (double): 선택된 기간의 평균 출석률
-   `lastYearPeriodAttendanceRate` (double): 작년 동일 기간의 평균 출석률 (YoY 비교용)


---

## 3. 응답 예시 (JSON)

```json
{
  "todayBirthdays": [
    {
      "memberId": 15,
      "memberName": "박믿음",
      "birthDate": "1998-12-03"
    }
  ],
  "weeklyBirthdays": [
    {
      "memberId": 15,
      "memberName": "박믿음",
      "birthDate": "1998-12-03"
    },
    {
      "memberId": 16,
      "memberName": "김은혜",
      "birthDate": "2000-12-08"
    }
  ],
  "monthlyBirthdays": [
    {
      "memberId": 15,
      "memberName": "박믿음",
      "birthDate": "1998-12-03"
    },
    {
      "memberId": 16,
      "memberName": "김은혜",
      "birthDate": "2000-12-08"
    },
    {
      "memberId": 17,
      "memberName": "최사랑",
      "birthDate": "1995-12-25"
    }
  ],
  "recentPrayers": [
    {
      "prayerId": 101,
      "memberId": 12,
      "memberName": "이소망",
      "content": "가족의 건강을 위해 기도해주세요.",
      "createdAt": "2025-12-04T11:30:00"
    }
  ],
  "weeklyPrayerCount": 5,
  "recentNotices": [
    {
      "noticeId": 5,
      "title": "성탄절 특별 새벽기도 안내",
      "createdAt": "2025-12-01T18:00:00",
      "pinned": true
    }
  ],
  "weeklyNoticeCount": 2,
  "overallAttendanceSummary": {
    "periodSummaries": [
      {
        "dateGroup": "2025-10",
        "totalPresent": 100,
        "totalAbsent": 10,
        "totalMembers": 30,
        "attendanceRate": 90.9
      },
      {
        "dateGroup": "2025-11",
        "totalPresent": 110,
        "totalAbsent": 5,
        "totalMembers": 30,
        "attendanceRate": 95.5
      }
    ],
    "totalSummary": {
      "totalPresent": 210,
      "totalAbsent": 15,
      "totalMembersInPeriod": 30,
      "totalRecordedDates": 8,
      "attendanceRate": 93.3
    }
  },
  "cellAttendanceSummaries": [
    {
      "cellId": 1,
      "cellName": "사랑셀",
      "periodSummaries": [
        {
          "dateGroup": "2025-10",
          "totalPresent": 10,
          "totalAbsent": 1,
          "totalMembers": 5,
          "attendanceRate": 90.9
        }
      ],
      "totalSummary": {
        "totalPresent": 30,
        "totalAbsent": 2,
        "totalMembers": 5,
        "totalRecordedDates": 8,
        "attendanceRate": 93.75
      }
    },
    {
      "cellId": 2,
      "cellName": "기쁨셀",
      "periodSummaries": [],
      "totalSummary": {
        "totalPresent": 0,
        "totalAbsent": 0,
        "totalMembers": 0,
        "totalRecordedDates": 0,
        "attendanceRate": 0.0
      }
    }
  ],
  "attendanceKeyMetrics": {
    "thisWeekAttendanceRate": 95.0,
    "periodAverageAttendanceRate": 93.3,
    "lastYearPeriodAttendanceRate": 85.0
  }
}
