// src/components/attendance/AttendanceStatisticsView.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { attendanceService } from "../../services/attendanceService";
import { semesterService } from "../../services/semesterService";
import type { SimpleAttendanceRateDto, User, SemesterDto } from "../../types";

interface AttendanceStatisticsViewProps {
  user: User;
}

type UnitType = "year" | "half" | "quarter" | "month" | "semester";

const AttendanceStatisticsView: React.FC<AttendanceStatisticsViewProps> = ({
  user,
}) => {
  const isCellLeader = user.role === "CELL_LEADER";
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [stats, setStats] = useState<SimpleAttendanceRateDto[]>([]);

  const [filters, setFilters] = useState(() => ({
    startDate: "",
    endDate: "",
    // ✅ 셀장은 처음부터 현재 연도로 고정
    year: (isCellLeader ? currentYear : "") as number | "",
    month: "" as number | "",
    quarter: "" as number | "",
    half: "" as number | "",
    semesterId: "" as number | "",
  }));

  const [filterType, setFilterType] = useState<"unit" | "range">("unit");
  const [unitType, setUnitType] = useState<UnitType>("year");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ 셀장은 항상 단위 기반 조회만 사용
  const effectiveFilterType: "unit" | "range" = isCellLeader
    ? "unit"
    : filterType;

  // ✅ 실제 출석 데이터가 있는 연도 목록
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // ✅ 실제 존재하는 학기 목록 (활성 학기만)
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;

  // -------------------------------------------------
  // 파라미터 구성
  //  - 학기 선택 시: 해당 학기의 startDate / endDate 우선 사용
  //  - range 모드: startDate / endDate 그대로 사용
  //  - unit 모드: year / month / quarter / half 사용
  //  - 셀장은 year를 항상 currentYear로 강제
  // -------------------------------------------------
  const getCleanedParams = useCallback(() => {
    let params: any = {};
    const typeForParam: "unit" | "range" = isCellLeader ? "unit" : filterType;

    // 1) 학기 선택이 되어 있다면: 학기 기간 기준으로 조회
    if (filters.semesterId && semesters.length > 0) {
      const semester = semesters.find((s) => s.id === filters.semesterId);
      if (semester) {
        params.startDate = semester.startDate;
        params.endDate = semester.endDate;
        return params;
      }
    }

    // 2) 기간 직접 선택 모드 (임원만)
    if (typeForParam === "range") {
      params = {
        ...params,
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    } else {
      // 3) 단위 기반 모드 (연/반기/분기/월)
      const yearForRequest = isCellLeader ? currentYear : filters.year;

      params = {
        ...params,
        year: yearForRequest,
        month: filters.month,
        quarter: filters.quarter,
        half: filters.half,
      };
    }

    return Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    );
  }, [filters, filterType, isCellLeader, semesters, currentYear]);

  // -------------------------------------------------
  // 통계 조회
  // -------------------------------------------------
  const fetchMemberStats = useCallback(async () => {
    if (!user.cellId) return;
    setLoading(true);
    setError(null);
    try {
      const params = getCleanedParams();
      const data = await attendanceService.getMemberAttendanceRate(
        user.cellId,
        params
      );
      setStats(data);
    } catch (err) {
      console.error("출석 통계 로딩 실패:", err);
      setError("출석 통계 데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user.cellId, getCleanedParams]);

  useEffect(() => {
    fetchMemberStats();
  }, [fetchMemberStats]);

  // -------------------------------------------------
  // 사용 가능한 연도 목록 조회 (실제 데이터 기준)
  //  - 셀장은 availableYears 상관없이 현재 연도만 사용
  // -------------------------------------------------
  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        const years = await attendanceService.getAvailableYears();
        setAvailableYears(years || []);
      } catch (err) {
        console.error("출석 연도 목록 로딩 실패:", err);
        setAvailableYears([]);
      }
    };

    // EXECUTIVE / 다른 역할일 때만 의미가 큼
    fetchAvailableYears();
  }, []);

  // -------------------------------------------------
  // 학기 목록 조회 (활성 학기 기준)
  // -------------------------------------------------
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const data = await semesterService.getAllSemesters(true);
        setSemesters(data || []);
      } catch (err) {
        console.error("학기 목록 로딩 실패:", err);
        setSemesters([]);
      }
    };

    fetchSemesters();
  }, []);

  // -------------------------------------------------
  // 필터/단위 관련
  // -------------------------------------------------
  const yearOptions = useMemo(() => {
    // ✅ 셀장은 현재 연도만 선택 가능
    if (isCellLeader) {
      return [{ value: currentYear, label: `${currentYear}년` }];
    }

    if (availableYears.length > 0) {
      const options = availableYears.map((year) => ({
        value: year,
        label: `${year}년`,
      }));
      return [{ value: "", label: "전체 연도" }, ...options];
    }

    const cy = new Date().getFullYear();
    return [
      { value: "", label: "전체 연도" },
      { value: cy, label: `${cy}년` },
    ];
  }, [availableYears, isCellLeader, currentYear]);

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const next = { ...prev };

      if (type === "year") {
        next.year = isCellLeader ? currentYear : next.year || currentYear;
        next.month = "";
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "half") {
        next.year = isCellLeader ? currentYear : next.year || currentYear;
        next.half = (next.half as number) || 1;
        next.month = "";
        next.quarter = "";
        next.semesterId = "";
      } else if (type === "quarter") {
        next.year = isCellLeader ? currentYear : next.year || currentYear;
        next.quarter = (next.quarter as number) || 1;
        next.month = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = isCellLeader ? currentYear : next.year || currentYear;
        next.month = (next.month as number) || currentMonth;
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "semester") {
        // 학기 단위: 연도/월/분기/반기는 의미 없음
        next.year = "";
        next.month = "";
        next.quarter = "";
        next.half = "";
        // semesterId는 사용자가 버튼으로 선택
      }

      return next;
    });
  };

  const handleUnitValueClick = (
    unit: "month" | "quarter" | "half",
    value: number
  ) => {
    setFilters((prev) => ({
      ...prev,
      month: unit === "month" ? value : "",
      quarter: unit === "quarter" ? value : "",
      half: unit === "half" ? value : "",
      semesterId: "",
    }));
  };

  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({
      ...prev,
      semesterId,
      year: "",
      month: "",
      quarter: "",
      half: "",
    }));
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
            <div className="mt-4 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
              현재 활성 상태인 학기가 없습니다. 학기 단위 통계를 사용하려면 최소
              1개 이상의 학기를 활성화해 주세요.
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {semesters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSemesterClick(s.id)}
                className={`px-2 py-1 border rounded-full text-sm ${
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
              <button
                type="button"
                onClick={() => setFilterType("range")}
                className={`px-3 py-1 text-sm rounded-full ${
                  filterType === "range"
                    ? "bg-blue-500 text-white"
                    : "bg-white border"
                }`}
              >
                기간으로 조회
              </button>
            </div>
          )}
        </div>

        {effectiveFilterType === "range" && !isCellLeader ? (
          // 셀장에게는 이 블록이 렌더되지 않음
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
          // 셀장은 항상 이쪽(단위 기반)만 사용
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
                    셀장은 현재 연도의 통계만 조회할 수 있습니다.
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
            {renderUnitButtons()}
          </div>
        )}
      </div>

      {/* 통계 테이블 */}
      {loading && (
        <div className="text-center p-8">통계 정보를 불러오는 중...</div>
      )}
      {!loading && (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  출석률
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  출석
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  결석
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  전체
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.map((s) => (
                <tr key={s.targetId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {s.targetName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {s.attendanceRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    {s.presentCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    {s.absentCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {s.totalDays}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.length === 0 && (
            <div className="text-center p-8">
              해당 조건의 통계 정보가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceStatisticsView;
