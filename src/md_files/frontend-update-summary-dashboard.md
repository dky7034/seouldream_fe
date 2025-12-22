# [백엔드 업데이트] 대시보드 API 변경 안내 (2025-12-11)

안녕하세요, 프론트엔드 팀.

대시보드 기능 강화를 위해 `GET /api/dashboard` API의 응답 데이터가 업데이트되어 안내해 드립니다.

## 1. 주요 변경 사항

`DashboardDto`에 다음 2개의 필드가 추가되었습니다.

1.  `weeklyPrayerCount` (Integer)
2.  `weeklyNoticeCount` (Integer)

## 2. 필드 상세 설명

### `weeklyPrayerCount`
- **설명**: **이번 주(일요일 ~ 토요일)**에 등록된 기도제목의 총 개수를 나타냅니다.
- **데이터 범위**:
    - **임원단 (`EXECUTIVE`)**: 모든 기도제목 (공개 범위 무관)
    - **셀리더/멤버 (`CELL_LEADER`, `MEMBER`)**: 사용자가 속한 셀의 기도제목 ('전체 공개' 또는 '셀 공개')

### `weeklyNoticeCount`
- **설명**: **이번 주(일요일 ~ 토요일)**에 등록된 **전체 공지**의 총 개수를 나타냅니다.
- **데이터 범위**: 사용자 역할에 관계없이 항상 전체 공지사항의 개수입니다.

## 3. 업데이트된 `DashboardDto` 응답 구조

아래는 새로운 필드가 포함된 `DashboardDto`의 전체 구조입니다.

```json
{
  "todayBirthdays": [...],
  "totalTodayBirthdays": 1,
  "weeklyBirthdays": [...],
  "totalWeeklyBirthdays": 2,
  "monthlyBirthdays": [...],
  "totalMonthlyBirthdays": 3,
  "recentPrayers": [...],
  "weeklyPrayerCount": 5,
  "recentNotices": [...],
  "weeklyNoticeCount": 2,
  "overallAttendanceSummary": {...},
  "cellAttendanceSummaries": [...],
  "attendanceKeyMetrics": {...}
}
```

## 4. 참고

- `todayBirthdays`, `recentPrayers` 등 기존 필드의 데이터 구조와 내용은 변경되지 않았습니다.
- 자세한 API 명세는 `dashboard-api-guide.md` 문서를 참고해 주세요.

감사합니다.
