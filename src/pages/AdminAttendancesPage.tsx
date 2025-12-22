// src/pages/AdminAttendancesPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { attendanceService } from "../services/attendanceService";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import { statisticsService } from "../services/statisticsService";
import { semesterService } from "../services/semesterService";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import { formatDisplayName } from "../utils/memberUtils";

// Components
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import AttendanceMatrix from "../components/AttendanceMatrix";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";

// Types
import type {
  GetAttendancesParams,
  AttendanceDto,
  AttendanceStatus,
  MemberDto,
  OverallAttendanceStatDto,
  SemesterDto,
} from "../types";
import type { SelectOption } from "../components/AsyncSearchableSelect";

// Icons
import {
  ChartBarIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from "@heroicons/react/24/outline";
import { FaTh } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────
// Types & Helpers
// ─────────────────────────────────────────────────────────────

type UnitType = "year" | "month" | "semester";

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

const pad = (n: number) => n.toString().padStart(2, "0");

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT"];

const translateAttendanceStatus = (status: string) => {
  switch (status) {
    case "PRESENT":
      return "출석";
    case "ABSENT":
      return "결석";
    default:
      return status;
  }
};

// ─────────────────────────────────────────────────────────────
// Sub Components
// ─────────────────────────────────────────────────────────────

/**
 * ✅ [수정] 백엔드 API(OverallAttendanceStatDto) 데이터를 직접 바인딩하여 보여주는 컴포넌트
 * - 주간 평균, 출석률, 장기 결석자 수, 증감률(Trend) 표시
 */
const AttendanceStats: React.FC<{
  stats: OverallAttendanceStatDto | null;
  loading: boolean;
}> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-pulse">
        <div className="bg-white p-4 h-32 rounded-lg shadow-sm border border-gray-100" />
        <div className="bg-white p-4 h-32 rounded-lg shadow-sm border border-gray-100" />
        <div className="bg-white p-4 h-32 rounded-lg shadow-sm border border-gray-100" />
      </div>
    );
  }

  if (!stats) return null;

  // 증감률 UI 결정 로직
  const { attendanceTrend = 0 } = stats;
  let trendColor = "text-gray-500";
  let TrendIcon = MinusIcon;
  let trendText = "변동 없음";

  if (attendanceTrend > 0) {
    trendColor = "text-red-500";
    TrendIcon = ArrowTrendingUpIcon;
    trendText = "증가";
  } else if (attendanceTrend < 0) {
    trendColor = "text-blue-500";
    TrendIcon = ArrowTrendingDownIcon;
    trendText = "감소";
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* 1. 주간 평균 출석 */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              주간 평균 출석
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <p className="text-3xl font-bold text-gray-900">
                {stats.weeklyAverage}
              </p>
              <span className="text-sm font-medium text-gray-500">명/주</span>
            </div>
          </div>
          <div className="bg-indigo-50 p-2 rounded-lg">
            <UsersIcon className="h-6 w-6 text-indigo-600" />
          </div>
        </div>

        {/* 증감률 및 설명 */}
        <div className="mt-4">
          <div className="flex items-center text-sm mb-1">
            <TrendIcon className={`h-4 w-4 mr-1 ${trendColor}`} />
            <span className={`font-medium ${trendColor}`}>
              {Math.abs(attendanceTrend)}%
            </span>
            <span className="text-gray-400 ml-1.5 text-xs">
              지난 기간 대비 {trendText}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            실제 예배가 진행된 주차의 평균 인원
          </p>
        </div>
      </div>

      {/* 2. 평균 출석률 */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              평균 출석률
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <p className="text-3xl font-bold text-gray-900">
                {stats.attendanceRate.toFixed(1)}
              </p>
              <span className="text-sm font-medium text-gray-500">%</span>
            </div>
          </div>
          <div className="bg-blue-50 p-2 rounded-lg">
            <ChartBarIcon className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-400 leading-relaxed">
          전체 재적 인원 대비 실제 출석한 비율의 평균입니다.
        </div>
      </div>

      {/* 3. 장기 결석자 (0회) */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-red-600">
              장기 결석 (0회)
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <p className="text-3xl font-bold text-gray-900">
                {stats.zeroAttendanceCount}
              </p>
              <span className="text-sm font-medium text-gray-500">명</span>
            </div>
          </div>
          <div className="bg-red-50 p-2 rounded-lg">
            <UsersIcon className="h-6 w-6 text-red-500" />
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-400 leading-relaxed">
          조회 기간 동안 출석 기록이 한 번도 없는 멤버 수입니다.
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// AttendanceMatrixView Component (유지)
// ─────────────────────────────────────────────────────────────

const AttendanceMatrixView: React.FC<{
  members: MemberDto[];
  attendances: AttendanceDto[];
  startDate: string;
  endDate: string;
  unitType: UnitType;
  isLoading: boolean;
}> = ({ members, attendances, startDate, endDate, unitType, isLoading }) => {
  // 가입일(createdAt)을 반영한 미체크 계산 (매트릭스 뷰 전용 로직)
  const uncheckedCount = useMemo(() => {
    if (!startDate || !endDate || members.length === 0) return 0;

    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    let totalPossibleChecks = 0;

    members.forEach((member) => {
      let joinDate: Date;
      if (member.createdAt) {
        joinDate = new Date(member.createdAt);
      } else if (member.joinYear) {
        joinDate = new Date(member.joinYear, 0, 1);
      } else {
        joinDate = new Date("2000-01-01");
      }
      joinDate.setHours(0, 0, 0, 0);

      const effectiveStart = filterStart < joinDate ? joinDate : filterStart;
      if (effectiveStart > filterEnd) return;

      const current = new Date(effectiveStart);
      current.setHours(0, 0, 0, 0);

      while (current <= filterEnd) {
        if (current.getDay() === 0) {
          totalPossibleChecks++;
        }
        current.setDate(current.getDate() + 1);
      }
    });

    const recordedCount = attendances.filter((a) =>
      ["PRESENT", "ABSENT"].includes(a.status)
    ).length;

    return Math.max(0, totalPossibleChecks - recordedCount);
  }, [startDate, endDate, members, attendances]);

  // 매트릭스 뷰용 통계 계산
  const summary = useMemo(() => {
    const present = attendances.filter((a) => a.status === "PRESENT").length;
    const absent = attendances.filter((a) => a.status === "ABSENT").length;
    const total = present + absent;
    const rate = total > 0 ? (present / total) * 100 : 0;

    return { present, absent, rate, unchecked: uncheckedCount };
  }, [attendances, uncheckedCount]);

  const matrixMembers = useMemo(
    () =>
      members
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({
          memberId: m.id,
          memberName: formatDisplayName(m, members),
        })),
    [members]
  );

  const matrixMode = unitType === "month" ? "month" : "semester";
  const [targetYear, targetMonth] = startDate.split("-").map(Number);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 4분할 통계 카드 (매트릭스 요약용) */}
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

  // Data States
  const [matrixAttendances, setMatrixAttendances] = useState<AttendanceDto[]>(
    []
  );

  const [allMembers, setAllMembers] = useState<MemberDto[]>([]);
  const [overallStats, setOverallStats] =
    useState<OverallAttendanceStatDto | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
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

  const isExecutive = useMemo(() => user?.role === "EXECUTIVE", [user]);
  const isCellLeader = useMemo(() => user?.role === "CELL_LEADER", [user]);

  // ─────────────────────────────────────────────────────────────
  // Effects & Logic
  // ─────────────────────────────────────────────────────────────

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

  const effectiveDateRange = useMemo(() => {
    if (filterType === "range") {
      if (filters.startDate && filters.endDate) {
        return { startDate: filters.startDate, endDate: filters.endDate };
      }
      return null;
    }

    if (unitType === "semester" && filters.semesterId && semesters.length > 0) {
      const semester = semesters.find((s) => s.id === filters.semesterId);
      if (semester) {
        return { startDate: semester.startDate, endDate: semester.endDate };
      }
    }

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
      return null;
    }

    if (semesters.length > 0) {
      const overlappingSemesters = semesters.filter(
        (s) => s.startDate <= rawEnd && s.endDate >= rawStart
      );

      if (overlappingSemesters.length > 0) {
        const sorted = [...overlappingSemesters].sort((a, b) =>
          a.startDate.localeCompare(b.startDate)
        );
        const firstSem = sorted[0];
        const lastSem = sorted[sorted.length - 1];

        if (rawStart < firstSem.startDate) rawStart = firstSem.startDate;
        if (rawEnd > lastSem.endDate) rawEnd = lastSem.endDate;
      }
    }

    return { startDate: rawStart, endDate: rawEnd };
  }, [filterType, filters, semesters, unitType]);

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

  const fetchAttendances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = getCleanedParams();
      const matrixParams = {
        ...params,
        page: 0,
        size: 2000,
        sort: "date,asc",
      };
      const data = await attendanceService.getAttendances(
        matrixParams as GetAttendancesParams
      );
      setMatrixAttendances(data.content);
    } catch (err) {
      setError("출석 기록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [getCleanedParams]);

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
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      fetchAvailableYears();
      fetchSemesters();
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  const handleSearch = () => {
    fetchAttendances();
    fetchOverallStats();
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
  };

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
  };
  const handleUnitValueClick = (value: number) => {
    setFilters((prev) => {
      const baseYear = prev.year || currentYear;
      return { ...prev, year: baseYear, month: value, semesterId: "" };
    });
  };
  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({ ...prev, semesterId, year: "", month: "" }));
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

  if (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
    return (
      <p className="mt-4 text-center text-sm text-red-600">
        접근 권한이 없습니다.
      </p>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            출석 관리
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            기간·셀·멤버별 출석 기록을 매트릭스 형태로 확인합니다.
          </p>
        </div>
      </div>

      {/* ✅ [수정] 프론트엔드 계산 없이 API 통계를 그대로 전달 */}
      <AttendanceStats stats={overallStats} loading={statsLoading} />

      {/* Filters */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기간 시작
              </label>
              <KoreanCalendarPicker
                value={filters.startDate}
                onChange={(date) => handleFilterChange("startDate", date)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                기간 종료
              </label>
              <KoreanCalendarPicker
                value={filters.endDate}
                onChange={(date) => handleFilterChange("endDate", date)}
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

      {/* Content Rendering: Matrix Only */}
      <AttendanceMatrixView
        members={targetMembers}
        attendances={matrixAttendances}
        startDate={effectiveDateRange?.startDate || ""}
        endDate={effectiveDateRange?.endDate || ""}
        unitType={unitType}
        isLoading={loading}
      />
    </div>
  );
};

export default AdminAttendancesPage;
