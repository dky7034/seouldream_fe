// src/pages/AdminCellsPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cellService } from "../services/cellService";
import { attendanceService } from "../services/attendanceService";
import type {
  GetAllCellsParams,
  CellDto,
  Page,
  SimpleAttendanceRateDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import Pagination from "../components/Pagination";
import { useDebounce } from "../hooks/useDebounce";
import { formatDisplayName } from "../utils/memberUtils";
import { memberService } from "../services/memberService";
import { semesterService } from "../services/semesterService";
import type { SemesterDto } from "../types";

type SortConfig = {
  key:
    | keyof CellDto
    | "leaderName"
    | "viceLeaderName"
    | "memberCount"
    | "attendanceRate";
  direction: "ascending" | "descending";
};

// ✅ 기간 계산용 유틸
const pad = (n: number) => n.toString().padStart(2, "0");

// month: 1~12, 결과는 해당 달의 마지막 날(28/29/30/31)
const lastDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};

// ✅ 필터 타입 정의 (semesterId 포함)
type Filters = {
  name: string;
  active: "all" | "true" | "false";
  startDate: string;
  endDate: string;
  year: number | "";
  month: number | "";
  quarter: number | "";
  half: number | "";
  semesterId: number | "";
};

const AdminCellsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);

  const hasActiveSemesters = semesters.length > 0;

  const [cellPage, setCellPage] = useState<Page<CellDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [cellToDelete, setCellToDelete] = useState<CellDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { name: string; birthDate?: string }[]
  >([]);

  const now = new Date();
  const currentYear = now.getFullYear();

  const [filters, setFilters] = useState<Filters>({
    name: "",
    active: "all",
    startDate: "",
    endDate: "",
    year: currentYear,
    month: "",
    quarter: "",
    half: "",
    semesterId: "",
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "name",
    direction: "ascending",
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [filterType, setFilterType] = useState<"unit" | "range">("unit");

  const [unitType, setUnitType] = useState<
    "year" | "half" | "quarter" | "month" | "semester"
  >("year");

  const [attendanceRates, setAttendanceRates] = useState<
    Map<number, SimpleAttendanceRateDto>
  >(new Map());
  const [rateLoading, setRateLoading] = useState<boolean>(false);

  const debouncedNameFilter = useDebounce(filters.name, 500);

  // ✅ 출석 데이터에서 사용 가능한 연도 목록
  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await attendanceService.getAvailableYears();
      setAvailableYears(years);
    } catch (err) {
      console.error("Failed to fetch available years:", err);
      setAvailableYears([]);
    }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("Failed to fetch semesters in AdminCellsPage:", err);
      setSemesters([]);
    }
  }, []);

  // ✅ filters + filterType + semesters 기준으로 최종 dateRange 계산
  const getDateRangeFromFilters = useCallback((): {
    startDate: string;
    endDate: string;
  } | null => {
    // 1) 기간 직접 입력 모드
    if (filterType === "range") {
      if (!filters.startDate || !filters.endDate) return null;
      return {
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    }

    // 2) 학기 선택 모드: semesterId가 있으면 항상 학기 우선
    if (filters.semesterId) {
      const semester = semesters.find((s) => s.id === filters.semesterId);
      if (semester) {
        return {
          startDate: semester.startDate,
          endDate: semester.endDate,
        };
      }
    }

    // 3) 단위 기반 모드 (연/반기/분기/월)
    const year = typeof filters.year === "number" ? filters.year : undefined;
    if (!year) {
      // 연도 선택이 안 되어 있으면 createdAt 필터 없이 전체 조회
      return null;
    }

    const { month, quarter, half } = filters;

    // ✅ 월간
    if (month) {
      const m = month as number;
      const last = lastDayOfMonth(year, m);
      return {
        startDate: `${year}-${pad(m)}-01`,
        endDate: `${year}-${pad(m)}-${pad(last)}`,
      };
    }

    // ✅ 분기
    if (quarter) {
      const q = quarter as number;
      const startMonth = (q - 1) * 3 + 1; // 1, 4, 7, 10
      const endMonth = startMonth + 2; // 3, 6, 9, 12
      const last = lastDayOfMonth(year, endMonth);
      return {
        startDate: `${year}-${pad(startMonth)}-01`,
        endDate: `${year}-${pad(endMonth)}-${pad(last)}`,
      };
    }

    // ✅ 반기
    if (half) {
      const h = half as number;
      if (h === 1) {
        const last = lastDayOfMonth(year, 6);
        return {
          startDate: `${year}-01-01`,
          endDate: `${year}-06-${pad(last)}`,
        };
      } else {
        const last = lastDayOfMonth(year, 12);
        return {
          startDate: `${year}-07-01`,
          endDate: `${year}-12-${pad(last)}`,
        };
      }
    }

    // ✅ 연간
    const last = lastDayOfMonth(year, 12);
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-${pad(last)}`,
    };
  }, [filterType, filters, semesters]);

  // ✅ 셀 목록 조회 (createdAt 기준 필터는 startDate/endDate만 사용)
  const fetchCells = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") return;

    setLoading(true);
    setError(null);

    const sortKeyMap: Record<string, string> = {
      leaderName: "leader.name",
      viceLeaderName: "viceLeader.name",
    };

    // ✅ 출석률 정렬일 때는 백엔드 sort 파라미터를 보내지 않음
    let sortParam: string | undefined = undefined;
    if (sortConfig.key !== "attendanceRate") {
      const backendSortKey =
        sortKeyMap[sortConfig.key as string] || sortConfig.key;
      sortParam = `${backendSortKey},${
        sortConfig.direction === "ascending" ? "asc" : "desc"
      }`;
    }

    const dateRange = getDateRangeFromFilters();

    let params: GetAllCellsParams = {
      page: currentPage,
      size: 10,
      sort: sortParam,
      name: debouncedNameFilter,
      active: filters.active === "all" ? undefined : filters.active === "true",
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
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
    debouncedNameFilter,
    filters.active,
    getDateRangeFromFilters,
  ]);

  // 권한 체크만 담당
  useEffect(() => {
    if (!user) {
      setError("로그인 후 셀 관리 페이지에 접근할 수 있습니다.");
      setLoading(false);
      return;
    }
    if (user.role !== "EXECUTIVE") {
      setError("셀 관리 페이지에 접근할 권한이 없습니다.");
      setLoading(false);
      return;
    }
  }, [user]);

  // 셀 목록: 유저/필터/페이지 변화에 반응해서 재조회
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    fetchCells();
  }, [user, fetchCells]);

  // 학기 + 연도 목록: 유저 확정 후 한 번만 로딩
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    fetchAvailableYears();
    fetchSemesters();
  }, [user, fetchAvailableYears, fetchSemesters]);

  // ✅ 동명이인 판별용: 전체 멤버 이름/생년월일 로딩
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

  // ✅ 셀별 출석률: 셀 리스트와 동일한 dateRange 사용
  useEffect(() => {
    if (!cellPage?.content || cellPage.content.length === 0) {
      setAttendanceRates(new Map());
      return;
    }

    const dateRange = getDateRangeFromFilters();
    if (!dateRange) {
      setAttendanceRates(new Map());
      return;
    }

    const fetchRates = async () => {
      setRateLoading(true);
      const rates = new Map<number, SimpleAttendanceRateDto>();
      await Promise.all(
        cellPage.content.map(async (cell) => {
          try {
            const rateData = await cellService.getCellAttendanceRate(cell.id, {
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
            });
            rates.set(cell.id, rateData);
          } catch (rateError) {
            console.error(
              `Failed to fetch attendance rate for cell ${cell.id}:`,
              rateError
            );
          }
        })
      );
      setAttendanceRates(rates);
      setRateLoading(false);
    };

    fetchRates();
  }, [cellPage, getDateRangeFromFilters]);

  const yearOptions = useMemo(
    () =>
      availableYears.map((year) => ({
        value: year,
        label: `${year}`,
      })),
    [availableYears]
  );

  // ✅ 출석률 포함 프론트 정렬용 배열
  const sortedCells = useMemo(() => {
    if (!cellPage) return [];

    const rows = [...cellPage.content];

    if (sortConfig.key === "attendanceRate") {
      rows.sort((a, b) => {
        const rateA = attendanceRates.get(a.id)?.attendanceRate;
        const rateB = attendanceRates.get(b.id)?.attendanceRate;

        const valueA = typeof rateA === "number" ? rateA : -1;
        const valueB = typeof rateB === "number" ? rateB : -1;

        if (sortConfig.direction === "ascending") {
          return valueA - valueB;
        } else {
          return valueB - valueA;
        }
      });
    }

    return rows;
  }, [cellPage, sortConfig, attendanceRates]);

  const requestSort = (key: SortConfig["key"]) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
    setCurrentPage(0);
  };

  const getSortIndicator = (key: SortConfig["key"]) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
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
      setDeleteError(err?.response?.data?.message || "셀 삭제에 실패했습니다.");
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmModal(false);
    setCellToDelete(null);
    setDeleteError(null);
  };

  const handleFilterChange = (field: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  const handleSemesterClick = (id: number) => {
    setFilters((prev) => ({
      ...prev,
      semesterId: prev.semesterId === id ? "" : id,
    }));
    setCurrentPage(0);
  };

  // ✅ 단위 버튼 클릭 (연/반기/분기/월/학기)
  const handleUnitTypeClick = (
    type: "year" | "half" | "quarter" | "month" | "semester"
  ) => {
    setUnitType(type);
    setFilters((prev) => {
      const next: Filters = { ...prev };
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      if (type === "year") {
        if (!next.year) {
          next.year = currentYear;
        }
        next.month = "";
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "half") {
        if (!next.year) {
          next.year = currentYear;
        }
        next.half = (next.half as number) || 1;
        next.month = "";
        next.quarter = "";
        next.semesterId = "";
      } else if (type === "quarter") {
        if (!next.year) {
          next.year = currentYear;
        }
        next.quarter = (next.quarter as number) || 1;
        next.month = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "month") {
        if (!next.year) {
          next.year = currentYear;
        }
        next.month = (next.month as number) || currentMonth;
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
    }));
    setCurrentPage(0);
  };

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
            {Array.from({ length: 2 }, (_, i) => i + 1).map((h) => (
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
            <div className="mt-4 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
              현재 활성 상태인 학기가 없습니다. 공지/출석 화면에서 학기 선택을
              사용하려면 최소 1개 이상의 학기를 활성화해 주세요.
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
      case "year":
      default:
        return null;
    }
  };

  // 권한 없는 경우 빠른 리턴 (레이아웃 포함)
  if (error && (!user || user.role !== "EXECUTIVE")) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <p className="mt-4 text-red-600 text-center text-sm sm:text-base">
            {error}
          </p>
        </div>
      </div>
    );
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
              셀 조직과 셀장 정보를 관리하고, 기간별 출석률을 한눈에 확인하는
              임원 전용 페이지입니다.
            </p>
          </div>
        </div>

        {error && user && user.role === "EXECUTIVE" && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* 필터 영역 */}
        <div className="p-4 bg-gray-50 rounded-lg mb-6 shadow-sm space-y-4">
          {/* 상단: 제목 + 단위/기간 토글 */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base sm:text-lg font-semibold">
              조회 기간 설정 (셀 생성일 기준)
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

          {filterType === "range" ? (
            // ✅ 직접 기간 선택
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
            // ✅ 단위 조회 (연/반기/분기/월/학기)
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
                    <option value="">전체 연도</option>
                    {yearOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}년
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
                    <p className="mt-1 text-xs text-red-500">
                      활성화된 학기가 없어 학기 단위 조회를 사용할 수 없습니다.
                    </p>
                  )}
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
                value={filters.name}
                onChange={(e) => handleFilterChange("name", e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상태
              </label>
              <select
                value={filters.active}
                onChange={(e) =>
                  handleFilterChange(
                    "active",
                    e.target.value as Filters["active"]
                  )
                }
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
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            + 새 셀 추가
          </button>
        </div>

        {loading && (
          <p className="text-center text-sm text-gray-600 mt-4">로딩 중...</p>
        )}

        {!loading && cellPage && (
          <>
            <div className="bg-white shadow-md rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => requestSort("name")}
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      이름{getSortIndicator("name")}
                    </th>
                    <th
                      onClick={() => requestSort("leaderName")}
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      셀장{getSortIndicator("leaderName")}
                    </th>
                    <th
                      onClick={() => requestSort("active")}
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      활성{getSortIndicator("active")}
                    </th>
                    <th
                      onClick={() => requestSort("memberCount")}
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      인원{getSortIndicator("memberCount")}
                    </th>
                    <th
                      onClick={() => requestSort("maleCount")}
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      남성{getSortIndicator("maleCount" as SortConfig["key"])}
                    </th>
                    <th
                      onClick={() => requestSort("femaleCount")}
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      여성
                      {getSortIndicator("femaleCount" as SortConfig["key"])}
                    </th>
                    <th
                      onClick={() => requestSort("attendanceRate")}
                      className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                    >
                      출석률
                      {getSortIndicator("attendanceRate" as SortConfig["key"])}
                    </th>
                    <th className="relative px-3 sm:px-6 py-2 sm:py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedCells.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500"
                      >
                        조건에 맞는 셀이 없습니다. 필터를 변경해 보세요.
                      </td>
                    </tr>
                  ) : (
                    sortedCells.map((cell) => {
                      const rateInfo = attendanceRates.get(cell.id);
                      return (
                        <tr
                          key={cell.id}
                          className={
                            !cell.active ? "bg-gray-100 text-gray-500" : ""
                          }
                        >
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                            <button
                              onClick={() =>
                                navigate(`/admin/cells/${cell.id}`)
                              }
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              {cell.name}
                            </button>
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                            {cell.leader
                              ? formatDisplayName(
                                  {
                                    name: cell.leader.name,
                                    birthDate: cell.leader.birthDate,
                                  },
                                  allMembersForNameCheck
                                )
                              : "미정"}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                            <span
                              className={`px-2 inline-flex text-[11px] sm:text-xs leading-5 font-semibold rounded-full ${
                                cell.active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {cell.active ? "활성" : "비활성"}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                            {cell.memberCount}명
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                            {cell.maleCount}명
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                            {cell.femaleCount}명
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                            {rateLoading
                              ? "..."
                              : `${(rateInfo?.attendanceRate ?? 0).toFixed(
                                  1
                                )}%`}
                          </td>

                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                            <button
                              onClick={() =>
                                navigate(`/admin/cells/${cell.id}/edit`)
                              }
                              className="text-indigo-600 hover:text-indigo-900 mr-3 sm:mr-4"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(cell)}
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
              onPageChange={setCurrentPage}
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
              <p className="text-xs text-gray-500 mb-4">
                셀을 삭제하면 해당 셀에 소속된 멤버/출석 정보에 영향을 줄 수
                있습니다. 필요하다면 먼저 셀 구성과 출석 데이터를 확인해 주세요.
              </p>
              {deleteError && (
                <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md mb-4">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCloseDeleteModal}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="bg-red-600 text-white px-4 py-2 rounded-md text-sm"
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
