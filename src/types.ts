// src/types.ts

// As per the backend's CreateMemberRequest DTO
export interface CreateMemberRequest {
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  email: string;
  cellId?: number;
  role: string;
  joinYear: number;
  address?: string;
  note?: string;
  username: string;
  password: string;
}

// 공통 Role 타입
export type UserRole = "EXECUTIVE" | "CELL_LEADER" | "MEMBER";

export interface CellShortDto {
  id: number;
  name: string;
}

export interface MemberDto {
  id: number;
  name: string;
  username: string;
  gender: "MALE" | "FEMALE";
  birthDate: string; // LocalDate
  age: number;
  phone: string;
  email: string;
  cell: {
    id: number;
    name: string;
  } | null;
  cellAssignmentDate?: string;
  role: UserRole;
  joinYear: number;
  active: boolean;
  address: string;
  note: string;
  createdAt: string; // LocalDateTime
  updatedAt: string; // LocalDateTime
}

// Assuming JWT payload structure from Spring Security JWT
export interface JwtPayload {
  userId: number;
  memberId: number | null;
  sub: string;
  name: string;
  role: UserRole;
  exp: number;
  iat: number;
  cellId: number | null;
  cellName: string | null;
}

// Response from the login endpoint
export interface JwtAuthenticationResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  role: UserRole;
  name: string;
  cellId: number | null;
  cellName: string | null;
  memberId: number | null;
}

// User object to be stored in localStorage
export interface User {
  id: number;
  memberId: number | null;
  username: string;
  name: string;
  role: UserRole;
  cellId: number | null;
  cellName: string | null;
}

export interface UpdateMemberRequest {
  name?: string;
  gender?: "MALE" | "FEMALE";
  birthDate?: string;
  phone?: string;
  email?: string;
  cellId?: number;
  role?: UserRole;
  joinYear?: number;
  active?: boolean;
  address?: string;
  note?: string;
}

export interface UpdateMyProfileRequest {
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
}

export interface TeamDto {
  id: number;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  active?: boolean;
}

export interface UpdateTeamRequest {
  name?: string;
  code?: string;
  description?: string;
  active?: boolean;
}

export interface CellMemberInfo {
  id: number;
  name: string;
  gender: "MALE" | "FEMALE";
  birthDate: string;
}

export interface CellDto {
  id: number;
  name: string;
  leader: CellMemberInfo | null;
  viceLeader: CellMemberInfo | null;
  description?: string;
  active: boolean;
  memberCount: number;
  maleCount: number;
  femaleCount: number;
  members: MemberDto[];
  createdAt: string;
  updatedAt: string;
  attendanceRate?: number; // ✅ [추가] 백엔드에서 계산해서 내려주는 출석률
}

export interface CellReportDto {
  meetingDate: string; // LocalDate (YYYY-MM-DD)
  cellShare: string;
  specialNotes: string;
}

export interface CreateCellRequest {
  name: string;
  leaderId?: number;
  viceLeaderId?: number;
  description?: string;
  memberIds?: number[];
}

export interface UpdateCellRequest {
  name?: string;
  leaderId?: number;
  viceLeaderId?: number | null;
  description?: string;
  active?: boolean;
}

export type AttendanceStatus = "PRESENT" | "ABSENT";

export interface AttendanceMemberInfo {
  id: number;
  name: string;
}

export interface AttendanceUserInfo {
  id: number;
  username: string;
  name: string;
}

export interface AttendanceDto {
  id: number;
  member: AttendanceMemberInfo;
  cell?: CellShortDto;
  date: string; // LocalDate
  status: AttendanceStatus;
  memo?: string;
  prayerContent?: string;
  createdBy: AttendanceUserInfo;
  createdAt: string; // LocalDateTime
}

export interface ProcessAttendanceRequest {
  memberId: number;
  date: string; // LocalDate
  status: AttendanceStatus;
  memo?: string;
  createdById: number;
}

export interface ProcessAttendanceWithPrayersRequest {
  meetingDate: string; // LocalDate (YYYY-MM-DD)
  cellShare: string;
  specialNotes?: string;
  items: AttendanceAndPrayerItem[];
}

export interface AttendanceAndPrayerItem {
  memberId: number;
  status: AttendanceStatus;
  memo?: string;
  prayerContent?: string;
}

export type AttendanceSummaryGroupBy =
  | "YEAR"
  | "HALF_YEAR"
  | "QUARTER"
  | "MONTH"
  | "WEEK"
  | "DAY"
  | "SEMESTER";

