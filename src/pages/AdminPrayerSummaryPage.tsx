// src/pages/AdminPrayerSummaryPage.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { semesterService } from "../services/semesterService";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import { formatDisplayName } from "../utils/memberUtils";
import type {
  GetPrayersParams,
  Page,
  SemesterDto,
  PrayerMemberSummaryDto,
  CellDto,
} from "../types";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import Pagination from "../components/Pagination";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import {
  ChatBubbleBottomCenterTextIcon,
  FunnelIcon,
} from "@heroicons/react/24/solid";

// [변경] 조회 단위에서 'month' 삭제
type UnitType = "year" | "semester";

type SortDirection = "ascending" | "descending";
type SortKey = "totalCount" | "latestCreatedAt" | "memberName" | "cellName";

// 로컬 스토리지 키
const FILTER_STORAGE_KEY = "adminPrayerSummaryFilters";

// 필터 상태 타입 정의
type SavedFilterState = {
  filterType: "unit" | "range";
  unitType: UnitType;
  filters: {
    cell: string;
    member: string;
    startDate: string;
    endDate: string;
    year: number | "";
    semesterId: number | "";
  };
  currentPage: number;
  sortKey?: SortKey;
  sortDirection?: SortDirection;
};

// 멤버 간략 정보 타입 (셀 ID 포함)
interface MemberSimpleDto {
  id: number;
  name: string;
  birthDate?: string;
  cellId?: number;
}

// 스크롤바 숨김 스타일
const scrollbarHideStyle: React.CSSProperties = {
  msOverflowStyle: "none",
  scrollbarWidth: "none",
};

// 저장된 필터 불러오기
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

const AdminPrayerSummaryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const savedState = loadSavedFilterState();

  // --------------------------------------------------------------------------
  // State Definitions
  // --------------------------------------------------------------------------

  // 데이터 리스트 상태
  const [memberSummaryPage, setMemberSummaryPage] =
    useState<Page<PrayerMemberSummaryDto> | null>(null);

  // 기준 정보 상태
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [allCells, setAllCells] = useState<CellDto[]>([]);
  const [allMembers, setAllMembers] = useState<MemberSimpleDto[]>([]);

  // 로딩 및 에러 상태
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 및 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(savedState?.currentPage ?? 0);
  const [filterType, setFilterType] = useState<"unit" | "range">(
    savedState?.filterType ?? "unit",
  );
  const [unitType, setUnitType] = useState<UnitType>(
    savedState?.unitType ?? "semester",
  );

  const [filters, setFilters] = useState({
    cell: savedState?.filters?.cell ?? "all",
    member: savedState?.filters?.member ?? "all",
    startDate: savedState?.filters?.startDate ?? "",
    endDate: savedState?.filters?.endDate ?? "",
    year: (savedState?.filters?.year ?? new Date().getFullYear()) as
      | number
      | "",
    semesterId: (savedState?.filters?.semesterId ?? "") as number | "",
  });

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>(() => ({
    key: savedState?.sortKey ?? "totalCount",
    direction: savedState?.sortDirection ?? "descending",
  }));

  const hasActiveSemesters = semesters.length > 0;

  // --------------------------------------------------------------------------
  // Derived State (Options & Cascading Logic)
  // --------------------------------------------------------------------------

  // 1. 셀 옵션
  const cellOptions = useMemo(() => {
    return allCells.map((c) => ({ value: c.id, label: c.name }));
  }, [allCells]);

  // 2. 멤버 옵션 (Cascading Select 적용)
  const memberOptions = useMemo(() => {
    let targetMembers = allMembers;

    // 특정 셀이 선택된 경우, 해당 셀 멤버만 필터링
    if (filters.cell !== "all") {
      const selectedCellId = Number(filters.cell);
      targetMembers = targetMembers.filter((m) => m.cellId === selectedCellId);
    }

    return targetMembers.map((m) => ({
      value: m.id,
      label: formatDisplayName(m, allMembers),
    }));
  }, [allMembers, filters.cell]);

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

  // --------------------------------------------------------------------------
  // Helper Functions
  // --------------------------------------------------------------------------

  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const targetStr =
      dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;
    const date = new Date(targetStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const findCurrentSemester = useCallback((semesterList: SemesterDto[]) => {
    if (semesterList.length === 0) return null;
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - offset);
    const todayStr = localDate.toISOString().split("T")[0];
    const currentYearMonth = todayStr.substring(0, 7);

    let target = semesterList.find((s) => {
      const start = s.startDate.split("T")[0];
      const end = s.endDate.split("T")[0];
      return todayStr >= start && todayStr <= end;
    });

    if (!target) {
      target = semesterList.find((s) => {
        const start = s.startDate.substring(0, 7);
        const end = s.endDate.substring(0, 7);
        return currentYearMonth >= start && currentYearMonth <= end;
      });
    }

    if (!target) {
      const sorted = [...semesterList].sort((a, b) => b.id - a.id);
      target = sorted[0];
    }
    return target;
  }, []);

  const buildBaseParams = useCallback((): GetPrayersParams => {
    const params: GetPrayersParams = {
      page: currentPage,
      size: 10,
      sort: `${sortConfig.key},${
        sortConfig.direction === "ascending" ? "asc" : "desc"
      }`,
    };

    if (filterType === "range") {
      params.startDate = filters.startDate || undefined;
      params.endDate = filters.endDate || undefined;
    } else {
      if (filters.semesterId && semesters.length > 0) {
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          params.startDate = semester.startDate;
          params.endDate = semester.endDate;
        }
      } else {
        params.year = normalizeNumberInput(filters.year);
      }
    }

    if (filters.cell !== "all") params.cellId = Number(filters.cell);
    if (filters.member !== "all") params.memberId = Number(filters.member);

    return Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined,
      ),
    ) as GetPrayersParams;
  }, [currentPage, filterType, filters, semesters, sortConfig]);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------

  // 1. 기초 데이터 로드 (학기, 연도, 셀, 멤버)
  const fetchBaseData = useCallback(async () => {
    try {
      // 학기
      const semData = await semesterService.getAllSemesters(true);
      setSemesters(
        semData.sort((a, b) => b.startDate.localeCompare(a.startDate)),
      );

      // 연도
      const years = await prayerService.getAvailableYears();
      setAvailableYears(years.sort((a, b) => b - a));

      // 셀 목록
      const cellPage = await cellService.getAllCells({
        page: 0,
        size: 1000,
        sort: "name,asc",
      });
      setAllCells(cellPage.content);

      // 멤버 목록
      const memberPage = await memberService.getAllMembers({
        page: 0,
        size: 2000,
        sort: "name,asc",
      });
      const mappedMembers = memberPage.content.map((m: any) => ({
        id: m.id,
        name: m.name,
        birthDate: m.birthDate,
        cellId: m.cell?.id || m.cellId, // 셀 ID 매핑
      }));
      setAllMembers(mappedMembers);
    } catch (err) {
      console.error("기초 데이터 로딩 실패:", err);
    }
  }, []);

  // 2. 메인 데이터 로드 (기도제목 요약)
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
      const data = await prayerService.getMemberPrayerSummary(params);
      setMemberSummaryPage(data);
    } catch (err) {
      console.error("기도제목 요약 로딩 실패:", err);
      setError("데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user, buildBaseParams]);

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  // 초기 권한 체크 및 데이터 로드
  useEffect(() => {
    if (user) {
      fetchBaseData();
    }
  }, [user, fetchBaseData]);

  // 조건 변경 시 데이터 다시 불러오기
  useEffect(() => {
    if (user?.role === "EXECUTIVE" || user?.role === "CELL_LEADER") {
      fetchData();
    }
  }, [fetchData, user?.role]);

  // 학기/연도 자동 설정
  useEffect(() => {
    if (semesters.length === 0) return;
    if (unitType === "semester" && !filters.semesterId) {
      const targetSemester = findCurrentSemester(semesters);
      if (targetSemester) {
        setFilters((prev) => ({
          ...prev,
          semesterId: targetSemester.id,
          year: "",
        }));
      }
    }
  }, [semesters, unitType, filters.semesterId, findCurrentSemester]);

  // 필터 상태 저장
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stateToSave: SavedFilterState = {
      filterType,
      unitType,
      filters,
      currentPage,
      sortKey: sortConfig.key,
      sortDirection: sortConfig.direction,
    };
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(stateToSave));
  }, [filterType, unitType, filters, currentPage, sortConfig]);

  // 연도 보정
  useEffect(() => {
    if (availableYears.length > 0 && filters.year) {
      if (!availableYears.includes(Number(filters.year))) {
        setFilters((prev) => ({ ...prev, year: availableYears[0] }));
      }
    }
  }, [availableYears, filters.year]);

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: value };
      // 셀 변경 시 멤버 필터 초기화 (Cascading Reset)
      if (field === "cell") {
        next.member = "all";
      }
      return next;
    });
    setCurrentPage(0);
  };

  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      let baseYear =
        typeof prev.year === "number" ? prev.year : new Date().getFullYear();
      if (unitType === "semester" && prev.semesterId) {
        const curSem = semesters.find((s) => s.id === prev.semesterId);
        if (curSem) baseYear = new Date(curSem.startDate).getFullYear();
      }
      if (availableYears.length > 0 && !availableYears.includes(baseYear)) {
        baseYear = availableYears[0];
      }

      const next = { ...prev };
      if (type === "year") {
        next.year = baseYear;
        next.semesterId = "";
      } else if (type === "semester") {
        next.year = "";
        const target = findCurrentSemester(semesters);
        if (target) next.semesterId = target.id;
      }
      return next;
    });
    setCurrentPage(0);
  };

  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({ ...prev, semesterId, year: "" }));
    setCurrentPage(0);
  };

  const requestSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction:
            prev.direction === "ascending" ? "descending" : "ascending",
        };
      }
      return { key, direction: "descending" };
    });
    setCurrentPage(0);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  // --------------------------------------------------------------------------
  // Render Helpers
  // --------------------------------------------------------------------------

  const renderUnitButtons = () => {
    if (unitType === "semester") {
      if (semesters.length === 0) {
        return (
          <div className="pt-2 border-t border-gray-200/50 mt-2">
            <div className="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800 border border-yellow-100">
              등록된 학기가 없습니다.
            </div>
          </div>
        );
      }
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
                  flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm whitespace-nowrap
                  ${
                    filters.semesterId === s.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-1 ring-indigo-600"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    s.isActive ? "bg-green-400" : "bg-gray-300"
                  }`}
                ></span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------

  if (!user || (user.role !== "EXECUTIVE" && user.role !== "CELL_LEADER")) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-sm text-center max-w-sm w-full">
          <p className="text-red-600 text-sm font-bold">
            접근 권한이 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
              <ChatBubbleBottomCenterTextIcon className="h-7 w-7 text-indigo-500" />
              기도제목 현황
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              기간 및 셀 조건을 설정하여 멤버들의 기도제목 제출 현황을
              확인합니다.
            </p>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <h3 className="font-bold text-gray-700 whitespace-nowrap">
              조회 조건 설정
            </h3>
          </div>

          {/* Mode Switcher */}
          <div className="bg-gray-100 p-1 rounded-xl flex text-xs sm:text-sm font-bold mb-5">
            <button
              onClick={() => setFilterType("unit")}
              className={`flex-1 py-2 rounded-lg transition-all whitespace-nowrap text-center ${
                filterType === "unit"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              단위별
            </button>
            <button
              onClick={() => setFilterType("range")}
              className={`flex-1 py-2 rounded-lg transition-all whitespace-nowrap text-center ${
                filterType === "range"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              기간설정
            </button>
          </div>

          <div className="space-y-5">
            {/* 1. Date Settings */}
            {filterType === "range" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    시작일
                  </label>
                  <KoreanCalendarPicker
                    value={filters.startDate}
                    onChange={(date) => handleFilterChange("startDate", date)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    종료일
                  </label>
                  <KoreanCalendarPicker
                    value={filters.endDate}
                    onChange={(date) => handleFilterChange("endDate", date)}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
                  <div className="w-full sm:w-32">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">
                      연도
                    </label>
                    <div className="relative">
                      <select
                        value={filters.year}
                        onChange={(e) =>
                          handleFilterChange("year", Number(e.target.value))
                        }
                        className="w-full py-2 px-1 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-100 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                        disabled={unitType === "semester"}
                      >
                        {yearOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
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

                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">
                      조회 단위
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          hasActiveSemesters && handleUnitTypeClick("semester")
                        }
                        disabled={!hasActiveSemesters}
                        className={`px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap ${
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
                        className={`px-3 py-2 text-sm font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap ${
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

            {/* 2. Cell & Member Filters (Cascading Select) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  소속 셀 (필터)
                </label>
                <div className="h-[42px]">
                  <SimpleSearchableSelect
                    options={cellOptions}
                    value={
                      filters.cell === "all" ? undefined : Number(filters.cell)
                    }
                    onChange={(val) =>
                      handleFilterChange(
                        "cell",
                        val != null ? String(val) : "all",
                      )
                    }
                    placeholder="셀 전체 보기"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  멤버 검색
                  {filters.cell !== "all" && (
                    <span className="text-indigo-600 ml-2 font-normal">
                      (선택된 셀 내 검색)
                    </span>
                  )}
                </label>
                <div className="h-[42px]">
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
                        val != null ? String(val) : "all",
                      )
                    }
                    placeholder={
                      filters.cell !== "all" && memberOptions.length === 0
                        ? "해당 셀에 멤버가 없습니다"
                        : "멤버 전체 보기"
                    }
                    disabled={
                      filters.cell !== "all" && memberOptions.length === 0
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error / Results */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}
        {error && !loading && (
          <div className="text-center p-8 bg-white rounded-2xl border border-red-100 text-red-600 font-bold mb-6">
            {error}
          </div>
        )}

        {!loading && !error && memberSummaryPage && (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden mb-4">
              {memberSummaryPage.content.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
                  조건에 맞는 데이터가 없습니다.
                </div>
              ) : (
                memberSummaryPage.content.map((row) => {
                  const foundMember = allMembers.find(
                    (m) => m.id === row.memberId,
                  );
                  const displayName = foundMember
                    ? formatDisplayName(foundMember, allMembers)
                    : row.memberName;

                  return (
                    <div
                      key={row.memberId}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <button
                            onClick={() =>
                              navigate(`/admin/prayers/members/${row.memberId}`)
                            }
                            className="text-lg font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            {displayName}
                          </button>
                          <div className="text-xs text-gray-500 mt-1">
                            {row.cellId ? (
                              <span className="flex items-center gap-1">
                                {row.cellName}
                              </span>
                            ) : (
                              "미배정"
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-400 block mb-0.5">
                            최근 작성
                          </span>
                          <span className="text-sm font-medium text-gray-800">
                            {safeFormatDate(row.latestCreatedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="pt-3 mt-2 border-t border-gray-50 flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-bold">
                          총 기도제목
                        </span>
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-xs font-bold">
                          {row.totalCount.toLocaleString()}건
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                      onClick={() => requestSort("memberName")}
                    >
                      이름 {getSortIndicator("memberName")}
                    </th>
                    <th
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                      onClick={() => requestSort("cellName")}
                    >
                      셀 {getSortIndicator("cellName")}
                    </th>
                    <th
                      className="px-6 py-3 text-right font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                      onClick={() => requestSort("totalCount")}
                    >
                      기도제목 수 {getSortIndicator("totalCount")}
                    </th>
                    <th
                      className="px-6 py-3 text-right font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                      onClick={() => requestSort("latestCreatedAt")}
                    >
                      최근 작성일 {getSortIndicator("latestCreatedAt")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {memberSummaryPage.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-gray-400 text-sm"
                      >
                        조건에 맞는 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    memberSummaryPage.content.map((row) => {
                      const foundMember = allMembers.find(
                        (m) => m.id === row.memberId,
                      );
                      const displayName = foundMember
                        ? formatDisplayName(foundMember, allMembers)
                        : row.memberName;

                      return (
                        <tr
                          key={row.memberId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-indigo-600">
                            <button
                              onClick={() =>
                                navigate(
                                  `/admin/prayers/members/${row.memberId}`,
                                )
                              }
                              className="hover:underline"
                            >
                              {displayName}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-gray-700 font-medium">
                            {row.cellId ? row.cellName : "-"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">
                              {row.totalCount.toLocaleString()}건
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 text-right">
                            {safeFormatDate(row.latestCreatedAt)}
                          </td>
                        </tr>
                      );
                    })
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
      </div>
    </div>
  );
};

export default AdminPrayerSummaryPage;
