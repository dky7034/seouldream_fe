// src/pages/AdminPrayerSummaryPage.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { semesterService } from "../services/semesterService";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import type {
  GetPrayersParams,
  Page,
  SemesterDto,
  PrayerMemberSummaryDto,
  PrayerCellSummaryDto,
} from "../types";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import Pagination from "../components/Pagination";

type SummaryMode = "members" | "cells";
type UnitType = "year" | "half" | "quarter" | "month" | "semester";

type SortDirection = "ascending" | "descending";
type SortKey = "totalCount" | "latestCreatedAt" | "memberName" | "cellName";

interface AdminPrayerSummaryPageProps {
  initialMode?: SummaryMode;
}

const FILTER_STORAGE_KEY = "adminPrayerSummaryFilters";

// =========================
// 저장 타입 정의
// =========================
type SavedFilterState = {
  mode: SummaryMode;
  filterType: "unit" | "range";
  unitType: UnitType;
  filters: {
    cell: string;
    member: string;
    startDate: string;
    endDate: string;
    year: number | "";
    month: number | "";
    quarter: number | "";
    half: number | "";
    semesterId: number | "";
  };
  currentPage: number;
  sortKey?: SortKey;
  sortDirection?: SortDirection;
};

// =========================
// sessionStorage에서 로드
// =========================
const loadSavedFilterState = (): SavedFilterState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedFilterState;
  } catch {
    return null;
  }
};

