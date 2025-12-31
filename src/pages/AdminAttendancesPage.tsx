// src/pages/AdminAttendancesPage.tsx
import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
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
  CalendarDaysIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid"; // Solid icons for UI
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
// Sub Component 1: AttendanceStats (상단 종합 통계 카드)
// ─────────────────────────────────────────────────────────────

const AttendanceStats = memo(
  ({
    stats,
    loading,
  }: {
    stats: OverallAttendanceStatDto | null;
    loading: boolean;
  }) => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-pulse">
          <div className="bg-white p-4 h-32 rounded-2xl shadow-sm border border-gray-100" />
          <div className="bg-white p-4 h-32 rounded-2xl shadow-sm border border-gray-100" />
          <div className="bg-white p-4 h-32 rounded-2xl shadow-sm border border-gray-100" />
        </div>
      );
    }

    if (!stats) return null;

    const { attendanceTrend = 0 } = stats;

    let trendColor = "text-gray-500";
    let bgTrendColor = "bg-gray-100";
    let TrendIcon = MinusIcon;
    let trendText = "변동 없음";

    if (attendanceTrend > 0) {
      trendColor = "text-green-600";
      bgTrendColor = "bg-green-50";
      TrendIcon = ArrowTrendingUpIcon;
      trendText = "증가";
    } else if (attendanceTrend < 0) {
      trendColor = "text-red-500";
      bgTrendColor = "bg-red-50";
      TrendIcon = ArrowTrendingDownIcon;
      trendText = "감소";
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 1. 주간 평균 출석 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                주간 평균 출석
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <p className="text-3xl font-bold text-gray-900">
                  {stats.weeklyAverage}
                </p>
                <span className="text-sm font-medium text-gray-500">명/주</span>
              </div>
            </div>
            <div className="bg-indigo-50 p-2 rounded-xl">
              <UsersIcon className="h-6 w-6 text-indigo-600" />
            </div>
          </div>

          <div className="mt-4 flex items-center">
            <div
              className={`flex items-center px-2 py-0.5 rounded text-xs font-bold ${bgTrendColor} ${trendColor}`}
            >
              <TrendIcon className="h-3 w-3 mr-1" />
              {Math.abs(attendanceTrend)}%
            </div>
            <span className="text-gray-400 ml-2 text-xs font-medium">
              지난 기간 대비 {trendText}
            </span>
          </div>
        </div>

        {/* 2. 평균 출석률 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                평균 출석률
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <p className="text-3xl font-bold text-gray-900">
                  {stats.attendanceRate.toFixed(1)}
                </p>
                <span className="text-sm font-medium text-gray-500">%</span>
              </div>
            </div>
            <div className="bg-blue-50 p-2 rounded-xl">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-400 font-medium leading-relaxed">
            전체 재적 인원 대비 실제 출석 비율 평균
          </div>
        </div>

        {/* 3. 장기 결석자 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-600">
                장기 결석 (0회)
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <p className="text-3xl font-bold text-gray-900">
                  {stats.zeroAttendanceCount}
                </p>
                <span className="text-sm font-medium text-gray-500">명</span>
              </div>
            </div>
            <div className="bg-red-50 p-2 rounded-xl">
              <UsersIcon className="h-6 w-6 text-red-500" />
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-400 font-medium leading-relaxed">
            조회 기간 동안 출석 기록이 없는 멤버
          </div>
        </div>
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────
// Sub Component 2: AttendanceMatrixView
// ─────────────────────────────────────────────────────────────

const AttendanceMatrixView = memo(
  ({
    members,
    attendances,
    startDate,
    endDate,
    unitType,
    isLoading,
  }: {
    members: MemberDto[];
    attendances: AttendanceDto[];
    startDate: string;
    endDate: string;
    unitType: UnitType;
    isLoading: boolean;
  }) => {
    // 로직은 기존 유지
    const uncheckedCount = useMemo(() => {
      if (!startDate || !endDate || members.length === 0) return 0;

      const toDateKey = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        // const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      };

      const start = new Date(startDate);
      const end = new Date(endDate);

      // 🔹 [추가] 오늘 날짜 기준 설정 (미래 미체크 방지)
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // 🔹 [수정] 종료일이 오늘보다 미래라면 오늘까지만 계산
      const effectiveEnd = end > today ? today : end;

      // 시작일조차 미래라면 미체크는 0
      if (start > effectiveEnd) return 0;

      const targetSundayKeys: string[] = [];
      const current = new Date(start);

      if (current.getDay() !== 0) {
        current.setDate(current.getDate() + (7 - current.getDay()));
      }

      // 🔹 [수정] end -> effectiveEnd
      while (current <= effectiveEnd) {
        targetSundayKeys.push(toDateKey(current));
        current.setDate(current.getDate() + 7);
      }

      const attendanceMap = new Set<string>();
      attendances.forEach((att) => {
        if (
          ["PRESENT", "ABSENT"].includes(att.status) &&
          att.member?.id &&
          att.date
        ) {
          const attDate = new Date(att.date);
          const key = `${att.member.id}-${toDateKey(attDate)}`;
          attendanceMap.add(key);
        }
      });

      let missingCount = 0;
      members.forEach((member) => {
        let joinDateStr = "2000-01-01";
        if (member.cellAssignmentDate) joinDateStr = member.cellAssignmentDate;
        else if (member.createdAt) joinDateStr = member.createdAt;
        else if (member.joinYear) joinDateStr = `${member.joinYear}-01-01`;

        const safeJoinDateStr = toDateKey(new Date(joinDateStr));

        targetSundayKeys.forEach((sundayKey) => {
          if (sundayKey < safeJoinDateStr) return;
          const key = `${member.id}-${sundayKey}`;
          if (!attendanceMap.has(key)) {
            missingCount++;
          }
        });
      });

      return missingCount;
    }, [startDate, endDate, members, attendances]);

    const summary = useMemo(() => {
      const present = attendances.filter((a) => a.status === "PRESENT").length;
      const recordedTotal =
        present + attendances.filter((a) => a.status === "ABSENT").length;
      const realTotalPossible = recordedTotal + uncheckedCount;
      const rate =
        realTotalPossible > 0 ? (present / realTotalPossible) * 100 : 0;

      return { rate, unchecked: uncheckedCount };
    }, [attendances, uncheckedCount]);

    const matrixMembers = useMemo(
      () =>
        members
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => ({
            memberId: m.id,
            memberName: formatDisplayName(m, members),
            cellAssignmentDate: m.cellAssignmentDate,
            createdAt: m.createdAt,
            joinYear: m.joinYear,
          })),
      [members]
    );

    const matrixMode = unitType === "month" ? "month" : "semester";
    const [targetYear, targetMonth] = startDate
      ? startDate.split("-").map(Number)
      : [0, 0];

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* 통계 요약 카드 (작은 사이즈) */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase">출석률</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600">
              {summary.rate.toFixed(0)}
              <span className="text-base ml-0.5">%</span>
            </p>
          </div>

          <div
            className={`p-4 rounded-2xl border shadow-sm ${
              summary.unchecked > 0
                ? "bg-red-50 border-red-100"
                : "bg-white border-gray-100"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase ${
                summary.unchecked > 0 ? "text-red-600" : "text-gray-500"
              }`}
            >
              미체크 (건)
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                summary.unchecked > 0 ? "text-red-700" : "text-gray-900"
              }`}
            >
              {summary.unchecked}
            </p>
          </div>
        </div>

        {/* 매트릭스 컨테이너 */}
        <div className="bg-white shadow-sm rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FaTh className="text-indigo-500" />
              {unitType === "year"
                ? `${targetYear}년 전체 현황`
                : unitType === "semester"
                ? "학기 전체 현황"
                : `${targetYear}년 ${targetMonth}월 상세 현황`}
            </h4>
          </div>

          <AttendanceMatrix
            mode={matrixMode}
            startDate={startDate}
            endDate={endDate}
            year={targetYear}
            month={targetMonth}
            members={matrixMembers}
            attendances={attendances}
            loading={isLoading}
            limitStartDate={startDate}
            limitEndDate={endDate}
          />
        </div>
      </div>
    );
  }
);

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

  // Loading States
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter Data & Options
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;
  const [hasAutoSelectedSemester, setHasAutoSelectedSemester] = useState(false);
  const [allCells, setAllCells] = useState<{ id: number; name: string }[]>([]);

  // Filters State
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

  // Effects & Logic
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
        size: 30000,
        sort: "date,asc",
      };
      const data = await attendanceService.getAttendances(
        matrixParams as GetAttendancesParams
      );
      setMatrixAttendances(data.content);
    } catch (err) {
      console.error(err);
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
      console.error(err);
      setOverallStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [getCleanedParams]);

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
  }, [
    user,
    fetchOverallStats,
    fetchAttendances,
    semesters.length,
    hasActiveSemesters,
  ]);

  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      attendanceService
        .getAvailableYears()
        .then(setAvailableYears)
        .catch(() => setAvailableYears([]));
      semesterService
        .getAllSemesters(true)
        .then(setSemesters)
        .catch(() => setSemesters([]));
      if (user.role === "EXECUTIVE") {
        cellService
          .getAllCells({ size: 1000 })
          .then((d) => setAllCells(d.content));
      }
    }
  }, [user]);

  // Filter Handlers
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

  const handleUnitTypeClick = useCallback(
    (type: UnitType) => {
      setUnitType(type);
      setFilters((prev) => {
        const baseYear =
          typeof prev.year === "number" ? prev.year : currentYear;
        const next: Filters = { ...prev };
        if (type === "year") {
          next.year = baseYear || currentYear;
          next.month = "";
          next.semesterId = "";
        } else if (type === "month") {
          next.year = baseYear || currentYear;
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
    },
    [semesters, currentYear, currentMonth]
  );

  const handleUnitValueClick = (value: number) => {
    setFilters((prev) => {
      const baseYear = prev.year || currentYear;
      return { ...prev, year: baseYear, month: value, semesterId: "" };
    });
  };

  // Options Helpers
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
      ...list.map((m) => ({ value: m.id, label: formatDisplayName(m, list) })),
    ];
  }, [allMembers, isCellLeader, user?.cellId]);

  const yearOptions = useMemo(() => {
    if (availableYears.length === 0) {
      return [{ value: currentYear, label: `${currentYear}년` }];
    }
    return availableYears.map((y) => ({ value: y, label: `${y}년` }));
  }, [availableYears, currentYear]);

  const targetMembers = useMemo(() => {
    if (filters.member)
      return allMembers.filter((m) => m.id === filters.member?.value);
    if (filters.cell)
      return allMembers.filter((m) => m.cell?.id === filters.cell?.value);
    if (isCellLeader && user?.cellId)
      return allMembers.filter((m) => m.cell?.id === user.cellId);
    return allMembers;
  }, [allMembers, filters.member, filters.cell, isCellLeader, user]);

  if (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-sm text-center max-w-sm w-full">
          <p className="text-red-600 text-sm font-bold">
            접근 권한이 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDaysIcon className="h-7 w-7 text-indigo-500" />
              출석 관리
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              기간·셀·멤버별 출석 기록을 매트릭스로 확인하고 관리합니다.
            </p>
          </div>
        </div>

        {/* 종합 통계 (Stats) */}
        <AttendanceStats stats={overallStats} loading={statsLoading} />

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-2">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <h3 className="font-bold text-gray-700">검색 및 필터</h3>
            </div>
            {/* Toggle: Unit vs Range */}
            <div className="bg-gray-100 p-1 rounded-xl flex text-xs font-bold">
              <button
                onClick={() => setFilterType("unit")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === "unit"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                단위별 조회
              </button>
              <button
                onClick={() => setFilterType("range")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === "range"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                기간 직접설정
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Top Row: Date Settings */}
            {filterType === "range" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    시작일
                  </label>
                  <KoreanCalendarPicker
                    value={filters.startDate}
                    onChange={(date) => handleFilterChange("startDate", date)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    종료일
                  </label>
                  <KoreanCalendarPicker
                    value={filters.endDate}
                    onChange={(date) => handleFilterChange("endDate", date)}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 space-y-4">
                {/* ✅ items-start로 설정하여 레이아웃 정렬 개선 */}
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {/* 1. 기준 연도 */}
                  <div className="sm:w-1/3 w-full">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">
                      기준 연도
                    </label>
                    <div className="relative">
                      <select
                        value={filters.year}
                        onChange={(e) =>
                          handleFilterChange(
                            "year",
                            e.target.value ? Number(e.target.value) : ""
                          )
                        }
                        // ✅ 스타일: border-gray-300, shadow-sm, px-3, py-2
                        className="w-full py-2 px-1 border border-gray-300 rounded-lg text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                        disabled={unitType === "semester"}
                      >
                        {yearOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {/* ✅ 안내 문구 추가 */}
                      {unitType === "semester" && (
                        <p className="absolute left-0 top-full mt-1 text-[10px] text-gray-400 whitespace-nowrap">
                          * 학기는 연도 무관
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 2. 조회 단위 */}
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">
                      조회 단위
                    </label>
                    {/* ✅ 스타일 개선: 개별 버튼 + gap-2 */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleUnitTypeClick("month")}
                        className={`flex-1 sm:flex-none px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all ${
                          unitType === "month"
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        월간
                      </button>
                      <button
                        onClick={() =>
                          hasActiveSemesters && handleUnitTypeClick("semester")
                        }
                        disabled={!hasActiveSemesters}
                        className={`flex-1 sm:flex-none px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all ${
                          hasActiveSemesters
                            ? unitType === "semester"
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                            : "bg-gray-50 text-gray-400 border-gray-200 border-dashed cursor-not-allowed shadow-none"
                        }`}
                      >
                        학기
                      </button>
                      <button
                        onClick={() => handleUnitTypeClick("year")}
                        className={`flex-1 sm:flex-none px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all ${
                          unitType === "year"
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        연간
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. 월 선택 영역 (스타일 업그레이드) */}
                {unitType === "month" && (
                  <div className="pt-2 border-t border-gray-200/50">
                    <label className="text-xs font-bold text-gray-500 mb-2 block">
                      월 선택
                    </label>
                    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleUnitValueClick(m)}
                          className={`py-1.5 rounded-md text-xs font-bold transition-all border ${
                            filters.month === m
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105"
                              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 shadow-sm"
                          }`}
                        >
                          {m}월
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. 학기 선택 영역 (스타일 업그레이드) */}
                {unitType === "semester" && semesters.length > 0 && (
                  <div className="pt-2 border-t border-gray-200/50">
                    <label className="text-xs font-bold text-gray-500 mb-2 block">
                      학기 선택
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {semesters.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setFilters((prev) => ({
                              ...prev,
                              semesterId: s.id,
                              year: "",
                              month: "",
                            }))
                          }
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                            filters.semesterId === s.id
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 shadow-sm"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Row: Cell/Member/Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  소속 셀
                </label>
                {isExecutive ? (
                  <div className="h-[46px]">
                    <SimpleSearchableSelect
                      options={cellOptions}
                      value={filters.cell?.value ?? null}
                      onChange={(value) =>
                        handleFilterChange(
                          "cell",
                          cellOptions.find((o) => o.value === value) || null
                        )
                      }
                      placeholder="전체 셀"
                      isClearable
                    />
                  </div>
                ) : (
                  <div className="h-[46px] px-3 flex items-center w-full bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-sm">
                    {user?.cellName || "내 셀"}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  멤버 검색
                </label>
                <div className="h-[46px]">
                  <SimpleSearchableSelect
                    options={memberOptions}
                    value={filters.member?.value ?? null}
                    onChange={(value) =>
                      handleFilterChange(
                        "member",
                        memberOptions.find((o) => o.value === value) || null
                      )
                    }
                    placeholder={
                      isCellLeader ? "내 셀 멤버 검색" : "전체 멤버 검색"
                    }
                    isClearable
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  출석 상태
                </label>
                <div className="h-[46px]">
                  <SimpleSearchableSelect
                    options={statusOptions}
                    value={filters.status}
                    onChange={(value) =>
                      handleFilterChange("status", value || "")
                    }
                    placeholder="모든 상태"
                    isClearable={false}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between pt-2">
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-bold text-gray-500 hover:text-gray-800 underline decoration-gray-300 underline-offset-2"
              >
                필터 초기화
              </button>
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                {loading ? "조회 중..." : "조회하기"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Matrix View */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <AttendanceMatrixView
            members={targetMembers}
            attendances={matrixAttendances}
            startDate={effectiveDateRange?.startDate || ""}
            endDate={effectiveDateRange?.endDate || ""}
            unitType={unitType}
            isLoading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default AdminAttendancesPage;
