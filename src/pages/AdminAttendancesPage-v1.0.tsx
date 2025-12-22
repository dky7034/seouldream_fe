// src/pages/AdminAttendancesPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { attendanceService } from "../services/attendanceService";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import { statisticsService } from "../services/statisticsService";
import { normalizeNumberInput } from "../utils/numberUtils";
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
import { semesterService } from "../services/semesterService";
import { useAuth } from "../hooks/useAuth";
import {
  translateAttendanceStatus,
  ATTENDANCE_STATUSES,
} from "../utils/attendanceUtils";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import type { SelectOption } from "../components/AsyncSearchableSelect";
import Pagination from "../components/Pagination";
import { ChartBarIcon, UsersIcon } from "@heroicons/react/24/outline";
import { formatDisplayName } from "../utils/memberUtils";

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
  quarter: number | "";
  half: number | "";
  semesterId: number | "";
};

const formatDateKorean = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${m}월 ${d}일`;
};

const pad = (n: number) => n.toString().padStart(2, "0");

// month: 1~12, 결과는 해당 달의 마지막 날(28/29/30/31)
const lastDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};

const formatDateGroupLabel = (
  groupBy: AttendanceSummaryGroupBy,
  raw: string
): string => {
  if (!raw) return raw;

  if (groupBy === "SEMESTER") {
    return raw;
  }

  if (groupBy === "QUARTER") {
    const match = raw.match(/^(\d{4})-Q([1-4])$/);
    if (match) {
      const year = match[1];
      const quarter = match[2];
      return `${year}년 ${quarter}분기`;
    }
    return raw;
  }

  if (groupBy === "HALF_YEAR") {
    const match = raw.match(/^(\d{4})-H([12])$/);
    if (match) {
      const year = match[1];
      const half = match[2] === "1" ? "상반기" : "하반기";
      return `${year}년 ${half}`;
    }
    return raw;
  }

  if (groupBy === "YEAR") {
    const match = raw.match(/^(\d{4})$/);
    if (match) {
      return `${match[1]}년`;
    }
    return raw;
  }

  if (groupBy === "MONTH") {
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = match[1];
      const month = parseInt(match[2], 10);
      return `${year}년 ${month}월`;
    }
    return raw;
  }

  if (groupBy === "WEEK") {
    const match = raw.match(/^(\d{4})-W(\d{1,2})$/);
    if (match) {
      const year = match[1];
      const week = parseInt(match[2], 10);
      return `${year}년 ${week}주차`;
    }
    return raw;
  }

  if (groupBy === "DAY") {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = match[1];
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      return `${year}년 ${month}월 ${day}일`;
    }
    return raw;
  }

  return raw;
};

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

  if (!stats) {
    return null;
  }
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

type TrendItem = AggregatedTrendDto;

type AttendanceTrendProps = {
  data: TrendItem[];
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
  if (data.length === 0) return null;

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

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-xs">조회 기간 (필터 기준)</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {dateRange
                ? `${formatDateKorean(
                    dateRange.startDate
                  )} ~ ${formatDateKorean(dateRange.endDate)}`
                : "기간이 설정되지 않았습니다."}
            </p>
            <p className="mt-1.5 font-medium text-gray-800 text-sm">
              {summary.startRate.toFixed(1)}% → {summary.endRate.toFixed(1)}%{" "}
              <span className="ml-2 text-xs text-blue-600">
                ({formatDiff(summary.diff)})
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              ({formatDateGroupLabel(selectedGroupBy, summary.start.dateGroup)}{" "}
              → {formatDateGroupLabel(selectedGroupBy, summary.end.dateGroup)}
              기준 )
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
  const handleChange = (value: string) => {
    if (disabled) return;
    onChange(value);
  };

  return (
    <input
      type="text"
      value={memo}
      onChange={(e) => handleChange(e.target.value)}
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

const AdminAttendancesPage: React.FC = () => {
  const { user } = useAuth();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [attendancePage, setAttendancePage] =
    useState<Page<AttendanceDto> | null>(null);
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

  const [filters, setFilters] = useState<Filters>(() => ({
    startDate: "",
    endDate: "",
    member: null,
    cell:
      user?.role === "CELL_LEADER" && user.cellId && user.cellName
        ? { value: user.cellId, label: user.cellName }
        : null,
    status: "",
    year: currentYear as number | "",
    month: "" as number | "",
    quarter: "" as number | "",
    half: "" as number | "",
    semesterId: "" as number | "",
  }));

  const [filterType, setFilterType] = useState<"unit" | "range">("unit");
  const [unitType, setUnitType] = useState<
    "year" | "half" | "quarter" | "month" | "semester"
  >("year");

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

  // ---- 유효 조회 기간 계산 ----
  const effectiveDateRange = useMemo(() => {
    // 1) 기간 직접 입력 모드
    if (filterType === "range") {
      if (filters.startDate && filters.endDate) {
        return {
          startDate: filters.startDate,
          endDate: filters.endDate,
        };
      }
      return null;
    }

    // 2) 학기 선택 모드 (semesterId 우선)
    if (filters.semesterId && semesters.length > 0) {
      const semester = semesters.find((s) => s.id === filters.semesterId);
      if (semester) {
        return {
          startDate: semester.startDate,
          endDate: semester.endDate,
        };
      }
    }

    // 3) 연/반기/분기/월 단위
    const year = typeof filters.year === "number" ? filters.year : undefined;
    if (!year) return null;

    if (filters.month) {
      const m = filters.month as number;
      const last = lastDayOfMonth(year, m);
      return {
        startDate: `${year}-${pad(m)}-01`,
        endDate: `${year}-${pad(m)}-${pad(last)}`,
      };
    }

    if (filters.quarter) {
      const q = filters.quarter as number;
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const last = lastDayOfMonth(year, endMonth);
      return {
        startDate: `${year}-${pad(startMonth)}-01`,
        endDate: `${year}-${pad(endMonth)}-${pad(last)}`,
      };
    }

    if (filters.half) {
      const h = filters.half as number;
      if (h === 1) {
        const last = lastDayOfMonth(year, 6);
        return {
          startDate: `${year}-01-01`,
          endDate: `${year}-06-${pad(last)}`,
        };
      } else {
        const last = lastDayOfMonth(year, 12);
        return {
          startDate: `${year}-07-01`,
          endDate: `${year}-12-${pad(last)}`,
        };
      }
    }

    // 연간
    const last = lastDayOfMonth(year, 12);
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-${pad(last)}`,
    };
  }, [filterType, filters, semesters]);

  const dateRangeForTrend = useMemo(() => {
    if (effectiveDateRange) return effectiveDateRange;
    return {
      startDate: "1970-01-01",
      endDate: "2999-12-31",
    };
  }, [effectiveDateRange]);

  const getCleanedParams = useCallback(() => {
    let params: GetAttendancesParams = {
      status: filters.status as AttendanceStatus | undefined,
      memberId: normalizeNumberInput(filters.member?.value),
      cellId: normalizeNumberInput(filters.cell?.value),
    };

    if (effectiveDateRange) {
      params.startDate = effectiveDateRange.startDate;
      params.endDate = effectiveDateRange.endDate;
    }

    return Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    );
  }, [filters, effectiveDateRange]);

  const fetchAttendances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sortKeyMap = {
        memberName: "member.name",
        cellName: "member.cell.name",
      } as Record<string, string>;

      const backendSortKey =
        sortKeyMap[sortConfig.key as string] || (sortConfig.key as string);

      const params = {
        ...getCleanedParams(),
        page: currentPage,
        size: pageSize,
        sort: `${backendSortKey},${
          sortConfig.direction === "ascending" ? "asc" : "desc"
        }`,
      };

      const data = await attendanceService.getAttendances(
        params as GetAttendancesParams
      );
      setAttendancePage(data);
      setEditedAttendances(new Map());
    } catch (err) {
      setError("출석 기록을 불러오는 데 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, sortConfig, getCleanedParams]);

  useEffect(() => {
    if (
      !dateRangeForTrend ||
      !dateRangeForTrend.startDate ||
      !dateRangeForTrend.endDate
    )
      return;

    const start = new Date(dateRangeForTrend.startDate);
    const end = new Date(dateRangeForTrend.endDate);

    const diffDays = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    let nextGroupBy: AttendanceSummaryGroupBy;

    if (diffDays <= 45) nextGroupBy = "DAY";
    else if (diffDays <= 180) nextGroupBy = "WEEK";
    else if (diffDays <= 730) nextGroupBy = "MONTH";
    else nextGroupBy = "QUARTER";

    setSelectedGroupBy(nextGroupBy);
  }, [dateRangeForTrend]);

  const fetchTrendData = useCallback(async () => {
    if (!isExecutive || !dateRangeForTrend) return;

    setTrendLoading(true);
    setErrorTrend(null);

    try {
      const params = {
        ...dateRangeForTrend,
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
      console.error(err);
    } finally {
      setTrendLoading(false);
    }
  }, [isExecutive, dateRangeForTrend, filters, selectedGroupBy]);

  const fetchOverallStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = getCleanedParams();
      const data = await statisticsService.getOverallAttendance(params);
      setOverallStats(data);
    } catch (err) {
      console.error("Failed to load overall stats", err);
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
      console.error("Failed to fetch available years for attendances:", err);
      setAvailableYears([]);
    }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("Failed to fetch semesters:", err);
      setSemesters([]);
    }
  }, []);

  // 초기 로딩: 권한 확인 + 출석/통계/멤버
  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      fetchAttendances();
      fetchOverallStats();

      (async () => {
        try {
          const res = await memberService.getAllMembers({ size: 1000 });
          setAllMembers(res.content);
        } catch (err) {
          console.error(err);
        }
      })();
    } else if (user) {
      setError("접근 권한이 없습니다.");
    }
  }, [user, fetchAttendances, fetchOverallStats]);

  // 학기/연도 목록
  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      fetchAvailableYears();
      fetchSemesters();
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

  // 출석률 추이
  useEffect(() => {
    if (!isExecutive) {
      setTrendData([]);
      return;
    }

    if (!dateRangeForTrend) return;

    fetchTrendData();
  }, [isExecutive, dateRangeForTrend, fetchTrendData]);

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
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      fetchAttendances();
      fetchOverallStats();
      if (isExecutive) {
        fetchTrendData();
      }
    }
  };

  const handleAttendanceChange = (
    id: number,
    field: keyof AttendanceDto,
    value: any
  ) => {
    setEditedAttendances((prev) => {
      const newMap = new Map(prev);
      const currentEdit = newMap.get(id) || {};
      newMap.set(id, { ...currentEdit, [field]: value });
      return newMap;
    });
  };

  const handleSaveChanges = async () => {
    if (!user || editedAttendances.size === 0) return;
    setIsSaving(true);
    setError(null);

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
      await fetchAttendances();
      await fetchOverallStats();
      if (isExecutive) {
        await fetchTrendData();
      }
      setEditMode(false);
    } catch (err) {
      setError("변경사항 저장에 실패했습니다.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const requestSort = (key: SortConfig["key"]) => {
    let direction: SortConfig["direction"] = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
    setCurrentPage(0);
  };

  const getSortIndicator = (key: SortConfig["key"]) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "ascending" ? "▲" : "▼";
  };

  const resetFilters = () => {
    if (!user) return;
    const now = new Date();
    const cy = now.getFullYear();
    setFilters({
      startDate: "",
      endDate: "",
      member: null,
      cell:
        user.role === "CELL_LEADER" && user.cellId && user.cellName
          ? { value: user.cellId, label: user.cellName }
          : null,
      status: "",
      year: cy,
      month: "" as number | "",
      quarter: "" as number | "",
      half: "" as number | "",
      semesterId: "" as number | "",
    });
    setFilterType("unit");
    setUnitType("year");
    setCurrentPage(0);
    setPageSize(10);
  };

  const statusOptions = useMemo(() => {
    return [
      { value: "", label: "모든 상태" },
      ...ATTENDANCE_STATUSES.map((s) => ({
        value: s,
        label: translateAttendanceStatus(s),
      })),
    ];
  }, []);

  const [allCells, setAllCells] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (isExecutive) {
      cellService
        .getAllCells({ size: 1000 })
        .then((data) => setAllCells(data.content))
        .catch((err) =>
          console.error("Failed to fetch cells for filter:", err)
        );
    }
  }, [isExecutive]);

  const cellOptions = useMemo(() => {
    if (!isExecutive) return [];

    const options = allCells.map((c) => ({
      value: c.id,
      label: c.name,
    }));
    return [{ value: null, label: "전체 셀" }, ...options];
  }, [allCells, isExecutive]);

  const memberOptions = useMemo(() => {
    if (isCellLeader && user?.cellId) {
      const cellMembers = allMembers.filter(
        (member) => member.cell?.id === user.cellId
      );
      const options = cellMembers.map((m) => ({
        value: m.id,
        label: formatDisplayName(m, cellMembers),
      }));
      return [{ value: null, label: "내 셀 전체" }, ...options];
    }

    const options = allMembers.map((m) => ({
      value: m.id,
      label: formatDisplayName(m, allMembers),
    }));
    return [{ value: null, label: "전체 멤버" }, ...options];
  }, [allMembers, isCellLeader, user?.cellId]);

  const yearOptions = useMemo(() => {
    if (availableYears.length === 0) {
      const cy = new Date().getFullYear();
      return [
        { value: "", label: "전체 연도" },
        { value: cy, label: `${cy}년` },
      ];
    }
    const options = availableYears.map((year) => ({
      value: year,
      label: `${year}년`,
    }));
    return [{ value: "", label: "전체 연도" }, ...options];
  }, [availableYears]);

  const handleUnitTypeClick = (
    type: "year" | "half" | "quarter" | "month" | "semester"
  ) => {
    setUnitType(type);

    setFilters((prev) => {
      const cy = new Date().getFullYear();
      const baseYear = prev.year || cy;

      if (type === "year") {
        return {
          ...prev,
          year: baseYear,
          month: "",
          quarter: "",
          half: "",
          semesterId: "",
        };
      }

      if (type === "half") {
        return {
          ...prev,
          year: baseYear,
          half: (prev.half as number) || 1,
          month: "",
          quarter: "",
          semesterId: "",
        };
      }

      if (type === "quarter") {
        return {
          ...prev,
          year: baseYear,
          quarter: (prev.quarter as number) || 1,
          month: "",
          half: "",
          semesterId: "",
        };
      }

      if (type === "month") {
        return {
          ...prev,
          year: baseYear,
          month: (prev.month as number) || currentMonth,
          quarter: "",
          half: "",
          semesterId: "",
        };
      }

      // semester
      return {
        ...prev,
        year: "",
        month: "",
        quarter: "",
        half: "",
        semesterId: prev.semesterId || ("" as number | ""),
      };
    });

    setCurrentPage(0);
  };

  const handleUnitValueClick = (
    unit: "month" | "quarter" | "half",
    value: number
  ) => {
    setFilters((prev) => {
      const cy = new Date().getFullYear();
      const baseYear = prev.year || cy;

      return {
        ...prev,
        year: baseYear,
        month: unit === "month" ? value : "",
        quarter: unit === "quarter" ? value : "",
        half: unit === "half" ? value : "",
        semesterId: "",
      };
    });

    setCurrentPage(0);
  };

  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({
      ...prev,
      semesterId:
        prev.semesterId === semesterId ? ("" as number | "") : semesterId,
      year: "",
      month: "",
      quarter: "",
      half: "",
    }));
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
                onClick={() => handleUnitValueClick("month", m)}
                className={`px-2 py-1 border rounded-full text-xs ${
                  filters.month === m ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {m}월
              </button>
            ))}
          </div>
        );
      case "quarter":
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => i + 1).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleUnitValueClick("quarter", q)}
                className={`px-2 py-1 border rounded-full text-xs sm:text-sm ${
                  filters.quarter === q ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {q}분기
              </button>
            ))}
          </div>
        );
      case "half":
        return (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleUnitValueClick("half", h)}
                className={`px-2 py-1 border rounded-full text-xs sm:text-sm ${
                  filters.half === h ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {h === 1 ? "상반기" : "하반기"}
              </button>
            ))}
          </div>
        );
      case "semester":
        if (semesters.length === 0) {
          return (
            <div className="mt-4 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
              현재 활성 상태인 학기가 없습니다. 출석 화면에서 학기 선택을
              사용하려면 최소 1개 이상의 학기를 활성화해 주세요.
            </div>
          );
        }

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

  if (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
    return (
      <p className="mt-4 text-center text-sm text-red-600">
        접근 권한이 없습니다.
      </p>
    );
  }

  const hasEdits = editedAttendances.size > 0;

  const groupByOptions: {
    value: AttendanceSummaryGroupBy;
    label: string;
  }[] = [
    { value: "DAY", label: "일별" },
    { value: "WEEK", label: "주별" },
    { value: "MONTH", label: "월별" },
    { value: "QUARTER", label: "분기별" },
    { value: "HALF_YEAR", label: "반기별" },
    { value: "YEAR", label: "연도별" },
    { value: "SEMESTER", label: "학기별" },
  ];

  const groupByLabelMap: Record<AttendanceSummaryGroupBy, string> = {
    DAY: "일자별 출석률 추이",
    WEEK: "주별 출석률 추이",
    MONTH: "월별 출석률 추이",
    QUARTER: "분기별 출석률 추이",
    HALF_YEAR: "반기별 출석률 추이",
    YEAR: "연도별 출석률 추이",
    SEMESTER: "학기별 출석률 추이",
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            출석 관리
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            기간·셀·멤버별 출석 기록을 조회하고, 출석/결석 상태와 메모를 한 번에
            수정할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-xs text-gray-600">출석 상태 수정</span>
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
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
      </div>

      {/* 상단 요약 카드 */}
      <AttendanceStats stats={overallStats} loading={statsLoading} />

      {/* 출석률 추이 영역 (임원만) */}
      {isExecutive && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">출석률 추이</h2>
            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
              {groupByOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedGroupBy(option.value);
                  }}
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
            <p className="text-center text-gray-600 mb-4 text-sm">
              출석률 추이 로딩 중...
            </p>
          )}
          {trendError && (
            <p className="text-center text-red-600 mb-4 text-sm">
              {trendError}
            </p>
          )}
          {!trendLoading && !trendError && trendData.length > 0 && (
            <AttendanceTrend
              data={trendData}
              selectedGroupBy={selectedGroupBy}
              title={groupByLabelMap[selectedGroupBy]}
              dateRange={effectiveDateRange || dateRangeForTrend}
            />
          )}
          {!trendLoading &&
            !trendError &&
            trendData.length === 0 &&
            (effectiveDateRange ? (
              <p className="text-center text-gray-500 mb-4 text-sm">
                선택된 필터 조건에 해당하는 출석률 추이 데이터가 없습니다.
              </p>
            ) : (
              <p className="text-center text-gray-500 mb-4 text-sm">
                출석률 추이를 보려면 기간을 설정하거나 전체 기간을 사용할 수
                있습니다.
              </p>
            ))}
        </div>
      )}

      {/* 필터 영역 */}
      <div className="p-4 bg-gray-50 rounded-lg mb-6 shadow-sm space-y-4">
        {/* 기간 필터 상단 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base sm:text-lg font-semibold">
            조회 기간 설정 (출석일 기준)
          </h3>
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

        {filterType === "range" ? (
          // 기간 직접 설정
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
          // 단위 기반 설정
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
                    onClick={() => handleUnitTypeClick("year")}
                    className={`px-3 py-1 text-xs sm:text-sm rounded-full ${
                      unitType === "year"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    연간
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("half")}
                    className={`px-3 py-1 text-xs sm:text-sm rounded-full ${
                      unitType === "half"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    반기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("quarter")}
                    className={`px-3 py-1 text-xs sm:text-sm rounded-full ${
                      unitType === "quarter"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    분기
                  </button>
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

        {/* 셀 / 멤버 / 상태 필터 */}
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

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-900 text-left"
            >
              필터 초기화
            </button>
            <div className="flex items-center">
              <label htmlFor="pageSize" className="sr-only">
                페이지당 항목 수
              </label>
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

      {/* 출석 목록 - 모바일 카드 + 데스크탑 테이블 */}
      {loading && (
        <div className="flex items-center justify-center min-h-[30vh]">
          <p className="text-sm text-gray-500">
            출석 기록을 불러오는 중입니다...
          </p>
        </div>
      )}

      {!loading && attendancePage && (
        <>
          {/* 📱 모바일: 카드 리스트 (md 미만) */}
          <div className="space-y-3 md:hidden mb-4">
            {attendancePage.content.length === 0 ? (
              <div className="bg-white rounded-lg shadow border border-gray-100 p-4 text-center text-xs sm:text-sm text-gray-500">
                해당 조건에 맞는 출석 기록이 없습니다.
              </div>
            ) : (
              attendancePage.content.map((attendance) => {
                const edited = editedAttendances.get(attendance.id);

                const displayMemo =
                  edited?.memo !== undefined
                    ? edited.memo
                    : attendance.memo || "";

                const rowEdited = Boolean(edited);

                const memberFullInfo = allMembers.find(
                  (m) => m.id === attendance.member.id
                );

                const displayName = memberFullInfo
                  ? formatDisplayName(memberFullInfo, allMembers)
                  : attendance.member.name;

                return (
                  <div
                    key={attendance.id}
                    className={`bg-white rounded-lg shadow border border-gray-100 p-4 text-xs space-y-2 ${
                      rowEdited ? "ring-2 ring-yellow-300" : ""
                    }`}
                  >
                    {/* 상단: 이름 / 셀 / 날짜 */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {displayName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          셀:{" "}
                          <span className="font-medium">
                            {attendance.cell?.name || "*소속 셀 없음"}
                          </span>
                        </p>
                      </div>
                      <span className="px-2 py-1 inline-flex text-[11px] leading-5 font-semibold rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
                        {attendance.date}
                      </span>
                    </div>

                    {/* 출석 상태 버튼 */}
                    <div className="mt-2">
                      <p className="text-[11px] text-gray-500 mb-1">
                        출석 상태
                      </p>
                      <StatusCell
                        attendance={attendance}
                        editedStatus={edited?.status as AttendanceStatus}
                        onChange={(status) =>
                          handleAttendanceChange(
                            attendance.id,
                            "status",
                            status
                          )
                        }
                        disabled={!editMode}
                      />
                    </div>

                    {/* 메모 입력 */}
                    <div className="mt-2">
                      <p className="text-[11px] text-gray-500 mb-1">메모</p>
                      <EditableMemoCell
                        memo={displayMemo}
                        onChange={(memo) =>
                          handleAttendanceChange(attendance.id, "memo", memo)
                        }
                        disabled={!editMode}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 🖥 데스크탑: 테이블 (md 이상) */}
          <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => requestSort("memberName")}
                    className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  >
                    멤버 {getSortIndicator("memberName")}
                  </th>
                  <th
                    onClick={() => requestSort("cellName")}
                    className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  >
                    셀 {getSortIndicator("cellName")}
                  </th>
                  <th
                    onClick={() => requestSort("date")}
                    className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                  >
                    날짜 {getSortIndicator("date")}
                  </th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    출석 상태
                  </th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3 sm:w-1/4">
                    메모
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {attendancePage.content.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 sm:px-4 py-4 text-center text-gray-500 text-sm"
                    >
                      해당 조건에 맞는 출석 기록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  attendancePage.content.map((attendance) => {
                    const edited = editedAttendances.get(attendance.id);

                    const displayMemo =
                      edited?.memo !== undefined
                        ? edited.memo
                        : attendance.memo || "";

                    const rowEdited = Boolean(edited);

                    const memberFullInfo = allMembers.find(
                      (m) => m.id === attendance.member.id
                    );

                    const displayName = memberFullInfo
                      ? formatDisplayName(memberFullInfo, allMembers)
                      : attendance.member.name;

                    return (
                      <tr
                        key={attendance.id}
                        className={rowEdited ? "bg-yellow-50" : "bg-white"}
                      >
                        <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {displayName}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {attendance.cell?.name || "*소속 셀 없음"}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {attendance.date}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm">
                          <StatusCell
                            attendance={attendance}
                            editedStatus={edited?.status as AttendanceStatus}
                            onChange={(status) =>
                              handleAttendanceChange(
                                attendance.id,
                                "status",
                                status
                              )
                            }
                            disabled={!editMode}
                          />
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 whitespace-normal">
                          <EditableMemoCell
                            memo={displayMemo}
                            onChange={(memo) =>
                              handleAttendanceChange(
                                attendance.id,
                                "memo",
                                memo
                              )
                            }
                            disabled={!editMode}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
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

      {/* 하단 저장 배너는 그대로 유지 */}
      {editMode && hasEdits && (
        <div className="fixed bottom-4 inset-x-0 mx-auto max-w-xl bg-white shadow-lg rounded-full px-4 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border z-50">
          <span className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
            저장되지 않은 출석 변경 {editedAttendances.size}건이 있습니다.
          </span>
          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs sm:text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? "저장 중..." : "변경사항 저장"}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminAttendancesPage;
