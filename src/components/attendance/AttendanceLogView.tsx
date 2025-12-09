// src/components/attendance/AttendanceLogView.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { attendanceService } from "../../services/attendanceService";
import { memberService } from "../../services/memberService";
import type {
  MemberDto,
  AttendanceDto,
  AttendanceStatus,
  User,
  Page,
  GetAttendancesParams,
  SemesterDto,
} from "../../types";
import { translateAttendanceStatus } from "../../utils/attendanceUtils";
import { normalizeNumberInput } from "../../utils/numberUtils";
import SimpleSearchableSelect from "../SimpleSearchableSelect";
import Pagination from "../Pagination";
import { semesterService } from "../../services/semesterService";

interface AttendanceLogViewProps {
  user: User;
}

type UnitType = "year" | "half" | "quarter" | "month" | "semester";

const AttendanceLogView: React.FC<AttendanceLogViewProps> = ({ user }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const isCellLeader = user.role === "CELL_LEADER";

  const [attendancePage, setAttendancePage] =
    useState<Page<AttendanceDto> | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const hasActiveSemesters = semesters.length > 0;

  const [filters, setFilters] = useState<{
    status: string;
    memberId: number | null;
    startDate: string;
    endDate: string;
    year: number | "";
    month: number | "";
    quarter: number | "";
    half: number | "";
    semesterId: number | "";
  }>({
    status: "all",
    memberId: null,
    startDate: "",
    endDate: "",
    // ✅ 기본값은 현재 연도, 셀장은 이 값이 고정적으로 쓰임
    year: currentYear,
    month: "",
    quarter: "",
    half: "",
    semesterId: "",
  });

  const [sort, setSort] = useState("date,desc");
  const [currentPage, setCurrentPage] = useState(0);
  const [filterType, setFilterType] = useState<"unit" | "range">("unit");
  const [unitType, setUnitType] = useState<UnitType>("year");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------
  // 멤버 조회
  // -------------------------------------------------
  const fetchCellMembers = useCallback(async () => {
    if (!user.cellId) return;
    try {
      const membersPage = await memberService.getAllMembers({
        cellId: user.cellId,
        size: 200,
        active: true,
      });
      setMembers(membersPage.content);
    } catch (err) {
      setError("셀 멤버 목록을 불러오는 데 실패했습니다.");
    }
  }, [user.cellId]);

  // -------------------------------------------------
  // 학기 목록 조회
  // -------------------------------------------------
  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("학기 목록 로딩 실패:", err);
      setSemesters([]);
    }
  }, []);

  // -------------------------------------------------
  // 출석 연도 목록 조회 (실제 데이터 기준)
  // -------------------------------------------------
  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await attendanceService.getAvailableYears();
      setAvailableYears(years);
    } catch (err) {
      console.error("출석 연도 목록 로딩 실패:", err);
      setAvailableYears([]);
    }
  }, []);

  // -------------------------------------------------
  // 출석 데이터 조회
  // -------------------------------------------------
  const fetchAttendances = useCallback(async () => {
    if (!user.cellId) return;
    setLoading(true);
    setError(null);

    const queryFilterType: "unit" | "range" = isCellLeader
      ? "unit"
      : filterType;

    let params: GetAttendancesParams = {
      cellId: user.cellId,
      page: currentPage,
      size: 10,
      sort,
      memberId: filters.memberId || undefined,
      status:
        filters.status !== "all"
          ? (filters.status as AttendanceStatus)
          : undefined,
    };

    if (queryFilterType === "range") {
      // 기간 직접 선택 모드 (임원만 사용)
      params = {
        ...params,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
    } else {
      // 단위 모드
      if (filters.semesterId && semesters.length > 0) {
        // 학기 선택 시: 학기의 시작/종료일로 조회
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          params = {
            ...params,
            startDate: semester.startDate,
            endDate: semester.endDate,
          };
        }
      } else {
        // 기존 연/월/분기/반기 방식
        const yearForRequest = isCellLeader
          ? currentYear
          : normalizeNumberInput(filters.year);

        params = {
          ...params,
          year: yearForRequest,
          month: normalizeNumberInput(filters.month),
          quarter: normalizeNumberInput(filters.quarter),
          half: normalizeNumberInput(filters.half),
        };
      }
    }

    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    );

    try {
      const data = await attendanceService.getAttendances(cleanedParams);
      setAttendancePage(data);
    } catch (err) {
      setError("출석 데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    user.cellId,
    currentPage,
    sort,
    filters.memberId,
    filters.status,
    filters.startDate,
    filters.endDate,
    filters.year,
    filters.month,
    filters.quarter,
    filters.half,
    filters.semesterId,
    filterType,
    isCellLeader,
    semesters,
    currentYear,
  ]);

  useEffect(() => {
    fetchCellMembers();
  }, [fetchCellMembers]);

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  useEffect(() => {
    fetchAvailableYears();
  }, [fetchAvailableYears]);

  useEffect(() => {
    fetchAttendances();
  }, [fetchAttendances]);

  // -------------------------------------------------
  // 옵션/필터 관련
  // -------------------------------------------------
  const yearOptions = useMemo(() => {
    // ✅ 셀장은 현재 연도만 선택 가능 (UI/파라미터 모두)
    if (isCellLeader) {
      return [{ value: currentYear, label: `${currentYear}년` }];
    }

    // EXECUTIVE 등: 실제 존재하는 연도 목록 우선 사용
    if (availableYears.length > 0) {
      return [
        { value: "", label: "전체 연도" },
        ...availableYears.map((year) => ({
          value: year,
          label: `${year}년`,
        })),
      ];
    }

    // fallback: 현재 연도만
    const cy = new Date().getFullYear();
    return [
      { value: "", label: "전체 연도" },
      { value: cy, label: `${cy}년` },
    ];
  }, [availableYears, isCellLeader, currentYear]);

  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.id, label: m.name })),
    [members]
  );

  const handleSort = (key: string) => {
    const [currentKey, currentDir] = sort.split(",");
    let newDir = "desc";
    if (key === currentKey && currentDir === "desc") newDir = "asc";
    setSort(`${key},${newDir}`);
    setCurrentPage(0);
  };

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  // 조회 단위 버튼(연간/반기/분기/월간/학기) 클릭
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const next = { ...prev };
      const now = new Date();
      const cy = now.getFullYear();
      const cm = now.getMonth() + 1;

      if (type === "year") {
        next.year = cy;
        next.month = "";
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "half") {
        next.year = cy;
        next.half = (next.half as number) || 1;
        next.month = "";
        next.quarter = "";
        next.semesterId = "";
      } else if (type === "quarter") {
        next.year = cy;
        next.quarter = (next.quarter as number) || 1;
        next.month = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = cy;
        next.month = (next.month as number) || cm;
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "semester") {
        // 학기 모드에서는 연/월/분기/반기 초기화
        next.year = "";
        next.month = "";
        next.quarter = "";
        next.half = "";
        // semesterId는 아래에서 선택
      }

      return next;
    });
    setCurrentPage(0);
  };

  // 월/분기/반기 값 버튼 클릭
  const handleUnitValueClick = (
    unit: "month" | "quarter" | "half",
    value: number
  ) => {
    setFilters((prev) => ({
      ...prev,
      month: unit === "month" ? value : "",
      quarter: unit === "quarter" ? value : "",
      half: unit === "half" ? value : "",
      semesterId: "", // 다른 단위를 선택하면 학기 선택 해제
    }));
    setCurrentPage(0);
  };

  // 학기 버튼 클릭
  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({
      ...prev,
      semesterId,
      year: "",
      month: "",
      quarter: "",
      half: "",
    }));
    setCurrentPage(0);
  };

  const renderSortIndicator = (key: string) => {
    const [currentKey, currentDir] = sort.split(",");
    const isActive = key === currentKey;
    const baseClass = "ml-1 text-xs";

    if (!isActive)
      return <span className={`${baseClass} text-gray-300`}>↕</span>;
    return (
      <span className={`${baseClass} text-indigo-500`}>
        {currentDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-6 gap-2">
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
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => i + 1).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleUnitValueClick("quarter", q)}
                className={`px-2 py-1 border rounded-full text-sm ${
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
                className={`px-2 py-1 border rounded-full text-sm ${
                  filters.half === h ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {h === 1 ? "상반기" : "하반기"}
              </button>
            ))}
          </div>
        );
      case "semester":
        if (!hasActiveSemesters) {
          return (
            <div className="mt-3 rounded-md border border-dashed border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">
              <p className="font-semibold mb-1">학기 단위 조회 불가</p>
              <p className="mb-1">
                현재 <span className="font-semibold">활성 상태인 학기</span>가
                없습니다.
              </p>
              <p>
                학기 관리 메뉴에서 학기를 생성하고{" "}
                <span className="font-semibold">‘활성’ 상태로 변경</span>한 뒤,
                다시 시도해 주세요.
              </p>
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
                className={`px-3 py-1 border rounded-full text-sm ${
                  filters.semesterId === s.id
                    ? "bg-blue-500 text-white border-blue-500"
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

  const pageStats = useMemo(() => {
    if (!attendancePage) return null;
    const presentCount = attendancePage.content.filter(
      (a) => a.status === "PRESENT"
    ).length;
    const totalOnPage = attendancePage.content.length;
    const attendanceRate =
      totalOnPage > 0 ? Math.round((presentCount / totalOnPage) * 100) : 0;
    return {
      totalRecords: attendancePage.totalElements,
      attendanceRate,
    };
  }, [attendancePage]);

  // UI용 필터 타입
  const uiFilterType: "unit" | "range" = isCellLeader ? "unit" : filterType;

  // 출석률 카드 라벨
  const getAttendanceRateLabel = () => {
    if (uiFilterType === "range") {
      if (filters.startDate && filters.endDate) {
        return `출석률 (${filters.startDate} ~ ${filters.endDate})`;
      }
      return "출석률 (선택 기간)";
    }

    // 단위 기반
    if (unitType === "semester" && filters.semesterId && semesters.length > 0) {
      const sem = semesters.find((s) => s.id === filters.semesterId);
      if (sem) {
        return `출석률 (${sem.name})`;
      }
    }

    const year = filters.year || currentYear;

    switch (unitType) {
      case "year":
        return `출석률 (${year}년 연간)`;
      case "half": {
        const half = filters.half || 1;
        const halfLabel = Number(half) === 1 ? "상반기" : "하반기";
        return `출석률 (${year}년 ${halfLabel})`;
      }
      case "quarter": {
        const quarter = filters.quarter || 1;
        return `출석률 (${year}년 ${quarter}분기)`;
      }
      case "month": {
        const month = filters.month || currentMonth;
        return `출석률 (${year}년 ${month}월)`;
      }
      default:
        return "출석률";
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
          {error}
        </div>
      )}

      {/* 필터 영역 */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">조회 기간 설정</h3>

          {/* 셀장은 기간/단위 토글 숨김, 항상 단위 조회만 사용 */}
          {!isCellLeader && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setFilterType("unit")}
                className={`px-3 py-1 text-sm rounded-full ${
                  filterType === "unit"
                    ? "bg-blue-500 text-white"
                    : "bg-white border"
                }`}
              >
                단위로 조회
              </button>
            </div>
          )}
        </div>

        {uiFilterType === "range" && !isCellLeader ? (
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
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
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
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
              />
            </div>
          </div>
        ) : (
          // 단위 기반 조회
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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
                  // ✅ 학기 모드이거나 셀장인 경우 연도 선택 비활성화
                  disabled={isCellLeader || unitType === "semester"}
                >
                  {yearOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {isCellLeader && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    셀장은 현재 연도의 출석 기록만 조회할 수 있습니다.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  조회 단위
                </label>
                <div>
                  <div className="flex items-center space-x-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handleUnitTypeClick("year")}
                      className={`px-3 py-1 text-sm rounded-full ${
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
                      className={`px-3 py-1 text-sm rounded-full ${
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
                      className={`px-3 py-1 text-sm rounded-full ${
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
                      className={`px-3 py-1 text-sm rounded-full ${
                        unitType === "month"
                          ? "bg-blue-500 text-white"
                          : "bg-white border"
                      }`}
                    >
                      월간
                    </button>
                    {/* 학기 버튼 (활성 학기 없으면 비활성) */}
                    <button
                      type="button"
                      onClick={() =>
                        hasActiveSemesters && handleUnitTypeClick("semester")
                      }
                      disabled={!hasActiveSemesters}
                      className={`px-3 py-1 text-sm rounded-full border ${
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
            </div>
            {renderUnitButtons()}
          </div>
        )}

        <hr />
        {/* 멤버/상태 필터 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              셀원
            </label>
            <div className="mt-1">
              <SimpleSearchableSelect
                options={memberOptions}
                value={filters.memberId ?? undefined}
                onChange={(val) =>
                  handleFilterChange("memberId", val === undefined ? null : val)
                }
                placeholder="모든 셀원"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="logStatusFilter"
              className="block text-sm font-medium text-gray-700"
            >
              상태
            </label>
            <select
              id="logStatusFilter"
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
            >
              <option value="all">모든 상태</option>
              <option value="PRESENT">출석</option>
              <option value="ABSENT">결석</option>
            </select>
          </div>
        </div>
      </div>

      {/* 리스트 + 통계 */}
      {loading && (
        <div className="text-center p-8">출석 기록을 불러오는 중...</div>
      )}

      {!loading && attendancePage && (
        <>
          {pageStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-600">총 기록</p>
                <p className="text-2xl font-bold text-blue-800">
                  {pageStats.totalRecords}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-600">
                  {getAttendanceRateLabel()}
                </p>
                <p className="text-2xl font-bold text-green-800">
                  {pageStats.attendanceRate}%
                </p>
              </div>
            </div>
          )}

          <div className="bg-white shadow-md rounded-lg overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort("member.name")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    이름{renderSortIndicator("member.name")}
                  </th>
                  <th
                    onClick={() => handleSort("date")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    날짜{renderSortIndicator("date")}
                  </th>
                  <th
                    onClick={() => handleSort("status")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    상태{renderSortIndicator("status")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    메모
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendancePage.content.map((att) => (
                  <tr key={att.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                      {att.member.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {att.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          att.status === "PRESENT"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {translateAttendanceStatus(att.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {att.memo || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendancePage.content.length === 0 && (
              <div className="text-center p-8">
                해당 조건의 출석 기록이 없습니다.
              </div>
            )}
          </div>

          <Pagination
            currentPage={attendancePage.number}
            totalPages={attendancePage.totalPages}
            totalElements={attendancePage.totalElements}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};

export default AttendanceLogView;
