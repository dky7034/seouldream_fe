import React, { useEffect, useState, useCallback, useMemo } from "react";
import { reportService } from "../services/reportService";
import type {
  IncompleteCheckReportDto,
  GetAttendancesParams,
  SemesterDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import { FaFileAlt } from "react-icons/fa";
import { memberService } from "../services/memberService";
import { formatDisplayName } from "../utils/memberUtils";
import { semesterService } from "../services/semesterService";

type FilterType = "unit" | "range";
type UnitType = "year" | "half" | "quarter" | "month" | "semester";

const AdminIncompleteChecksReportPage: React.FC = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<IncompleteCheckReportDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // 동명이인 판별용 전체 멤버
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  // 실제 학기 목록
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    year: "" as number | "",
    month: "" as number | "",
    quarter: "" as number | "",
    half: "" as number | "",
    semesterId: "" as number | "",
  });
  const [filterType, setFilterType] = useState<FilterType>("unit");
  const [unitType, setUnitType] = useState<UnitType>("year");

  const yearOptions = useMemo(
    () =>
      availableYears.length === 0
        ? (() => {
            const cy = new Date().getFullYear();
            return [
              { value: "", label: "전체 연도" },
              { value: cy, label: `${cy}년` },
            ];
          })()
        : [
            { value: "", label: "전체 연도" },
            ...availableYears.map((year) => ({
              value: year,
              label: `${year}년`,
            })),
          ],
    [availableYears]
  );

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  // YYYY-MM-DD -> MM/DD 변환
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [, month, day] = dateStr.split("-");
    return `${month}/${day}`;
  };

  // 필터 상태 기반 기간 요약
  const periodSummary = useMemo(() => {
    if (filterType === "range" && filters.startDate && filters.endDate) {
      return `기간: ${formatShortDate(filters.startDate)} ~ ${formatShortDate(
        filters.endDate
      )}`;
    }

    if (filterType === "unit") {
      // 학기
      if (unitType === "semester" && filters.semesterId && semesters.length) {
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          return `조회 단위: 학기 (${semester.name})`;
        }
      }

      const yearText = filters.year ? `${filters.year}년` : "전체 연도";
      if (unitType === "year") return `조회 단위: 연간 (${yearText})`;
      if (unitType === "half" && filters.half)
        return `조회 단위: ${yearText} ${
          filters.half === 1 ? "상반기" : "하반기"
        }`;
      if (unitType === "quarter" && filters.quarter)
        return `조회 단위: ${yearText} ${filters.quarter}분기`;
      if (unitType === "month" && filters.month)
        return `조회 단위: ${yearText} ${filters.month}월`;
    }

    return "";
  }, [filterType, unitType, filters, semesters]);

  /**
   * 상단 조회 단위 버튼 클릭 (연간/반기/분기/월간/학기)
   */
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const currentYear =
        prev.year && typeof prev.year === "number"
          ? (prev.year as number)
          : new Date().getFullYear();

      const next = { ...prev };

      if (type === "year") {
        next.year = currentYear;
        next.month = "";
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "half") {
        next.year = currentYear;
        next.half = (next.half as number) || 1;
        next.month = "";
        next.quarter = "";
        next.semesterId = "";
      } else if (type === "quarter") {
        next.year = currentYear;
        next.quarter = (next.quarter as number) || 1;
        next.month = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = currentYear;
        next.month = (next.month as number) || new Date().getMonth() + 1;
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "semester") {
        next.year = "";
        next.month = "";
        next.quarter = "";
        next.half = "";
        // semesterId는 선택 유지 가능
      }

      return next;
    });
  };

  /**
   * 월/분기/반기 세부 값 버튼
   */
  const handleUnitValueChange = (
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
        semesterId: "", // 다른 단위 선택 시 학기 해제
      };
    });
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
                onClick={() => handleUnitValueChange("month", m)}
                className={`px-2 py-1 border rounded-full text-xs sm:text-sm ${
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
                onClick={() => handleUnitValueChange("quarter", q)}
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
            {Array.from({ length: 2 }, (_, i) => i + 1).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleUnitValueChange("half", h)}
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
            <div className="mt-3 rounded-md bg-yellow-50 p-3 text-[11px] sm:text-xs text-yellow-800">
              현재 활성 상태인 학기가 없습니다. 리포트에서 학기 선택을
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

  const fetchIncompleteChecks = useCallback(
    async (opts?: { skipLoading?: boolean }) => {
      if (!user || user.role !== "EXECUTIVE") {
        setLoading(false);
        setError("접근 권한이 없습니다.");
        return;
      }

      if (!opts?.skipLoading) {
        setLoading(true);
      }
      setError(null);

      let params: GetAttendancesParams = {};

      if (filterType === "range") {
        params = {
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        };
      } else {
        if (filters.semesterId && semesters.length > 0) {
          // 학기 선택 시 학기 기간 사용
          const semester = semesters.find((s) => s.id === filters.semesterId);
          if (semester) {
            params = {
              startDate: semester.startDate,
              endDate: semester.endDate,
            };
          }
        } else {
          // 기존 연/월/분기/반기
          params = {
            year: normalizeNumberInput(filters.year),
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
        const data = await reportService.getIncompleteCheckReport(
          cleanedParams
        );
        setReport(data);
      } catch (err: any) {
        console.error("Failed to fetch incomplete checks report:", err);
        setError(
          err?.response?.data?.message ||
            "출석 누락 현황 정보를 불러오는 데 실패했습니다."
        );
      } finally {
        if (!opts?.skipLoading) {
          setLoading(false);
        }
      }
    },
    [user, filters, filterType, semesters]
  );

  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await reportService.getAvailableYearsForReports();
      setAvailableYears(years);
    } catch (err) {
      console.error("Failed to fetch available years for reports:", err);
      setAvailableYears([]);
    }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("Failed to fetch semesters for reports:", err);
      setSemesters([]);
    }
  }, []);

  // 필터/단위 변경 시 리포트 재조회
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    fetchIncompleteChecks();
  }, [user, fetchIncompleteChecks]);

  // 연도/학기 목록 로딩
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    fetchAvailableYears();
    fetchSemesters();
  }, [user, fetchAvailableYears, fetchSemesters]);

  // 동명이인 판별용 멤버 목록
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;

    const fetchAllMembersForNameCheck = async () => {
      try {
        const page = await memberService.getAllMembers({
          page: 0,
          size: 1000,
          sort: "id,asc",
        });

        const list =
          page?.content?.map((m) => ({
            id: m.id,
            name: m.name,
            birthDate: m.birthDate,
          })) ?? [];

        setAllMembersForNameCheck(list);
      } catch (e) {
        console.error("동명이인 판별용 멤버 목록 로딩 실패:", e);
        setAllMembersForNameCheck([]);
      }
    };

    fetchAllMembersForNameCheck();
  }, [user]);

  // 권한 없음
  if (!user || user.role !== "EXECUTIVE") {
    return (
      <div className="bg-gray-50 min-h-screen flex justify-center items-center px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <p className="mt-1 text-red-600 text-sm sm:text-base">
            이 페이지에 접근할 권한이 없습니다.
          </p>
        </div>
      </div>
    );
  }

  // 로딩
  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-indigo-500" />
          <p className="text-xs sm:text-sm text-gray-500">
            리포트 정보를 불러오는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md w-full text-center">
          <p className="text-red-700 mb-3 text-sm sm:text-base">{error}</p>
          <button
            type="button"
            onClick={() => fetchIncompleteChecks({ skipLoading: false })}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              출석 누락 현황
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              지정된 기간 동안 출석 체크를 완료하지 않은 셀장 및 날짜 정보를
              확인할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 필터 영역 */}
        <div className="p-4 bg-gray-50 rounded-lg mb-4 sm:mb-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h3 className="text-base sm:text-lg font-semibold">기간 설정</h3>
            <div className="flex flex-wrap items-center gap-2">
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
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value)
                  }
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
                    <p className="mt-1 text-[11px] text-red-500">
                      활성화된 학기가 없어 학기 단위 조회를 사용할 수 없습니다.
                    </p>
                  )}
                </div>
              </div>

              {/* 월/분기/반기/학기 세부 버튼 */}
              {renderUnitButtons()}
            </div>
          )}
        </div>

        {/* 기간 요약 & 리포트 요약 */}
        {(periodSummary || report.length > 0) && (
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
            <div>{periodSummary}</div>
            <div>
              총{" "}
              <span className="font-semibold text-gray-800">
                {report.length}
              </span>
              명의 셀장이 출석 체크를 누락했습니다.
            </div>
          </div>
        )}

        {/* 결과 영역 */}
        {report.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
            <FaFileAlt className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-3" />
            <p className="text-base sm:text-lg font-semibold">
              조건에 맞는 미완료 출석 체크가 없습니다.
            </p>
            <p className="mt-1 text-xs sm:text-sm">
              기간 또는 단위를 조정해 다시 조회해 보세요.
            </p>
          </div>
        ) : (
          <>
            {/* 🔹 모바일: 카드 리스트 */}
            <div className="md:hidden space-y-3 mb-4">
              {report.map((item) => {
                const leaderMember = allMembersForNameCheck.find(
                  (m) => m.id === item.leaderId
                );
                const displayName = leaderMember
                  ? formatDisplayName(leaderMember, allMembersForNameCheck)
                  : item.leaderName;

                const badgeClass =
                  item.missedDatesCount >= 5
                    ? "bg-red-100 text-red-700"
                    : item.missedDatesCount >= 2
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-700";

                return (
                  <div
                    key={item.leaderId}
                    className="bg-white rounded-lg shadow border border-gray-100 p-4 text-xs space-y-2"
                  >
                    {/* 상단: 셀장 / 셀 이름 */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {displayName}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          셀:{" "}
                          <span className="font-medium text-gray-700">
                            {item.cellName}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${badgeClass}`}
                      >
                        {item.missedDatesCount}회 누락
                      </span>
                    </div>

                    {/* 하단: 날짜 리스트 */}
                    <div className="pt-1 border-t border-gray-100 mt-2">
                      <p className="text-[11px] text-gray-500 mb-1">
                        미완료 날짜
                      </p>
                      <div className="max-h-32 overflow-y-auto pr-1">
                        <ul className="space-y-1">
                          {item.missedDates.map((date, index) => (
                            <li
                              key={`${date}-${index}`}
                              className="flex items-center text-[11px] text-gray-700"
                            >
                              <span className="mr-1 text-gray-400">•</span>
                              <span>{formatShortDate(date)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🔹 데스크탑: 테이블 */}
            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        셀장 이름
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        셀 이름
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        미완료 횟수
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        미완료 날짜
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.map((item) => (
                      <tr key={item.leaderId}>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {(() => {
                            const leaderMember = allMembersForNameCheck.find(
                              (m) => m.id === item.leaderId
                            );
                            return leaderMember
                              ? formatDisplayName(
                                  leaderMember,
                                  allMembersForNameCheck
                                )
                              : item.leaderName;
                          })()}
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                          {item.cellName}
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm">
                          <span
                            className={`
                              inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold
                              ${
                                item.missedDatesCount >= 5
                                  ? "bg-red-100 text-red-700"
                                  : item.missedDatesCount >= 2
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-700"
                              }
                            `}
                          >
                            {item.missedDatesCount}회
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 align-top text-xs sm:text-sm text-gray-700">
                          <div className="max-h-32 overflow-y-auto pr-1">
                            <ul className="space-y-1">
                              {item.missedDates.map((date, index) => (
                                <li
                                  key={`${date}-${index}`}
                                  className="flex items-center text-[11px] sm:text-xs text-gray-700"
                                >
                                  <span className="mr-1 text-gray-400">•</span>
                                  <span>{formatShortDate(date)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminIncompleteChecksReportPage;
