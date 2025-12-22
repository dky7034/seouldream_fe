// src/components/AttendanceLogView.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { attendanceService } from "../../services/attendanceService";
import { memberService } from "../../services/memberService";
import { semesterService } from "../../services/semesterService";
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
import { FaTh, FaChartBar } from "react-icons/fa";

interface AttendanceLogViewProps {
  user: User;
}

type FilterMode = "unit" | "range";
type UnitType = "month" | "semester";

/** -----------------------------
 * Helpers (프로덕션용 안전 버전)
 * ----------------------------- */

/** YYYY-MM-DD를 로컬 00:00:00 Date로 파싱 (UTC 파싱 방지) */
const parseLocal = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/** 어떤 date 문자열이든 YYYY-MM-DD로 정규화 */
const normalizeISODate = (v: string | undefined | null) => {
  if (!v) return "";
  return v.slice(0, 10);
};

/** Date -> YYYY-MM-DD (로컬 기준) */
const toLocalISODate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** AttendanceDto에서 member id를 최대한 안전하게 추출 */
const getAttendanceMemberId = (att: any): string | number | null => {
  if (att?.memberId !== undefined && att?.memberId !== null)
    return att.memberId;

  const m = att?.member;
  if (!m) return null;

  if (typeof m === "number" || typeof m === "string") return m;
  if (typeof m === "object") {
    if (m.id !== undefined && m.id !== null) return m.id;
    if (m.memberId !== undefined && m.memberId !== null) return m.memberId;
  }
  return null;
};

/** ------------------------------------------------------------
 * AttendanceMatrixView
 * - 통계 + 매트릭스
 * - 미체크 주 계산: 일요일 기준, (cellAssignmentDate 우선 / 없으면 joinYear-01-01)
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
  onMonthChange?: (increment: number) => void;
  limitStartDate?: string;
  limitEndDate?: string;
  filterMode: FilterMode;
}> = ({
  members,
  attendances,
  startDate,
  endDate,
  unitType,
  year,
  month,
  loading,
  onMonthChange,
  limitStartDate,
  limitEndDate,
  filterMode,
}) => {
  // ✅ "미체크된 주(Week)" 계산
  const uncheckedCount = useMemo(() => {
    if (!startDate || !endDate || members.length === 0) return 0;

    const filterStart = parseLocal(startDate);
    const filterEnd = parseLocal(endDate);
    if (!filterStart || !filterEnd) return 0;

    filterStart.setHours(0, 0, 0, 0);
    filterEnd.setHours(0, 0, 0, 0);
    if (filterStart > filterEnd) return 0;

    // 1) 기간 내 모든 일요일 목록 생성 (YYYY-MM-DD)
    const targetSundays: string[] = [];
    const cur = new Date(filterStart);

    while (cur <= filterEnd) {
      if (cur.getDay() === 0) targetSundays.push(toLocalISODate(cur));
      cur.setDate(cur.getDate() + 1);
    }

    // 2) 출석 데이터 Set (Key: memberId-YYYY-MM-DD)
    const attendanceSet = new Set<string>();
    for (const a of attendances) {
      const mId = getAttendanceMemberId(a);
      const dateKey = normalizeISODate(a?.date);

      if (mId === null || !dateKey) continue;
      if (!["PRESENT", "ABSENT"].includes(a.status)) continue;

      attendanceSet.add(`${String(mId)}-${dateKey}`);
    }

    // 3) 각 일요일마다 검사
    let incompleteWeeks = 0;

    for (const sundayStr of targetSundays) {
      const sunday = parseLocal(sundayStr);
      if (!sunday) continue;
      sunday.setHours(0, 0, 0, 0);

      const activeMembers = members.filter((m) => {
        const baseDateStr =
          normalizeISODate((m as any).cellAssignmentDate) || "";
        const base = parseLocal(baseDateStr) || new Date(m.joinYear, 0, 1);
        base.setHours(0, 0, 0, 0);
        return base <= sunday;
      });

      if (activeMembers.length === 0) continue;

      const isWeekIncomplete = activeMembers.some((m) => {
        const key = `${String(m.id)}-${sundayStr}`;
        return !attendanceSet.has(key);
      });

      if (isWeekIncomplete) incompleteWeeks++;
    }

    return incompleteWeeks;
  }, [startDate, endDate, members, attendances]);

  // 통계
  const summary = useMemo(() => {
    const present = attendances.filter((a) => a.status === "PRESENT").length;
    const absent = attendances.filter((a) => a.status === "ABSENT").length;
    return { present, absent, unchecked: uncheckedCount };
  }, [attendances, uncheckedCount]);

  // 매트릭스 멤버 포맷
  const matrixMembers = useMemo(
    () => members.map((m) => ({ memberId: m.id, memberName: m.name })),
    [members]
  );

  // Matrix 모드: range 또는 semester => semester
  const matrixMode =
    filterMode === "range" || unitType === "semester" ? "semester" : "month";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-center">
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
            출석 체크 누락 (주)
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-600">
            {summary.unchecked}
          </p>
        </div>
      </div>

      {/* 매트릭스 */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-bold text-gray-700 mb-4 ml-1 flex items-center">
          <FaTh className="mr-2 text-indigo-500" />
          {matrixMode === "semester" ? "기간 전체 현황" : "월간 상세 현황"}
        </h4>

        <AttendanceMatrix
          mode={matrixMode}
          startDate={startDate}
          endDate={endDate}
          year={year}
          month={month}
          members={matrixMembers}
          attendances={attendances}
          // ✅ 핵심: AttendanceMatrix가 필수 콜백을 요구한다면 undefined 방지
          onMonthChange={onMonthChange ?? (() => {})}
          loading={loading}
          limitStartDate={limitStartDate}
          limitEndDate={limitEndDate}
        />
      </div>
    </div>
  );
};

