// src/pages/AdminPrayerSummaryPage.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { semesterService } from "../services/semesterService";
import { memberService } from "../services/memberService";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import { formatDisplayName } from "../utils/memberUtils";
import type {
  GetPrayersParams,
  Page,
  SemesterDto,
  PrayerMemberSummaryDto,
  PrayerCellSummaryDto,
} from "../types";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import Pagination from "../components/Pagination";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";

type SummaryMode = "members" | "cells";
type UnitType = "year" | "month" | "semester";

type SortDirection = "ascending" | "descending";
type SortKey = "totalCount" | "latestCreatedAt" | "memberName" | "cellName";

interface AdminPrayerSummaryPageProps {
  initialMode?: SummaryMode;
}

const FILTER_STORAGE_KEY = "adminPrayerSummaryFilters";

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
    semesterId: number | "";
  };
  currentPage: number;
  sortKey?: SortKey;
  sortDirection?: SortDirection;
};

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

  const urlMode: SummaryMode = useMemo(() => {
    if (location.pathname.endsWith("/cells")) return "cells";
    return initialMode;
  }, [location.pathname, initialMode]);

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

  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(savedState?.currentPage ?? 0);
  const [filterType, setFilterType] = useState<"unit" | "range">(
    savedState?.filterType ?? "unit"
  );
  const [unitType, setUnitType] = useState<UnitType>(
    savedState?.unitType ?? "semester"
  );

  const [filters, setFilters] = useState({
    cell: savedState?.filters?.cell ?? "all",
    member: savedState?.filters?.member ?? "all",
    startDate: savedState?.filters?.startDate ?? "",
    endDate: savedState?.filters?.endDate ?? "",
    year: (savedState?.filters?.year ?? new Date().getFullYear()) as
      | number
      | "",
    month: (savedState?.filters?.month ?? "") as number | "",
    semesterId: (savedState?.filters?.semesterId ?? "") as number | "",
  });

  const hasActiveSemesters = semesters.length > 0;

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>(() => ({
    key: savedState?.sortKey ?? "totalCount",
    direction: savedState?.sortDirection ?? "descending",
  }));

  const memberOptions: { value: number; label: string }[] = [];
  const cellOptions: { value: number; label: string }[] = [];

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

  useEffect(() => {
    if (!user) return;
    const fetchAllMembers = async () => {
      try {
        const page = await memberService.getAllMembers({
          page: 0,
          size: 2000,
          sort: "id,asc",
        });
        const list = page.content.map((m) => ({
          id: m.id,
          name: m.name,
          birthDate: m.birthDate,
        }));
        setAllMembersForNameCheck(list);
      } catch (e) {
        console.error("동명이인 확인용 멤버 목록 로딩 실패:", e);
      }
    };
    fetchAllMembers();
  }, [user]);

  // ✅ [추가] 현재 날짜 기준 적절한 학기를 찾는 헬퍼 함수
  const findCurrentSemester = useCallback((semesterList: SemesterDto[]) => {
    if (semesterList.length === 0) return null;

    const now = new Date();
    // YYYY-MM-DD 포맷 (시간대 오차 제거를 위해 문자열 처리)
    // 로컬 시간 기준의 날짜 문자열 생성
    const offset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - offset);
    const todayStr = localDate.toISOString().split("T")[0];
    const currentYearMonth = todayStr.substring(0, 7); // YYYY-MM

    // 1. 오늘 날짜가 기간 내에 정확히 포함된 학기 (1순위)
    let target = semesterList.find((s) => {
      const start = s.startDate.split("T")[0];
      const end = s.endDate.split("T")[0];
      return todayStr >= start && todayStr <= end;
    });

    // 2. 포함된 학기가 없다면 이번 달이 걸쳐있는 학기 (2순위 - 방학 등 고려)
    if (!target) {
      target = semesterList.find((s) => {
        const start = s.startDate.substring(0, 7);
        const end = s.endDate.substring(0, 7);
        return currentYearMonth >= start && currentYearMonth <= end;
      });
    }

    // 3. 그래도 없으면 가장 최신 학기 (3순위)
    if (!target) {
      const sorted = [...semesterList].sort((a, b) => b.id - a.id);
      target = sorted[0];
    }

    return target;
  }, []);

  // ✅ [수정] 학기 데이터 로드 후 자동 선택 로직
  // 저장된 값이 있더라도, 현재 unitType이 'semester'인데 semesterId가 비어있다면 자동 선택 수행
  useEffect(() => {
    if (semesters.length === 0) return;

    // 현재 모드가 '학기'이고, 선택된 학기 ID가 없을 때만 자동 선택 실행
    if (unitType === "semester" && !filters.semesterId) {
      const targetSemester = findCurrentSemester(semesters);

      if (targetSemester) {
        setFilters((prev) => ({
          ...prev,
          semesterId: targetSemester.id,
          year: "", // 학기 모드에서는 연도/월 비움
          month: "",
        }));
      }
    }
  }, [semesters, unitType, filters.semesterId, findCurrentSemester]);

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
        // year가 숫자면 normalizeNumberInput이 숫자 반환
        params.year = normalizeNumberInput(filters.year);
        params.month = normalizeNumberInput(filters.month);
      }
    }

    if (filters.cell !== "all") params.cellId = Number(filters.cell);
    if (filters.member !== "all") params.memberId = Number(filters.member);

    const cleaned = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined
      )
    ) as GetPrayersParams;

    return cleaned;
  }, [currentPage, filterType, filters, semesters, sortConfig]);

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

  useEffect(() => {
    if (user?.role === "EXECUTIVE" || user?.role === "CELL_LEADER") {
      fetchData();
    }
  }, [fetchData, user?.role]);

  useEffect(() => {
    if (user) {
      fetchAvailableYears();
      fetchSemesters();
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

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

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  // ✅ [수정] 단위 변경 핸들러 (버튼 클릭 시 동작)
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const next = { ...prev };
      const now = new Date();
      const currentYear = now.getFullYear();

      if (type === "year") {
        next.year = next.year || currentYear;
        next.month = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = next.year || currentYear;
        next.month = next.month || now.getMonth() + 1;
        next.semesterId = "";
      } else if (type === "semester") {
        next.year = "";
        next.month = "";

        // 헬퍼 함수를 재사용하여 학기 찾기 로직 통일
        const target = findCurrentSemester(semesters);
        if (target) {
          next.semesterId = target.id;
        }
      }

      return next;
    });

    setCurrentPage(0);
  };

  const handleUnitValueClick = (value: number) => {
    setFilters((prev) => ({
      ...prev,
      month: value,
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
    }));
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

      const yearText = filters.year ? `${filters.year}년` : "연도 미선택";

      if (unitType === "year") return `조회 단위: 연간 (${yearText})`;
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
      case "year":
      default:
        return null;
    }
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
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
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-700"
            }`}
          >
            멤버별 기도제목
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
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-700"
            }`}
          >
            셀별 기도제목
          </button>
        </div>

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
                <label className="block text-sm font-medium text-gray-700">
                  기간 시작
                </label>
                <KoreanCalendarPicker
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange("startDate", date)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  기간 종료
                </label>
                <KoreanCalendarPicker
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange("endDate", date)}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    연도
                  </label>
                  <select
                    value={filters.year}
                    onChange={(e) =>
                      handleFilterChange("year", Number(e.target.value))
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
                </div>
              </div>

              {renderUnitButtons()}
            </>
          )}

          <hr />

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

        {periodSummary && (
          <p className="mb-4 text-[11px] sm:text-xs text-gray-500">
            {periodSummary}
          </p>
        )}

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

        {/* 1. 멤버별 요약 목록 */}
        {!loading && !error && mode === "members" && memberSummaryPage && (
          <>
            {/* 모바일 뷰 */}
            <div className="space-y-3 md:hidden mb-4">
              {memberSummaryPage.content.length === 0 ? (
                <div className="bg-white rounded-lg shadow border p-4 text-center text-xs sm:text-sm text-gray-500">
                  조건에 맞는 멤버가 없습니다.
                </div>
              ) : (
                memberSummaryPage.content.map((row) => {
                  const foundMember = allMembersForNameCheck.find(
                    (m) => m.id === row.memberId
                  );
                  const displayName = foundMember
                    ? formatDisplayName(foundMember, allMembersForNameCheck)
                    : row.memberName;

                  return (
                    <div
                      key={row.memberId}
                      className="bg-white rounded-lg shadow border p-3 text-xs space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <button
                            onClick={() =>
                              navigate(`/admin/prayers/members/${row.memberId}`)
                            }
                            className="text-sm font-semibold text-indigo-600 hover:underline"
                          >
                            {displayName}
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
                            {safeFormatDate(row.latestCreatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-[11px] text-gray-500">
                          기도제목 수
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {row.totalCount.toLocaleString()}건
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 데스크탑 뷰 */}
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
                    memberSummaryPage.content.map((row) => {
                      const foundMember = allMembersForNameCheck.find(
                        (m) => m.id === row.memberId
                      );
                      const displayName = foundMember
                        ? formatDisplayName(foundMember, allMembersForNameCheck)
                        : row.memberName;

                      return (
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
                              {displayName}
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

        {/* 2. 셀별 요약 목록 */}
        {!loading && !error && mode === "cells" && cellSummaryPage && (
          <>
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
                          {safeFormatDate(row.latestCreatedAt)}
                        </span>
                      </div>
                    </div>

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
                          {safeFormatDate(row.latestCreatedAt)}
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
