// src/pages/AdminCellsPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cellService } from "../services/cellService";
import type { GetAllCellsParams, CellDto, Page, SemesterDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import Pagination from "../components/Pagination";
import { useDebounce } from "../hooks/useDebounce";
import { formatDisplayName } from "../utils/memberUtils";
import { memberService } from "../services/memberService";
import { semesterService } from "../services/semesterService";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  UsersIcon,
  ChartBarIcon,
} from "@heroicons/react/24/solid";

type SortKey =
  | "name"
  | "leaderName"
  | "viceLeaderName"
  | "memberCount"
  | "attendanceRate"
  | "active"
  | "maleCount"
  | "femaleCount";

type SortConfig = {
  key: SortKey;
  direction: "ascending" | "descending";
};

const pad = (n: number) => n.toString().padStart(2, "0");
const lastDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

type Filters = {
  name: string;
  active: "all" | "true" | "false";
  startDate: string;
  endDate: string;
  year: number | "";
  month: number | "";
  semesterId: number | "";
};

const AdminCellsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 데이터 상태
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [cellPage, setCellPage] = useState<Page<CellDto> | null>(null);

  // UI 상태
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // 삭제 모달 상태
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [cellToDelete, setCellToDelete] = useState<CellDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { name: string; birthDate?: string }[]
  >([]);

  // 검색어 로컬 상태
  const [localSearchName, setLocalSearchName] = useState(
    searchParams.get("name") || ""
  );
  const debouncedSearchName = useDebounce(localSearchName, 500);

  // 필터 상태
  const [filters, setFilters] = useState<Filters>(() => {
    const name = searchParams.get("name") || "";
    const active = (searchParams.get("active") as Filters["active"]) || "all";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const semesterIdParam = searchParams.get("semesterId");

    let initialYear: number | "" = "";
    if (yearParam && yearParam !== "all") {
      const parsed = Number(yearParam);
      if (!isNaN(parsed)) initialYear = parsed;
    }

    return {
      name,
      active,
      startDate,
      endDate,
      year: initialYear,
      month: monthParam ? Number(monthParam) : "",
      semesterId: semesterIdParam ? Number(semesterIdParam) : "",
    };
  });

  const [filterType, setFilterType] = useState<"unit" | "range">("unit");
  const [unitType, setUnitType] = useState<"year" | "month" | "semester">(
    "semester"
  );
  const hasActiveSemesters = semesters.length > 0;

  const updateQueryParams = useCallback(
    (updates: Record<string, string | number | undefined | null>) => {
      const newParams = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "")
          newParams.delete(key);
        else newParams.set(key, String(value));
      });
      if (!Object.prototype.hasOwnProperty.call(updates, "page"))
        newParams.set("page", "0");
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const getValidSortKey = (value: string | null): SortKey => {
    const validKeys: SortKey[] = [
      "name",
      "leaderName",
      "viceLeaderName",
      "memberCount",
      "attendanceRate",
      "active",
      "maleCount",
      "femaleCount",
    ];
    return validKeys.includes(value as SortKey) ? (value as SortKey) : "name";
  };

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const key = getValidSortKey(searchParams.get("sortKey"));
    const dirParam = searchParams.get("sortDir");
    return {
      key,
      direction: dirParam === "descending" ? "descending" : "ascending",
    };
  });

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get("page");
    const pageNum = pageParam ? Number(pageParam) : 0;
    return Number.isNaN(pageNum) || pageNum < 0 ? 0 : pageNum;
  });

  // Effects
  useEffect(() => {
    const currentParamsName = searchParams.get("name") || "";
    if (debouncedSearchName !== currentParamsName)
      updateQueryParams({ name: debouncedSearchName });
  }, [debouncedSearchName, searchParams, updateQueryParams]);

  useEffect(() => {
    const paramsName = searchParams.get("name") || "";
    if (paramsName !== localSearchName) setLocalSearchName(paramsName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const key = getValidSortKey(searchParams.get("sortKey"));
    const dirParam = searchParams.get("sortDir");
    const pageParam = searchParams.get("page");
    const pageNum = pageParam ? Number(pageParam) : 0;

    setSortConfig({
      key,
      direction: dirParam === "descending" ? "descending" : "ascending",
    });
    setCurrentPage(Number.isNaN(pageNum) || pageNum < 0 ? 0 : pageNum);

    const urlUnitType = searchParams.get("unitType") as
      | "year"
      | "month"
      | "semester"
      | null;
    const urlFilterType = searchParams.get("filterType") as
      | "unit"
      | "range"
      | null;

    if (urlUnitType) setUnitType(urlUnitType);
    if (urlFilterType) setFilterType(urlFilterType);

    setFilters((prev) => ({
      ...prev,
      name: searchParams.get("name") || "",
      active: (searchParams.get("active") as Filters["active"]) || "all",
      startDate: searchParams.get("startDate") || "",
      endDate: searchParams.get("endDate") || "",
      year: searchParams.get("year") ? Number(searchParams.get("year")) : "",
      month: searchParams.get("month") ? Number(searchParams.get("month")) : "",
      semesterId: searchParams.get("semesterId")
        ? Number(searchParams.get("semesterId"))
        : "",
    }));
  }, [searchParams]);

  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await cellService.getAvailableYears();
      setAvailableYears(
        years.length === 0
          ? [new Date().getFullYear()]
          : years.sort((a, b) => b - a)
      );
    } catch (err) {
      setAvailableYears([new Date().getFullYear()]);
    }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("Failed to fetch semesters:", err);
      setSemesters([]);
    }
  }, []);

  const getDateRangeFromFilters = useCallback((): {
    startDate: string;
    endDate: string;
  } | null => {
    if (filterType === "range") {
      if (!filters.startDate || !filters.endDate) return null;
      return { startDate: filters.startDate, endDate: filters.endDate };
    }
    if (filters.semesterId) {
      const semester = semesters.find((s) => s.id === filters.semesterId);
      if (semester)
        return { startDate: semester.startDate, endDate: semester.endDate };
    }

    // 🔴 [수정 전] 타입이 number가 아니면 undefined 처리되어 날짜 계산 안 됨
    // const year = typeof filters.year === "number" ? filters.year : undefined;

    // 🟢 [수정 후] 값이 있으면 Number로 변환하여 사용 (안전장치)
    const year = filters.year ? Number(filters.year) : undefined;

    if (!year) return null; // 연도가 없으면 null 반환 -> 백엔드가 기본값(학기) 처리함

    const { month } = filters;
    if (month) {
      const m = month as number;
      const last = lastDayOfMonth(year, m);
      return {
        startDate: `${year}-${pad(m)}-01`,
        endDate: `${year}-${pad(m)}-${pad(last)}`,
      };
    }
    const last = lastDayOfMonth(year, 12);
    return { startDate: `${year}-01-01`, endDate: `${year}-12-${pad(last)}` };
  }, [filterType, filters, semesters]);

  const fetchCells = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") return;
    if (unitType === "semester" && !filters.semesterId && filterType === "unit")
      return;

    setLoading(true);
    setError(null);
    const sortKeyMap: Record<string, string> = {
      leaderName: "leader.name",
      viceLeaderName: "viceLeader.name",
    };
    const backendSortKey =
      sortKeyMap[sortConfig.key as string] || sortConfig.key;
    const sortParam = `${backendSortKey},${
      sortConfig.direction === "ascending" ? "asc" : "desc"
    }`;
    const dateRange = getDateRangeFromFilters();

    const params: GetAllCellsParams = {
      page: currentPage,
      size: 10,
      sort: sortParam,
      name: debouncedSearchName,
      active: filters.active === "all" ? undefined : filters.active === "true",
      startDate: dateRange?.startDate || undefined,
      endDate: dateRange?.endDate || undefined,
    };
    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    );

    try {
      const response = await cellService.getAllCells(cleanedParams);
      setCellPage(response);
    } catch {
      setError("셀 목록 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [
    user,
    currentPage,
    sortConfig,
    debouncedSearchName,
    filters.active,
    getDateRangeFromFilters,
    unitType,
    filters.semesterId,
    filterType,
  ]);

  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") {
      setLoading(false);
      if (!user) setError("로그인이 필요합니다.");
      else setError("권한이 없습니다.");
      return;
    }
    fetchAvailableYears();
    fetchSemesters();
    memberService
      .getAllMembers({ page: 0, size: 1000 })
      .then((p) =>
        setAllMembersForNameCheck(
          p?.content?.map((m) => ({ name: m.name, birthDate: m.birthDate })) ??
            []
        )
      )
      .catch(() => {});
  }, [user, fetchAvailableYears, fetchSemesters]);

  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    if (semesters.length === 0 && unitType === "semester") return;
    fetchCells();
  }, [user, fetchCells, semesters.length, unitType]);

  useEffect(() => {
    if (semesters.length === 0 || hasInitialized) return;
    if (
      searchParams.get("semesterId") ||
      searchParams.get("year") ||
      searchParams.get("startDate")
    ) {
      setHasInitialized(true);
      return;
    }

    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    let target = semesters.find(
      (s) =>
        s.startDate.substring(0, 7) <= currentYM &&
        s.endDate.substring(0, 7) >= currentYM
    );
    if (!target) target = [...semesters].sort((a, b) => b.id - a.id)[0];

    if (target)
      updateQueryParams({
        unitType: "semester",
        semesterId: target.id,
        year: "",
        month: "",
        active: "all",
      });
    else
      updateQueryParams({
        unitType: "month",
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        semesterId: "",
        active: "all",
      });
    setHasInitialized(true);
  }, [semesters, hasInitialized, searchParams, updateQueryParams]);

  // Handlers
  const yearOptions = useMemo(
    () => availableYears.map((y) => ({ value: y, label: `${y}` })),
    [availableYears]
  );
  const sortedCells = useMemo(
    () => (cellPage ? cellPage.content : []),
    [cellPage]
  );

  const requestSort = (key: SortKey) => {
    const nextDir =
      sortConfig.key === key && sortConfig.direction === "ascending"
        ? "descending"
        : "ascending";
    updateQueryParams({ sortKey: key, sortDir: nextDir, page: 0 });
  };
  const handlePageChange = (page: number) => {
    updateQueryParams({ page: page < 0 ? 0 : page });
  };
  const handleDelete = (cell: CellDto) => {
    setCellToDelete(cell);
    setDeleteError(null);
    setShowDeleteConfirmModal(true);
  };
  const handleConfirmDelete = async () => {
    if (!cellToDelete) return;
    try {
      await cellService.deleteCell(cellToDelete.id);
      setShowDeleteConfirmModal(false);
      setCellToDelete(null);
      fetchCells();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || "삭제 실패");
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal(false);
    setCellToDelete(null);
    setDeleteError(null);
  };

  const handleFilterChange = (field: keyof Filters, value: any) =>
    updateQueryParams({ [field]: value });
  const handleSemesterClick = (id: number) =>
    updateQueryParams({ semesterId: filters.semesterId === id ? "" : id });

  const handleUnitTypeClick = (type: "year" | "month" | "semester") => {
    const now = new Date();
    const updates: Record<string, string | number> = {
      unitType: type,
      filterType: "unit",
    };
    if (type === "year") {
      // 🔴 [수정 전] filters.year가 없으면 빈 문자열("")이 들어감 -> 위 함수에서 null 반환됨
      // updates.year = filters.year || "";

      // 🟢 [수정 후] 선택된 연도가 없으면 '올해'를 기본값으로 설정
      updates.year = filters.year || now.getFullYear();
      updates.month = "";
      updates.semesterId = "";
    } else if (type === "month") {
      updates.year = filters.year || now.getFullYear();
      updates.month = filters.month || now.getMonth() + 1;
      updates.semesterId = "";
    } else if (type === "semester") {
      updates.year = "";
      updates.month = "";
      if (semesters.length > 0 && !filters.semesterId)
        updates.semesterId = semesters[0].id;
    }
    updateQueryParams(updates);
  };

  const handleUnitValueClick = (value: number) =>
    updateQueryParams({ month: value });
  const handleFilterTypeChange = (type: "unit" | "range") =>
    updateQueryParams({ filterType: type });

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  const renderUnitButtons = () => {
    if (unitType === "month") {
      return (
        <div className="pt-2 border-t border-gray-200/50 mt-2">
          <label className="text-xs font-bold text-gray-500 mb-2 block">
            월 선택
          </label>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                onClick={() => handleUnitValueClick(m)}
                className={`py-1.5 rounded-md text-xs font-bold transition-all border ${
                  filters.month === m
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 shadow-sm"
                }`}
              >
                {m}월
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (unitType === "semester") {
      if (semesters.length === 0)
        return (
          <div className="text-xs text-yellow-800 bg-yellow-50 p-3 rounded-lg border border-yellow-100 mt-2">
            활성화된 학기가 없습니다.
          </div>
        );
      return (
        <div className="pt-2 border-t border-gray-200/50 mt-2">
          <label className="text-xs font-bold text-gray-500 mb-2 block">
            학기 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {semesters.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSemesterClick(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${
                  filters.semesterId === s.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (error && (!user || user.role !== "EXECUTIVE"))
    return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UserGroupIcon className="h-7 w-7 text-indigo-500" />셀 관리
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              셀 정보를 관리하고 출석 현황을 모니터링합니다.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/cells/add")}
            className="flex items-center justify-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-sm transition-all"
          >
            <PlusIcon className="h-4 w-4" /> 셀 추가
          </button>
        </div>

        {/* Filters Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 space-y-5">
          <div className="flex flex-col sm:flex-row gap-4 mb-2">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto self-start">
              <button
                onClick={() => handleFilterTypeChange("unit")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  filterType === "unit"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                단위별
              </button>
              <button
                onClick={() => handleFilterTypeChange("range")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
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
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              {/* ✅ 레이아웃 개선: items-start 적용 */}
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
                {/* 1. 연도 선택 */}
                <div className="w-full sm:w-32">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    연도
                  </label>
                  <div className="relative">
                    <select
                      value={filters.year}
                      onChange={(e) =>
                        // 🟢 [수정] e.target.value를 Number()로 감싸서 전달
                        handleFilterChange("year", Number(e.target.value))
                      }
                      className="w-full py-2 px-1 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-100 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                      disabled={unitType === "semester"}
                    >
                      <option value="">전체 연도</option>
                      {yearOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}년
                        </option>
                      ))}
                    </select>
                    {/* ✅ 안내 문구 추가 */}
                    {unitType === "semester" && (
                      <p className="absolute left-0 top-full mt-1 text-[10px] text-gray-400 whitespace-nowrap">
                        * 학기는 연도 무관
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. 조회 단위 */}
                <div className="flex-1 w-full">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    조회 단위
                  </label>
                  {/* ✅ 스타일 개선: 개별 버튼 + gap-2 */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleUnitTypeClick("month")}
                      className={`px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all ${
                        unitType === "month"
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      월간
                    </button>
                    <button
                      onClick={() =>
                        hasActiveSemesters && handleUnitTypeClick("semester")
                      }
                      disabled={!hasActiveSemesters}
                      className={`px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all ${
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
                      className={`px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all ${
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
              {renderUnitButtons()}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                셀 이름
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="검색..."
                  value={localSearchName}
                  onChange={(e) => setLocalSearchName(e.target.value)}
                  // ✅ 수정: py-2, border-gray-300, rounded-lg, shadow-sm
                  className="w-full pl-10 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white transition-all shadow-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                상태
              </label>
              <select
                value={filters.active}
                onChange={(e) => handleFilterChange("active", e.target.value)}
                // ✅ 수정: py-2, border-gray-300, rounded-lg, shadow-sm, px-3
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white shadow-sm"
              >
                <option value="all">모든 상태</option>
                <option value="true">활성 셀</option>
                <option value="false">비활성 셀</option>
              </select>
            </div>
          </div>
        </div>

        {/* List / Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : !cellPage || sortedCells.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
            조건에 맞는 셀이 없습니다.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden mb-4">
              {sortedCells.map((cell) => {
                const leaderName = cell.leader
                  ? formatDisplayName(
                      {
                        name: cell.leader.name,
                        birthDate: cell.leader.birthDate,
                      },
                      allMembersForNameCheck
                    )
                  : "미정";
                const rateText =
                  cell.attendanceRate !== undefined
                    ? `${Math.round(cell.attendanceRate)}%`
                    : "-";

                return (
                  <div
                    key={cell.id}
                    onClick={() => navigate(`/admin/cells/${cell.id}`)}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.99] transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                          {cell.name}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              cell.active
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {cell.active ? "활성" : "비활성"}
                          </span>
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          셀장: {leaderName}
                        </p>
                      </div>
                      {user?.role === "EXECUTIVE" && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/cells/${cell.id}/edit`);
                            }}
                            className="bg-gray-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-50"
                          >
                            수정
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(cell);
                            }}
                            className="bg-gray-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-gray-50 p-2 rounded-xl">
                        <div className="text-gray-400 mb-0.5 flex justify-center">
                          <UsersIcon className="h-3 w-3" />
                        </div>
                        <div className="font-bold text-gray-700">
                          {cell.memberCount}명
                        </div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-xl">
                        <div className="text-gray-400 mb-0.5 flex justify-center">
                          <UserGroupIcon className="h-3 w-3" />
                        </div>
                        <div className="font-bold text-gray-700">
                          {cell.maleCount}/{cell.femaleCount}
                        </div>
                      </div>
                      <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                        <div className="text-indigo-400 mb-0.5 flex justify-center">
                          <ChartBarIcon className="h-3 w-3" />
                        </div>
                        <div className="font-bold text-indigo-700">
                          {rateText}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    {[
                      { k: "name", l: "이름" },
                      { k: "leaderName", l: "셀장" },
                      { k: "active", l: "상태" },
                      { k: "memberCount", l: "인원" },
                      { k: "maleCount", l: "남성" },
                      { k: "femaleCount", l: "여성" },
                      { k: "attendanceRate", l: "출석률" },
                    ].map((col) => (
                      <th
                        key={col.k}
                        onClick={() => requestSort(col.k as SortKey)}
                        className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600 transition-colors"
                      >
                        {col.l} {getSortIndicator(col.k as SortKey)}
                      </th>
                    ))}
                    <th className="px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {sortedCells.map((cell) => {
                    const leaderName = cell.leader
                      ? formatDisplayName(
                          {
                            name: cell.leader.name,
                            birthDate: cell.leader.birthDate,
                          },
                          allMembersForNameCheck
                        )
                      : "미정";
                    const rateText =
                      cell.attendanceRate !== undefined
                        ? `${Math.round(cell.attendanceRate)}%`
                        : "-";
                    return (
                      <tr
                        key={cell.id}
                        onClick={() => navigate(`/admin/cells/${cell.id}`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4 font-bold text-indigo-600">
                          {cell.name}
                        </td>
                        <td className="px-6 py-4 text-gray-900">
                          {leaderName}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              cell.active
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {cell.active ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {cell.memberCount}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {cell.maleCount}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {cell.femaleCount}
                        </td>
                        <td className="px-6 py-4 font-bold text-indigo-600">
                          {rateText}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* ✅ 데스크탑 버튼: 텍스트 스타일 (테두리 없음) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/cells/${cell.id}/edit`);
                              }}
                              className="text-gray-400 hover:text-indigo-600 font-bold text-xs"
                            >
                              수정
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(cell);
                              }}
                              className="text-gray-400 hover:text-red-500 font-bold text-xs"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <Pagination
                currentPage={cellPage.number}
                totalPages={cellPage.totalPages}
                totalElements={cellPage.totalElements}
                onPageChange={handlePageChange}
                itemLabel="개 셀"
              />
            </div>
          </>
        )}

        {/* Delete Modal */}
        {showDeleteConfirmModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">셀 삭제</h3>
              <p className="text-sm text-gray-600 mb-6 break-keep">
                정말로{" "}
                <span className="font-bold text-gray-900">
                  "{cellToDelete?.name}"
                </span>{" "}
                셀을 삭제하시겠습니까? 소속된 멤버들의 정보에 영향을 줄 수
                있습니다.
              </p>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseDeleteModal}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700"
                >
                  삭제하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCellsPage;
