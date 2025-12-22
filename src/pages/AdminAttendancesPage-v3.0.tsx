// src/pages/AdminAttendancesPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { attendanceService } from "../services/attendanceService";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import { statisticsService } from "../services/statisticsService";
import { semesterService } from "../services/semesterService";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import {
  translateAttendanceStatus,
  ATTENDANCE_STATUSES,
} from "../utils/attendanceUtils";
import { formatDisplayName } from "../utils/memberUtils";

// Components
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import Pagination from "../components/Pagination";
import AttendanceMatrix from "../components/AttendanceMatrix"; // [필수] 기존 컴포넌트

// Types
import type {
  GetAttendancesParams,
  AttendanceDto,
  AttendanceStatus,
  MemberDto,
  Page,
  ProcessAttendanceRequest,
  AggregatedTrendDto,
  OverallAttendanceStatDto,
  AttendanceSummaryGroupBy,
  SemesterDto,
} from "../types";
import type { SelectOption } from "../components/AsyncSearchableSelect";

// Icons
import { ChartBarIcon, UsersIcon } from "@heroicons/react/24/outline";
import { FaList, FaTh } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────
// Types & Helpers
// ─────────────────────────────────────────────────────────────

type UnitType = "year" | "month" | "semester";

type SortConfig = {
  key: keyof AttendanceDto | "memberName" | "cellName";
  direction: "ascending" | "descending";
};

type Filters = {
  startDate: string;
  endDate: string;
  member: SelectOption | null;
  cell: SelectOption | null;
  status?: AttendanceStatus | "";
  year: number | "";
  month: number | "";
  semesterId: number | "";
};

const formatDateKorean = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${m}월 ${d}일`;
};

const pad = (n: number) => n.toString().padStart(2, "0");

const formatDateGroupLabel = (
  groupBy: AttendanceSummaryGroupBy,
  raw: string
): string => {
  if (!raw) return raw;
  if (groupBy === "SEMESTER") return raw;
  if (groupBy === "YEAR") return `${raw}년`;

  if (groupBy === "MONTH") {
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    return match ? `${match[1]}년 ${parseInt(match[2], 10)}월` : raw;
  }
  if (groupBy === "WEEK") {
    const match = raw.match(/^(\d{4})-W(\d{1,2})$/);
    return match ? `${match[1]}년 ${parseInt(match[2], 10)}주차` : raw;
  }
  if (groupBy === "DAY") {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[1]}년 ${parseInt(match[2], 10)}월 ${parseInt(
        match[3],
        10
      )}일`;
    }
    return raw;
  }
  return raw;
};

// ─────────────────────────────────────────────────────────────
// Sub Components (Stats, Trend, Cells)
// ─────────────────────────────────────────────────────────────

const AttendanceStats: React.FC<{
  stats: OverallAttendanceStatDto | null;
  loading: boolean;
}> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-center">
          <p className="text-gray-600 text-sm">통계 불러오는 중...</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-center">
          <p className="text-gray-600 text-sm">통계 불러오는 중...</p>
        </div>
      </div>
    );
  }
  if (!stats) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4">
        <div className="bg-blue-100 p-3 rounded-full">
          <UsersIcon className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">총 기록</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.totalRecords}
          </p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4">
        <div className="bg-indigo-100 p-3 rounded-full">
          <ChartBarIcon className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">출석률</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.attendanceRate.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};

type AttendanceTrendProps = {
  data: AggregatedTrendDto[];
  selectedGroupBy: AttendanceSummaryGroupBy;
  title: string;
  dateRange?: { startDate: string; endDate: string } | null;
};

