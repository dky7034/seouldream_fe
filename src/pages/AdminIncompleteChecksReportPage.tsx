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
import { memberService } from "../services/memberService";
import { formatDisplayName } from "../utils/memberUtils";
import { semesterService } from "../services/semesterService";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import { useNavigate } from "react-router-dom";
import {
  ExclamationCircleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";

type FilterType = "unit" | "range";
type UnitType = "year" | "month" | "semester";

type Filters = {
  startDate: string;
  endDate: string;
  year: number | "";
  month: number | "";
  semesterId: number | "";
};

// 스크롤바 숨김 스타일
const scrollbarHideStyle: React.CSSProperties = {
  msOverflowStyle: "none" /* IE and Edge */,
  scrollbarWidth: "none" /* Firefox */,
};

const AdminIncompleteChecksReportPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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

  const [filters, setFilters] = useState<Filters>({
    startDate: "",
    endDate: "",
    year: currentYear,
    month: "" as number | "",
    semesterId: "" as number | "",
  });
  const [filterType, setFilterType] = useState<FilterType>("unit");
  const [unitType, setUnitType] = useState<UnitType>("semester");

  // ✅ [추가] 1. availableYears와 현재 filters.year 불일치 시 자동 보정
  useEffect(() => {
    if (availableYears.length > 0 && filters.year) {
      if (!availableYears.includes(filters.year as number)) {
        // 목록에 없는 연도라면 가장 최신 연도(index 0)로 강제 변경
        setFilters((prev) => ({ ...prev, year: availableYears[0] }));
      }
    }
  }, [availableYears, filters.year]);

  const yearOptions = useMemo(() => {
    if (availableYears.length === 0)
      return [{ value: currentYear, label: `${currentYear}년` }];
    return availableYears.map((year) => ({ value: year, label: `${year}년` }));
  }, [availableYears, currentYear]);

  const handleFilterChange = (field: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
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
        if (semester) return `학기: ${semester.name}`;
      }
      const yearText = filters.year ? `${filters.year}년` : "전체 연도";
      if (unitType === "year") return `연간: ${yearText}`;
      if (unitType === "month" && filters.month)
        return `월간: ${yearText} ${filters.month}월`;
    }
    return "";
  }, [filterType, unitType, filters, semesters]);

  useEffect(() => {
    if (semesters.length > 0 && !hasAutoSelectedSemester) {
      const today = new Date();
      const currentYearMonth = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;
      let targetSemester = semesters.find(
        (s) =>
          s.startDate.substring(0, 7) <= currentYearMonth &&
          s.endDate.substring(0, 7) >= currentYearMonth
      );
      if (!targetSemester)
        targetSemester = [...semesters].sort((a, b) => b.id - a.id)[0];

      if (targetSemester)
        setFilters((prev) => ({
          ...prev,
          semesterId: targetSemester!.id,
          year: "",
          month: "",
        }));
      else {
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

  // ✅ [수정] 2. 학기 -> 연간/월간 전환 시 해당 학기의 연도를 유지하도록 로직 개선
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      let baseYear = typeof prev.year === "number" ? prev.year : currentYear;

      // 학기 모드에서 다른 모드로 갈 때, 선택된 학기의 연도를 가져옴
      if (unitType === "semester" && prev.semesterId) {
        const currentSemester = semesters.find((s) => s.id === prev.semesterId);
        if (currentSemester) {
          baseYear = new Date(currentSemester.startDate).getFullYear();
        }
      }

      const next: Filters = { ...prev };
      if (type === "year") {
        next.year = baseYear;
        next.month = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = baseYear;
        next.month = (next.month as number) || currentMonth;
        next.semesterId = "";
      } else if (type === "semester") {
        next.year = "";
        next.month = "";
        if (semesters.length > 0) {
          const today = new Date();
          const currentYM = `${today.getFullYear()}-${String(
            today.getMonth() + 1
          ).padStart(2, "0")}`;
          let target = semesters.find(
            (s) =>
              s.startDate.substring(0, 7) <= currentYM &&
              s.endDate.substring(0, 7) >= currentYM
          );
          if (!target) target = [...semesters].sort((a, b) => b.id - a.id)[0];
          if (target) next.semesterId = target.id;
        }
      }
      return next;
    });
  };

  const handleUnitValueChange = (value: number) => {
    setFilters((prev) => ({
      ...prev,
      year: typeof prev.year === "number" ? prev.year : currentYear,
      month: value,
      semesterId: "",
    }));
  };
  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({ ...prev, semesterId, year: "", month: "" }));
  };

  // ✅ 렌더링 함수 개선: 가로 스크롤 칩 UI 적용
  const renderUnitButtons = () => {
    // 1. 월 선택
    if (unitType === "month") {
      return (
        <div className="pt-2 border-t border-gray-200/50 mt-2">
          <div className="flex justify-between items-end mb-2">
            <label className="text-xs font-bold text-gray-500">월 선택</label>
            <span className="text-[10px] text-gray-400 font-normal sm:hidden">
              좌우로 스크롤
            </span>
          </div>
          <div
            className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap scrollbar-hide"
            style={scrollbarHideStyle}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                onClick={() => handleUnitValueChange(m)}
                className={`
                  flex-shrink-0 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap
                  ${
                    filters.month === m
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-1 ring-indigo-600"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                {m}월
              </button>
            ))}
          </div>
        </div>
      );
    }

    // 2. 학기 선택
    if (unitType === "semester") {
      if (semesters.length === 0)
        return (
          <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded mt-2 border border-yellow-100">
            활성 학기 없음
          </div>
        );
      return (
        <div className="pt-2 border-t border-gray-200/50 mt-2">
          <div className="flex justify-between items-end mb-2">
            <label className="text-xs font-bold text-gray-500">학기 선택</label>
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
                onClick={() => handleSemesterClick(s.id)}
                className={`
                  flex-shrink-0 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all shadow-sm whitespace-nowrap
                  ${
                    filters.semesterId === s.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-1 ring-indigo-600"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    s.isActive ? "bg-green-400" : "bg-gray-300"
                  } inline-block mr-1.5`}
                ></span>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const fetchIncompleteChecks = useCallback(
    async (opts?: { skipLoading?: boolean }) => {
      if (!user || user.role !== "EXECUTIVE") {
        setLoading(false);
        setError("권한이 없습니다.");
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
          if (semester)
            params = {
              startDate: semester.startDate,
              endDate: semester.endDate,
            };
        } else {
          const yearVal = normalizeNumberInput(filters.year);
          const monthVal = normalizeNumberInput(filters.month);
          if (!yearVal) {
            setLoading(false);
            setReport([]);
            return;
          }
          let rangeStart = "",
            rangeEnd = "";
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

          if (overlappingSemesters.length > 0) {
            const minS = overlappingSemesters.reduce(
              (m, s) => (s.startDate < m ? s.startDate : m),
              overlappingSemesters[0].startDate
            );
            const maxE = overlappingSemesters.reduce(
              (m, s) => (s.endDate > m ? s.endDate : m),
              overlappingSemesters[0].endDate
            );
            params = {
              startDate: rangeStart > minS ? rangeStart : minS,
              endDate: rangeEnd < maxE ? rangeEnd : maxE,
            };
          } else {
            // 학기가 없으면 해당 연도/월 전체 조회
            params = { startDate: rangeStart, endDate: rangeEnd };
          }
        }
      }

      // ✅ 날짜 Boundary Cutoff
      if (params.endDate) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const reqEnd = new Date(params.endDate);
        reqEnd.setHours(23, 59, 59, 999);

        // A. 미래 날짜 제한
        if (reqEnd > today) {
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, "0");
          const d = String(today.getDate()).padStart(2, "0");
          params.endDate = `${y}-${m}-${d}`;
        }

        // B. 연말 날짜 제한
        if (filters.year && filterType === "unit" && unitType === "year") {
          const yearEnd = `${filters.year}-12-31`;
          if (params.endDate > yearEnd) {
            params.endDate = yearEnd;
          }
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
        setReport(await reportService.getIncompleteCheckReport(cleanedParams));
      } catch (err: any) {
        setError(err?.response?.data?.message || "데이터 로드 실패");
      } finally {
        if (!opts?.skipLoading) setLoading(false);
      }
    },
    [user, filters, filterType, semesters, unitType]
  );

  const fetchAvailableYears = useCallback(async () => {
    try {
      // ✅ [수정] 3. 연도 목록 정렬 (최신순)
      const years = await reportService.getAvailableYearsForReports();
      setAvailableYears(years.sort((a, b) => b - a));
    } catch {
      setAvailableYears([]);
    }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      const sorted = data.sort((a, b) =>
        b.startDate.localeCompare(a.startDate)
      );
      setSemesters(sorted);
    } catch {
      setSemesters([]);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    if (semesters.length > 0 || hasActiveSemesters === false)
      fetchIncompleteChecks();
  }, [user, fetchIncompleteChecks, semesters.length, hasActiveSemesters]);
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    fetchAvailableYears();
    fetchSemesters();
  }, [user, fetchAvailableYears, fetchSemesters]);
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    memberService
      .getAllMembers({ page: 0, size: 1000, sort: "id,asc" })
      .then((p) =>
        setAllMembersForNameCheck(
          p?.content?.map((m) => ({
            id: m.id,
            name: m.name,
            birthDate: m.birthDate,
          })) ?? []
        )
      )
      .catch(console.error);
  }, [user]);

  if (!user || user.role !== "EXECUTIVE")
    return (
      <div className="p-10 text-center text-red-500">권한이 없습니다.</div>
    );

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
              <ExclamationCircleIcon className="h-7 w-7 text-red-500" /> 출석
              누락 현황
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              출석 체크를 완료하지 않은 셀장 및 날짜를 확인합니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5" /> {error}
            <button
              onClick={() => fetchIncompleteChecks({ skipLoading: false })}
              className="ml-auto text-xs bg-white border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 whitespace-nowrap"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 space-y-5">
          <div className="flex flex-col sm:flex-row gap-4 mb-2">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto self-start">
              <button
                onClick={() => setFilterType("unit")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filterType === "unit"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                단위별
              </button>
              <button
                onClick={() => setFilterType("range")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filterType === "range"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                기간설정
              </button>
            </div>
          </div>

          {filterType === "range" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  시작일
                </label>
                <KoreanCalendarPicker
                  value={filters.startDate}
                  onChange={(d) => handleFilterChange("startDate", d)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  종료일
                </label>
                <KoreanCalendarPicker
                  value={filters.endDate}
                  onChange={(d) => handleFilterChange("endDate", d)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {/* 1. 연도 */}
                <div className="sm:w-1/3">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    연도
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
                      className="w-full py-2 px-1 border border-gray-300 rounded-lg text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                      disabled={unitType === "semester"}
                    >
                      {yearOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
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

                {/* 2. 조회 단위 */}
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    조회 단위
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { t: "month", l: "월간" },
                        { t: "semester", l: "학기" },
                        { t: "year", l: "연간" },
                      ] as const
                    ).map((u) => {
                      const isDisabled =
                        u.t === "semester" && !hasActiveSemesters;
                      return (
                        <button
                          key={u.t}
                          onClick={() =>
                            !isDisabled && handleUnitTypeClick(u.t)
                          }
                          disabled={isDisabled}
                          className={`flex-1 sm:flex-none px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap ${
                            isDisabled
                              ? "bg-gray-50 text-gray-400 border-gray-200 border-dashed cursor-not-allowed shadow-none"
                              : unitType === u.t
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {u.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* 월/학기 선택 버튼 영역 */}
              {renderUnitButtons()}
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-gray-400" />
                <span className="font-bold text-gray-700 whitespace-nowrap">
                  검색 결과{" "}
                  <span className="text-red-600">{report.length}</span>명
                </span>
              </div>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md whitespace-nowrap">
                {periodSummary}
              </span>
            </div>

            <div className="space-y-3 md:hidden">
              {report.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
                  누락된 기록이 없습니다.
                </div>
              ) : (
                report.map((item) => {
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
                      onClick={() => navigate(`/admin/cells/${item.cellId}`)}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-indigo-200 transition-all active:scale-[0.99]"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-base font-bold text-gray-900 truncate max-w-[120px]">
                            {displayName}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {item.cellName}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${badgeClass}`}
                        >
                          {item.missedDatesCount}회 누락
                        </span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
                          미완료 날짜
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.missedDates.map((d, i) => (
                            <span
                              key={i}
                              className="text-xs font-medium text-gray-600 bg-white border border-gray-200 px-1.5 py-0.5 rounded whitespace-nowrap"
                            >
                              {formatShortDate(d)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs w-1/4 whitespace-nowrap">
                      셀장 이름
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs w-1/4 whitespace-nowrap">
                      셀 이름
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs w-1/6 whitespace-nowrap">
                      누락 횟수
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      미완료 날짜
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {report.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        결과가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    report.map((item) => {
                      const leaderMember = allMembersForNameCheck.find(
                        (m) => m.id === item.leaderId
                      );
                      const displayName = leaderMember
                        ? formatDisplayName(
                            leaderMember,
                            allMembersForNameCheck
                          )
                        : item.leaderName;
                      const badgeClass =
                        item.missedDatesCount >= 5
                          ? "bg-red-100 text-red-700"
                          : item.missedDatesCount >= 2
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700";

                      return (
                        <tr
                          key={item.leaderId}
                          onClick={() =>
                            navigate(`/admin/cells/${item.cellId}`)
                          }
                          className="hover:bg-gray-50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-indigo-600 align-top whitespace-nowrap">
                            {displayName}
                          </td>
                          <td className="px-6 py-4 text-gray-600 align-top whitespace-nowrap">
                            {item.cellName}
                          </td>
                          <td className="px-6 py-4 align-top">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${badgeClass}`}
                            >
                              {item.missedDatesCount}회
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="flex flex-wrap gap-1.5">
                              {item.missedDates.map((d, i) => (
                                <span
                                  key={i}
                                  className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap"
                                >
                                  {formatShortDate(d)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminIncompleteChecksReportPage;
