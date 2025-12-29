// src/components/attendance/AttendanceStatisticsView.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { attendanceService } from "../../services/attendanceService";
import { semesterService } from "../../services/semesterService";
import { formatDisplayName } from "../../utils/memberUtils";
import type { SimpleAttendanceRateDto, User, SemesterDto } from "../../types";
import {
  ChartBarIcon,
  FunnelIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  PresentationChartLineIcon,
} from "@heroicons/react/24/solid";

interface AttendanceStatisticsViewProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

type UnitType = "month" | "semester";
type FilterMode = "unit" | "range";

/** -----------------------------
 * Helpers
 * ----------------------------- */

// 시간 초기화를 포함한 일요일 계산
const countSundays = (startInput: Date, endInput: Date): number => {
  if (startInput > endInput) return 0;
  const current = new Date(startInput);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endInput);
  end.setHours(0, 0, 0, 0);

  if (current.getDay() !== 0) {
    current.setDate(current.getDate() + (7 - current.getDay()));
  }

  let count = 0;
  while (current <= end) {
    count++;
    current.setDate(current.getDate() + 7);
  }
  return count;
};

const isDateInSemesterOrSameMonth = (date: Date, semester: SemesterDto) => {
  const start = new Date(semester.startDate);
  const end = new Date(semester.endDate);
  if (date >= start && date <= end) return true;
  const isStartMonth =
    date.getFullYear() === start.getFullYear() &&
    date.getMonth() === start.getMonth();
  const isEndMonth =
    date.getFullYear() === end.getFullYear() &&
    date.getMonth() === end.getMonth();
  return isStartMonth || isEndMonth;
};

/** -----------------------------
 * Main Component
 * ----------------------------- */
const AttendanceStatisticsView: React.FC<AttendanceStatisticsViewProps> = ({
  user,
  allMembers,
}) => {
  const isCellLeader = user.role === "CELL_LEADER";
  const now = new Date();

  // Data State
  const [stats, setStats] = useState<SimpleAttendanceRateDto[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);

  // Filter State
  const [filterMode, setFilterMode] = useState<FilterMode>("unit");
  const [unitType, setUnitType] = useState<UnitType>("semester");

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    semesterId: 0 as number,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const effectiveFilterMode = isCellLeader ? "unit" : filterMode;

  const formatName = useCallback(
    (id: number | null, originalName: string) => {
      if (!id) return originalName;
      const found = allMembers.find((m) => m.id === id);
      return found ? formatDisplayName(found, allMembers) : originalName;
    },
    [allMembers]
  );

  // -------------------------------------------------
  // Derived State
  // -------------------------------------------------

  const currentSemester = useMemo(() => {
    return semesters.find((s) => s.id === filters.semesterId) || null;
  }, [semesters, filters.semesterId]);

  const semesterMonths = useMemo(() => {
    if (!currentSemester) return [];
    const start = new Date(currentSemester.startDate);
    const end = new Date(currentSemester.endDate);
    const list: { year: number; month: number; label: string }[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endDate = new Date(end.getFullYear(), end.getMonth(), 1);
    while (current <= endDate) {
      list.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        label: `${current.getMonth() + 1}월`,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return list;
  }, [currentSemester]);

  const expectedTotalDays = useMemo(() => {
    let start: Date | null = null;
    let end: Date | null = null;

    if (effectiveFilterMode === "range") {
      if (filters.startDate && filters.endDate) {
        start = new Date(filters.startDate);
        end = new Date(filters.endDate);
      }
    } else {
      if (unitType === "semester" && currentSemester) {
        start = new Date(currentSemester.startDate);
        end = new Date(currentSemester.endDate);
      } else if (unitType === "month") {
        start = new Date(filters.year, filters.month - 1, 1);
        end = new Date(filters.year, filters.month, 0);

        if (currentSemester) {
          const semStart = new Date(currentSemester.startDate);
          const semEnd = new Date(currentSemester.endDate);
          semStart.setHours(0, 0, 0, 0);
          semEnd.setHours(0, 0, 0, 0);
          if (semStart > start) start = semStart;
          if (semEnd < end) end = semEnd;
        }
      }
    }

    if (!start || !end || start > end) return 0;
    return countSundays(start, end);
  }, [effectiveFilterMode, unitType, filters, currentSemester]);

  // -------------------------------------------------
  // Initialization & Fetch
  // -------------------------------------------------

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data || []);
    } catch {
      setSemesters([]);
    }
  }, []);

  useEffect(() => {
    if (semesters.length === 0 || isInitialized) return;
    const today = new Date();
    const targetSem =
      semesters.find((s) => isDateInSemesterOrSameMonth(today, s)) ||
      semesters.find((s) => s.isActive) ||
      semesters[0];

    if (targetSem) {
      setFilters((prev) => ({
        ...prev,
        semesterId: targetSem.id,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
      }));
      setUnitType("semester");
    }
    setIsInitialized(true);
  }, [semesters, isInitialized]);

  const fetchStats = useCallback(async () => {
    if (!user.cellId || !isInitialized) return;
    setLoading(true);
    setError(null);
    let params: any = {};

    if (effectiveFilterMode === "range") {
      params = { startDate: filters.startDate, endDate: filters.endDate };
    } else {
      if (unitType === "semester") {
        const sem = semesters.find((s) => s.id === filters.semesterId);
        if (sem) params = { startDate: sem.startDate, endDate: sem.endDate };
      } else {
        params = { year: filters.year, month: filters.month };
      }
    }

    try {
      const cleanedParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v)
      );
      const data = await attendanceService.getMemberAttendanceRate(
        user.cellId,
        cleanedParams
      );
      setStats(data);
    } catch (err) {
      setError("통계 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    user.cellId,
    isInitialized,
    effectiveFilterMode,
    unitType,
    filters,
    semesters,
  ]);

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // -------------------------------------------------
  // Event Handlers
  // -------------------------------------------------
  const handleFilterChange = (field: string, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSemesterChange = (newSemesterId: number) => {
    const sem = semesters.find((s) => s.id === newSemesterId);
    if (!sem) return;
    const start = new Date(sem.startDate);
    setFilters((prev) => ({
      ...prev,
      semesterId: newSemesterId,
      year: start.getFullYear(),
      month: start.getMonth() + 1,
    }));
  };

  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    if (type === "month" && semesterMonths.length > 0) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const isCurrentMonthValid = semesterMonths.some(
        (m) => m.year === currentYear && m.month === currentMonth
      );
      if (isCurrentMonthValid) {
        setFilters((prev) => ({
          ...prev,
          year: currentYear,
          month: currentMonth,
        }));
      } else {
        const first = semesterMonths[0];
        setFilters((prev) => ({
          ...prev,
          year: first.year,
          month: first.month,
        }));
      }
    }
  };

  const handleMonthButtonClick = (year: number, month: number) => {
    setFilters((prev) => ({ ...prev, year, month }));
  };

  // -------------------------------------------------
  // Render
  // -------------------------------------------------
  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {error}
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-indigo-500" /> 통계 필터
          </h3>

          {!isCellLeader && (
            <div className="bg-gray-100 p-1 rounded-xl flex text-sm font-bold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterMode("unit")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${
                  effectiveFilterMode === "unit"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                학기/월
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("range")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${
                  effectiveFilterMode === "range"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                직접 입력
              </button>
            </div>
          )}
        </div>

        <div className="p-5">
          {effectiveFilterMode === "range" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">
                  시작일
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    handleFilterChange("startDate", e.target.value)
                  }
                  className="block w-full border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">
                  종료일
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value)
                  }
                  className="block w-full border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Semester & Unit Select */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 mb-1.5 uppercase flex items-center gap-1">
                    <CalendarDaysIcon className="h-4 w-4" /> 학기 선택
                  </label>
                  <div className="relative">
                    <select
                      value={filters.semesterId}
                      onChange={(e) =>
                        handleSemesterChange(Number(e.target.value))
                      }
                      className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-200 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl bg-gray-50 appearance-none font-medium"
                    >
                      {semesters.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.startDate} ~ {s.endDate})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="sm:min-w-[200px]">
                  <label className="text-xs font-bold text-gray-500 mb-1.5 uppercase flex items-center gap-1">
                    <PresentationChartLineIcon className="h-4 w-4" /> 조회 단위
                  </label>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleUnitTypeClick("month")}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${
                        unitType === "month"
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      월별
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitTypeClick("semester")}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${
                        unitType === "semester"
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      학기 전체
                    </button>
                  </div>
                </div>
              </div>

              {/* Month Pills (Horizontal Scroll) */}
              {unitType === "month" && (
                <div className="animate-fadeIn pt-2">
                  <div className="text-xs font-bold text-gray-400 mb-2 px-1">
                    상세 월 선택
                  </div>
                  <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar snap-x">
                    {semesterMonths.length > 0 ? (
                      semesterMonths.map((m) => {
                        const isActive =
                          filters.year === m.year && filters.month === m.month;
                        return (
                          <button
                            key={`${m.year}-${m.month}`}
                            type="button"
                            onClick={() =>
                              handleMonthButtonClick(m.year, m.month)
                            }
                            className={`flex-shrink-0 snap-start px-4 py-2 text-sm font-bold rounded-full transition-all border ${
                              isActive
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                            }`}
                          >
                            <span className="text-[10px] mr-1 opacity-80 font-normal">
                              {m.year !== filters.year && `${m.year}년 `}
                            </span>
                            {m.label}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-sm text-gray-400 py-1 pl-1">
                        표시할 월이 없습니다.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results View */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-4">
            <div className="flex items-center gap-2 px-1">
              <ChartBarIcon className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-gray-900">통계 결과</h3>
            </div>
            {stats.map((s) => {
              const baseTotal =
                expectedTotalDays > 0 ? expectedTotalDays : s.totalDays;
              const uncheckedCount =
                baseTotal - (s.presentCount + s.absentCount);
              const displayName = formatName(s.targetId, s.targetName);

              // 출석률 계산 (안전하게 0으로 나누기 방지)
              const rate =
                baseTotal > 0
                  ? Math.round((s.presentCount / baseTotal) * 100)
                  : 0;

              return (
                <div
                  key={s.targetId}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <UserGroupIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">
                          {displayName}
                        </p>
                        <p className="text-xs text-gray-500">
                          총 {baseTotal}주 조회
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-2xl font-extrabold text-indigo-600">
                        {rate}%
                      </span>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">
                        출석률
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-2.5 rounded-full"
                      style={{ width: `${rate}%` }}
                    ></div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-green-50 p-2.5 rounded-xl border border-green-100">
                      <div className="text-lg font-bold text-green-700">
                        {s.presentCount}
                      </div>
                      <div className="text-[10px] font-bold text-green-600/70 mt-0.5">
                        출석
                      </div>
                    </div>
                    <div className="bg-red-50 p-2.5 rounded-xl border border-red-100">
                      <div className="text-lg font-bold text-red-700">
                        {s.absentCount}
                      </div>
                      <div className="text-[10px] font-bold text-red-600/70 mt-0.5">
                        결석
                      </div>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                      <div className="text-lg font-bold text-gray-600">
                        {Math.max(0, uncheckedCount)}
                      </div>
                      <div className="text-[10px] font-bold text-gray-500/70 mt-0.5">
                        미체크
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {stats.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">
                  해당 조건의 통계 정보가 없습니다.
                </p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-indigo-500" />
              <h3 className="text-base font-bold text-gray-900">상세 통계표</h3>
            </div>
            {stats.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      이름
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      출석률
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      출석
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      결석
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      미체크
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      전체(주)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.map((s) => {
                    const baseTotal =
                      expectedTotalDays > 0 ? expectedTotalDays : s.totalDays;
                    const uncheckedCount =
                      baseTotal - (s.presentCount + s.absentCount);
                    const displayName = formatName(s.targetId, s.targetName);
                    const rate =
                      baseTotal > 0
                        ? Math.round((s.presentCount / baseTotal) * 100)
                        : 0;

                    return (
                      <tr
                        key={s.targetId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                          {displayName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-600 w-8">
                              {rate}%
                            </span>
                            <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-500 h-1.5 rounded-full"
                                style={{ width: `${rate}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600 font-bold">
                          {s.presentCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-red-600 font-bold">
                          {s.absentCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-400 font-medium">
                          {Math.max(0, uncheckedCount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-bold">
                          {baseTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center p-12 text-gray-400 text-sm">
                해당 조건의 통계 정보가 없습니다.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AttendanceStatisticsView;