const AdminPrayerSummaryPage: React.FC<AdminPrayerSummaryPageProps> = ({
  initialMode = "members",
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const savedState = loadSavedFilterState();

  // URL 경로 기반 모드 계산
  const urlMode: SummaryMode = useMemo(() => {
    if (location.pathname.endsWith("/cells")) return "cells";
    return initialMode;
  }, [location.pathname, initialMode]);

  // 모드 초기값
  const [mode, setMode] = useState<SummaryMode>(savedState?.mode ?? urlMode);

  useEffect(() => {
    setMode(urlMode);
  }, [urlMode]);

  const [memberSummaryPage, setMemberSummaryPage] =
    useState<Page<PrayerMemberSummaryDto> | null>(null);
  const [cellSummaryPage, setCellSummaryPage] =
    useState<Page<PrayerCellSummaryDto> | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(savedState?.currentPage ?? 0);
  const [filterType, setFilterType] = useState<"unit" | "range">(
    savedState?.filterType ?? "unit"
  );
  const [unitType, setUnitType] = useState<UnitType>(
    savedState?.unitType ?? "year"
  );

  const [filters, setFilters] = useState({
    cell: savedState?.filters?.cell ?? "all",
    member: savedState?.filters?.member ?? "all",
    startDate: savedState?.filters?.startDate ?? "",
    endDate: savedState?.filters?.endDate ?? "",
    year: (savedState?.filters?.year ?? "") as number | "",
    month: (savedState?.filters?.month ?? "") as number | "",
    quarter: (savedState?.filters?.quarter ?? "") as number | "",
    half: (savedState?.filters?.half ?? "") as number | "",
    semesterId: (savedState?.filters?.semesterId ?? "") as number | "",
  });

  const hasActiveSemesters = semesters.length > 0;

  // =========================
  // 정렬 상태 (세션에서 복원)
  // =========================
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>(() => ({
    key: savedState?.sortKey ?? "totalCount",
    direction: savedState?.sortDirection ?? "descending",
  }));

  // 실제 구현 시 서비스에서 가져오는 구조로 확장 가능
  const memberOptions: { value: number; label: string }[] = [];
  const cellOptions: { value: number; label: string }[] = [];

  // 학기 목록
  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("학기 목록 로딩 실패:", err);
      setSemesters([]);
    }
  }, []);

  // 연도 목록
  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await prayerService.getAvailableYears();
      setAvailableYears(years);
    } catch (err) {
      console.error("Failed to fetch available years for prayers:", err);
      setAvailableYears([]);
    }
  }, []);

  // 최신 연도 자동 세팅
  useEffect(() => {
    if (
      filterType === "unit" &&
      unitType === "year" &&
      !filters.year &&
      availableYears.length > 0
    ) {
      const latestYear = Math.max(...availableYears);
      setFilters((prev) => ({ ...prev, year: latestYear }));
      setCurrentPage(0);
    }
  }, [filterType, unitType, filters.year, availableYears]);

  // =========================
  // API Params 구성
  // =========================
  const buildBaseParams = useCallback((): GetPrayersParams => {
    let params: GetPrayersParams = {
      page: currentPage,
      size: 10,
      sort: `${sortConfig.key},${
        sortConfig.direction === "ascending" ? "asc" : "desc"
      }`,
    };

    // 기간 필터
    if (filterType === "range") {
      params.startDate = filters.startDate || undefined;
      params.endDate = filters.endDate || undefined;
    } else {
      // 학기 단위
      if (filters.semesterId && semesters.length > 0) {
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          params.startDate = semester.startDate;
          params.endDate = semester.endDate;
        }
      } else {
        params.year = normalizeNumberInput(filters.year);
        params.month = normalizeNumberInput(filters.month);
        params.quarter = normalizeNumberInput(filters.quarter);
        params.half = normalizeNumberInput(filters.half);
      }
    }

    // 선택 필터
    if (filters.cell !== "all") params.cellId = Number(filters.cell);
    if (filters.member !== "all") params.memberId = Number(filters.member);

    // 불필요 값 제거
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined
      )
    ) as GetPrayersParams;

    return cleaned;
  }, [currentPage, filterType, filters, semesters, sortConfig]);

  // =========================
  // 실제 데이터 로딩
  // =========================
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError("로그인이 필요한 페이지입니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const params = buildBaseParams();

    try {
      if (mode === "members") {
        const data = await prayerService.getMemberPrayerSummary(params);
        setMemberSummaryPage(data);
      } else {
        const data = await prayerService.getCellPrayerSummary(params);
        setCellSummaryPage(data);
      }
    } catch (err) {
      console.error("기도제목 요약 로딩 실패:", err);
      setError("기도제목 요약 데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user, buildBaseParams, mode]);

  // 권한 체크 후 로딩
  useEffect(() => {
    if (user?.role === "EXECUTIVE" || user?.role === "CELL_LEADER") {
      fetchData();
    }
  }, [fetchData, user?.role]);

  // 연도 / 학기 목록 로딩
  useEffect(() => {
    if (user) {
      fetchAvailableYears();
      fetchSemesters();
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

  // =========================
  // 필터/정렬 상태 sessionStorage 저장
  // =========================
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stateToSave: SavedFilterState = {
      mode,
      filterType,
      unitType,
      filters,
      currentPage,
      sortKey: sortConfig.key,
      sortDirection: sortConfig.direction,
    };

    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(stateToSave));
  }, [mode, filterType, unitType, filters, currentPage, sortConfig]);

  // =========================
  // 필터 핸들러
  // =========================
  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const next = { ...prev };
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      if (type === "year") {
        next.year = next.year || currentYear;
        next.month = "";
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "half") {
        next.year = next.year || currentYear;
        next.half = next.half || 1;
        next.month = "";
        next.quarter = "";
        next.semesterId = "";
      } else if (type === "quarter") {
        next.year = next.year || currentYear;
        next.quarter = next.quarter || 1;
        next.month = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = next.year || currentYear;
        next.month = next.month || currentMonth;
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "semester") {
        next.year = "";
        next.month = "";
        next.quarter = "";
        next.half = "";
      }

      return next;
    });

    setCurrentPage(0);
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
    setCurrentPage(0);
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
    setCurrentPage(0);
  };

  // =========================
  // 정렬 핸들러
  // =========================
  const requestSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction:
            prev.direction === "ascending" ? "descending" : "ascending",
        };
      }
      return {
        key,
        direction: "descending",
      };
    });
    setCurrentPage(0);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "ascending" ? "▲" : "▼";
  };

  // =========================
  // 연도 옵션
  // =========================
  const yearOptions = useMemo(() => {
    if (availableYears.length === 0) {
      const currentYear = new Date().getFullYear();
      return [{ value: currentYear, label: `${currentYear}년` }];
    }
    return availableYears.map((year) => ({
      value: year,
      label: `${year}년`,
    }));
  }, [availableYears]);

  // =========================
  // 날짜 요약표시
  // =========================
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [, m, d] = dateStr.split("-");
    return `${m}/${d}`;
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
        if (semester) return `조회 단위: 학기 (${semester.name})`;
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

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                onClick={() => handleUnitValueClick("month", m)}
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
                onClick={() => handleUnitValueClick("quarter", q)}
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
            {([1, 2] as const).map((h) => (
              <button
                key={h}
                onClick={() => handleUnitValueClick("half", h)}
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
              등록된 학기가 없습니다. 먼저 학기를 생성해 주세요.
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {semesters.map((s) => (
              <button
                key={s.id}
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
      default:
        return null;
    }
  };

  // =========================
  // 권한 체크
  // =========================
  if (!user) {
    return (
      <div className="bg-gray-50 min-h-screen flex justify-center items-center px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <p className="text-red-600 text-sm sm:text-base">
            로그인이 필요한 페이지입니다.
          </p>
        </div>
      </div>
    );
  }

  if (user.role !== "EXECUTIVE" && user.role !== "CELL_LEADER") {
    return (
      <div className="bg-gray-50 min-h-screen flex justify-center items-center px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <p className="text-red-600 text-sm sm:text-base">
            기도제목 요약 페이지에 접근할 권한이 없습니다.
          </p>
        </div>
      </div>
    );
  }

  // =========================
  // UI 렌더링
  // =========================
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 sm:mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              기도제목
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              기간/셀/멤버 기준으로 &quot;기도제목이 실제로 등록된&quot; 멤버와
              셀만 확인할 수 있는 페이지입니다.
            </p>
          </div>
        </div>

        {/* 모드 탭 */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              setCurrentPage(0);
              setSortConfig({ key: "totalCount", direction: "descending" });
              navigate("/admin/prayers/summary/members");
            }}
            className={`px-3 py-1 text-xs sm:text-sm rounded-full border ${
              mode === "members"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700"
            }`}
          >
            멤버별 히스토리
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentPage(0);
              setSortConfig({ key: "totalCount", direction: "descending" });
              navigate("/admin/prayers/summary/cells");
            }}
            className={`px-3 py-1 text-xs sm:text-sm rounded-full border ${
              mode === "cells"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700"
            }`}
          >
            셀별 히스토리
          </button>
        </div>

        {/* 기간 필터 */}
        <div className="p-4 bg-gray-50 rounded-lg mb-3 sm:mb-4 space-y-4 shadow-sm">
          {/* 필터 종류 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-base sm:text-lg font-semibold">
              조회 기간 설정
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
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

          {/* 기간 직접 선택 */}
          {filterType === "range" ? (
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
            <>
              {/* 연도 + 단위 선택 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 연도 */}
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
                    <option value="">전체 연도</option>
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

                {/* 단위 버튼 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    조회 단위
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {(
                      [
                        "year",
                        "half",
                        "quarter",
                        "month",
                        "semester",
                      ] as UnitType[]
                    ).map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          t === "semester"
                            ? hasActiveSemesters && handleUnitTypeClick(t)
                            : handleUnitTypeClick(t)
                        }
                        disabled={t === "semester" && !hasActiveSemesters}
                        className={`px-3 py-1 text-xs sm:text-sm rounded-full border ${
                          t === unitType
                            ? "bg-blue-500 text-white border-blue-500"
                            : t === "semester" && !hasActiveSemesters
                            ? "bg-gray-100 text-gray-400 border-dashed cursor-not-allowed"
                            : "bg-white"
                        }`}
                      >
                        {t === "year" && "연간"}
                        {t === "half" && "반기"}
                        {t === "quarter" && "분기"}
                        {t === "month" && "월간"}
                        {t === "semester" && "학기"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 단위별 버튼 */}
              {renderUnitButtons()}
            </>
          )}

          <hr />

          {/* 셀/멤버 필터 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <SimpleSearchableSelect
              options={cellOptions}
              value={filters.cell === "all" ? undefined : Number(filters.cell)}
              onChange={(val) =>
                handleFilterChange("cell", val != null ? String(val) : "all")
              }
              placeholder="셀 필터"
            />

            <SimpleSearchableSelect
              options={memberOptions}
              value={
                filters.member === "all" ? undefined : Number(filters.member)
              }
              onChange={(val) =>
                handleFilterChange("member", val != null ? String(val) : "all")
              }
              placeholder="멤버 필터"
            />
          </div>

          {/* 임원단 권한 - 새 기도제목 추가 */}
          {user.role === "EXECUTIVE" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate("/admin/prayers/add")}
                className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700"
              >
                + 새 기도제목
              </button>
            </div>
          )}
        </div>

        {/* 기간 요약 */}
        {periodSummary && (
          <p className="mb-4 text-[11px] sm:text-xs text-gray-500">
            {periodSummary}
          </p>
        )}

        {/* 로딩/에러 */}
        {loading && (
          <div className="flex items-center justify-center min-h-[30vh] mb-4">
            <p className="text-sm text-gray-500">
              기도제목 요약을 불러오는 중입니다...
            </p>
          </div>
        )}
        {error && !loading && (
          <p className="text-center text-sm text-red-500 mb-4">{error}</p>
        )}

        {/* =========================
            멤버 요약 영역
        ========================= */}
        {!loading && !error && mode === "members" && memberSummaryPage && (
          <>
            {/* 모바일 카드 */}
            <div className="space-y-3 md:hidden mb-4">
              {memberSummaryPage.content.length === 0 ? (
                <div className="bg-white rounded-lg shadow border p-4 text-center text-xs sm:text-sm text-gray-500">
                  조건에 맞는 멤버가 없습니다.
                </div>
              ) : (
                memberSummaryPage.content.map((row) => (
                  <div
                    key={row.memberId}
                    className="bg-white rounded-lg shadow border p-3 text-xs space-y-2"
                  >
                    {/* 상단 */}
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <button
                          onClick={() =>
                            navigate(`/admin/prayers/members/${row.memberId}`)
                          }
                          className="text-sm font-semibold text-indigo-600 hover:underline"
                        >
                          {row.memberName}
                        </button>
                        <p className="text-[11px] text-gray-500 mt-1">
                          셀:{" "}
                          {row.cellId ? (
                            <button
                              onClick={() =>
                                navigate(`/admin/prayers/cells/${row.cellId}`)
                              }
                              className="hover:underline"
                            >
                              {row.cellName}
                            </button>
                          ) : (
                            "-"
                          )}
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-gray-500">
                        최근 작성일
                        <br />
                        <span className="font-medium text-gray-800">
                          {new Date(row.latestCreatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* 하단 */}
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-[11px] text-gray-500">
                        기도제목 수
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {row.totalCount.toLocaleString()}건
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 🖥 데스크탑 테이블 (md 이상) */}
            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => requestSort("memberName")}
                    >
                      이름{" "}
                      <span className="ml-1">
                        {getSortIndicator("memberName")}
                      </span>
                    </th>
                    <th
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => requestSort("cellName")}
                    >
                      셀{" "}
                      <span className="ml-1">
                        {getSortIndicator("cellName")}
                      </span>
                    </th>
                    <th
                      className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => requestSort("totalCount")}
                    >
                      기도제목 수{" "}
                      <span className="ml-1">
                        {getSortIndicator("totalCount")}
                      </span>
                    </th>
                    <th
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => requestSort("latestCreatedAt")}
                    >
                      최근 작성일{" "}
                      <span className="ml-1">
                        {getSortIndicator("latestCreatedAt")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {memberSummaryPage.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500"
                      >
                        조건에 맞는 멤버가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    memberSummaryPage.content.map((row) => (
                      <tr key={row.memberId}>
                        <td className="px-3 sm:px-6 py-2 sm:py-3">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/prayers/members/${row.memberId}`)
                            }
                            className="text-indigo-600 hover:text-indigo-900 underline-offset-2 hover:underline"
                          >
                            {row.memberName}
                          </button>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3">
                          {row.cellId ? (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/admin/prayers/cells/${row.cellId}`)
                              }
                              className="text-gray-700 underline-offset-2 hover:underline"
                            >
                              {row.cellName}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3 text-right">
                          {row.totalCount.toLocaleString()}건
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap">
                          {new Date(row.latestCreatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={memberSummaryPage.number}
              totalPages={memberSummaryPage.totalPages}
              totalElements={memberSummaryPage.totalElements}
              onPageChange={setCurrentPage}
            />
          </>
        )}

        {/* =========================
            셀 요약 영역
        ========================= */}
        {!loading && !error && mode === "cells" && cellSummaryPage && (
          <>
            {/* 모바일 */}
            <div className="space-y-3 md:hidden mb-4">
              {cellSummaryPage.content.length === 0 ? (
                <div className="bg-white rounded-lg shadow border p-4 text-center text-xs text-gray-500">
                  조건에 맞는 셀이 없습니다.
                </div>
              ) : (
                cellSummaryPage.content.map((row) => (
                  <div
                    key={row.cellId}
                    className="bg-white rounded-lg shadow border p-3 text-xs space-y-2"
                  >
                    {/* 상단 */}
                    <div className="flex justify-between items-start">
                      <button
                        onClick={() =>
                          navigate(`/admin/prayers/cells/${row.cellId}`)
                        }
                        className="text-sm font-semibold text-indigo-600 hover:underline"
                      >
                        {row.cellName}
                      </button>

                      <div className="text-right text-[11px] text-gray-500">
                        최근 작성일
                        <br />
                        <span className="font-medium text-gray-800">
                          {new Date(row.latestCreatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* 하단 */}
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-[11px] text-gray-500">
                        기도제목 수
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {row.totalCount.toLocaleString()}건
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 데스크탑 */}
            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => requestSort("cellName")}
                    >
                      셀{" "}
                      <span className="ml-1">
                        {getSortIndicator("cellName")}
                      </span>
                    </th>
                    <th
                      className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => requestSort("totalCount")}
                    >
                      기도제목 수{" "}
                      <span className="ml-1">
                        {getSortIndicator("totalCount")}
                      </span>
                    </th>
                    <th
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => requestSort("latestCreatedAt")}
                    >
                      최근 작성일{" "}
                      <span className="ml-1">
                        {getSortIndicator("latestCreatedAt")}
                      </span>
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {cellSummaryPage.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500"
                      >
                        조건에 맞는 셀이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    cellSummaryPage.content.map((row) => (
                      <tr key={row.cellId}>
                        <td className="px-3 sm:px-6 py-2 sm:py-3">
                          <button
                            onClick={() =>
                              navigate(`/admin/prayers/cells/${row.cellId}`)
                            }
                            className="text-indigo-600 hover:text-indigo-900 underline-offset-2 hover:underline"
                          >
                            {row.cellName}
                          </button>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3 text-right">
                          {row.totalCount.toLocaleString()}건
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap">
                          {new Date(row.latestCreatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={cellSummaryPage.number}
              totalPages={cellSummaryPage.totalPages}
              totalElements={cellSummaryPage.totalElements}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPrayerSummaryPage;
