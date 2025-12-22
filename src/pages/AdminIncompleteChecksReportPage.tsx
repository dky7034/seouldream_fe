// src/pages/AdminIncompleteChecksReportPage.tsx
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
import KoreanCalendarPicker from "../components/KoreanCalendarPicker"; // ✅ 달력 컴포넌트 임포트

type FilterType = "unit" | "range";
type UnitType = "year" | "month" | "semester";

type Filters = {
  startDate: string;
  endDate: string;
  year: number | "";
  month: number | "";
  semesterId: number | "";
};

const AdminIncompleteChecksReportPage: React.FC = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<IncompleteCheckReportDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;
  const [hasAutoSelectedSemester, setHasAutoSelectedSemester] = useState(false);

  // ✅ 초기값 비워져 있음 ("")
  const [filters, setFilters] = useState<Filters>({
    startDate: "",
    endDate: "",
    year: "" as number | "",
    month: "" as number | "",
    semesterId: "" as number | "",
  });
  const [filterType, setFilterType] = useState<FilterType>("unit");
  const [unitType, setUnitType] = useState<UnitType>("semester");

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

  const handleFilterChange = (field: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [, month, day] = dateStr.split("-");
    return `${month}/${day}`;
  };

  const periodSummary = useMemo(() => {
    if (filterType === "range" && filters.startDate && filters.endDate) {
      return `기간: ${formatShortDate(filters.startDate)} ~ ${formatShortDate(
        filters.endDate
      )}`;
    }

    if (filterType === "unit") {
      if (unitType === "semester" && filters.semesterId && semesters.length) {
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          return `조회 단위: 학기 (${semester.name})`;
        }
      }

      const yearText = filters.year ? `${filters.year}년` : "전체 연도";

      if (unitType === "year") return `조회 단위: ${yearText} (학기 기간만)`;
      if (unitType === "month" && filters.month)
        return `조회 단위: ${yearText} ${filters.month}월 (학기 기간만)`;
    }

    return "";
  }, [filterType, unitType, filters, semesters]);

  useEffect(() => {
    if (semesters.length > 0 && !hasAutoSelectedSemester) {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`;

      let targetSemester = semesters.find((s) => {
        const startYearMonth = s.startDate.substring(0, 7);
        const endYearMonth = s.endDate.substring(0, 7);
        return (
          currentYearMonth >= startYearMonth && currentYearMonth <= endYearMonth
        );
      });

      if (!targetSemester) {
        const sorted = [...semesters].sort((a, b) => b.id - a.id);
        targetSemester = sorted[0];
      }

      if (targetSemester) {
        setFilters((prev) => ({
          ...prev,
          semesterId: targetSemester!.id,
          year: "",
          month: "",
        }));
      } else {
        setUnitType("month");
        setFilters((prev) => ({
          ...prev,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          semesterId: "",
        }));
      }
      setHasAutoSelectedSemester(true);
    }
  }, [semesters, hasAutoSelectedSemester]);

  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const currentYear =
        typeof prev.year === "number" ? prev.year : new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const next: Filters = { ...prev };

      if (type === "year") {
        next.year = currentYear;
        next.month = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = currentYear;
        next.month = (next.month as number) || currentMonth;
        next.semesterId = "";
      } else if (type === "semester") {
        next.year = "";
        next.month = "";
        if (semesters.length > 0) {
          const now = new Date();
          const currentYearMonth = `${now.getFullYear()}-${String(
            now.getMonth() + 1
          ).padStart(2, "0")}`;

          let target = semesters.find((s) => {
            const start = s.startDate.substring(0, 7);
            const end = s.endDate.substring(0, 7);
            return currentYearMonth >= start && currentYearMonth <= end;
          });

          if (!target) {
            const sorted = [...semesters].sort((a, b) => b.id - a.id);
            target = sorted[0];
          }
          if (target) next.semesterId = target.id;
        }
      }
      return next;
    });
  };

  const handleUnitValueChange = (value: number) => {
    setFilters((prev) => {
      const cy = new Date().getFullYear();
      const baseYear = prev.year || cy;
      return {
        ...prev,
        year: baseYear,
        month: value,
        semesterId: "",
      };
    });
  };

  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({
      ...prev,
      semesterId,
      year: "",
      month: "",
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
                onClick={() => handleUnitValueChange(m)}
                className={`px-2 py-1 border rounded-full text-xs sm:text-sm ${
                  filters.month === m ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {m}월
              </button>
            ))}
          </div>
        );
      case "semester":
        if (semesters.length === 0) {
          return (
            <div className="mt-3 rounded-md bg-yellow-50 p-3 text-[11px] sm:text-xs text-yellow-800">
              현재 활성 상태인 학기가 없습니다.
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

      if (!opts?.skipLoading) setLoading(true);
      setError(null);

      let params: GetAttendancesParams = {};

      if (filterType === "range") {
        params = {
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        };
      } else {
        if (filters.semesterId && semesters.length > 0) {
          const semester = semesters.find((s) => s.id === filters.semesterId);
          if (semester) {
            params = {
              startDate: semester.startDate,
              endDate: semester.endDate,
            };
          }
        } else {
          const yearVal = normalizeNumberInput(filters.year);
          const monthVal = normalizeNumberInput(filters.month);

          if (!yearVal) {
            setLoading(false);
            setReport([]);
            return;
          }

          let rangeStart = "";
          let rangeEnd = "";

          if (monthVal) {
            const startD = new Date(yearVal, monthVal - 1, 1);
            const endD = new Date(yearVal, monthVal, 0);
            const pad = (n: number) => String(n).padStart(2, "0");
            rangeStart = `${startD.getFullYear()}-${pad(
              startD.getMonth() + 1
            )}-${pad(startD.getDate())}`;
            rangeEnd = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(
              endD.getDate()
            )}`;
          } else {
            rangeStart = `${yearVal}-01-01`;
            rangeEnd = `${yearVal}-12-31`;
          }

          const overlappingSemesters = semesters.filter(
            (s) => s.startDate <= rangeEnd && s.endDate >= rangeStart
          );

          if (overlappingSemesters.length === 0) {
            setReport([]);
            if (!opts?.skipLoading) setLoading(false);
            return;
          }

          const semestersMinStart = overlappingSemesters.reduce(
            (min, s) => (s.startDate < min ? s.startDate : min),
            overlappingSemesters[0].startDate
          );
          const semestersMaxEnd = overlappingSemesters.reduce(
            (max, s) => (s.endDate > max ? s.endDate : max),
            overlappingSemesters[0].endDate
          );

          const finalStart =
            rangeStart > semestersMinStart ? rangeStart : semestersMinStart;
          const finalEnd =
            rangeEnd < semestersMaxEnd ? rangeEnd : semestersMaxEnd;

          params = {
            startDate: finalStart,
            endDate: finalEnd,
          };
        }
      }

      const cleanedParams = Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== null && v !== "" && v !== undefined
        )
      );

      if (Object.keys(cleanedParams).length === 0) {
        setReport([]);
        if (!opts?.skipLoading) setLoading(false);
        return;
      }

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

  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    if (semesters.length > 0 || hasActiveSemesters === false) {
      fetchIncompleteChecks();
    }
  }, [user, fetchIncompleteChecks, semesters.length, hasActiveSemesters]);

  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    fetchAvailableYears();
    fetchSemesters();
  }, [user, fetchAvailableYears, fetchSemesters]);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기간 시작
                </label>
                {/* ✅ KoreanCalendarPicker 적용 */}
                <KoreanCalendarPicker
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange("startDate", date)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기간 종료
                </label>
                {/* ✅ KoreanCalendarPicker 적용 */}
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
                      학기 단위 조회 시 학기별 연도가 자동 적용됩니다.
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
                    <p className="mt-1 text-[11px] text-red-500">
                      활성화된 학기가 없어 학기 단위 조회를 사용할 수 없습니다.
                    </p>
                  )}
                </div>
              </div>

              {renderUnitButtons()}
            </div>
          )}
        </div>

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
            {/* Mobile View */}
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

            {/* Desktop View */}
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
