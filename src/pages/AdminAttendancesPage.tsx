// src/pages/AdminAttendancesPage.tsx
import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
import { attendanceService } from "../services/attendanceService";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
// ✅ [빌드 에러 방지] 사용하지 않는 서비스 주석 처리
// import { statisticsService } from "../services/statisticsService";
import { semesterService } from "../services/semesterService";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import { formatDisplayName } from "../utils/memberUtils";

// Components
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import AttendanceMatrix from "../components/AttendanceMatrix";

// Types
import type {
  GetAttendancesParams,
  AttendanceDto,
  MemberDto,
  // ✅ [빌드 에러 방지] 사용하지 않는 타입 주석 처리
  // OverallAttendanceStatDto,
  SemesterDto,
} from "../types";
import type { SelectOption } from "../components/AsyncSearchableSelect";

// Icons
import {
  // ✅ [빌드 에러 방지] 통계 컴포넌트에서만 쓰는 아이콘 주석 처리
  // ChartBarIcon,
  // UsersIcon,
  // ArrowTrendingUpIcon,
  // ArrowTrendingDownIcon,
  // MinusIcon,
  CalendarDaysIcon,
  FunnelIcon,
} from "@heroicons/react/24/solid";
import { FaTh } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────
// Types & Helpers
// ─────────────────────────────────────────────────────────────

type UnitType = "year" | "semester";
type SortDirection = "asc" | "desc"; // 정렬 방향 타입

type Filters = {
  member: SelectOption | null;
  cell: SelectOption | null;
  year: number | "";
  semesterId: number | "";
  includeExecutive: boolean;
};

const scrollbarHideStyle: React.CSSProperties = {
  msOverflowStyle: "none",
  scrollbarWidth: "none",
};

// ─────────────────────────────────────────────────────────────
// Sub Component 1: AttendanceStats
// ─────────────────────────────────────────────────────────────

// ✅ [빌드 에러 방지] 컴포넌트 정의 전체 주석 처리
/*
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
  },
);
*/

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
    includeExecutive,
    semesters,
    nameSort, // ✅ 이름 정렬 상태
    ageSort, // ✅ 나이 정렬 상태
  }: {
    members: MemberDto[];
    attendances: AttendanceDto[];
    startDate: string;
    endDate: string;
    unitType: UnitType;
    isLoading: boolean;
    includeExecutive: boolean;
    semesters: SemesterDto[];
    nameSort: SortDirection | null;
    ageSort: SortDirection | null;
  }) => {
    const attendanceMap = useMemo(() => {
      const map = new Map<string, string>();
      attendances.forEach((att) => {
        if (att.member?.id && att.date) {
          const dateKey = att.date.substring(0, 10);
          map.set(`${att.member.id}-${dateKey}`, att.status);
        }
      });
      return map;
    }, [attendances]);

    const stats = useMemo(() => {
      if (!startDate || !endDate || members.length === 0) {
        return { rate: 0, unchecked: 0 };
      }

      const toDateKey = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();
      const todayStr = toDateKey(today);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      today.setHours(23, 59, 59, 999);
      const effectiveEnd = end > today ? today : end;

      const targetSundayKeys: string[] = [];
      const current = new Date(start);

      if (current.getDay() !== 0) {
        current.setDate(current.getDate() + (7 - current.getDay()));
      }

      while (current <= effectiveEnd) {
        let isSemesterDate = true;
        const currentDateStr = toDateKey(current);
        if (unitType === "year" && semesters.length > 0) {
          const isInSemester = semesters.some(
            (s) => currentDateStr >= s.startDate && currentDateStr <= s.endDate,
          );
          if (!isInSemester) isSemesterDate = false;
        }
        if (isSemesterDate) targetSundayKeys.push(currentDateStr);
        current.setDate(current.getDate() + 7);
      }

      let totalPresent = 0;
      let totalPossible = 0;
      let totalUnchecked = 0;

      members.forEach((member) => {
        if (!includeExecutive && member.role === "EXECUTIVE") return;
        let joinDateStr = "2000-01-01";
        if (member.cellAssignmentDate)
          joinDateStr = member.cellAssignmentDate.substring(0, 10);
        else if (member.createdAt)
          joinDateStr = member.createdAt.substring(0, 10);
        else if (member.joinYear) joinDateStr = `${member.joinYear}-01-01`;

        targetSundayKeys.forEach((sundayKey) => {
          if (sundayKey > todayStr) return;
          const key = `${member.id}-${sundayKey}`;
          const status = attendanceMap.get(key);
          if (sundayKey >= joinDateStr || status) {
            totalPossible++;
            if (status === "PRESENT") totalPresent++;
            else if (!status) totalUnchecked++;
          }
        });
      });

      const rate = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;
      return { rate, unchecked: totalUnchecked };
    }, [
      startDate,
      endDate,
      members,
      attendanceMap,
      includeExecutive,
      unitType,
      semesters,
    ]);

    const matrixMembers = useMemo(
      () =>
        members
          .filter((m) => includeExecutive || m.role !== "EXECUTIVE")
          .sort((a, b) => {
            const birthA = a.birthDate || "9999-99-99";
            const birthB = b.birthDate || "9999-99-99";

            // ✅ 1순위: 나이 정렬 (ageSort가 있을 때)
            if (ageSort) {
              if (birthA !== birthB) {
                // age 'asc' = 나이 적은 순 = 생일 늦은 순 (내림차순)
                // age 'desc' = 나이 많은 순 = 생일 빠른 순 (오름차순)
                return ageSort === "asc"
                  ? birthB.localeCompare(birthA)
                  : birthA.localeCompare(birthB);
              }
            }

            // ✅ 2순위: 이름 정렬 (nameSort가 있거나, 기본값)
            if (nameSort === "desc") {
              return b.name.localeCompare(a.name);
            }
            // 기본값: 이름 오름차순 (nameSort === 'asc' 또는 null일 때도 가나다순)
            return a.name.localeCompare(b.name);
          })
          .map((m) => ({
            memberId: m.id,
            memberName: formatDisplayName(m, members),
            cellAssignmentDate: m.cellAssignmentDate,
            createdAt: m.createdAt,
            joinYear: m.joinYear,
          })),
      [members, includeExecutive, nameSort, ageSort], // 의존성 업데이트
    );

    const matrixMode = "semester";
    const [targetYear] = startDate ? startDate.split("-").map(Number) : [0];

    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase">출석률</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600">
              {stats.rate.toFixed(0)}
              <span className="text-base ml-0.5">%</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
              * {includeExecutive ? "임원 포함" : "임원 제외"}, 방학 제외
            </p>
          </div>
          <div
            className={`p-4 rounded-2xl border shadow-sm ${
              stats.unchecked > 0
                ? "bg-red-50 border-red-100"
                : "bg-white border-gray-100"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase ${
                stats.unchecked > 0 ? "text-red-600" : "text-gray-500"
              }`}
            >
              미체크 (건)
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                stats.unchecked > 0 ? "text-red-700" : "text-gray-900"
              }`}
            >
              {stats.unchecked}
            </p>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2 whitespace-nowrap">
              <FaTh className="text-indigo-500" />
              {unitType === "year"
                ? `${targetYear}년 전체 현황`
                : "학기 전체 현황"}
            </h4>
          </div>
          <AttendanceMatrix
            mode={matrixMode}
            startDate={startDate}
            endDate={endDate}
            year={targetYear}
            month={0}
            members={matrixMembers}
            attendances={attendances}
            loading={isLoading}
            limitStartDate={startDate}
            limitEndDate={endDate}
            semesters={semesters}
          />
        </div>
      </div>
    );
  },
);

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

const AdminAttendancesPage: React.FC = () => {
  const { user } = useAuth();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [matrixAttendances, setMatrixAttendances] = useState<AttendanceDto[]>(
    [],
  );
  const [allMembers, setAllMembers] = useState<MemberDto[]>([]);

  // ✅ [빌드 에러 방지] 사용하지 않는 State 주석 처리
  /*
  const [overallStats, setOverallStats] =
    useState<OverallAttendanceStatDto | null>(null);

  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  */
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;
  const [hasAutoSelectedSemester, setHasAutoSelectedSemester] = useState(false);
  const [allCells, setAllCells] = useState<{ id: number; name: string }[]>([]);

  const [filters, setFilters] = useState<Filters>({
    member: null,
    cell:
      user?.role === "CELL_LEADER" && user.cellId && user.cellName
        ? { value: user.cellId, label: user.cellName }
        : null,
    year: currentYear,
    semesterId: "" as number | "",
    includeExecutive: false,
  });

  const [unitType, setUnitType] = useState<UnitType>("semester");

  // ✅ [수정] 독립적인 정렬 상태 관리 (기본: 이름 오름차순, 나이 없음)
  const [nameSort, setNameSort] = useState<SortDirection | null>("asc");
  const [ageSort, setAgeSort] = useState<SortDirection | null>(null);

  const isExecutive = useMemo(() => user?.role === "EXECUTIVE", [user]);
  const isCellLeader = useMemo(() => user?.role === "CELL_LEADER", [user]);

  // 1. 연도 자동 보정
  useEffect(() => {
    if (availableYears.length > 0 && filters.year) {
      if (!availableYears.includes(filters.year as number)) {
        setFilters((prev) => ({ ...prev, year: availableYears[0] }));
      }
    }
  }, [availableYears, filters.year]);

  // 2. 초기 로드 시 학기 자동 선택
  useEffect(() => {
    if (semesters.length > 0 && !hasAutoSelectedSemester) {
      const today = new Date();
      const currentYM = `${today.getFullYear()}-${String(
        today.getMonth() + 1,
      ).padStart(2, "0")}`;

      let target = semesters.find((s) => {
        const start = s.startDate.substring(0, 7);
        const end = s.endDate.substring(0, 7);
        return currentYM >= start && currentYM <= end;
      });

      if (!target) {
        // 활성 학기 중에서 가장 최신(ID가 큰) 학기 선택
        target = [...semesters].sort((a, b) => b.id - a.id)[0];
      }

      if (target) {
        setFilters((prev) => ({
          ...prev,
          semesterId: target!.id,
          year: "",
        }));
      } else {
        setUnitType("year");
        setFilters((prev) => ({
          ...prev,
          year: currentYear,
          semesterId: "",
        }));
      }
      setHasAutoSelectedSemester(true);
    }
  }, [semesters, hasAutoSelectedSemester, currentYear]);

  const effectiveDateRange = useMemo(() => {
    if (unitType === "semester" && filters.semesterId && semesters.length > 0) {
      const semester = semesters.find((s) => s.id === filters.semesterId);
      if (semester) {
        return { startDate: semester.startDate, endDate: semester.endDate };
      }
    }

    const year = typeof filters.year === "number" ? filters.year : undefined;
    if (!year) return null;

    let rawStart = `${year}-01-01`;
    let rawEnd = `${year}-12-31`;

    if (semesters.length > 0) {
      const overlappingSemesters = semesters.filter(
        (s) => s.startDate <= rawEnd && s.endDate >= rawStart,
      );
      if (overlappingSemesters.length > 0) {
        const sorted = [...overlappingSemesters].sort((a, b) =>
          a.startDate.localeCompare(b.startDate),
        );
        const firstSem = sorted[0];
        const lastSem = sorted[sorted.length - 1];
        if (rawStart < firstSem.startDate) rawStart = firstSem.startDate;
        if (rawEnd > lastSem.endDate) rawEnd = lastSem.endDate;
      }
    }
    return { startDate: rawStart, endDate: rawEnd };
  }, [filters, semesters, unitType]);

  const getCleanedParams = useCallback(() => {
    const params: GetAttendancesParams = {
      status: undefined,
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
        ([, v]) => v !== null && v !== "" && v !== undefined,
      ),
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
        matrixParams as GetAttendancesParams,
      );
      setMatrixAttendances(data.content);
    } catch (err) {
      console.error(err);
      setError("출석 기록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [getCleanedParams]);

  // ✅ [빌드 에러 방지] 사용하지 않는 함수 주석 처리
  /*
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
  */

  // 필터 변경 시 자동 조회
  useEffect(() => {
    if (semesters.length > 0 && !hasAutoSelectedSemester) return;

    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      fetchAttendances();
      // ✅ [데이터 부정확 이슈] 백엔드 로직 수정 전까지 통계 API 호출 임시 비활성화
      // fetchOverallStats();
    }
  }, [
    fetchAttendances,
    // fetchOverallStats, // ✅ 의존성 배열에서도 제거
    user,
    semesters.length,
    hasAutoSelectedSemester,
  ]);

  // 멤버 목록 로드
  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      (async () => {
        try {
          const res = await memberService.getAllMembers({ size: 1000 });
          setAllMembers(res.content);
        } catch (err) {
          console.error(err);
        }
      })();
    }
  }, [user]);

  // 연도/학기/셀 데이터 로드
  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      attendanceService
        .getAvailableYears()
        .then((data) => setAvailableYears(data.sort((a, b) => b - a)))
        .catch(() => setAvailableYears([]));

      // ✅ [수정됨] 활성화된 학기만 조회 (true 전달)
      semesterService
        .getAllSemesters(true)
        .then((data) => {
          const sorted = data.sort((a, b) =>
            b.startDate.localeCompare(a.startDate),
          );
          setSemesters(sorted);
        })
        .catch(() => setSemesters([]));

      if (user.role === "EXECUTIVE") {
        cellService
          .getAllCells({ size: 1000 })
          .then((d) => setAllCells(d.content));
      }
    }
  }, [user]);

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    if (!user) return;
    setFilters({
      member: null,
      cell:
        user.role === "CELL_LEADER" && user.cellId && user.cellName
          ? { value: user.cellId, label: user.cellName }
          : null,
      year: currentYear,
      semesterId: "" as number | "",
      includeExecutive: false,
    });
    setUnitType("year");
    setNameSort("asc");
    setAgeSort(null);
  };

  const handleUnitTypeClick = useCallback(
    (type: UnitType) => {
      setUnitType(type);
      setFilters((prev) => {
        let baseYear = typeof prev.year === "number" ? prev.year : currentYear;

        if (unitType === "semester" && prev.semesterId) {
          const currentSemester = semesters.find(
            (s) => s.id === prev.semesterId,
          );
          if (currentSemester) {
            baseYear = new Date(currentSemester.startDate).getFullYear();
          }
        }

        const next: Filters = { ...prev };
        if (type === "year") {
          next.year = baseYear || currentYear;
          next.semesterId = "";
        } else if (type === "semester") {
          next.year = "";
          if (semesters.length > 0) {
            const today = new Date();
            const currentYM = `${today.getFullYear()}-${String(
              today.getMonth() + 1,
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
    [semesters, currentYear, unitType],
  );

  const cellOptions = useMemo(
    () =>
      !isExecutive
        ? []
        : [
            { value: null, label: "전체 셀" },
            ...allCells.map((c) => ({ value: c.id, label: c.name })),
          ],
    [allCells, isExecutive],
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

  // ✅ [수정] 정렬 옵션 정의
  const nameSortOptions = [
    { value: "asc", label: "이름 오름차순" },
    { value: "desc", label: "이름 내림차순" },
  ];

  const ageSortOptions = [
    { value: "asc", label: "나이 적은순" },
    { value: "desc", label: "나이 많은순" },
  ];

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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
              <CalendarDaysIcon className="h-7 w-7 text-indigo-500" />
              출석 관리
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              기간·셀·멤버별 출석 기록을 확인하고 관리합니다.
            </p>
          </div>
        </div>

        {/* ✅ [수정됨] 종합 통계 (Stats) - 데이터 정합성 이슈로 임시 비활성화 */}
        {/* <AttendanceStats stats={overallStats} loading={statsLoading} /> */}

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <h3 className="font-bold text-gray-700 whitespace-nowrap">
              검색 및 필터
            </h3>
          </div>

          <div className="space-y-5">
            {/* 상단 조회 조건 (연도 / 학기) */}
            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 space-y-4">
              <div className="flex flex-col sm:flex-row items-start gap-4">
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
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className="w-full py-2 px-1 border border-gray-300 rounded-lg text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                      disabled={unitType === "semester"}
                    >
                      {yearOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {unitType === "semester" && (
                      <p className="absolute left-0 top-full mt-1 text-[10px] text-gray-400 whitespace-nowrap">
                        * 학기는 연도 무관
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    조회 단위
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        hasActiveSemesters && handleUnitTypeClick("semester")
                      }
                      disabled={!hasActiveSemesters}
                      className={`flex-1 sm:flex-none px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap ${
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
                      className={`flex-1 sm:flex-none px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap ${
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

              {/* ✅ [수정] 활성 학기가 없을 때 메시지 표시 추가 */}
              {unitType === "semester" && (
                <div className="pt-3 border-t border-gray-200/50 mt-3 animate-fadeIn">
                  {semesters.length === 0 ? (
                    <div className="text-xs text-yellow-800 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                      활성 학기가 없습니다.
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-bold text-gray-500">
                          학기 선택
                        </label>
                        <span className="text-[10px] text-gray-400 font-normal sm:hidden">
                          좌우로 스크롤
                        </span>
                      </div>

                      <div
                        className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap scrollbar-hide"
                        style={scrollbarHideStyle}
                      >
                        {semesters.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                semesterId: s.id,
                                year: "",
                              }))
                            }
                            className={`
                            flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm whitespace-nowrap
                            ${
                              filters.semesterId === s.id
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-1 ring-indigo-600"
                                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                            }
                          `}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                s.isActive ? "bg-green-400" : "bg-gray-300"
                              }`}
                            ></span>
                            <span>{s.name}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ✅ [수정] 4열 구조: 소속 셀 / 멤버 / 이름 정렬 / 나이 정렬 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
                          cellOptions.find((o) => o.value === value) || null,
                        )
                      }
                      placeholder="전체 셀"
                      isClearable
                    />
                  </div>
                ) : (
                  <div className="h-[46px] px-3 flex items-center w-full bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
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
                        memberOptions.find((o) => o.value === value) || null,
                      )
                    }
                    placeholder={
                      isCellLeader ? "내 셀 멤버 검색" : "전체 멤버 검색"
                    }
                    isClearable
                  />
                </div>
              </div>

              {/* ✅ 이름 정렬 (독립) */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  이름 정렬
                </label>
                <div className="h-[46px]">
                  <SimpleSearchableSelect
                    options={nameSortOptions}
                    value={nameSort}
                    onChange={(value) => setNameSort(value as SortDirection)}
                    placeholder="이름순"
                    isClearable={true}
                    isSearchable={false}
                  />
                </div>
              </div>

              {/* ✅ 나이 정렬 (독립) */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  나이 정렬
                </label>
                <div className="h-[46px]">
                  <SimpleSearchableSelect
                    options={ageSortOptions}
                    value={ageSort}
                    onChange={(value) => setAgeSort(value as SortDirection)}
                    placeholder="나이순"
                    isClearable={true}
                    isSearchable={false}
                  />
                </div>
              </div>
            </div>

            {/* 하단 옵션바 (초기화 + 임원 포함) */}
            <div className="flex items-center justify-between py-3 mt-1 border-t border-gray-50">
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-bold text-gray-400 hover:text-gray-700 underline decoration-gray-300 underline-offset-2 whitespace-nowrap transition-colors"
              >
                필터 초기화
              </button>

              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={filters.includeExecutive}
                    onChange={(e) =>
                      handleFilterChange("includeExecutive", e.target.checked)
                    }
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                {/* <span className="text-sm font-bold text-gray-500 group-hover:text-gray-800 transition-colors whitespace-nowrap">
                  임원단 포함
                </span> */}
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 text-center">
            {error}
          </div>
        )}

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
            includeExecutive={filters.includeExecutive}
            semesters={semesters}
            nameSort={nameSort}
            ageSort={ageSort}
          />
        )}
      </div>
    </div>
  );
};

export default AdminAttendancesPage;
