// src/components/attendance/AttendanceLogView.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { attendanceService } from "../../services/attendanceService";
import { memberService } from "../../services/memberService";
import { semesterService } from "../../services/semesterService";
import { formatDisplayName } from "../../utils/memberUtils";
import type {
  MemberDto,
  AttendanceDto,
  AttendanceStatus,
  User,
  GetAttendancesParams,
  SemesterDto,
} from "../../types";
import SimpleSearchableSelect from "../SimpleSearchableSelect";
import AttendanceMatrix from "../AttendanceMatrix";
import {
  TableCellsIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  PresentationChartLineIcon,
} from "@heroicons/react/24/solid";

interface AttendanceLogViewProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

type FilterMode = "unit" | "range";
type UnitType = "month" | "semester";

/** -----------------------------
 * Helpers (Timezone Safe Version)
 * ----------------------------- */

const safeFormatDate = (
  dateStr: string | null | undefined,
  separator = "-"
) => {
  if (!dateStr) return "";
  const targetStr =
    dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;
  const date = new Date(targetStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${separator}${month}${separator}${day}`;
};

const getAttendanceMemberId = (att: any): number | null => {
  if (att?.memberId !== undefined && att?.memberId !== null)
    return Number(att.memberId);
  const m = att?.member;
  if (!m) return null;
  if (typeof m === "number" || typeof m === "string") return Number(m);
  if (typeof m === "object") {
    if (m.id !== undefined && m.id !== null) return Number(m.id);
    if (m.memberId !== undefined && m.memberId !== null)
      return Number(m.memberId);
  }
  return null;
};

/** ------------------------------------------------------------
 * AttendanceMatrixView
 * ------------------------------------------------------------ */
const AttendanceMatrixView: React.FC<{
  members: MemberDto[];
  attendances: AttendanceDto[];
  startDate: string;
  endDate: string;
  unitType: UnitType;
  year: number;
  month: number;
  loading: boolean;
  limitStartDate?: string;
  limitEndDate?: string;
  filterMode: FilterMode;
  allMembers: { id: number; name: string; birthDate?: string }[];
  userRole?: string;
}> = ({
  members,
  attendances,
  startDate,
  endDate,
  unitType,
  year,
  month,
  loading,
  limitStartDate,
  limitEndDate,
  filterMode,
  allMembers,
  userRole,
}) => {
  const uncheckedCount = useMemo(() => {
    if (!startDate || !endDate || members.length === 0) return 0;

    const startStr = safeFormatDate(startDate, "-");
    const endStr = safeFormatDate(endDate, "-");
    const start = new Date(startStr);
    const end = new Date(endStr);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start > end) return 0;

    const targetSundays: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      if (cur.getDay() === 0) {
        targetSundays.push(safeFormatDate(cur.toISOString(), "-"));
      }
      cur.setDate(cur.getDate() + 1);
    }

    const attendanceSet = new Set<string>();
    for (const a of attendances) {
      const mId = getAttendanceMemberId(a);
      const dateKey = safeFormatDate(a.date, "-");
      if (mId === null || !dateKey) continue;
      if (!["PRESENT", "ABSENT"].includes(a.status)) continue;
      attendanceSet.add(`${mId}-${dateKey}`);
    }

    let incompleteWeeks = 0;
    for (const sundayStr of targetSundays) {
      const sundayDate = new Date(sundayStr);
      sundayDate.setHours(0, 0, 0, 0);

      const activeMembers = members.filter((m) => {
        if (!m.cellAssignmentDate) return true;
        const assignDate = new Date(m.cellAssignmentDate);
        assignDate.setHours(0, 0, 0, 0);
        return assignDate <= sundayDate;
      });

      if (activeMembers.length === 0) continue;
      const isWeekIncomplete = activeMembers.some((m) => {
        const key = `${m.id}-${sundayStr}`;
        return !attendanceSet.has(key);
      });
      if (isWeekIncomplete) incompleteWeeks++;
    }
    return incompleteWeeks;
  }, [startDate, endDate, members, attendances]);

  const matrixMembers = useMemo(
    () =>
      members.map((m) => {
        const found = allMembers.find((am) => am.id === m.id);
        return {
          memberId: m.id,
          memberName: found ? formatDisplayName(found, allMembers) : m.name,
        };
      }),
    [members, allMembers]
  );

  const matrixMode =
    filterMode === "range" || unitType === "semester" ? "semester" : "month";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Alert Card */}
      {uncheckedCount > 0 ? (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center justify-between shadow-sm">
          <div className="flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">
                출석 체크가 누락된 주가 있습니다.
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                총{" "}
                <strong className="font-extrabold">{uncheckedCount}개</strong>의
                주일에 기록이 없습니다.
              </p>
            </div>
          </div>
          <div className="hidden sm:block text-3xl font-extrabold text-red-700/50">
            {uncheckedCount}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center gap-3 shadow-sm opacity-80">
          <CheckCircleIcon className="h-6 w-6 text-gray-400" />
          <div>
            <p className="text-sm font-bold text-gray-600">
              모든 주차 입력 완료
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              조회 기간 내 누락된 주차가 없습니다.
            </p>
          </div>
        </div>
      )}

      {/* Matrix Card */}
      <div className="bg-white shadow-sm rounded-2xl border border-gray-100 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
          <TableCellsIcon className="h-5 w-5 text-indigo-500" />
          <h4 className="text-base font-bold text-gray-900">
            {matrixMode === "semester"
              ? "기간 전체 현황표"
              : "월간 상세 현황표"}
          </h4>
        </div>

        <AttendanceMatrix
          mode={matrixMode}
          startDate={startDate}
          endDate={endDate}
          year={year}
          month={month}
          members={matrixMembers}
          attendances={attendances}
          loading={loading}
          limitStartDate={limitStartDate}
          limitEndDate={limitEndDate}
          showAttendanceRate={userRole === "EXECUTIVE"}
        />
      </div>
    </div>
  );
};

/** ------------------------------------------------------------
 * Main Component
 * ------------------------------------------------------------ */
const AttendanceLogView: React.FC<AttendanceLogViewProps> = ({
  user,
  allMembers,
}) => {
  const now = new Date();
  const isCellLeader = user.role === "CELL_LEADER";

  const [attendanceList, setAttendanceList] = useState<AttendanceDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [filters, setFilters] = useState<{
    status: string;
    memberId: number | null;
    startDate: string;
    endDate: string;
    year: number;
    month: number;
    semesterId: number | "";
  }>({
    status: "all",
    memberId: null,
    startDate: "",
    endDate: "",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    semesterId: "",
  });

  const [filterMode, setFilterMode] = useState<FilterMode>("unit");
  const [unitType, setUnitType] = useState<UnitType>("semester");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isDateInSemesterOrSameMonth = useCallback(
    (date: Date, semester: SemesterDto) => {
      const start = new Date(semester.startDate);
      const end = new Date(semester.endDate);
      const inRange = date >= start && date <= end;
      if (inRange) return true;
      return (
        (date.getFullYear() === end.getFullYear() &&
          date.getMonth() === end.getMonth()) ||
        (date.getFullYear() === start.getFullYear() &&
          date.getMonth() === start.getMonth())
      );
    },
    []
  );

  const selectedSemester = useMemo(
    () => semesters.find((s) => s.id === filters.semesterId) || null,
    [semesters, filters.semesterId]
  );

  const semesterMonths = useMemo(() => {
    if (!selectedSemester) return [];
    const start = new Date(selectedSemester.startDate);
    const end = new Date(selectedSemester.endDate);
    const list: { year: number; month: number; label: string }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endMonth) {
      list.push({
        year: cur.getFullYear(),
        month: cur.getMonth() + 1,
        label: `${cur.getMonth() + 1}월`,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return list;
  }, [selectedSemester]);

  // --------------------
  // Data Fetching
  // --------------------
  const fetchCellMembers = useCallback(async () => {
    if (!user.cellId) return;
    try {
      const membersPage = await memberService.getAllMembers({
        cellId: user.cellId,
        size: 200,
        active: true,
        sort: "name,asc",
      });
      setMembers(membersPage.content ?? []);
    } catch {
      setError("셀 멤버 목록 로드 실패");
    }
  }, [user.cellId]);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data ?? []);
    } catch {
      setSemesters([]);
    }
  }, []);

  useEffect(() => {
    if (semesters.length === 0 || isInitialized) return;
    const today = new Date();
    const currentSem = semesters.find((s) =>
      isDateInSemesterOrSameMonth(today, s)
    );
    const targetSem =
      currentSem || semesters.find((s) => s.isActive) || semesters[0];

    if (targetSem) {
      setFilters((prev) => ({
        ...prev,
        semesterId: targetSem.id,
        year: currentSem
          ? today.getFullYear()
          : new Date(targetSem.startDate).getFullYear(),
        month: currentSem
          ? today.getMonth() + 1
          : new Date(targetSem.startDate).getMonth() + 1,
      }));
      setUnitType("semester");
    }
    setIsInitialized(true);
  }, [semesters, isInitialized, isDateInSemesterOrSameMonth]);

  const fetchAttendances = useCallback(async () => {
    if (!user.cellId || !isInitialized) return;
    setLoading(true);
    setError(null);

    const queryFilterMode: FilterMode = isCellLeader ? "unit" : filterMode;
    let params: GetAttendancesParams = {
      cellId: user.cellId,
      page: 0,
      size: 2000,
      sort: "date,asc",
      memberId: filters.memberId || undefined,
      status:
        filters.status !== "all"
          ? (filters.status as AttendanceStatus)
          : undefined,
    };

    if (queryFilterMode === "range") {
      params = {
        ...params,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
    } else {
      if (unitType === "semester") {
        const sem = semesters.find((s) => s.id === filters.semesterId);
        if (sem)
          params = {
            ...params,
            startDate: sem.startDate,
            endDate: sem.endDate,
          };
      } else {
        params = { ...params, year: filters.year, month: filters.month };
      }
    }

    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    ) as GetAttendancesParams;

    try {
      const data = await attendanceService.getAttendances(cleanedParams);
      setAttendanceList(data?.content ?? []);
    } catch {
      setError("출석 데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [
    user.cellId,
    isInitialized,
    filters,
    filterMode,
    isCellLeader,
    semesters,
    unitType,
  ]);

  useEffect(() => {
    fetchCellMembers();
  }, [fetchCellMembers]);
  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);
  useEffect(() => {
    fetchAttendances();
  }, [fetchAttendances]);

  // --------------------
  // Handlers
  // --------------------
  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    if (type === "month") {
      if (semesterMonths.length > 0) {
        const isCurrentMonthInSemester = semesterMonths.some(
          (m) => m.year === todayYear && m.month === todayMonth
        );
        if (isCurrentMonthInSemester) {
          setFilters((prev) => ({
            ...prev,
            year: todayYear,
            month: todayMonth,
          }));
          return;
        }
        const isInRange = semesterMonths.some(
          (m) => m.year === filters.year && m.month === filters.month
        );
        if (!isInRange) {
          setFilters((prev) => ({
            ...prev,
            year: semesterMonths[0].year,
            month: semesterMonths[0].month,
          }));
        }
      }
    } else {
      const currentSem = semesters.find((s) =>
        isDateInSemesterOrSameMonth(today, s)
      );
      if (currentSem) {
        setFilters((prev) => ({
          ...prev,
          semesterId: currentSem.id,
          year: new Date(currentSem.startDate).getFullYear(),
          month: new Date(currentSem.startDate).getMonth() + 1,
        }));
      }
    }
  };

  const handleMonthButtonClick = (year: number, month: number) => {
    setFilters((prev) => ({ ...prev, year, month }));
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

  const filteredMembers = useMemo(
    () =>
      filters.memberId
        ? members.filter((m) => m.id === filters.memberId)
        : members,
    [members, filters.memberId]
  );

  const viewProps = useMemo(() => {
    if (filterMode === "range")
      return { sDate: filters.startDate, eDate: filters.endDate };
    if (unitType === "semester") {
      const sem = semesters.find((s) => s.id === filters.semesterId);
      return {
        sDate: safeFormatDate(sem?.startDate, "-"),
        eDate: safeFormatDate(sem?.endDate, "-"),
      };
    }
    const y = filters.year;
    const m = filters.month;
    let startObj = new Date(y, m - 1, 1);
    let endObj = new Date(y, m, 0);
    if (selectedSemester) {
      const semStart = new Date(selectedSemester.startDate);
      const semEnd = new Date(selectedSemester.endDate);
      if (semStart > startObj) startObj = semStart;
      if (semEnd < endObj) endObj = semEnd;
    }
    if (startObj > endObj) return { sDate: "", eDate: "" };
    return {
      sDate: safeFormatDate(startObj.toISOString(), "-"),
      eDate: safeFormatDate(endObj.toISOString(), "-"),
    };
  }, [filterMode, unitType, filters, semesters, selectedSemester]);

  const memberOptions = useMemo(
    () =>
      members.map((m) => {
        const found = allMembers.find((am) => am.id === m.id);
        return {
          value: m.id,
          label: found ? formatDisplayName(found, allMembers) : m.name,
        };
      }),
    [members, allMembers]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5" /> {error}
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-gray-900">기록 조회 필터</h3>
          </div>

          {!isCellLeader && (
            <div className="bg-gray-100 p-1 rounded-xl flex text-sm font-bold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setFilterMode("unit")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${
                  filterMode === "unit"
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
                  filterMode === "range"
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
          {filterMode === "range" && !isCellLeader ? (
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
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                      <CalendarDaysIcon className="h-4 w-4" /> 학기 선택
                    </label>
                    {selectedSemester && (
                      <span className="hidden sm:block text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {selectedSemester.startDate} ~{" "}
                        {selectedSemester.endDate}
                      </span>
                    )}
                  </div>
                  <select
                    value={filters.semesterId}
                    onChange={(e) =>
                      handleSemesterChange(Number(e.target.value))
                    }
                    className="block w-full pl-3 pr-10 py-2.5 text-sm border-gray-200 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-xl bg-gray-50 font-medium"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {selectedSemester && (
                    <p className="sm:hidden mt-2 text-xs text-indigo-600 flex items-center">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5"></span>
                      {selectedSemester.startDate} ~ {selectedSemester.endDate}
                    </p>
                  )}
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
                      월별 상세
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

          <div className="border-t border-gray-100 mt-5 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">
                셀원 검색
              </div>
              <SimpleSearchableSelect
                options={memberOptions}
                value={filters.memberId ?? undefined}
                onChange={(val) =>
                  handleFilterChange("memberId", val === undefined ? null : val)
                }
                placeholder="전체 보기"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase mb-1.5">
                상태 필터
              </div>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="block w-full border-gray-200 rounded-xl shadow-sm py-2 px-3 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 font-medium"
              >
                <option value="all">모든 상태</option>
                <option value="PRESENT">출석만 표시</option>
                <option value="ABSENT">결석만 표시</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <AttendanceMatrixView
        members={filteredMembers}
        attendances={attendanceList}
        startDate={viewProps.sDate}
        endDate={viewProps.eDate}
        unitType={unitType}
        year={filters.year}
        month={filters.month}
        loading={loading}
        limitStartDate={selectedSemester?.startDate}
        limitEndDate={selectedSemester?.endDate}
        filterMode={filterMode}
        allMembers={allMembers}
        userRole={user.role}
      />
    </div>
  );
};

export default AttendanceLogView;