const AttendanceTrend: React.FC<AttendanceTrendProps> = ({
  data,
  selectedGroupBy,
  title,
  dateRange,
}) => {
  const shouldLimitItems =
    selectedGroupBy === "DAY" || selectedGroupBy === "WEEK";
  const MAX_ITEMS = 12;

  const slicedData = useMemo(() => {
    const base = data.filter((item) => typeof item.attendanceRate === "number");
    if (!shouldLimitItems) return base;
    return base.length > MAX_ITEMS ? base.slice(-MAX_ITEMS) : base;
  }, [data, shouldLimitItems]);

  const summary = useMemo(() => {
    if (!slicedData.length) return null;
    const sorted = [...slicedData];
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const max = sorted.reduce((acc, cur) =>
      cur.attendanceRate > acc.attendanceRate ? cur : acc
    );
    const min = sorted.reduce((acc, cur) =>
      cur.attendanceRate < acc.attendanceRate ? cur : acc
    );

    return {
      start: first,
      end: last,
      startRate: first.attendanceRate,
      endRate: last.attendanceRate,
      diff: last.attendanceRate - first.attendanceRate,
      max,
      min,
    };
  }, [slicedData]);

  const formatDiff = (diff: number) => {
    const fixed = diff.toFixed(1);
    if (diff > 0) return `+${fixed}p`;
    if (diff < 0) return `${fixed}p`;
    return "변화 없음";
  };

  if (data.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-xs">조회 기간</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {dateRange
                ? `${formatDateKorean(
                    dateRange.startDate
                  )} ~ ${formatDateKorean(dateRange.endDate)}`
                : "전체 기간"}
            </p>
            <p className="mt-1.5 font-medium text-gray-800 text-sm">
              {summary.startRate.toFixed(1)}% → {summary.endRate.toFixed(1)}%{" "}
              <span className="ml-2 text-xs text-blue-600">
                ({formatDiff(summary.diff)})
              </span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-xs">최고 출석률</p>
            <p className="font-medium text-gray-800 text-sm">
              {summary.max.attendanceRate.toFixed(1)}%{" "}
              <span className="ml-1 text-xs text-gray-600">
                ({formatDateGroupLabel(selectedGroupBy, summary.max.dateGroup)})
              </span>
            </p>
          </div>
          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-xs">최저 출석률</p>
            <p className="font-medium text-gray-800 text-sm">
              {summary.min.attendanceRate.toFixed(1)}%{" "}
              <span className="ml-1 text-xs text-gray-600">
                ({formatDateGroupLabel(selectedGroupBy, summary.min.dateGroup)})
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {slicedData.map((item) => (
          <div key={item.dateGroup} className="space-y-1">
            <div className="flex justify-between text-[11px] sm:text-xs text-gray-600">
              <span>
                {formatDateGroupLabel(selectedGroupBy, item.dateGroup)}
              </span>
              <span>
                {item.attendanceRate.toFixed(1)}% ({item.presentRecords}/
                {item.totalRecords})
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${item.attendanceRate}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {shouldLimitItems && data.length > MAX_ITEMS && (
        <p className="mt-2 text-[11px] text-gray-400">
          * 최근 {MAX_ITEMS}개의 데이터만 표시합니다.
        </p>
      )}
    </div>
  );
};

const StatusCell: React.FC<{
  attendance: AttendanceDto;
  editedStatus?: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
}> = ({ attendance, editedStatus, onChange, disabled }) => {
  const currentStatus = editedStatus || attendance.status;
  const handleClick = (status: AttendanceStatus) => {
    if (disabled) return;
    onChange(status);
  };
  if (disabled) {
    return (
      <span
        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
          currentStatus === "PRESENT"
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
        }`}
      >
        {translateAttendanceStatus(currentStatus)}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {(["PRESENT", "ABSENT"] as AttendanceStatus[]).map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => handleClick(status)}
          disabled={disabled}
          className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
            currentStatus === status
              ? status === "PRESENT"
                ? "bg-green-500 text-white border-green-500"
                : "bg-red-500 text-white border-red-500"
              : `bg-transparent hover:bg-gray-100 ${
                  status === "PRESENT"
                    ? "text-green-700 border-green-300"
                    : "text-red-700 border-red-300"
                }`
          }`}
        >
          {translateAttendanceStatus(status)}
        </button>
      ))}
    </div>
  );
};

const EditableMemoCell: React.FC<{
  memo: string;
  onChange: (memo: string) => void;
  disabled?: boolean;
}> = ({ memo, onChange, disabled }) => {
  return (
    <input
      type="text"
      value={memo}
      onChange={(e) => !disabled && onChange(e.target.value)}
      readOnly={disabled}
      className={`w-full px-2 py-1 border border-transparent rounded-md bg-transparent text-xs sm:text-sm ${
        disabled
          ? "text-gray-400 cursor-not-allowed"
          : "hover:border-gray-300 focus:border-indigo-500 focus:bg-white"
      }`}
      placeholder={disabled ? "" : "메모를 입력하세요"}
    />
  );
};

// ─────────────────────────────────────────────────────────────
// [NEW] AttendanceMatrixView Component
// ─────────────────────────────────────────────────────────────