export interface AttendanceSummaryQueryParams {
  startDate?: string;
  endDate?: string;
  groupBy?: AttendanceSummaryGroupBy;
  year?: number;
  month?: number;
  quarter?: number;
  half?: number;
}

export interface SimpleAttendanceRateDto {
  targetId: number | null;
  targetName: string;
  attendanceRate: number;
  presentCount: number;
  absentCount: number;
  totalDays: number;
  startDate: string;
  endDate: string;
}

export interface OverallAttendanceStatDto {
  totalRecords: number;
  attendanceRate: number;
  weeklyAverage: number;
  zeroAttendanceCount: number;
  attendanceTrend: number;
}

export interface TotalSummaryDto {
  totalPresent: number;
  totalAbsent: number;
  totalMembersInPeriod: number;
  totalRecordedDates: number;
  attendanceRate: number;
}

export interface MemberTotalSummaryDto {
  totalPresent: number;
  totalAbsent: number;
  totalRecordedDates: number;
  totalPossibleAttendances: number;
  attendanceRate: number;
}

export interface PeriodSummaryDto {
  dateGroup: string;
  totalPresent: number;
  totalAbsent: number;
  totalMembers: number;
  attendanceRate: number;
}

export interface OverallAttendanceSummaryDto {
  periodSummaries: PeriodSummaryDto[];
  totalSummary: TotalSummaryDto;
}

export interface CellAttendanceSummaryDto {
  cellId: number;
  cellName: string;
  periodSummaries: PeriodSummaryDto[];
  totalSummary: TotalSummaryDto;
}

export interface MemberPeriodSummaryDto {
  dateGroup: string;
  status?: AttendanceStatus;
  memo?: string;
  presentCount?: number;
  absentCount?: number;
}

export interface MemberAttendanceSummaryDto {
  memberId: number;
  memberName: string;
  periodSummaries: MemberPeriodSummaryDto[];
  totalSummary: MemberTotalSummaryDto;
}

export interface MemberAlertDto {
  memberId: number;
  memberName: string;
  cellName: string;
  lastAttendanceDate: string; // LocalDate
  consecutiveAbsences: number;
}

export interface IncompleteCheckReportDto {
  leaderId: number;
  leaderName: string;
  cellId: number;
  cellName: string;
  missedDatesCount: number;
  missedDates: string[];
}

export interface CellMemberAttendanceSummaryDto {
  memberId: number;
  memberName: string;
  gender: Gender;
  birthDate: string;
  joinYear: number;
  active: boolean;
  lastAttendanceDate: string | null;
  consecutiveAbsences: number;
  cellAssignmentDate?: string;
}

export interface AggregatedTrendDto {
  dateGroup: string;
  totalRecords: number;
  presentRecords: number;
  attendanceRate: number;
}

export type PrayerVisibility = "PRIVATE" | "CELL" | "ALL";

export interface PrayerMemberInfo {
  id: number;
  name: string;
  cell?: {
    id: number;
  };
}

export interface PrayerUserInfo {
  id: number;
  username: string;
  name: string;
}

// ✅ [수정] PrayerDto: meetingDate 필드 추가
export interface PrayerDto {
  id: number;
  member: PrayerMemberInfo;
  content: string;
  meetingDate: string; // ✅ YYYY-MM-DD (필수)
  weekOfMonth?: number;
  visibility: PrayerVisibility;
  isDeleted: boolean;
  deletedAt?: string;
  createdBy: PrayerUserInfo;
  createdAt: string; // 작성일
  updatedAt: string; // 수정일
}

export interface PrayerMemberSummaryDto {
  memberId: number;
  memberName: string;
  cellId: number | null;
  cellName: string | null;
  totalCount: number;
  latestCreatedAt: string;
}

export interface PrayerCellSummaryDto {
  cellId: number;
  cellName: string;
  totalCount: number;
  latestCreatedAt: string;
}

// ✅ [수정] CreatePrayerRequest: meetingDate 추가
export interface CreatePrayerRequest {
  memberId: number;
  content: string;
  meetingDate: string; // ✅ YYYY-MM-DD (필수)
  weekOfMonth?: number;
  visibility: PrayerVisibility;
  createdById: number;
}

