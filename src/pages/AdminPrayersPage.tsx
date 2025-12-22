// src/pages/AdminPrayersPage.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  useNavigate,
  Link,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { prayerService } from "../services/prayerService";
import type {
  GetPrayersParams,
  PrayerDto,
  Page,
  SemesterDto,
  MemberDto,
  PrayerMemberSummaryDto,
  PrayerCellSummaryDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import ConfirmModal from "../components/ConfirmModal";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import Pagination from "../components/Pagination";
import { semesterService } from "../services/semesterService";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker"; // ✅ 달력 컴포넌트 임포트

// 뷰 모드: 개별 리스트 / 멤버 요약 / 셀 요약
type ViewMode = "prayerList" | "memberSummary" | "cellSummary";

type SortKey = "createdAt" | "visibility" | "memberName" | "creatorName";

type SortConfig = {
  key: SortKey;
  direction: "ascending" | "descending";
};

const sortKeyMap: Record<SortKey, string> = {
  createdAt: "createdAt",
  visibility: "visibility",
  memberName: "member.name",
  creatorName: "creatorName",
};

type UnitType = "year" | "half" | "quarter" | "month" | "semester";

const AdminPrayersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // 현재 시각 기준 (연/월 기본값에 사용)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // ✅ URL 기준으로 현재 모드를 계산
  const urlViewMode: ViewMode = useMemo(() => {
    if (location.pathname.endsWith("/summary/members")) return "memberSummary";
    if (location.pathname.endsWith("/summary/cells")) return "cellSummary";
    return "prayerList";
  }, [location.pathname]);

  // 내부 상태는 URL을 따라가도록
  const [viewMode, setViewMode] = useState<ViewMode>(urlViewMode);

  useEffect(() => {
    setViewMode(urlViewMode);
  }, [urlViewMode]);

  // 🔹 URL에서 유효한 sortKey 파싱하는 헬퍼
  const getValidSortKey = (value: string | null): SortKey => {
    if (value === "createdAt") return "createdAt";
    if (value === "visibility") return "visibility";
    if (value === "memberName") return "memberName";
    if (value === "creatorName") return "creatorName";
    return "createdAt";
  };

  // 🔹 URL에서 초기 정렬/페이지 읽어오기
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const key = getValidSortKey(searchParams.get("sortKey"));
    const dirParam = searchParams.get("sortDir");
    const direction: SortConfig["direction"] =
      dirParam === "ascending" ? "ascending" : "descending";
    return { key, direction };
  });

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get("page");
    const pageNum = pageParam ? Number(pageParam) : 0;
    return Number.isNaN(pageNum) || pageNum < 0 ? 0 : pageNum;
  });

  // 🔹 브라우저 뒤로가기/앞으로가기 등으로 쿼리가 바뀔 때 상태 동기화
  useEffect(() => {
    const key = getValidSortKey(searchParams.get("sortKey"));
    const dirParam = searchParams.get("sortDir");
    const direction: SortConfig["direction"] =
      dirParam === "ascending" ? "ascending" : "descending";

    const pageParam = searchParams.get("page");
    const pageNum = pageParam ? Number(pageParam) : 0;
    const safePage = Number.isNaN(pageNum) || pageNum < 0 ? 0 : pageNum;

    setSortConfig((prev) =>
      prev.key === key && prev.direction === direction
        ? prev
        : { key, direction }
    );
    setCurrentPage((prev) => (prev === safePage ? prev : safePage));
  }, [searchParams]);

  // ===== 상태들 =====
  const [prayerPage, setPrayerPage] = useState<Page<PrayerDto> | null>(null);
  const [memberSummaryPage, setMemberSummaryPage] =
    useState<Page<PrayerMemberSummaryDto> | null>(null);
  const [cellSummaryPage, setCellSummaryPage] =
    useState<Page<PrayerCellSummaryDto> | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);

  // 초기값은 빈 문자열로 설정되어 있음
  const [filters, setFilters] = useState({
    visibility: "all",
    cell: "all",
    member: "all",
    creator: "all",
    showDeleted: false,
    startDate: "",
    endDate: "",
    year: currentYear as number | "",
    month: "" as number | "",
    quarter: "" as number | "",
    half: "" as number | "",
    semesterId: "" as number | "",
  });

  const [filterType, setFilterType] = useState<"unit" | "range">("unit");
  const [unitType, setUnitType] = useState<UnitType>("year");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prayerToDelete, setPrayerToDelete] = useState<number | null>(null);

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";
  const canManage = isExecutive || isCellLeader;
  const hasActiveSemesters = semesters.length > 0;

  const memberOptions: { value: number; label: string }[] = [];
  const cellOptions: { value: number; label: string }[] = [];

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("학기 목록 로딩 실패:", err);
      setSemesters([]);
    }
  }, []);

  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await prayerService.getAvailableYears();
      setAvailableYears(years);
    } catch (err) {
      console.error("Failed to fetch available years for prayers:", err);
      setAvailableYears([]);
    }
  }, []);

  const buildBaseParams = useCallback((): GetPrayersParams => {
    const sortField = sortKeyMap[sortConfig.key];

    let params: GetPrayersParams = {
      page: currentPage,
      size: 10,
      sort: `${sortField},${
        sortConfig.direction === "ascending" ? "asc" : "desc"
      }`,
      isDeleted: filters.showDeleted,
    };

    if (filterType === "range") {
      params = {
        ...params,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
    } else {
      if (filters.semesterId && semesters.length > 0) {
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          params = {
            ...params,
            startDate: semester.startDate,
            endDate: semester.endDate,
          };
        }
      } else {
        params = {
          ...params,
          year: normalizeNumberInput(filters.year),
          month: normalizeNumberInput(filters.month),
          quarter: normalizeNumberInput(filters.quarter),
          half: normalizeNumberInput(filters.half),
        };
      }
    }

    if (isExecutive) {
      if (filters.cell !== "all") params.cellId = Number(filters.cell);
      if (filters.member !== "all") params.memberId = Number(filters.member);
      if (filters.creator !== "all")
        params.createdById = Number(filters.creator);
    } else if (isCellLeader) {
      params.cellId = user?.cellId ?? undefined;
    }

    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    ) as GetPrayersParams;

    return cleanedParams;
  }, [
    currentPage,
    sortConfig,
    filters,
    filterType,
    semesters,
    isExecutive,
    isCellLeader,
    user,
  ]);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError("로그인이 필요한 페이지입니다.");
      return;
    }
    if (!canManage) {
      setLoading(false);
      setError("기도제목 관리 페이지에 접근할 권한이 없습니다.");
      return;
    }
    if (
      !isExecutive &&
      (viewMode === "memberSummary" || viewMode === "cellSummary")
    ) {
      setLoading(false);
      setError("멤버/셀 요약 뷰는 임원단(EXECUTIVE)만 조회할 수 있습니다.");
      return;
    }
    if (isCellLeader && !user.cellId) {
      setLoading(false);
      setError("셀장 정보에 셀 ID가 없습니다. 관리자에게 문의하세요.");
      return;
    }

    setLoading(true);
    setError(null);

    const params = buildBaseParams();

    try {
      if (viewMode === "prayerList") {
        const prayerData = await prayerService.getPrayers(params);
        setPrayerPage(prayerData);
      } else if (viewMode === "memberSummary") {
        const summaryData = await prayerService.getMemberPrayerSummary(params);
        setMemberSummaryPage(summaryData);
      } else if (viewMode === "cellSummary") {
        const summaryData = await prayerService.getCellPrayerSummary(params);
        setCellSummaryPage(summaryData);
      }
    } catch (err) {
      console.error("기도제목 데이터 로딩 실패:", err);
      setError("기도제목 데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user, canManage, isExecutive, isCellLeader, buildBaseParams, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (user) {
      fetchAvailableYears();
      fetchSemesters();
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

  const yearOptions = useMemo(() => {
    if (availableYears.length === 0) {
      const cy = currentYear;
      return [
        { value: "", label: "전체 연도" },
        { value: cy, label: `${cy}년` },
      ];
    }
    const options = availableYears.map((year) => ({
      value: year,
      label: `${year}년`,
    }));
    return [{ value: "", label: "전체 연도" }, ...options];
  }, [availableYears, currentYear]);

  const requestSort = (key: SortKey) => {
    setSortConfig((prev) => {
      const nextDirection: SortConfig["direction"] =
        prev.key === key && prev.direction === "ascending"
          ? "descending"
          : "ascending";

      const nextConfig: SortConfig = {
        key,
        direction: nextDirection,
      };

      setCurrentPage(0);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("sortKey", nextConfig.key);
      nextParams.set("sortDir", nextConfig.direction);
      nextParams.set("page", "0");
      setSearchParams(nextParams);

      return nextConfig;
    });
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  const handlePageChange = (page: number) => {
    const safePage = page < 0 ? 0 : page;
    setCurrentPage(safePage);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(safePage));
    nextParams.set("sortKey", sortConfig.key);
    nextParams.set("sortDir", sortConfig.direction);
    setSearchParams(nextParams);
  };

  const handleDelete = (prayerId: number) => {
    setPrayerToDelete(prayerId);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (prayerToDelete === null) return;
    try {
      await prayerService.deletePrayer(prayerToDelete);
      await fetchData();
    } catch (err) {
      console.error("기도제목 삭제 실패:", err);
      alert("삭제에 실패했습니다.");
    } finally {
      setIsModalOpen(false);
      setPrayerToDelete(null);
    }
  };

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");
    nextParams.set("sortKey", sortConfig.key);
    nextParams.set("sortDir", sortConfig.direction);
    setSearchParams(nextParams);
  };

  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);

    setFilters((prev) => {
      const next = { ...prev };
      const baseYear = (prev.year as number) || currentYear;

      if (type === "year") {
        next.year = baseYear;
        next.month = "";
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "half") {
        next.year = baseYear;
        next.half = (next.half as number) || 1;
        next.month = "";
        next.quarter = "";
        next.semesterId = "";
      } else if (type === "quarter") {
        next.year = baseYear;
        next.quarter = (next.quarter as number) || 1;
        next.month = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = baseYear;
        next.month = (next.month as number) || currentMonth;
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "semester") {
        next.year = "";
        next.month = "";
        next.quarter = "";
        next.half = "";
        if (!next.semesterId && semesters.length > 0) {
          next.semesterId = semesters[0].id;
        }
      }

      return next;
    });

    setCurrentPage(0);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");
    setSearchParams(nextParams);
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

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");
    setSearchParams(nextParams);
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

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", "0");
    setSearchParams(nextParams);
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

      if (unitType === "year") {
        return `조회 단위: 연간 (${yearText})`;
      }
      if (unitType === "half" && filters.half) {
        return `조회 단위: ${yearText} ${
          filters.half === 1 ? "상반기" : "하반기"
        }`;
      }
      if (unitType === "quarter" && filters.quarter) {
        return `조회 단위: ${yearText} ${filters.quarter}분기`;
      }
      if (unitType === "month" && filters.month) {
        return `조회 단위: ${yearText} ${filters.month}월`;
      }
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
            {[1, 2].map((h) => (
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
              현재 활성 상태인 학기가 없습니다. 학기 단위 조회를 사용하려면 최소
              1개 이상의 학기를 활성화해 주세요.
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

  const getDisplayNameForMember = (
    memberLike:
      | { id: number; name: string; birthDate?: string }
      | MemberDto
      | null
      | undefined
  ): string => {
    if (!memberLike) return "";
    return memberLike.name;
  };

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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        <ConfirmModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="기도제목 삭제"
          message="정말로 이 기도제목을 삭제하시겠습니까?"
        />

        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4 sm:mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              기도제목 관리
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              셀과 멤버별로 등록된 기도제목을 조회하고, 공개 범위/삭제 여부를
              관리할 수 있는 페이지입니다.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/prayers/add")}
            className="self-start bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
          >
            + 새 기도제목
          </button>
        </div>

        {/* 보기 방식 토글 */}
        <div className="flex flex-wrap gap-2 mb-3">
          {isExecutive && (
            <>
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(0);
                  navigate("/admin/prayers");
                }}
                className={`px-3 py-1 text-xs sm:text-sm rounded-full border ${
                  viewMode === "prayerList"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700"
                }`}
              >
                기도제목 목록
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage(0);
                  navigate("/admin/prayers/summary/members");
                }}
                className={`px-3 py-1 text-xs sm:text-sm rounded-full border ${
                  viewMode === "memberSummary"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700"
                }`}
              >
                멤버별 기도제목
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentPage(0);
                  navigate("/admin/prayers/summary/cells");
                }}
                className={`px-3 py-1 text-xs sm:text-sm rounded-full border ${
                  viewMode === "cellSummary"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700"
                }`}
              >
                셀별 기도제목
              </button>
            </>
          )}
        </div>

        {/* ====== 기간 필터 영역 ====== */}
        <div className="p-4 bg-gray-50 rounded-lg mb-3 sm:mb-4 space-y-4 shadow-sm">
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
                      onClick={() =>
                        hasActiveSemesters && handleUnitTypeClick("semester")
                      }
                      className={`px-3 py-1 text-xs sm:text-sm rounded-full border ${
                        hasActiveSemesters
                          ? unitType === "semester"
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white"
                          : "bg-gray-100 text-gray-400 border-dashed cursor-not-allowed"
                      }`}
                      disabled={!hasActiveSemesters}
                    >
                      학기
                    </button>
                  </div>
                </div>
              </div>
              {renderUnitButtons()}
            </div>
          )}

          <hr />

          {/* 기타 필터 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            {isExecutive && (
              <>
                <SimpleSearchableSelect
                  options={cellOptions}
                  value={
                    filters.cell === "all" ? undefined : Number(filters.cell)
                  }
                  onChange={(val) =>
                    handleFilterChange(
                      "cell",
                      val != null ? String(val) : "all"
                    )
                  }
                  placeholder="셀 필터"
                />
                <SimpleSearchableSelect
                  options={memberOptions}
                  value={
                    filters.member === "all"
                      ? undefined
                      : Number(filters.member)
                  }
                  onChange={(val) =>
                    handleFilterChange(
                      "member",
                      val != null ? String(val) : "all"
                    )
                  }
                  placeholder="멤버 필터"
                />
                <SimpleSearchableSelect
                  options={memberOptions}
                  value={
                    filters.creator === "all"
                      ? undefined
                      : Number(filters.creator)
                  }
                  onChange={(val) =>
                    handleFilterChange(
                      "creator",
                      val != null ? String(val) : "all"
                    )
                  }
                  placeholder="작성자 필터"
                />
              </>
            )}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">
                삭제된 항목
              </label>
              <button
                type="button"
                onClick={() =>
                  handleFilterChange("showDeleted", !filters.showDeleted)
                }
                className={`${
                  filters.showDeleted ? "bg-indigo-600" : "bg-gray-200"
                } relative inline-flex items-center h-6 rounded-full w-11 transition-colors`}
              >
                <span
                  className={`${
                    filters.showDeleted ? "translate-x-6" : "translate-x-1"
                  } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* 기간 요약 한 줄 */}
        {periodSummary && (
          <p className="mb-4 text-[11px] sm:text-xs text-gray-500">
            {periodSummary}
          </p>
        )}

        {/* 상태 메시지 */}
        {loading && (
          <div className="flex items-center justify-center min-height-[30vh] mb-4">
            <p className="text-sm text-gray-500">
              기도제목을 불러오는 중입니다...
            </p>
          </div>
        )}
        {error && !loading && (
          <p className="text-center text-sm text-red-500 mb-4">{error}</p>
        )}

        {/* ===== 뷰별 목록 영역 ===== */}
        {!loading && !error && (
          <>
            {/* 1) 개별 기도제목 목록 */}
            {viewMode === "prayerList" && prayerPage && (
              <>
                {prayerPage.content.length === 0 ? (
                  <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500 mb-4">
                    <p className="text-base sm:text-lg font-semibold">
                      등록된 기도제목이 없거나, 조건에 맞는 기도제목이 없습니다.
                    </p>
                    <p className="mt-1 text-xs sm:text-sm">
                      조회 기간이나 필터 조건을 조정해 다시 확인해 주세요.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 모바일 카드 리스트 */}
                    <div className="md:hidden space-y-3 mb-4">
                      {prayerPage.content.map((prayer) => (
                        <div
                          key={prayer.id}
                          className={`bg-white rounded-lg shadow border border-gray-100 p-4 text-xs space-y-2 ${
                            prayer.isDeleted ? "opacity-60 bg-gray-50" : ""
                          }`}
                        >
                          <div className="flex justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-[11px] text-gray-500">
                                기도 대상
                              </p>
                              <p className="text-sm font-semibold text-gray-900">
                                {prayer.member ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/admin/prayers/members/${prayer.member.id}`
                                      )
                                    }
                                    className="text-indigo-600 hover:text-indigo-900 underline-offset-2 hover:underline"
                                  >
                                    {getDisplayNameForMember(prayer.member)}
                                  </button>
                                ) : (
                                  "-"
                                )}
                              </p>
                              {prayer.member?.cell?.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/admin/prayers/cells/${
                                        prayer.member!.cell!.id
                                      }`
                                    )
                                  }
                                  className="mt-0.5 block text-[11px] text-gray-500 underline-offset-2 hover:underline text-left"
                                >
                                  이 셀 기도제목 전체 보기
                                </button>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-[11px] text-gray-500">
                                작성일
                              </p>
                              <p className="text-[11px] text-gray-700">
                                {new Date(
                                  prayer.createdAt
                                ).toLocaleDateString()}
                              </p>
                              {prayer.isDeleted && (
                                <p className="text-[11px] text-red-500 font-medium">
                                  삭제됨
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-[11px] text-gray-500 mb-1">
                              내용
                            </p>
                            <Link
                              to={`/admin/prayers/${prayer.id}`}
                              className="text-xs text-gray-800 hover:text-indigo-700"
                            >
                              {prayer.content}
                            </Link>
                          </div>

                          <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                            <div>
                              <p className="text-[11px] text-gray-500">
                                작성자(셀장)
                              </p>
                              <p className="text-[11px] text-gray-700 font-medium">
                                {getDisplayNameForMember(
                                  prayer.createdBy as any
                                ) || "-"}
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={() =>
                                  navigate(`/admin/prayers/${prayer.id}/edit`)
                                }
                                className="text-[11px] text-indigo-600 hover:text-indigo-900 font-medium"
                              >
                                수정
                              </button>
                              {!prayer.isDeleted && (
                                <button
                                  onClick={() => handleDelete(prayer.id)}
                                  className="text-[11px] text-red-600 hover:text-red-900 font-medium"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 데스크톱 테이블 */}
                    <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto mb-4">
                      <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th
                              onClick={() => requestSort("memberName")}
                              className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            >
                              멤버(기도대상) {getSortIndicator("memberName")}
                            </th>
                            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                              내용
                            </th>
                            <th
                              onClick={() => requestSort("creatorName")}
                              className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            >
                              작성자(셀장) {getSortIndicator("creatorName")}
                            </th>
                            <th
                              onClick={() => requestSort("createdAt")}
                              className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer whitespace-nowrap"
                            >
                              작성일 {getSortIndicator("createdAt")}
                            </th>
                            <th className="relative px-3 sm:px-6 py-2 sm:py-3">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {prayerPage.content.map((prayer) => (
                            <tr
                              key={prayer.id}
                              className={
                                prayer.isDeleted
                                  ? "bg-gray-100 text-gray-400"
                                  : ""
                              }
                            >
                              <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                                {prayer.member ? (
                                  <div className="flex flex-col">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(
                                          `/admin/prayers/members/${prayer.member.id}`
                                        )
                                      }
                                      className="text-indigo-600 hover:text-indigo-900 underline-offset-2 hover:underline text-left"
                                    >
                                      {getDisplayNameForMember(prayer.member)}
                                    </button>

                                    {prayer.member.cell?.id && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          navigate(
                                            `/admin/prayers/cells/${
                                              prayer.member!.cell!.id
                                            }`
                                          )
                                        }
                                        className="mt-0.5 text-[11px] text-gray-500 underline-offset-2 hover:underline text-left"
                                      >
                                        이 셀 기도제목 전체 보기
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm max-w-sm truncate">
                                <Link
                                  to={`/admin/prayers/${prayer.id}`}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  {prayer.content}
                                </Link>
                              </td>
                              <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                                {getDisplayNameForMember(
                                  prayer.createdBy as any
                                )}
                              </td>
                              <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                                {new Date(
                                  prayer.createdAt
                                ).toLocaleDateString()}
                              </td>
                              <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                                <button
                                  onClick={() =>
                                    navigate(`/admin/prayers/${prayer.id}/edit`)
                                  }
                                  className="text-indigo-600 hover:text-indigo-900 mr-3 sm:mr-4"
                                >
                                  수정
                                </button>
                                {!prayer.isDeleted && (
                                  <button
                                    onClick={() => handleDelete(prayer.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    삭제
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <Pagination
                  currentPage={prayerPage.number}
                  totalPages={prayerPage.totalPages}
                  totalElements={prayerPage.totalElements}
                  onPageChange={handlePageChange}
                />
              </>
            )}

            {/* 2) 멤버별 요약 뷰 */}
            {viewMode === "memberSummary" && memberSummaryPage && (
              <>
                <div className="bg-white shadow-md rounded-lg overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          멤버
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          셀
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          기도제목 수
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          최근 작성일
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
                                  navigate(
                                    `/admin/prayers/members/${row.memberId}`
                                  )
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
                                    navigate(
                                      `/admin/prayers/cells/${row.cellId}`
                                    )
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
                              {new Date(
                                row.latestCreatedAt
                              ).toLocaleDateString()}
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
                  onPageChange={handlePageChange}
                />
              </>
            )}

            {/* 3) 셀별 요약 뷰 */}
            {viewMode === "cellSummary" && cellSummaryPage && (
              <>
                <div className="bg-white shadow-md rounded-lg overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          셀
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          기도제목 수
                        </th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                          최근 작성일
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
                                type="button"
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
                              {new Date(
                                row.latestCreatedAt
                              ).toLocaleDateString()}
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
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPrayersPage;