const AttendanceMatrixView: React.FC<{
  members: MemberDto[];
  attendances: AttendanceDto[];
  startDate: string;
  endDate: string;
  unitType: UnitType;
  isLoading: boolean;
}> = ({ members, attendances, startDate, endDate, unitType, isLoading }) => {
  // 1. 기간 내 미체크 수 계산 (일요일 수 * 멤버 수 - 기록된 수)
  const uncheckedCount = useMemo(() => {
    if (!startDate || !endDate || members.length === 0) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    let sundayCount = 0;
    const current = new Date(start);
    while (current <= end) {
      if (current.getDay() === 0) sundayCount++;
      current.setDate(current.getDate() + 1);
    }

    const recordedCount = attendances.filter(
      (a) => a.status === "PRESENT" || a.status === "ABSENT"
    ).length;

    const totalPossibleChecks = sundayCount * members.length;
    return Math.max(0, totalPossibleChecks - recordedCount);
  }, [startDate, endDate, members.length, attendances]);

  // 2. 통계 계산
  const summary = useMemo(() => {
    const present = attendances.filter((a) => a.status === "PRESENT").length;
    const absent = attendances.filter((a) => a.status === "ABSENT").length;
    const total = present + absent;
    const rate = total > 0 ? (present / total) * 100 : 0;

    return { present, absent, rate, unchecked: uncheckedCount };
  }, [attendances, uncheckedCount]);

  // 3. 매트릭스용 멤버 포맷
  const matrixMembers = useMemo(
    () =>
      members
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({ memberId: m.id, memberName: m.name })),
    [members]
  );

  // [수정] unitType이 'month'일 때만 달력형식(화살표), 'year'나 'semester'는 전체 범위 스크롤
  const matrixMode = unitType === "month" ? "month" : "semester";
  const [targetYear, targetMonth] = startDate.split("-").map(Number);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 4분할 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-xs sm:text-sm font-medium text-indigo-500">
            출석률
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-indigo-600">
            {summary.rate.toFixed(0)}
            <span className="text-lg">%</span>
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
          <p className="text-xs sm:text-sm font-medium text-green-600">출석</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-green-700">
            {summary.present}
          </p>
        </div>
        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <p className="text-xs sm:text-sm font-medium text-red-600">결석</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-red-700">
            {summary.absent}
          </p>
        </div>
        <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
          <p className="text-xs sm:text-sm font-medium text-gray-500">
            미체크 (예상)
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-600">
            {summary.unchecked}
          </p>
        </div>
      </div>

      {/* 매트릭스 테이블 */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-bold text-gray-700 mb-4 ml-1 flex items-center">
          <FaTh className="mr-2 text-indigo-500" />
          {unitType === "year"
            ? `${targetYear}년 전체 현황`
            : unitType === "semester"
            ? "학기 전체 현황"
            : "월간 상세 현황"}
        </h4>

        <AttendanceMatrix
          mode={matrixMode}
          startDate={startDate}
          endDate={endDate}
          year={targetYear}
          month={targetMonth}
          members={matrixMembers}
          attendances={attendances}
          onMonthChange={() => {}}
          loading={isLoading}
          limitStartDate={startDate}
          limitEndDate={endDate}
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

const AdminAttendancesPage: React.FC = () => {
  const { user } = useAuth();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // View Mode: 'list' | 'matrix'
  const [viewMode, setViewMode] = useState<"list" | "matrix">("list");

  // Data States
  const [attendancePage, setAttendancePage] =
    useState<Page<AttendanceDto> | null>(null);
  const [matrixAttendances, setMatrixAttendances] = useState<AttendanceDto[]>(
    []
  );

  const [allMembers, setAllMembers] = useState<MemberDto[]>([]);
  const [editedAttendances, setEditedAttendances] = useState<
    Map<number, Partial<AttendanceDto>>
  >(new Map());

  const [trendData, setTrendData] = useState<AggregatedTrendDto[]>([]);
  const [trendLoading, setTrendLoading] = useState<boolean>(false);
  const [trendError, setErrorTrend] = useState<string | null>(null);

  const [overallStats, setOverallStats] =
    useState<OverallAttendanceStatDto | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;

  const [hasAutoSelectedSemester, setHasAutoSelectedSemester] = useState(false);

  // Filters
  const [filters, setFilters] = useState<Filters>({
    startDate: "",
    endDate: "",
    member: null,
    cell:
      user?.role === "CELL_LEADER" && user.cellId && user.cellName
        ? { value: user.cellId, label: user.cellName }
        : null,
    status: "",
    year: currentYear,
    month: "" as number | "",
    semesterId: "" as number | "",
  });

  const [filterType, setFilterType] = useState<"unit" | "range">("unit");
  const [unitType, setUnitType] = useState<UnitType>("semester");

  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    direction: "descending",
  });

  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedGroupBy, setSelectedGroupBy] =
    useState<AttendanceSummaryGroupBy>("DAY");

  const isExecutive = useMemo(() => user?.role === "EXECUTIVE", [user]);
  const isCellLeader = useMemo(() => user?.role === "CELL_LEADER", [user]);

  // ─────────────────────────────────────────────────────────────
  // Effects & Logic
  // ─────────────────────────────────────────────────────────────

  // 학기 자동 선택 로직
  useEffect(() => {
    if (semesters.length > 0 && !hasAutoSelectedSemester) {
      const today = new Date();
      const currentYM = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;

      let target = semesters.find((s) => {
        const start = s.startDate.substring(0, 7);
        const end = s.endDate.substring(0, 7);
        return currentYM >= start && currentYM <= end;
      });

      if (!target) {
        target = [...semesters].sort((a, b) => b.id - a.id)[0];
      }

      if (target) {
        setFilters((prev) => ({
          ...prev,
          semesterId: target!.id,
          year: "",
          month: "",
        }));
      } else {
        setUnitType("month");
        setFilters((prev) => ({
          ...prev,
          year: currentYear,
          month: currentMonth,
          semesterId: "",
        }));
      }
      setHasAutoSelectedSemester(true);
    }
  }, [semesters, hasAutoSelectedSemester, currentYear, currentMonth]);

  // [수정] 유효 기간 계산 (학기 교집합 로직 적용)
  const effectiveDateRange = useMemo(() => {
    // 1. 기간 직접 선택 (Range)
    if (filterType === "range") {
      if (filters.startDate && filters.endDate) {
        return { startDate: filters.startDate, endDate: filters.endDate };
      }
      return null;
    }

    // 2. 학기 단위 (Semester)
    if (unitType === "semester" && filters.semesterId && semesters.length > 0) {
      const semester = semesters.find((s) => s.id === filters.semesterId);
      if (semester) {
        return { startDate: semester.startDate, endDate: semester.endDate };
      }
    }

    // 3. 연간/월간 단위 (Year/Month)
    const year = typeof filters.year === "number" ? filters.year : undefined;
    if (!year) return null;

    let rawStart = "";
    let rawEnd = "";

    if (unitType === "month" && filters.month) {
      const m = filters.month as number;
      const lastDay = new Date(year, m, 0).getDate();
      rawStart = `${year}-${pad(m)}-01`;
      rawEnd = `${year}-${pad(m)}-${pad(lastDay)}`;
    } else if (unitType === "year") {
      rawStart = `${year}-01-01`;
      rawEnd = `${year}-12-31`;
    } else {
      return null; // Should not happen based on UI
    }

    // [CRITICAL] 학기와의 교집합(Intersection) 처리
    // 선택한 기간(월/연) 내에 존재하는 '학기 기간'으로만 범위를 제한(Clipping)합니다.
    // 이를 통해 학기가 시작되지 않은 기간이 '미체크(결석)'로 잡히는 것을 방지합니다.
    if (semesters.length > 0) {
      const overlappingSemesters = semesters.filter(
        (s) => s.startDate <= rawEnd && s.endDate >= rawStart
      );

      if (overlappingSemesters.length > 0) {
        // 날짜순 정렬
        const sorted = [...overlappingSemesters].sort((a, b) =>
          a.startDate.localeCompare(b.startDate)
        );
        const firstSem = sorted[0];
        const lastSem = sorted[sorted.length - 1];

        // 시작일 Clip: 선택 기간 시작보다 첫 학기 시작이 늦으면 학기 시작일로
        if (rawStart < firstSem.startDate) {
          rawStart = firstSem.startDate;
        }
        // 종료일 Clip: 선택 기간 종료보다 마지막 학기 종료가 빠르면 학기 종료일로
        if (rawEnd > lastSem.endDate) {
          rawEnd = lastSem.endDate;
        }
      } else {
        // 겹치는 학기가 아예 없는 경우 (예: 방학 기간 선택)
        // 원본 범위를 그대로 반환하거나, 빈 범위를 반환할 수 있습니다.
        // 여기서는 데이터가 없더라도 조회는 되도록 원본 범위를 둡니다 (결과는 0건)
      }
    }

    return { startDate: rawStart, endDate: rawEnd };
  }, [filterType, filters, semesters, unitType]);

  const dateRangeForTrend = useMemo(() => {
    if (effectiveDateRange) return effectiveDateRange;
    return { startDate: "2999-01-01", endDate: "2999-01-01" };
  }, [effectiveDateRange]);

  const getCleanedParams = useCallback(() => {
    const params: GetAttendancesParams = {
      status: filters.status as AttendanceStatus | undefined,
      memberId: normalizeNumberInput(filters.member?.value),
      cellId: normalizeNumberInput(filters.cell?.value),
    };

    if (effectiveDateRange) {
      params.startDate = effectiveDateRange.startDate;
      params.endDate = effectiveDateRange.endDate;
    } else {
      params.startDate = "2999-01-01";
      params.endDate = "2999-01-01";
    }

    return Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    );
  }, [filters, effectiveDateRange]);

  // Fetch Logic
  const fetchAttendances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = getCleanedParams();

      if (viewMode === "matrix") {
        // [Matrix View] Load large dataset sorted by date
        const matrixParams = {
          ...params,
          page: 0,
          size: 2000, // Sufficiently large size
          sort: "date,asc",
        };
        const data = await attendanceService.getAttendances(
          matrixParams as GetAttendancesParams
        );
        setMatrixAttendances(data.content);
      } else {
        // [List View] Load paginated dataset
        const sortKeyMap = {
          memberName: "member.name",
          cellName: "member.cell.name",
        } as Record<string, string>;
        const backendSortKey =
          sortKeyMap[sortConfig.key as string] || (sortConfig.key as string);
        const listParams = {
          ...params,
          page: currentPage,
          size: pageSize,
          sort: `${backendSortKey},${
            sortConfig.direction === "ascending" ? "asc" : "desc"
          }`,
        };
        const data = await attendanceService.getAttendances(
          listParams as GetAttendancesParams
        );
        setAttendancePage(data);
        setEditedAttendances(new Map());
      }
    } catch (err) {
      setError("출석 기록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, sortConfig, getCleanedParams, viewMode]);

  const fetchTrendData = useCallback(async () => {
    if (!isExecutive || !effectiveDateRange) return;
    setTrendLoading(true);
    setErrorTrend(null);
    try {
      const params = {
        startDate: effectiveDateRange.startDate,
        endDate: effectiveDateRange.endDate,
        status: filters.status as AttendanceStatus | undefined,
        memberId: normalizeNumberInput(filters.member?.value),
        cellId: normalizeNumberInput(filters.cell?.value),
        groupBy: selectedGroupBy,
      };
      const cleanedParams = Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== null && v !== "" && v !== undefined
        )
      );
      const data = await statisticsService.getAttendanceTrend(cleanedParams);
      setTrendData(data);
    } catch (err) {
      setErrorTrend("출석률 추이 데이터를 불러오는 데 실패했습니다.");
    } finally {
      setTrendLoading(false);
    }
  }, [isExecutive, effectiveDateRange, filters, selectedGroupBy]);

  const fetchOverallStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = getCleanedParams();
      const data = await statisticsService.getOverallAttendance(params);
      setOverallStats(data);
    } catch (err) {
      setOverallStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [getCleanedParams]);

  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await attendanceService.getAvailableYears();
      setAvailableYears(years);
    } catch (err) {
      setAvailableYears([]);
    }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      setSemesters([]);
    }
  }, []);

  // Initial Loads
  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      if (semesters.length > 0 || hasActiveSemesters === false) {
        fetchAttendances();
        fetchOverallStats();
      }
      (async () => {
        try {
          const res = await memberService.getAllMembers({ size: 1000 });
          setAllMembers(res.content);
        } catch (err) {
          console.error(err);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchOverallStats, semesters.length, hasActiveSemesters]);

  useEffect(() => {
    fetchAttendances();
  }, [viewMode, fetchAttendances]); // Reload when mode changes

  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      fetchAvailableYears();
      fetchSemesters();
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

  useEffect(() => {
    if (!isExecutive) {
      setTrendData([]);
      return;
    }
    // List 모드일 때만 추이 그래프 로드 (선택 사항)
    if (viewMode === "list") {
      fetchTrendData();
    }
  }, [isExecutive, fetchTrendData, viewMode]);

  // Handlers
  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  };
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(0);
  };
  const handleSearch = () => {
    setCurrentPage(0);
    fetchAttendances();
    fetchOverallStats();
    if (isExecutive && viewMode === "list") fetchTrendData();
  };
  const handleAttendanceChange = (
    id: number,
    field: keyof AttendanceDto,
    value: any
  ) => {
    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(id) || {};
      newMap.set(id, { ...current, [field]: value });
      return newMap;
    });
  };
  const handleSaveChanges = async () => {
    if (!user || editedAttendances.size === 0) return;
    setIsSaving(true);
    const payload: ProcessAttendanceRequest[] = [];
    for (const [id, edits] of editedAttendances.entries()) {
      const original = attendancePage?.content.find((a) => a.id === id);
      if (original) {
        payload.push({
          memberId: original.member.id,
          date: original.date,
          status: (edits.status || original.status)!,
          memo: edits.memo !== undefined ? edits.memo : original.memo,
          createdById: user.id,
        });
      }
    }
    try {
      await attendanceService.processAttendances(payload);
      fetchAttendances(); // Refresh current view
      setEditMode(false);
    } catch (err) {
      setError("변경사항 저장 실패");
    } finally {
      setIsSaving(false);
    }
  };

  const requestSort = (key: SortConfig["key"]) => {
    let direction: SortConfig["direction"] = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending")
      direction = "descending";
    setSortConfig({ key, direction });
    setCurrentPage(0);
  };
  const getSortIndicator = (key: SortConfig["key"]) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "ascending" ? "▲" : "▼";
  };

  const resetFilters = () => {
    if (!user) return;
    setFilters({
      startDate: "",
      endDate: "",
      member: null,
      cell:
        user.role === "CELL_LEADER" && user.cellId && user.cellName
          ? { value: user.cellId, label: user.cellName }
          : null,
      status: "",
      year: currentYear,
      month: "" as number | "",
      semesterId: "" as number | "",
    });
    setUnitType("year");
    setCurrentPage(0);
  };

  // Options & Logic
  const statusOptions = useMemo(
    () => [
      { value: "", label: "모든 상태" },
      ...ATTENDANCE_STATUSES.map((s) => ({
        value: s,
        label: translateAttendanceStatus(s),
      })),
    ],
    []
  );
  const [allCells, setAllCells] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (isExecutive) {
      cellService
        .getAllCells({ size: 1000 })
        .then((d) => setAllCells(d.content));
    }
  }, [isExecutive]);
  const cellOptions = useMemo(
    () =>
      !isExecutive
        ? []
        : [
            { value: null, label: "전체 셀" },
            ...allCells.map((c) => ({ value: c.id, label: c.name })),
          ],
    [allCells, isExecutive]
  );
  const memberOptions = useMemo(() => {
    let list = allMembers;
    if (isCellLeader && user?.cellId)
      list = allMembers.filter((m) => m.cell?.id === user.cellId);
    return [
      { value: null, label: isCellLeader ? "내 셀 전체" : "전체 멤버" },
      ...list.map((m) => ({
        value: m.id,
        label: formatDisplayName(m, list),
      })),
    ];
  }, [allMembers, isCellLeader, user?.cellId]);
  const yearOptions = useMemo(() => {
    if (availableYears.length === 0)
      return [
        { value: "", label: "전체 연도" },
        { value: currentYear, label: `${currentYear}년` },
      ];
    return [
      { value: "", label: "전체 연도" },
      ...availableYears.map((y) => ({ value: y, label: `${y}년` })),
    ];
  }, [availableYears, currentYear]);

  // Unit Handler
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const baseYear = typeof prev.year === "number" ? prev.year : currentYear;
      const next: Filters = { ...prev };
      if (type === "year") {
        next.year = baseYear;
        next.month = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = baseYear;
        next.month = (prev.month as number) || currentMonth;
        next.semesterId = "";
      } else if (type === "semester") {
        next.year = "";
        next.month = "";
        if (semesters.length > 0) {
          const today = new Date();
          const currentYM = `${today.getFullYear()}-${String(
            today.getMonth() + 1
          ).padStart(2, "0")}`;
          let target = semesters.find((s) => {
            const start = s.startDate.substring(0, 7);
            const end = s.endDate.substring(0, 7);
            return currentYM >= start && currentYM <= end;
          });
          if (!target) target = [...semesters].sort((a, b) => b.id - a.id)[0];
          if (target) next.semesterId = target.id;
        }
      }
      return next;
    });
    setCurrentPage(0);
  };
  const handleUnitValueClick = (value: number) => {
    setFilters((prev) => {
      const baseYear = prev.year || currentYear;
      return { ...prev, year: baseYear, month: value, semesterId: "" };
    });
    setCurrentPage(0);
  };
  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({ ...prev, semesterId, year: "", month: "" }));
    setCurrentPage(0);
  };

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleUnitValueClick(m)}
                className={`px-2 py-1 border rounded-full text-xs ${
                  filters.month === m ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {m}월
              </button>
            ))}
          </div>
        );
      case "semester":
        if (semesters.length === 0)
          return (
            <div className="mt-4 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
              활성 학기가 없습니다.
            </div>
          );
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {semesters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSemesterClick(s.id)}
                className={`px-2 py-1 border rounded-full text-xs sm:text-sm ${
                  filters.semesterId === s.id
                    ? "bg-blue-500 text-white"
                    : "bg-white"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        );
      case "year":
      default:
        return null;
    }
  };

  // Target Members for Matrix
  const targetMembers = useMemo(() => {
    if (filters.member) {
      return allMembers.filter((m) => m.id === filters.member?.value);
    }
    if (filters.cell) {
      return allMembers.filter((m) => m.cell?.id === filters.cell?.value);
    }
    if (isCellLeader && user?.cellId) {
      return allMembers.filter((m) => m.cell?.id === user.cellId);
    }
    return allMembers;
  }, [allMembers, filters.member, filters.cell, isCellLeader, user]);

  const groupByOptions: { value: AttendanceSummaryGroupBy; label: string }[] = [
    { value: "DAY", label: "일별" },
    { value: "WEEK", label: "주별" },
    { value: "MONTH", label: "월별" },
    { value: "SEMESTER", label: "학기별" },
    { value: "YEAR", label: "연도별" },
  ];
  const groupByLabelMap: Record<AttendanceSummaryGroupBy, string> = {
    DAY: "일자별 출석률 추이",
    WEEK: "주별 출석률 추이",
    MONTH: "월별 출석률 추이",
    QUARTER: "분기별",
    HALF_YEAR: "반기별",
    YEAR: "연도별 출석률 추이",
    SEMESTER: "학기별 출석률 추이",
  };

  const hasEdits = editedAttendances.size > 0;

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  if (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
    return (
      <p className="mt-4 text-center text-sm text-red-600">
        접근 권한이 없습니다.
      </p>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            출석 관리
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            기간·셀·멤버별 출석 기록 조회 및 수정
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-lg self-start md:self-center">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
              viewMode === "list"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <FaList className="mr-2" /> 리스트
          </button>
          <button
            onClick={() => setViewMode("matrix")}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${
              viewMode === "matrix"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <FaTh className="mr-2" /> 매트릭스
          </button>
        </div>

        {/* Save Button (List Mode only) */}
        {viewMode === "list" && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <span className="text-xs text-gray-600">출석 상태 수정</span>
              <button
                type="button"
                onClick={() => setEditMode((p) => !p)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  editMode
                    ? "bg-green-100 text-green-700 border-green-300"
                    : "bg-gray-100 text-gray-600 border-gray-300"
                }`}
              >
                {editMode ? "편집 모드 ON" : "편집 모드 OFF"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving || !hasEdits}
              className="w-full sm:w-auto bg-green-600 text-white px-4 sm:px-6 py-2 rounded-md text-sm font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving
                ? "저장 중..."
                : `출석 변경사항 저장 (${editedAttendances.size}건)`}
            </button>
          </div>
        )}
      </div>

      {/* Overall Stats (Always Visible) */}
      <AttendanceStats stats={overallStats} loading={statsLoading} />

      {/* Trend Chart (Visible only in List Mode) */}
      {viewMode === "list" && isExecutive && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">출석률 추이</h2>
            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
              {groupByOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedGroupBy(option.value)}
                  className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                    selectedGroupBy === option.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {trendLoading && (
            <p className="text-center text-gray-600 text-sm">로딩 중...</p>
          )}
          {!trendLoading && !trendError && trendData.length > 0 && (
            <AttendanceTrend
              data={trendData}
              selectedGroupBy={selectedGroupBy}
              title={groupByLabelMap[selectedGroupBy]}
              dateRange={effectiveDateRange || dateRangeForTrend}
            />
          )}
          {!trendLoading && trendData.length === 0 && (
            <p className="text-center text-gray-500 mb-4 text-sm">
              {effectiveDateRange
                ? "조건에 해당하는 데이터가 없습니다."
                : "기간을 설정해주세요."}
            </p>
          )}
        </div>
      )}

      {/* Filters (Common) */}
      <div className="p-4 bg-gray-50 rounded-lg mb-6 shadow-sm space-y-4">
        {/* Unit/Range Type Toggle */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base sm:text-lg font-semibold">조회 기간 설정</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterType("unit")}
              className={`px-3 py-1 text-xs sm:text-sm rounded-full ${
                filterType === "unit"
                  ? "bg-blue-500 text-white"
                  : "bg-white border"
              }`}
            >
              단위로 조회
            </button>
            <button
              type="button"
              onClick={() => setFilterType("range")}
              className={`px-3 py-1 text-xs sm:text-sm rounded-full ${
                filterType === "range"
                  ? "bg-blue-500 text-white"
                  : "bg-white border"
              }`}
            >
              기간으로 조회
            </button>
          </div>
        </div>

        {/* Date Filters */}
        {filterType === "range" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                기간 시작
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                기간 종료
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  연도
                </label>
                <select
                  value={filters.year}
                  onChange={(e) =>
                    handleFilterChange(
                      "year",
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3 text-sm"
                  disabled={unitType === "semester"}
                >
                  {yearOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {unitType === "semester" && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    학기 단위 조회 시 연도를 선택할 수 없습니다.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  조회 단위
                </label>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("month")}
                    className={`px-3 py-1 text-xs sm:text-sm rounded-full ${
                      unitType === "month"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    월간
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      hasActiveSemesters && handleUnitTypeClick("semester")
                    }
                    disabled={!hasActiveSemesters}
                    className={`px-3 py-1 text-xs sm:text-sm rounded-full border ${
                      hasActiveSemesters
                        ? unitType === "semester"
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white"
                        : "bg-gray-100 text-gray-400 border-dashed cursor-not-allowed"
                    }`}
                  >
                    학기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("year")}
                    className={`px-3 py-1 text-xs sm:text-sm rounded-full ${
                      unitType === "year"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    연간
                  </button>
                </div>
                {!hasActiveSemesters && (
                  <p className="mt-1 text-xs text-red-500">
                    활성화된 학기가 없어 학기 단위 조회를 사용할 수 없습니다.
                  </p>
                )}
              </div>
            </div>
            {renderUnitButtons()}
          </div>
        )}

        <hr />
        {/* Cell / Member / Status Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              셀
            </label>
            {isExecutive ? (
              <SimpleSearchableSelect
                options={cellOptions}
                value={filters.cell?.value ?? null}
                onChange={(value) => {
                  const selectedOption =
                    cellOptions.find((o) => o.value === value) || null;
                  handleFilterChange("cell", selectedOption);
                }}
                placeholder="전체 셀"
                isClearable
              />
            ) : (
              <div className="mt-1 flex items-center h-[42px] px-3 w-full bg-gray-100 border border-gray-300 rounded-md">
                <span className="text-sm font-medium text-gray-700 truncate">
                  {user?.cellName || "내 셀"}
                </span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              멤버
            </label>
            <SimpleSearchableSelect
              options={memberOptions}
              value={filters.member?.value ?? null}
              onChange={(value) => {
                const selectedOption =
                  memberOptions.find((o) => o.value === value) || null;
                handleFilterChange("member", selectedOption);
              }}
              placeholder={isCellLeader ? "내 셀 멤버 검색" : "전체 멤버 검색"}
              isClearable
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              출석 상태
            </label>
            <SimpleSearchableSelect
              options={statusOptions}
              value={filters.status}
              onChange={(value) => {
                const selectedOption =
                  statusOptions.find((o) => o.value === value) || null;
                handleFilterChange(
                  "status",
                  selectedOption ? selectedOption.value : ""
                );
              }}
              placeholder="모든 상태"
              isClearable={false}
            />
          </div>
        </div>
        {/* Search Button Area */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-900 text-left"
            >
              필터 초기화
            </button>
            {/* PageSize only for List view */}
            {viewMode === "list" && (
              <div className="flex items-center">
                <select
                  id="pageSize"
                  name="pageSize"
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-xs py-1.5 pl-2 pr-7"
                >
                  <option value={10}>10개씩</option>
                  <option value={20}>20개씩</option>
                  <option value={50}>50개씩</option>
                  <option value={100}>100개씩</option>
                </select>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-md text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-center text-sm text-red-600">{error}</p>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* Content Rendering: Matrix vs List */}
      {/* ────────────────────────────────────────────── */}

      {/* 1. MATRIX VIEW */}
      {viewMode === "matrix" && (
        <AttendanceMatrixView
          members={targetMembers}
          attendances={matrixAttendances}
          startDate={effectiveDateRange?.startDate || ""}
          endDate={effectiveDateRange?.endDate || ""}
          unitType={unitType}
          isLoading={loading}
        />
      )}

      {/* 2. LIST VIEW */}
      {viewMode === "list" && loading && (
        <div className="flex items-center justify-center min-h-[30vh]">
          <p className="text-sm text-gray-500">
            출석 기록을 불러오는 중입니다...
          </p>
        </div>
      )}

      {viewMode === "list" && !loading && attendancePage && (
        <>
          <div className="space-y-3 md:hidden mb-4">
            {attendancePage.content.map((att) => (
              <div key={att.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold">{att.member.name}</span>
                    <span className="block text-xs text-gray-500">
                      {att.cell?.name || "소속 없음"}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {formatDateKorean(att.date)}
                  </span>
                </div>
                <div className="mt-2">
                  <StatusCell
                    attendance={att}
                    onChange={(s) =>
                      handleAttendanceChange(att.id, "status", s)
                    }
                    disabled={!editMode}
                  />
                </div>
                <div className="mt-2">
                  <EditableMemoCell
                    memo={att.memo || ""}
                    onChange={(m) => handleAttendanceChange(att.id, "memo", m)}
                    disabled={!editMode}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => requestSort("memberName")}
                    className="px-4 py-3 text-left font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    멤버 {getSortIndicator("memberName")}
                  </th>
                  <th
                    onClick={() => requestSort("cellName")}
                    className="px-4 py-3 text-left font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    셀 {getSortIndicator("cellName")}
                  </th>
                  <th
                    onClick={() => requestSort("date")}
                    className="px-4 py-3 text-left font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    날짜 {getSortIndicator("date")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">
                    메모
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendancePage.content.map((att) => (
                  <tr key={att.id}>
                    <td className="px-4 py-2">{att.member.name}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {att.cell?.name || "소속 없음"}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {formatDateKorean(att.date)}
                    </td>
                    <td className="px-4 py-2">
                      <StatusCell
                        attendance={att}
                        onChange={(s) =>
                          handleAttendanceChange(att.id, "status", s)
                        }
                        disabled={!editMode}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <EditableMemoCell
                        memo={att.memo || ""}
                        onChange={(m) =>
                          handleAttendanceChange(att.id, "memo", m)
                        }
                        disabled={!editMode}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attendancePage.totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={attendancePage.number}
                totalPages={attendancePage.totalPages}
                totalElements={attendancePage.totalElements}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* Edit Mode Floating Save Button (List only) */}
      {viewMode === "list" && editMode && hasEdits && (
        <div className="fixed bottom-4 inset-x-0 mx-auto max-w-xl bg-white shadow-lg rounded-full px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border z-50">
          <span className="text-xs sm:text-sm text-gray-700">
            저장되지 않은 출석 변경 {editedAttendances.size}건이 있습니다.
          </span>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs sm:text-sm hover:bg-green-700 disabled:bg-gray-400"
          >
            {isSaving ? "저장 중..." : "변경사항 저장"}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminAttendancesPage;
