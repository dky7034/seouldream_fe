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

const lastDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};

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

  // ───────────────── 검색어 IME(한글) 버그 해결을 위한 로컬 상태 ─────────────────
  // URL의 'name' 파라미터와 분리하여 입력 UI를 제어합니다.
  const [localSearchName, setLocalSearchName] = useState(
    searchParams.get("name") || ""
  );
  // 로컬 입력값에 대해 0.5초 디바운스 적용
  const debouncedSearchName = useDebounce(localSearchName, 500);

  // ───────────────── 필터 상태 (URL 기반 초기값) ─────────────────
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
        if (value === undefined || value === null || value === "") {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      if (!Object.prototype.hasOwnProperty.call(updates, "page")) {
        newParams.set("page", "0");
      }

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // --- 정렬 설정 (URL에서 읽기) ---
  const getValidSortKey = (value: string | null): SortKey => {
    if (value === "name") return "name";
    if (value === "leaderName") return "leaderName";
    if (value === "viceLeaderName") return "viceLeaderName";
    if (value === "memberCount") return "memberCount";
    if (value === "attendanceRate") return "attendanceRate";
    if (value === "active") return "active";
    if (value === "maleCount") return "maleCount";
    if (value === "femaleCount") return "femaleCount";
    return "name";
  };

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const key = getValidSortKey(searchParams.get("sortKey"));
    const dirParam = searchParams.get("sortDir");
    const direction: SortConfig["direction"] =
      dirParam === "descending" ? "descending" : "ascending";
    return { key, direction };
  });

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get("page");
    const pageNum = pageParam ? Number(pageParam) : 0;
    return Number.isNaN(pageNum) || pageNum < 0 ? 0 : pageNum;
  });

  // 1. 디바운스된 검색어가 변경되면 URL 업데이트 (검색 실행)
  useEffect(() => {
    const currentParamsName = searchParams.get("name") || "";
    if (debouncedSearchName !== currentParamsName) {
      updateQueryParams({ name: debouncedSearchName });
    }
  }, [debouncedSearchName, searchParams, updateQueryParams]);

  // 2. 브라우저 뒤로가기 등으로 URL이 변경되었을 때 입력창 동기화
  useEffect(() => {
    const paramsName = searchParams.get("name") || "";
    if (paramsName !== localSearchName) {
      setLocalSearchName(paramsName);
    }
    // localSearchName을 의존성에 넣으면 루프 돌 수 있으므로 제외 (단방향 동기화)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const key = getValidSortKey(searchParams.get("sortKey"));
    const dirParam = searchParams.get("sortDir");
    const direction: SortConfig["direction"] =
      dirParam === "descending" ? "descending" : "ascending";
    const pageParam = searchParams.get("page");
    const pageNum = pageParam ? Number(pageParam) : 0;
    const safePage = Number.isNaN(pageNum) || pageNum < 0 ? 0 : pageNum;

    setSortConfig({ key, direction });
    setCurrentPage(safePage);

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
      // name은 로컬 스테이트가 관리하지만 filters 객체 동기화를 위해 업데이트
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

  // --- 데이터 페칭 ---

  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await cellService.getAvailableYears();
      if (years.length === 0) {
        setAvailableYears([new Date().getFullYear()]);
      } else {
        setAvailableYears(years.sort((a, b) => b - a));
      }
    } catch (err) {
      console.error(err);
      setAvailableYears([new Date().getFullYear()]);
    }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters();
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
      if (semester) {
        return { startDate: semester.startDate, endDate: semester.endDate };
      }
    }

    const year = typeof filters.year === "number" ? filters.year : undefined;
    if (!year) {
      return null;
    }

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
      // attendanceRate도 서버 필드명과 일치한다고 가정 (불일치 시 매핑 추가 필요)
    };

    // ✅ [버그 수정 1] attendanceRate일 때도 항상 서버로 정렬 파라미터 전송
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
      name: debouncedSearchName, // ✅ URL과 동기화된 디바운스 값 사용
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
      const data = await cellService.getAllCells(cleanedParams);
      setCellPage(data);
    } catch (err) {
      setError("셀 목록을 불러오는 데 실패했습니다.");
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
      if (user) setError("접근 권한이 없습니다.");
      else setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    fetchAvailableYears();
    fetchSemesters();

    const fetchMembers = async () => {
      try {
        const page = await memberService.getAllMembers({ page: 0, size: 1000 });
        setAllMembersForNameCheck(
          page?.content?.map((m) => ({
            name: m.name,
            birthDate: m.birthDate,
          })) ?? []
        );
      } catch (e) {
        /* ignore */
      }
    };
    fetchMembers();
  }, [user, fetchAvailableYears, fetchSemesters]);

  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    if (semesters.length === 0 && unitType === "semester") return;

    fetchCells();
  }, [user, fetchCells, semesters.length, unitType]);

  useEffect(() => {
    if (semesters.length === 0 || hasInitialized) return;

    const hasUrlParams =
      searchParams.get("semesterId") ||
      searchParams.get("year") ||
      searchParams.get("startDate");

    if (hasUrlParams) {
      setHasInitialized(true);
      return;
    }

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    let targetSemester = semesters.find((s) => {
      const start = s.startDate.substring(0, 7);
      const end = s.endDate.substring(0, 7);
      return currentYearMonth >= start && currentYearMonth <= end;
    });

    if (!targetSemester) {
      const sorted = [...semesters].sort((a, b) => b.id - a.id);
      targetSemester = sorted[0];
    }

    if (targetSemester) {
      updateQueryParams({
        unitType: "semester",
        semesterId: targetSemester.id,
        year: "",
        month: "",
        active: "all",
      });
    } else {
      updateQueryParams({
        unitType: "month",
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        semesterId: "",
        active: "all",
      });
    }
    setHasInitialized(true);
  }, [semesters, hasInitialized, searchParams, updateQueryParams]);

  // --- Memoized Data ---

  const yearOptions = useMemo(
    () => availableYears.map((year) => ({ value: year, label: `${year}` })),
    [availableYears]
  );

  // ✅ [버그 수정 1 관련] 프론트엔드 정렬 로직 제거
  // 서버에서 이미 정렬되어 오므로 그대로 렌더링
  const sortedCells = useMemo(() => {
    if (!cellPage) return [];
    return cellPage.content;
  }, [cellPage]);

  // --- Event Handlers ---

  const requestSort = (key: SortKey) => {
    const nextDirection: SortConfig["direction"] =
      sortConfig.key === key && sortConfig.direction === "ascending"
        ? "descending"
        : "ascending";

    updateQueryParams({
      sortKey: key,
      sortDir: nextDirection,
      page: 0,
    });
  };

  const handlePageChange = (page: number) => {
    const safePage = page < 0 ? 0 : page;
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(safePage));
    setSearchParams(newParams);
  };

  const handleDelete = (cell: CellDto) => {
    setCellToDelete(cell);
    setDeleteError(null);
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!cellToDelete) return;
    setDeleteError(null);
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

  const handleFilterChange = (field: keyof Filters, value: any) => {
    updateQueryParams({ [field]: value });
  };

  const handleSemesterClick = (id: number) => {
    const newValue = filters.semesterId === id ? "" : id;
    updateQueryParams({ semesterId: newValue });
  };

  const handleUnitTypeClick = (type: "year" | "month" | "semester") => {
    const now = new Date();
    const updates: Record<string, string | number> = {
      unitType: type,
      filterType: "unit",
    };

    if (type === "year") {
      updates.year = filters.year === "" ? "" : filters.year || "";
      updates.month = "";
      updates.semesterId = "";
    } else if (type === "month") {
      updates.year =
        filters.year === ""
          ? now.getFullYear()
          : filters.year || now.getFullYear();
      updates.month = filters.month || now.getMonth() + 1;
      updates.semesterId = "";
    } else if (type === "semester") {
      updates.year = "";
      updates.month = "";
      if (semesters.length > 0 && !filters.semesterId) {
        updates.semesterId = semesters[0].id;
      }
    }

    updateQueryParams(updates);
  };

  const handleUnitValueClick = (value: number) => {
    updateQueryParams({ month: value });
  };

  const handleFilterTypeChange = (type: "unit" | "range") => {
    updateQueryParams({ filterType: type });
  };

  // --- Render Helpers ---

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                onClick={() => handleUnitValueClick(m)}
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
        if (semesters.length === 0)
          return (
            <div className="text-xs text-yellow-800 bg-yellow-50 p-3 rounded">
              생성된 학기가 없습니다.
            </div>
          );
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

  // --- Main Render ---

  if (error && (!user || user.role !== "EXECUTIVE")) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              셀 관리
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              셀과 셀장 정보를 관리하고, 기간별 출석률을 확인합니다.
            </p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg mb-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base sm:text-lg font-semibold">
              조회 기간 설정
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleFilterTypeChange("unit")}
                className={`px-3 py-1 text-xs sm:text-sm rounded-full ${
                  filterType === "unit"
                    ? "bg-blue-500 text-white"
                    : "bg-white border"
                }`}
              >
                단위로 조회
              </button>
              <button
                onClick={() => handleFilterTypeChange("range")}
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
                <KoreanCalendarPicker
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange("startDate", date)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기간 종료
                </label>
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
                    onChange={(e) => handleFilterChange("year", e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3 text-sm"
                    disabled={unitType === "semester"}
                  >
                    <option value="">전체 연도</option>
                    {yearOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}년
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    조회 단위
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <button
                      onClick={() => handleUnitTypeClick("month")}
                      className={`px-3 py-1 text-xs rounded-full ${
                        unitType === "month"
                          ? "bg-blue-500 text-white"
                          : "bg-white border"
                      }`}
                    >
                      월간
                    </button>
                    <button
                      onClick={() =>
                        hasActiveSemesters && handleUnitTypeClick("semester")
                      }
                      disabled={!hasActiveSemesters}
                      className={`px-3 py-1 text-xs rounded-full border ${
                        hasActiveSemesters
                          ? unitType === "semester"
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white"
                          : "bg-gray-100 text-gray-400 border-dashed"
                      }`}
                    >
                      학기
                    </button>
                    <button
                      onClick={() => handleUnitTypeClick("year")}
                      className={`px-3 py-1 text-xs rounded-full ${
                        unitType === "year"
                          ? "bg-blue-500 text-white"
                          : "bg-white border"
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

          <hr />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                셀 이름
              </label>
              <input
                type="text"
                placeholder="이름으로 검색..."
                // ✅ [버그 수정 2] 로컬 state 사용 및 onChange 분리
                value={localSearchName}
                onChange={(e) => setLocalSearchName(e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상태
              </label>
              <select
                value={filters.active}
                onChange={(e) => handleFilterChange("active", e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
              >
                <option value="all">모든 상태</option>
                <option value="true">활성 셀만</option>
                <option value="false">비활성 셀만</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <button
            onClick={() => navigate("/admin/cells/add")}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            + 새 셀 추가
          </button>
        </div>

        {loading && (
          <div className="text-center py-10 text-gray-500">
            데이터를 불러오는 중...
          </div>
        )}

        {!loading && cellPage && (
          <>
            {/* 📱 모바일 카드 뷰 */}
            <div className="space-y-3 md:hidden mb-4">
              {sortedCells.length === 0 ? (
                <div className="p-4 bg-white text-center text-gray-500 text-sm">
                  데이터가 없습니다.
                </div>
              ) : (
                sortedCells.map((cell) => {
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
                      className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer border border-gray-100"
                    >
                      <div className="flex justify-between">
                        <span className="font-bold text-indigo-600">
                          {cell.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            cell.active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {cell.active ? "활성" : "비활성"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        셀장: {leaderName}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2 bg-gray-50 p-2 rounded">
                        <div>
                          <div className="text-gray-400">인원</div>
                          <div>{cell.memberCount}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">남/여</div>
                          <div>
                            {cell.maleCount}/{cell.femaleCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400">출석률</div>
                          <div className="font-semibold text-blue-600">
                            {rateText}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => requestSort("name")}
                      className="px-6 py-3 text-left font-medium text-gray-500 cursor-pointer"
                    >
                      이름{getSortIndicator("name")}
                    </th>
                    <th
                      onClick={() => requestSort("leaderName")}
                      className="px-6 py-3 text-left font-medium text-gray-500 cursor-pointer"
                    >
                      셀장{getSortIndicator("leaderName")}
                    </th>
                    <th
                      onClick={() => requestSort("active")}
                      className="px-6 py-3 text-left font-medium text-gray-500 cursor-pointer"
                    >
                      활성{getSortIndicator("active")}
                    </th>
                    <th
                      onClick={() => requestSort("memberCount")}
                      className="px-6 py-3 text-left font-medium text-gray-500 cursor-pointer"
                    >
                      인원{getSortIndicator("memberCount")}
                    </th>
                    <th
                      onClick={() => requestSort("maleCount")}
                      className="px-6 py-3 text-left font-medium text-gray-500 cursor-pointer"
                    >
                      남성{getSortIndicator("maleCount")}
                    </th>
                    <th
                      onClick={() => requestSort("femaleCount")}
                      className="px-6 py-3 text-left font-medium text-gray-500 cursor-pointer"
                    >
                      여성{getSortIndicator("femaleCount")}
                    </th>
                    <th
                      onClick={() => requestSort("attendanceRate")}
                      className="px-6 py-3 text-left font-medium text-gray-500 cursor-pointer"
                    >
                      출석률{getSortIndicator("attendanceRate")}
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedCells.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    sortedCells.map((cell) => {
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
                          className="hover:bg-indigo-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-indigo-600">
                            {cell.name}
                          </td>
                          <td className="px-6 py-4">{leaderName}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                cell.active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {cell.active ? "활성" : "비활성"}
                            </span>
                          </td>
                          <td className="px-6 py-4">{cell.memberCount}명</td>
                          <td className="px-6 py-4">{cell.maleCount}명</td>
                          <td className="px-6 py-4">{cell.femaleCount}명</td>
                          <td className="px-6 py-4 font-semibold text-blue-600">
                            {rateText}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/cells/${cell.id}/edit`);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              수정
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(cell);
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={cellPage.number}
              totalPages={cellPage.totalPages}
              totalElements={cellPage.totalElements}
              onPageChange={handlePageChange}
              itemLabel="개 셀"
            />
          </>
        )}

        {showDeleteConfirmModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-sm w-full">
              <h2 className="text-lg sm:text-xl font-bold mb-4">
                셀 삭제 확인
              </h2>
              <p className="text-gray-700 mb-2 text-sm">
                정말로 &quot;{cellToDelete?.name}&quot; 셀을 삭제하시겠습니까?
              </p>

              {deleteError && (
                <div className="mt-2 p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={handleCloseDeleteModal}
                  className="bg-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-400"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700"
                >
                  삭제
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