/** ------------------------------------------------------------
 * Main Component
 * ------------------------------------------------------------ */
const AttendanceLogView: React.FC<AttendanceLogViewProps> = ({ user }) => {
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

  // 현재 날짜가 학기 범위 또는 시작/종료 월에 걸치는지
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

  const selectedSemester = useMemo(() => {
    return semesters.find((s) => s.id === filters.semesterId) || null;
  }, [semesters, filters.semesterId]);

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
      setError("셀 멤버 목록을 불러오는 데 실패했습니다.");
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

  // 최초 학기/월 초기값 세팅
  useEffect(() => {
    if (semesters.length === 0) return;
    if (isInitialized) return;

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
      setError("출석 데이터를 불러오는 데 실패했습니다.");
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

  const handleMatrixMonthChange = (increment: number) => {
    setFilters((prev) => {
      const currentDate = new Date(prev.year, prev.month - 1, 1);
      currentDate.setMonth(currentDate.getMonth() + increment);
      return {
        ...prev,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      };
    });
  };

  const filteredMembers = useMemo(() => {
    return filters.memberId
      ? members.filter((m) => m.id === filters.memberId)
      : members;
  }, [members, filters.memberId]);

  // Matrix/Stats에 넘길 날짜 범위
  const viewProps = useMemo(() => {
    // 1) range 모드
    if (filterMode === "range")
      return { sDate: filters.startDate, eDate: filters.endDate };

    // 2) 학기 모드
    if (unitType === "semester") {
      const sem = semesters.find((s) => s.id === filters.semesterId);
      return { sDate: sem?.startDate || "", eDate: sem?.endDate || "" };
    }

    // 3) 월 모드 (학기 교집합)
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

    return { sDate: toLocalISODate(startObj), eDate: toLocalISODate(endObj) };
  }, [filterMode, unitType, filters, semesters, selectedSemester]);

  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.id, label: m.name })),
    [members]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
          {error}
        </div>
      )}

      {/* Control Panel */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4 border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FaChartBar className="text-indigo-500" />
            <h3 className="text-lg font-semibold text-gray-800">출석부 조회</h3>
          </div>

          {!isCellLeader && (
            <div className="bg-white p-1 rounded-lg border border-gray-200 flex text-sm">
              <button
                type="button"
                onClick={() => setFilterMode("unit")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  filterMode === "unit"
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                학기/월 단위
              </button>
              <div className="w-px bg-gray-200 my-1 mx-1" />
              <button
                type="button"
                onClick={() => setFilterMode("range")}
                className={`px-3 py-1 rounded-md transition-colors ${
                  filterMode === "range"
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                직접 기간 입력
              </button>
            </div>
          )}
        </div>

        <hr className="border-gray-200" />

        {filterMode === "range" && !isCellLeader ? (
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
                className="block w-full border-gray-300 rounded-md shadow-sm h-[40px] px-3 focus:ring-blue-500 focus:border-blue-500"
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
                className="block w-full border-gray-300 rounded-md shadow-sm h-[40px] px-3 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  학기 선택
                </label>
                <select
                  value={filters.semesterId}
                  onChange={(e) => handleSemesterChange(Number(e.target.value))}
                  className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startDate} ~ {s.endDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[180px]">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  조회 단위
                </label>
                <div className="flex bg-white rounded-md border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("month")}
                    className={`flex-1 py-2 text-sm transition-colors ${
                      unitType === "month"
                        ? "bg-blue-600 text-white font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    월별 상세
                  </button>
                  <div className="w-px bg-gray-300" />
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("semester")}
                    className={`flex-1 py-2 text-sm transition-colors ${
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

            {unitType === "month" && (
              <div className="bg-white p-3 rounded-md border border-gray-200">
                <div className="text-xs text-gray-400 mb-2">
                  * 선택된 학기({selectedSemester?.name})에 포함된 월만
                  표시됩니다.
                </div>
                <div className="flex flex-wrap gap-2">
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
                          className={`px-4 py-2 text-sm rounded-md transition-all shadow-sm ${
                            isActive
                              ? "bg-blue-600 text-white font-bold ring-2 ring-blue-300"
                              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400"
                          }`}
                        >
                          {m.year !== filters.year && (
                            <span className="text-xs opacity-75 mr-1">
                              {m.year}년
                            </span>
                          )}
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

        <div className="pt-2 border-t border-gray-200 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                특정 셀원 검색
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
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                상태 필터
              </div>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
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
        onMonthChange={handleMatrixMonthChange}
        limitStartDate={selectedSemester?.startDate}
        limitEndDate={selectedSemester?.endDate}
        filterMode={filterMode}
      />
    </div>
  );
};

export default AttendanceLogView;
