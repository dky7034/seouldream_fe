# 프론트엔드용 DTO 및 Enum 정의

이 문서는 백엔드 애플리케이션의 DTO(Data Transfer Object)와 Enum 정의를 포함하고 있습니다. 프론트엔드에서 TypeScript 인터페이스로 변환하여 사용하실 수 있습니다.

---

## 1. 공통 Enum 정의

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/AttendanceStatus.java
package com.sdc.seouldreamcellbe.domain.common;

public enum AttendanceStatus {
    PRESENT,
    ABSENT
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/Gender.java
package com.sdc.seouldreamcellbe.domain.common;

public enum Gender {
    MALE,
    FEMALE
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/GroupBy.java
package com.sdc.seouldreamcellbe.domain.common;

public enum GroupBy {
    DAY,
    WEEK,
    MONTH
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/NoticeTarget.java
package com.sdc.seouldreamcellbe.domain.common;

public enum NoticeTarget {
    ALL,
    CELL_LEADER,
    EXECUTIVE,
    CELL
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/PrayerVisibility.java
package com.sdc.seouldreamcellbe.domain.common;

public enum PrayerVisibility {
    PRIVATE,
    CELL,
    ALL
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/Role.java
package com.sdc.seouldreamcellbe.domain.common;

public enum Role {
    EXECUTIVE,
    CELL_LEADER,
    MEMBER
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/SuggestionStatus.java
package com.sdc.seouldreamcellbe.domain.common;

public enum SuggestionStatus {
    PENDING,
    IN_PROGRESS,
    RESOLVED
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/SuggestionType.java
package com.sdc.seouldreamcellbe.domain.common;

public enum SuggestionType {
    DIFFICULTY,
    REQUEST,
    OTHER
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/domain/common/UserStatus.java
package com.sdc.seouldreamcellbe.domain.common;

public enum UserStatus {
    ACTIVE,
    INACTIVE,
    DELETED
}
```

---

## 2. DTO 정의

### 2.1. 인증 (Auth)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/auth/ChangePasswordRequest.java
package com.sdc.seouldreamcellbe.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank
    String oldPassword,

    @NotBlank
    @Size(min = 6, max = 100, message = "새 비밀번호는 6자 이상 100자 이하이어야 합니다.")
    String newPassword
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/auth/JwtAuthenticationResponse.java
package com.sdc.seouldreamcellbe.dto.auth;

public record JwtAuthenticationResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    Long userId,
    String role,
    String name // Added name field
) {
    public JwtAuthenticationResponse(String accessToken, String refreshToken) {
        this(accessToken, refreshToken, "Bearer", null, null, null);
    }

    public JwtAuthenticationResponse(String accessToken, String refreshToken, Long userId, String role, String name) {
        this(accessToken, refreshToken, "Bearer", userId, role, name);
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/auth/LoginRequest.java
package com.sdc.seouldreamcellbe.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
    @NotBlank String username,
    @NotBlank String password
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/auth/TokenRefreshRequest.java
package com.sdc.seouldreamcellbe.dto.auth;

import jakarta.validation.constraints.NotBlank;

public record TokenRefreshRequest(
    @NotBlank String refreshToken
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/auth/TokenRefreshResponse.java
package com.sdc.seouldreamcellbe.dto.auth;

public record TokenRefreshResponse(
    String accessToken,
    String tokenType
) {
    public TokenRefreshResponse(String accessToken) {
        this(accessToken, "Bearer");
    }
}
```

### 2.2. 멤버 (Member)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/member/CreateMemberRequest.java
package com.sdc.seouldreamcellbe.dto.member;

import com.sdc.seouldreamcellbe.domain.common.Gender;
import com.sdc.seouldreamcellbe.domain.common.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;

import java.time.LocalDate;

@Builder
public record CreateMemberRequest(
    // Member fields
    @NotBlank String name,
    @NotNull Gender gender,
    @NotNull LocalDate birthDate,
    @NotBlank String phone,
    @NotBlank @Email String email,
    Long cellId, // ID for the cell to associate with
    @NotNull Role role,
    @NotNull Integer joinYear,
    String address,
    String note,

    // User fields
    @NotBlank @Size(min = 1, max = 50) String username,
    @NotBlank @Size(min = 6, max = 100) String password
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/member/MemberDto.java
package com.sdc.seouldreamcellbe.dto.member;

import com.sdc.seouldreamcellbe.domain.Member;
import com.sdc.seouldreamcellbe.domain.common.Gender;
import com.sdc.seouldreamcellbe.domain.common.Role;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Builder
public record MemberDto(
    Long id,
    String name,
    Gender gender,
    LocalDate birthDate,
    Integer age,
    String phone,
    String email,
    CellInfo cell,
    Role role,
    Integer joinYear,
    boolean active,
    String address,
    String note,
    String username, // NEW
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    @Builder
    public record CellInfo(
        Long id,
        String name
    ) {}

    public static MemberDto from(Member entity) {
        CellInfo cellInfo = (entity.getCell() != null)
            ? new CellInfo(entity.getCell().getId(), entity.getCell().getName())
            : null;

        String username = (entity.getUser() != null) ? entity.getUser().getUsername() : null; // NEW

        return MemberDto.builder()
            .id(entity.getId())
            .name(entity.getName())
            .gender(entity.getGender())
            .birthDate(entity.getBirthDate())
            .age(entity.getAge())
            .phone(entity.getPhone())
            .email(entity.getEmail())
            .cell(cellInfo)
            .role(entity.getRole())
            .joinYear(entity.getJoinYear())
            .active(entity.getActive())
            .address(entity.getAddress())
            .note(entity.getNote())
            .username(username) // NEW
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/member/UpdateMemberRequest.java
package com.sdc.seouldreamcellbe.dto.member;

import com.sdc.seouldreamcellbe.domain.common.Gender;
import com.sdc.seouldreamcellbe.domain.common.Role;
import jakarta.validation.constraints.Email;
import lombok.Builder;

import java.time.LocalDate;

@Builder
public record UpdateMemberRequest(
    String name,
    Gender gender,
    LocalDate birthDate,
    String phone,
    @Email String email,
    Long cellId,
    Role role,
    Integer joinYear,
    Boolean active,
    String address,
    String note
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/member/UpdateMyProfileRequest.java
package com.sdc.seouldreamcellbe.dto.member;

import jakarta.validation.constraints.Email;
import lombok.Builder;

@Builder
public record UpdateMyProfileRequest(
    String phone,
    @Email String email,
    String address,
    String note
) {
}
```

### 2.3. 출석 (Attendance)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/attendance/AttendanceDto.java
package com.sdc.seouldreamcellbe.dto.attendance;

import com.sdc.seouldreamcellbe.domain.Attendance;
import com.sdc.seouldreamcellbe.domain.Cell;
import com.sdc.seouldreamcellbe.domain.Member;
import com.sdc.seouldreamcellbe.domain.User;
import com.sdc.seouldreamcellbe.domain.common.AttendanceStatus;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Builder
public record AttendanceDto(
    Long id,
    MemberInfo member,
    CellInfo cell, // Added cell information
    LocalDate date,
    AttendanceStatus status,
    String memo,
    UserInfo createdBy,
    LocalDateTime createdAt
) {
    @Builder
    public record MemberInfo(Long id, String name) {
        public static MemberInfo from(Member member) {
            return (member != null) ? new MemberInfo(member.getId(), member.getName()) : null;
        }
    }

    @Builder
    public record CellInfo(Long id, String name) { // New inner record for CellInfo
        public static CellInfo from(Cell cell) {
            return (cell != null) ? new CellInfo(cell.getId(), cell.getName()) : null;
        }
    }

    @Builder
    public record UserInfo(Long id, String username) {
        public static UserInfo from(User user) {
            return (user != null) ? new UserInfo(user.getId(), user.getUsername()) : null;
        }
    }

    public static AttendanceDto from(Attendance entity) {
        return AttendanceDto.builder()
            .id(entity.getId())
            .member(MemberInfo.from(entity.getMember()))
            .cell(entity.getMember() != null ? CellInfo.from(entity.getMember().getCell()) : null) // Populate cell
            .date(entity.getDate())
            .status(entity.getStatus())
            .memo(entity.getMemo())
            .createdBy(UserInfo.from(entity.getCreatedBy()))
            .createdAt(entity.getCreatedAt())
            .build();
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/attendance/AttendanceKeyMetricsDto.java
package com.sdc.seouldreamcellbe.dto.attendance;

import lombok.Builder;

@Builder
public record AttendanceKeyMetricsDto(
    double thisWeekAttendanceRate,
    double periodAverageAttendanceRate,
    double lastYearPeriodAttendanceRate
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/attendance/CellAttendanceSummaryDto.java
package com.sdc.seouldreamcellbe.dto.attendance;

import lombok.Builder;

import java.util.List;

@Builder
public record CellAttendanceSummaryDto(
    Long cellId,
    String cellName,
    List<OverallAttendanceSummaryDto.PeriodSummaryDto> periodSummaries, // Reuse PeriodSummaryDto
    TotalSummaryDto totalSummary
) {

    @Builder
    public record TotalSummaryDto(
        long totalPresent,
        long totalAbsent,
        long totalMembers, // 전체 멤버 수
        long totalRecordedDates, // 출석이 기록된 총 날짜 수
        double attendanceRate // 전체 기간 출석률
    ) {}
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/attendance/MemberAlertDto.java
package com.sdc.seouldreamcellbe.dto.attendance;

import lombok.Builder;

import java.time.LocalDate;

@Builder
public record MemberAlertDto(
    Long memberId,
    String memberName,
    String cellName,
    LocalDate lastAttendanceDate,
    int consecutiveAbsences
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/attendance/MemberAttendanceSummaryDto.java
package com.sdc.seouldreamcellbe.dto.attendance;

import com.sdc.seouldreamcellbe.domain.common.AttendanceStatus;
import lombok.Builder;

import java.util.List;

@Builder
public record MemberAttendanceSummaryDto(
    Long memberId,
    String memberName,
    List<MemberPeriodSummaryDto> periodSummaries,
    TotalSummaryDto totalSummary
) {
    @Builder
    public record MemberPeriodSummaryDto(
        String dateGroup, // e.g., "2024-01-01", "2024-W1", "2024-01"
        AttendanceStatus status, // Only for DAY grouping
        String memo,             // Only for DAY grouping
        long presentCount,       // For WEEK, MONTH grouping
        long absentCount        // For WEEK, MONTH grouping
    ) {}

    @Builder
    public record TotalSummaryDto(
        long totalPresent,
        long totalAbsent,
        long totalRecordedDates, // 출석이 기록된 총 날짜 수
        long totalPossibleAttendances, // 해당 멤버에게 가능한 출석 기회 수 (totalRecordedDates와 동일)
        double attendanceRate // 전체 기간 출석률
    ) {}
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/attendance/OverallAttendanceSummaryDto.java
package com.sdc.seouldreamcellbe.dto.attendance;

import lombok.Builder;

import java.time.LocalDate;
import java.util.List;

@Builder
public record OverallAttendanceSummaryDto(
    List<PeriodSummaryDto> periodSummaries,
    TotalSummaryDto totalSummary
) {
    @Builder
    public record PeriodSummaryDto(
        String dateGroup, // e.g., "2024-01-01", "2024-W1", "2024-01"
        long totalPresent,
        long totalAbsent,
        long totalMembers,
        double attendanceRate // totalPresent / totalMembers
    ) {}

    @Builder
    public record TotalSummaryDto(
        long totalPresent,
        long totalAbsent,
        long totalMembersInPeriod, // 기간 내 전체 활성 멤버 수
        long totalRecordedDates, // 출석이 기록된 총 날짜 수
        double attendanceRate // 전체 기간 출석률
    ) {}
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/attendance/ProcessAttendanceRequest.java
package com.sdc.seouldreamcellbe.dto.attendance;

import com.sdc.seouldreamcellbe.domain.common.AttendanceStatus;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record ProcessAttendanceRequest(
    @NotNull Long memberId,
    @NotNull LocalDate date,
    @NotNull AttendanceStatus status,
    String memo,
    @NotNull Long createdById // Will be replaced by authenticated user later
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/attendance/SimpleAttendanceRateDto.java
package com.sdc.seouldreamcellbe.dto.attendance;

import lombok.Builder;

import java.time.LocalDate;

@Builder
public record SimpleAttendanceRateDto(
    Long targetId,
    String targetName,
    double attendanceRate,
    long presentCount,
    long absentCount,
    long totalDays,
    LocalDate startDate,
    LocalDate endDate
) {
}
```

### 2.4. 셀 (Cell)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/cell/CellDto.java
package com.sdc.seouldreamcellbe.dto.cell;

import com.sdc.seouldreamcellbe.domain.Cell;
import com.sdc.seouldreamcellbe.domain.Member;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Builder
public record CellDto(
    Long id,
    String name,
    MemberInfo leader,
    MemberInfo viceLeader,
    String description,
    boolean active,
    Integer createdYear,
    List<MemberInfo> members,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    @Builder
    public record MemberInfo(
        Long id,
        String name
    ) {
        public static MemberInfo from(Member member) {
            if (member == null) return null;
            return new MemberInfo(member.getId(), member.getName());
        }
    }

    public static CellDto from(Cell entity) {
        return CellDto.builder()
            .id(entity.getId())
            .name(entity.getName())
            .leader(MemberInfo.from(entity.getLeader()))
            .viceLeader(MemberInfo.from(entity.getViceLeader()))
            .description(entity.getDescription())
            .active(entity.getActive())
            .createdYear(entity.getCreatedYear())
            .members(entity.getMembers().stream().map(MemberInfo::from).collect(Collectors.toList()))
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/cell/CreateCellRequest.java
package com.sdc.seouldreamcellbe.dto.cell;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;

@Builder
public record CreateCellRequest(
    @NotBlank String name,
    Long leaderId,
    Long viceLeaderId,
    String description,
    Integer createdYear
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/cell/UpdateCellRequest.java
package com.sdc.seouldreamcellbe.dto.cell;

import lombok.Builder;

@Builder
public record UpdateCellRequest(
    String name,
    Long leaderId,
    Long viceLeaderId,
    String description,
    Boolean active,
    Integer createdYear
) {
}
```

### 2.5. 대시보드 (Dashboard)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/dashboard/DashboardDto.java
package com.sdc.seouldreamcellbe.dto.dashboard;

import com.sdc.seouldreamcellbe.dto.attendance.AttendanceKeyMetricsDto;
import com.sdc.seouldreamcellbe.dto.attendance.CellAttendanceSummaryDto;
import com.sdc.seouldreamcellbe.dto.attendance.OverallAttendanceSummaryDto;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Builder
public record DashboardDto(
    List<BirthdayInfo> todayBirthdays,
    List<BirthdayInfo> weeklyBirthdays,
    List<BirthdayInfo> monthlyBirthdays,
    List<RecentPrayerInfo> recentPrayers,
    List<RecentNoticeInfo> recentNotices,
    OverallAttendanceSummaryDto overallAttendanceSummary,
    List<CellAttendanceSummaryDto> cellAttendanceSummaries,
    AttendanceKeyMetricsDto attendanceKeyMetrics
) {

    @Builder
    public record BirthdayInfo(
        Long memberId,
        String memberName,
        LocalDate birthDate
    ) {}

    @Builder
    public record RecentPrayerInfo(
        Long prayerId,
        Long memberId,
        String memberName,
        String content,
        LocalDateTime createdAt
    ) {}

    @Builder
    public record RecentNoticeInfo(
        Long noticeId,
        String title,
        LocalDateTime createdAt
    ) {}
}
```

### 2.6. 공지 (Notice)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/notice/CreateNoticeRequest.java
package com.sdc.seouldreamcellbe.dto.notice;

import com.sdc.seouldreamcellbe.domain.common.NoticeTarget;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record CreateNoticeRequest(
    @NotBlank String title,
    @NotBlank String content,
    @NotNull NoticeTarget target,
    Long targetCellId,
    Boolean pinned,
    LocalDateTime publishAt,
    LocalDateTime expireAt,
    @NotNull Long createdById // Will be replaced by authenticated user later
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/notice/NoticeDto.java
package com.sdc.seouldreamcellbe.dto.notice;

import com.sdc.seouldreamcellbe.domain.Cell;
import com.sdc.seouldreamcellbe.domain.Notice;
import com.sdc.seouldreamcellbe.domain.User;
import com.sdc.seouldreamcellbe.domain.common.NoticeTarget;
import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record NoticeDto(
    Long id,
    String title,
    String content,
    NoticeTarget target,
    CellInfo targetCell,
    boolean pinned,
    LocalDateTime publishAt,
    LocalDateTime expireAt,
    boolean isDeleted,
    UserInfo createdBy,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    @Builder
    public record CellInfo(Long id, String name) {
        public static CellInfo from(Cell cell) {
            return (cell != null) ? new CellInfo(cell.getId(), cell.getName()) : null;
        }
    }

    @Builder
    public record UserInfo(Long id, String username) {
        public static UserInfo from(User user) {
            return (user != null) ? new UserInfo(user.getId(), user.getUsername()) : null;
        }
    }

    public static NoticeDto from(Notice entity) {
        return NoticeDto.builder()
            .id(entity.getId())
            .title(entity.getTitle())
            .content(entity.getContent())
            .target(entity.getTarget())
            .targetCell(CellInfo.from(entity.getTargetCell()))
            .pinned(entity.isPinned())
            .publishAt(entity.getPublishAt())
            .expireAt(entity.getExpireAt())
            .isDeleted(entity.isDeleted())
            .createdBy(UserInfo.from(entity.getCreatedBy()))
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/notice/UpdateNoticeRequest.java
package com.sdc.seouldreamcellbe.dto.notice;

import com.sdc.seouldreamcellbe.domain.common.NoticeTarget;
import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record UpdateNoticeRequest(
    String title,
    String content,
    NoticeTarget target,
    Long targetCellId,
    Boolean pinned,
    LocalDateTime publishAt,
    LocalDateTime expireAt
) {
}
```

### 2.7. 기도제목 (Prayer)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/prayer/CreatePrayerRequest.java
package com.sdc.seouldreamcellbe.dto.prayer;

import com.sdc.seouldreamcellbe.domain.common.PrayerVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;

@Builder
public record CreatePrayerRequest(
    @NotNull Long memberId,
    @NotBlank String content,
    Integer weekOfMonth,
    @NotNull PrayerVisibility visibility,
    @NotNull Long createdById // Will be replaced by authenticated user later
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/prayer/PrayerDto.java
package com.sdc.seouldreamcellbe.dto.prayer;

import com.sdc.seouldreamcellbe.domain.Member;
import com.sdc.seouldreamcellbe.domain.Prayer;
import com.sdc.seouldreamcellbe.domain.User;
import com.sdc.seouldreamcellbe.domain.common.PrayerVisibility;
import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record PrayerDto(
    Long id,
    MemberInfo member,
    String content,
    Integer weekOfMonth,
    PrayerVisibility visibility,
    boolean isDeleted,
    LocalDateTime deletedAt,
    UserInfo createdBy,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    @Builder
    public record MemberInfo(Long id, String name) {
        public static MemberInfo from(Member member) {
            return (member != null) ? new MemberInfo(member.getId(), member.getName()) : null;
        }
    }

    @Builder
    public record UserInfo(Long id, String username) {
        public static UserInfo from(User user) {
            return (user != null) ? new UserInfo(user.getId(), user.getUsername()) : null;
        }
    }

    public static PrayerDto from(Prayer entity) {
        return PrayerDto.builder()
            .id(entity.getId())
            .member(MemberInfo.from(entity.getMember()))
            .content(entity.getContent())
            .weekOfMonth(entity.getWeekOfMonth())
            .visibility(entity.getVisibility())
            .isDeleted(entity.isDeleted())
            .deletedAt(entity.getDeletedAt())
            .createdBy(UserInfo.from(entity.getCreatedBy()))
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/prayer/UpdatePrayerRequest.java
package com.sdc.seouldreamcellbe.dto.prayer;

import com.sdc.seouldreamcellbe.domain.common.PrayerVisibility;
import lombok.Builder;

@Builder
public record UpdatePrayerRequest(
    String content,
    Integer weekOfMonth,
    PrayerVisibility visibility
) {
}
```

### 2.8. 건의사항 (Suggestion)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/suggestion/CreateSuggestionRequest.java
package com.sdc.seouldreamcellbe.dto.suggestion;

import com.sdc.seouldreamcellbe.domain.common.SuggestionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;

@Builder
public record CreateSuggestionRequest(
    @NotNull Long cellId,
    @NotNull SuggestionType type,
    @NotBlank String content,
    @NotNull Long createdById // Will be replaced by authenticated user later
) {
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/suggestion/SuggestionDto.java
package com.sdc.seouldreamcellbe.dto.suggestion;

import com.sdc.seouldreamcellbe.domain.Cell;
import com.sdc.seouldreamcellbe.domain.Suggestion;
import com.sdc.seouldreamcellbe.domain.SuggestionStatusHistory;
import com.sdc.seouldreamcellbe.domain.User;
import com.sdc.seouldreamcellbe.domain.common.SuggestionStatus;
import com.sdc.seouldreamcellbe.domain.common.SuggestionType;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Builder
public record SuggestionDto(
    Long id,
    CellInfo cell,
    SuggestionType type,
    String content,
    SuggestionStatus status,
    String response,
    UserInfo handledBy,
    UserInfo createdBy,
    List<StatusHistoryDto> statusHistories,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    @Builder
    public record CellInfo(Long id, String name) {
        public static CellInfo from(Cell cell) {
            return (cell != null) ? new CellInfo(cell.getId(), cell.getName()) : null;
        }
    }

    @Builder
    public record UserInfo(Long id, String username) {
        public static UserInfo from(User user) {
            return (user != null) ? new UserInfo(user.getId(), user.getUsername()) : null;
        }
    }

    @Builder
    public record StatusHistoryDto(
        Long id,
        SuggestionStatus fromStatus,
        SuggestionStatus toStatus,
        UserInfo changedBy,
        LocalDateTime changedAt,
        String note
    ) {
        public static StatusHistoryDto from(SuggestionStatusHistory entity) {
            return StatusHistoryDto.builder()
                .id(entity.getId())
                .fromStatus(entity.getFromStatus())
                .toStatus(entity.getToStatus())
                .changedBy(UserInfo.from(entity.getChangedBy()))
                .changedAt(entity.getChangedAt())
                .note(entity.getNote())
                .build();
        }
    }

    public static SuggestionDto from(Suggestion entity) {
        return SuggestionDto.builder()
            .id(entity.getId())
            .cell(CellInfo.from(entity.getCell()))
            .type(entity.getType())
            .content(entity.getContent())
            .status(entity.getStatus())
            .response(entity.getResponse())
            .handledBy(UserInfo.from(entity.getHandledBy()))
            .createdBy(UserInfo.from(entity.getCreatedBy()))
            .statusHistories(entity.getStatusHistories().stream().map(StatusHistoryDto::from).collect(Collectors.toList()))
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/suggestion/UpdateSuggestionRequest.java
package com.sdc.seouldreamcellbe.dto.suggestion;

import com.sdc.seouldreamcellbe.domain.common.SuggestionStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;

@Builder
public record UpdateSuggestionRequest(
    @NotNull SuggestionStatus status,
    String response,
    Long handledById, // The user who is handling this
    String historyNote // A note for the status change history
) {
}
```

### 2.9. 팀 (Team)

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/team/CreateTeamRequest.java
package com.sdc.seouldreamcellbe.dto.team;

import com.sdc.seouldreamcellbe.domain.Team;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;

@Builder
public record CreateTeamRequest(
    @NotBlank(message = "팀 이름은 필수입니다.")
    String name,

    String description
) {
    public Team toEntity() {
        return Team.builder()
            .name(name)
            .description(description)
            .active(true) // 기본값으로 활성화
            .build();
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/team/TeamDto.java
package com.sdc.seouldreamcellbe.dto.team;

import com.sdc.seouldreamcellbe.domain.Team;
import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record TeamDto(
    Long id,
    String name,
    String code,
    String description,
    boolean active,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static TeamDto from(Team entity) {
        return TeamDto.builder()
            .id(entity.getId())
            .name(entity.getName())
            .code(entity.getCode())
            .description(entity.getDescription())
            .active(entity.getActive())
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }
}
```

```java
// src/main/java/com/sdc/seouldreamcellbe/dto/team/UpdateTeamRequest.java
package com.sdc.seouldreamcellbe.dto.team;

import lombok.Builder;

@Builder
public record UpdateTeamRequest(
    String name,
    String code,
    String description,
    Boolean active
) {
}
```