// ✅ [수정] UpdatePrayerRequest: meetingDate 추가
export interface UpdatePrayerRequest {
  content?: string;
  meetingDate?: string; // ✅ YYYY-MM-DD (선택)
  weekOfMonth?: number;
  createdAt?: string;
  visibility?: PrayerVisibility;
}

export interface PrayerFormErrors {
  memberId?: string;
  content?: string;
  weekOfMonth?: string;
  visibility?: string;
  createdById?: string;
  submit?: string;
  createdAt?: string;
}

export type NoticeTarget = "ALL" | "CELL_LEADER" | "EXECUTIVE" | "CELL";

export interface NoticeCellInfo {
  id: number;
  name: string;
}

export interface NoticeUserInfo {
  id: number;
  username: string;
  name: string;
}

export interface NoticeDto {
  id: number;
  title: string;
  content: string;
  target: NoticeTarget;
  targetCell: NoticeCellInfo | null;
  pinned: boolean;
  publishAt?: string;
  expireAt?: string;
  isDeleted: boolean;
  createdBy: NoticeUserInfo;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoticeRequest {
  title: string;
  content: string;
  target: NoticeTarget;
  targetCellId?: number;
  pinned?: boolean;
  publishAt?: string;
  expireAt?: string;
  createdById: number;
}

export interface UpdateNoticeRequest {
  title?: string;
  content?: string;
  target?: NoticeTarget;
  targetCellId?: number;
  pinned?: boolean;
  publishAt?: string;
  expireAt?: string;
}

export interface NoticeFormErrors {
  title?: string;
  content?: string;
  target?: string;
  targetCellId?: string;
  pinned?: string;
  publishAt?: string;
  expireAt?: string;
  createdById?: string;
  submit?: string;
}

export type SuggestionType = "DIFFICULTY" | "REQUEST" | "OTHER";
export type SuggestionStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED";

export type Gender = "MALE" | "FEMALE";
export type GroupBy = "DAY" | "WEEK" | "MONTH";
export type UserStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export interface SuggestionCellInfo {
  id: number;
  name: string;
}

export interface SuggestionUserInfo {
  id: number;
  username: string;
  name: string;
}

export interface SuggestionStatusHistoryDto {
  id: number;
  fromStatus: SuggestionStatus;
  toStatus: SuggestionStatus;
  changedBy: SuggestionUserInfo;
  changedAt: string;
  note?: string;
}

export interface SuggestionDto {
  id: number;
  cell: SuggestionCellInfo;
  type: SuggestionType;
  content: string;
  status: SuggestionStatus;
  response?: string;
  handledBy: SuggestionUserInfo | null;
  createdBy: SuggestionUserInfo;
  statusHistories: SuggestionStatusHistoryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSuggestionRequest {
  cellId: number;
  type: SuggestionType;
  content: string;
  createdById: number;
}

export interface UpdateSuggestionRequest {
  status: SuggestionStatus;
  response?: string;
  handledById?: number;
  historyNote?: string;
}

export interface Page<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      sorted: boolean;
      unsorted: boolean;
      empty: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface SuggestionFormErrors {
  cellId?: string;
  type?: string;
  content?: string;
  status?: string;
  response?: string;
  handledById?: number;
  historyNote?: string;
  createdById?: string;
  submit?: string;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface PasswordVerificationRequest {
  password?: string;
}

export interface BirthdayInfo {
  memberId: number;
  memberName: string;
  birthDate: string;
}

export interface RecentPrayerInfo {
  prayerId: number;
  memberId: number;
  memberName: string;
  content: string;
  createdAt: string;
}

export interface RecentNoticeInfo {
  noticeId: number;
  title: string;
  createdAt: string;
  pinned: boolean;
}

export interface CellLeaderDashboardDto {
  presentRecords: number;
  totalMembers: number;
  attendanceRate: number;
  incompleteCheckCount: number;
}

export interface AttendanceKeyMetricsDto {
  thisWeekAttendanceRate: number;
  periodAverageAttendanceRate: number;
  lastYearPeriodAttendanceRate: number;
}

export interface DemographicsDistributionDto {
  birthYear: number;
  maleCount: number;
  femaleCount: number;
}

export interface DashboardDemographicsDto {
  totalCellCount: number;
  totalMemberCount: number;
  cellMemberCount: number;
  previousSemesterCount: number;
  executiveCount: number;
  cellLeaderCount: number;
  count10sAndUnder: number;
  count20s: number;
  count30s: number;
  count40sAndOver: number;
  distribution: DemographicsDistributionDto[];
}

export interface DashboardDto {
  todayBirthdays: BirthdayInfo[];
  weeklyBirthdays: BirthdayInfo[];
  monthlyBirthdays: BirthdayInfo[];
  totalTodayBirthdays: number;
  totalWeeklyBirthdays: number;
  totalMonthlyBirthdays: number;
  totalLongTermAbsentees: number;
  newcomerCount: number;
  attendanceChange: number;
  unassignedMemberCount: number;
  recentPrayers: RecentPrayerInfo[];
  recentNotices: RecentNoticeInfo[];
  weeklyPrayerCount: number;
  weeklyNoticeCount: number;
  overallAttendanceSummary:
    | OverallAttendanceSummaryDto
    | OverallAttendanceStatDto;
  cellAttendanceSummaries: CellAttendanceSummaryDto[];
  attendanceKeyMetrics: AttendanceKeyMetricsDto;
  attendanceTrend?: AggregatedTrendDto[];
  demographics?: DashboardDemographicsDto;
}

export interface MyProfileFormErrors {
  name?: string;
  gender?: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  submit?: string;
}

export interface AttendanceFormErrors {
  memberId?: string;
  date?: string;
  status?: string;
  memo?: string;
  createdById?: string;
  submit?: string;
}

export interface CellFormErrors {
  name?: string;
  leaderId?: string;
  viceLeaderId?: string;
  description?: string;
  active?: string;
  submit?: string;
}

export interface TeamFormErrors {
  name?: string;
  description?: string;
  active?: string;
  submit?: string;
}

export interface FormErrors {
  name?: string;
  username?: string;
  password?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  gender?: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  cellId?: string;
  role?: string;
  joinYear?: string;
  address?: string;
  note?: string;
  submit?: string;
}

export interface GetAllMembersParams {
  name?: string;
  joinYear?: number;
  gender?: "MALE" | "FEMALE";
  role?: "EXECUTIVE" | "CELL_LEADER" | "MEMBER";
  unassigned?: boolean;
  cellId?: number;
  page?: number;
  size?: number;
  sort?: string;
  active?: boolean;
  month?: number;
}

export interface GetAllTeamsParams {
  name?: string;
  code?: string;
  active?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

export interface GetAllCellsParams {
  name?: string;
  active?: boolean;
  page?: number;
  size?: number;
  sort?: string;
  startDate?: string;
  endDate?: string;
  year?: number;
  month?: number;
  quarter?: number;
  half?: number;
}

export interface GetAllNoticesParams {
  title?: string;
  target?: NoticeTarget;
  pinned?: boolean;
  page?: number;
  size?: number;
  sort?: string;
  startDate?: string;
  endDate?: string;
  year?: number;
  month?: number;
  quarter?: number;
  half?: number;
}

export interface GetPrayersParams {
  memberId?: number;
  cellId?: number;
  createdById?: number;
  isDeleted?: boolean;
  visibility?: PrayerVisibility;
  startDate?: string; // 백엔드에서 meetingDate 필터링에 사용됨
  endDate?: string; // 백엔드에서 meetingDate 필터링에 사용됨
  year?: number;
  month?: number;
  quarter?: number;
  half?: number;
  page?: number;
  size?: number;
  sort?: string;
}

export interface GetAttendancesParams {
  page?: number;
  size?: number;
  sort?: string;
  startDate?: string;
  endDate?: string;
  cellId?: number;
  memberId?: number;
  status?: AttendanceStatus;
  year?: number;
  month?: number;
  quarter?: number;
  half?: number;
}

export interface SemesterDto {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface CreateSemesterRequest {
  name: string;
  startDate: string;
  endDate: string;
}

export interface UpdateSemesterRequest {
  name?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export interface OptionType {
  value: string;
  label: string;
}

export interface NewcomerStatDto {
  label: string;
  count: number;
  growthRate: number;
}

export interface SemesterSummaryDto {
  semesterName: string;
  totalCellCount: number;
  totalMemberCount: number;
  cellMemberCount: number;
  unassignedCount: number;
  executiveCount: number;
  cellLeaderCount: number;
  ageGroupSummary: {
    under20s: number;
    twenties: number;
    thirties: number;
    over40s: number;
  };
}

export interface UnassignedMemberDto {
  id: number;
  name: string;
  birthYear?: string;
  birthDate?: string; // ✅ 추가됨
  age?: number;
  phone: string;
  registeredDate: string;
  gender: Gender;
}
