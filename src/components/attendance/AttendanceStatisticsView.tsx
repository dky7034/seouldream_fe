// src/components/attendance/AttendanceStatisticsView.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { attendanceService } from "../../services/attendanceService";
import { semesterService } from "../../services/semesterService";
import { formatDisplayName } from "../../utils/memberUtils";
import type { SimpleAttendanceRateDto, User, SemesterDto } from "../../types";

interface AttendanceStatisticsViewProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

type UnitType = "month" | "semester";
type FilterMode = "unit" | "range";

/** -----------------------------
 * Helpers
 * ----------------------------- */

const countSundays = (startInput: Date, endInput: Date): number => {
  if (startInput > endInput) return 0;

  const current = new Date(startInput);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endInput);
  end.setHours(23, 59, 59, 999);

  let count = 0;

  if (current.getDay() !== 0) {
    current.setDate(current.getDate() + (7 - current.getDay()));
  }

  while (current <= end) {
    count++;
    current.setDate(current.getDate() + 7);
  }
  return count;
};

const isDateInSemesterOrSameMonth = (date: Date, semester: SemesterDto) => {
  const start = new Date(semester.startDate);
  const end = new Date(semester.endDate);

  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  if (date >= startDay && date <= endDay) return true;

  const isSameYear =
    date.getFullYear() === start.getFullYear() ||
    date.getFullYear() === end.getFullYear();
  if (!isSameYear) return false;

  const m = date.getMonth();
  const isStartMonth =
    date.getFullYear() === start.getFullYear() && m === start.getMonth();
  const isEndMonth =
    date.getFullYear() === end.getFullYear() && m === end.getMonth();

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
          semEnd.setHours(23, 59, 59, 999);

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
      params = {
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    } else {
      if (unitType === "semester") {
        const sem = semesters.find((s) => s.id === filters.semesterId);
        if (sem) {
          params = {
            startDate: sem.startDate,
            endDate: sem.endDate,
          };
        }
      } else {
        params = {
          year: filters.year,
          month: filters.month,
        };
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
        <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
          {error}
        </div>
      )}

      {/* Control Panel */}
      <div className="p-3 sm:p-4 bg-gray-50 rounded-lg space-y-4 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800 break-keep">
            통계 조회
          </h3>

          {!isCellLeader && (
            <div className="bg-white p-1 rounded-lg border border-gray-200 flex text-sm w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterMode("unit")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  effectiveFilterMode === "unit"
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                학기/월
              </button>
              <div className="w-px bg-gray-200 my-1 mx-1" />
              <button
                type="button"
                onClick={() => setFilterMode("range")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  effectiveFilterMode === "range"
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                직접 입력
              </button>
            </div>
          )}
        </div>

        <hr className="border-gray-200" />

        {effectiveFilterMode === "range" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className="block w-full border-gray-300 rounded-md shadow-sm h-[40px] px-3 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm h-[40px] px-3 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 학기 선택 및 단위 선택 */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  학기 선택
                </label>
                <select
                  value={filters.semesterId}
                  onChange={(e) => handleSemesterChange(Number(e.target.value))}
                  className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startDate} ~ {s.endDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:min-w-[180px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  조회 단위
                </label>
                <div className="flex bg-white rounded-md border border-gray-300 overflow-hidden w-full">
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("month")}
                    className={`flex-1 py-2 text-sm transition-colors whitespace-nowrap ${
                      unitType === "month"
                        ? "bg-blue-600 text-white font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    월별
                  </button>
                  <div className="w-px bg-gray-300" />
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("semester")}
                    className={`flex-1 py-2 text-sm transition-colors whitespace-nowrap ${
                      unitType === "semester"
                        ? "bg-blue-600 text-white font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    학기 전체
                  </button>
                </div>
              </div>
            </div>

            {/* 월 선택 (가로 스크롤 적용) */}
            {unitType === "month" && (
              <div className="bg-white p-3 rounded-md border border-gray-200 animate-fadeIn">
                <div className="text-xs text-gray-400 mb-2 break-keep">
                  * 선택된 학기 기간 내의 월만 표시됩니다.
                </div>
                {/* [수정] 가로 스크롤 적용 */}
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
                          className={`flex-shrink-0 snap-start px-4 py-2 text-sm rounded-md transition-all shadow-sm border ${
                            isActive
                              ? "bg-blue-600 text-white font-bold border-blue-600 ring-2 ring-blue-300"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400"
                          }`}
                        >
                          <span className="text-xs mr-1 opacity-70">
                            {m.year !== filters.year && `${m.year}년 `}
                          </span>
                          {m.label}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-sm text-gray-500 py-1">
                      표시할 월이 없습니다.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results View */}
      {loading ? (
        <div className="text-center p-8 text-gray-500">
          통계 정보를 불러오는 중...
        </div>
      ) : (
        <>
          {/* Mobile View */}
          <div className="sm:hidden space-y-3">
            {stats.map((s) => {
              const baseTotal =
                expectedTotalDays > 0 ? expectedTotalDays : s.totalDays;
              const uncheckedCount =
                baseTotal - (s.presentCount + s.absentCount);
              const displayName = formatName(s.targetId, s.targetName);

              return (
                <div
                  key={s.targetId}
                  className="bg-white rounded-lg shadow-sm p-4 border border-gray-100"
                >
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-bold text-gray-900 break-keep">
                      {displayName}
                    </p>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      총 {baseTotal}주
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div className="bg-green-50 text-green-700 p-2 rounded-md border border-green-100">
                      <div className="font-bold text-sm">{s.presentCount}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">출석</div>
                    </div>
                    <div className="bg-red-50 text-red-700 p-2 rounded-md border border-red-100">
                      <div className="font-bold text-sm">{s.absentCount}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">결석</div>
                    </div>
                    <div className="bg-gray-50 text-gray-600 p-2 rounded-md border border-gray-200">
                      <div className="font-bold text-sm">
                        {Math.max(0, uncheckedCount)}
                      </div>
                      <div className="text-[10px] opacity-75 mt-0.5">
                        미체크
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {stats.length === 0 && (
              <div className="text-center p-8 text-sm text-gray-500 bg-white rounded-lg shadow-sm border border-gray-100">
                해당 조건의 통계 정보가 없습니다.
              </div>
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden sm:block bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
            {stats.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider break-keep">
                      이름
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      출석
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      결석
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      미체크
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
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

                    return (
                      <tr
                        key={s.targetId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {displayName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">
                          {s.presentCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-red-600 font-medium">
                          {s.absentCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
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
              <div className="text-center p-12 text-gray-500">
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
