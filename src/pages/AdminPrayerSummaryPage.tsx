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
import {
  ChatBubbleBottomCenterTextIcon,
  FunnelIcon,
  PlusIcon,
  UserIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";

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

  // 현재 날짜 기준 적절한 학기를 찾는 헬퍼 함수
  const findCurrentSemester = useCallback((semesterList: SemesterDto[]) => {
    if (semesterList.length === 0) return null;

    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localDate = new Date(now.getTime() - offset);
    const todayStr = localDate.toISOString().split("T")[0];
    const currentYearMonth = todayStr.substring(0, 7);

    // 1. 오늘 날짜가 기간 내에 정확히 포함된 학기
    let target = semesterList.find((s) => {
      const start = s.startDate.split("T")[0];
      const end = s.endDate.split("T")[0];
      return todayStr >= start && todayStr <= end;
    });

    // 2. 포함된 학기가 없다면 이번 달이 걸쳐있는 학기
    if (!target) {
      target = semesterList.find((s) => {
        const start = s.startDate.substring(0, 7);
        const end = s.endDate.substring(0, 7);
        return currentYearMonth >= start && currentYearMonth <= end;
      });
    }

    // 3. 그래도 없으면 가장 최신 학기
    if (!target) {
      const sorted = [...semesterList].sort((a, b) => b.id - a.id);
      target = sorted[0];
    }

    return target;
  }, []);

  // 학기 데이터 로드 후 자동 선택 로직
  useEffect(() => {
    if (semesters.length === 0) return;
    if (unitType === "semester" && !filters.semesterId) {
      const targetSemester = findCurrentSemester(semesters);
      if (targetSemester) {
        setFilters((prev) => ({
          ...prev,
          semesterId: targetSemester.id,
          year: "",
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
        params.year = normalizeNumberInput(filters.year);
        params.month = normalizeNumberInput(filters.month);
      }
    }

    if (filters.cell !== "all") params.cellId = Number(filters.cell);
    if (filters.member !== "all") params.memberId = Number(filters.member);

    return Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined
      )
    ) as GetPrayersParams;
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
      setError("데이터를 불러오는 데 실패했습니다.");
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
        const target = findCurrentSemester(semesters);
        if (target) next.semesterId = target.id;
      }
      return next;
    });
    setCurrentPage(0);
  };

  const handleUnitValueClick = (value: number) => {
    setFilters((prev) => ({ ...prev, month: value, semesterId: "" }));
    setCurrentPage(0);
  };

  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({ ...prev, semesterId, year: "", month: "" }));
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

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 mt-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                onClick={() => handleUnitValueClick(m)}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  filters.month === m
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 shadow-sm"
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
            <div className="mt-2 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800 border border-yellow-100">
              등록된 학기가 없습니다.
            </div>
          );
        }
        return (
          <div className="flex flex-wrap gap-2 mt-2">
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
        );
      case "year":
      default:
        return null;
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ChatBubbleBottomCenterTextIcon className="h-7 w-7 text-indigo-500" />
              기도제목 요약
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              기간/셀/멤버 기준으로 등록된 기도제목 현황을 확인합니다.
            </p>
          </div>
          {/* Mode Switcher (Pill Style) */}
          <div className="bg-gray-200 p-1 rounded-xl flex text-xs font-bold self-start sm:self-center">
            <button
              onClick={() => {
                setCurrentPage(0);
                setSortConfig({ key: "totalCount", direction: "descending" });
                navigate("/admin/prayers/summary/members");
              }}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                mode === "members"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <UserIcon className="h-3 w-3" /> 멤버별
            </button>
            <button
              onClick={() => {
                setCurrentPage(0);
                setSortConfig({ key: "totalCount", direction: "descending" });
                navigate("/admin/prayers/summary/cells");
              }}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                mode === "cells"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <UserGroupIcon className="h-3 w-3" /> 셀별
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-gray-50 pb-4">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <h3 className="font-bold text-gray-700">조회 조건 설정</h3>
            </div>
            {/* Unit vs Range Toggle */}
            <div className="bg-gray-100 p-1 rounded-xl flex text-xs font-bold w-fit">
              <button
                onClick={() => setFilterType("unit")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === "unit"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                단위별 조회
              </button>
              <button
                onClick={() => setFilterType("range")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === "range"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                기간 직접설정
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {/* Date Settings */}
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
                {/* ✅ items-start 적용 */}
                <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
                  {/* 1. 기준 연도 */}
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
                {/* 상세 선택 버튼 (월/학기) */}
                {(unitType === "month" || unitType === "semester") && (
                  <div className="pt-2 border-t border-gray-200/50 mt-2">
                    <label className="text-xs font-bold text-gray-500 block mb-1">
                      {unitType === "month" ? "월 선택" : "학기 선택"}
                    </label>
                    {renderUnitButtons()}
                  </div>
                )}
              </div>
            )}

            {/* Cell & Member Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  소속 셀
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
                        val != null ? String(val) : "all"
                      )
                    }
                    placeholder="셀 필터"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  멤버
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
                        val != null ? String(val) : "all"
                      )
                    }
                    placeholder="멤버 필터"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              {user.role === "EXECUTIVE" && (
                <button
                  type="button"
                  onClick={() => navigate("/admin/prayers/add")}
                  className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition-all"
                >
                  <PlusIcon className="h-4 w-4" /> 새 기도제목
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
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

        {/* 1. Members Summary List */}
        {!loading && !error && mode === "members" && memberSummaryPage && (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden mb-4">
              {memberSummaryPage.content.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
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
                              <button
                                onClick={() =>
                                  navigate(`/admin/prayers/cells/${row.cellId}`)
                                }
                                className="hover:underline flex items-center gap-1"
                              >
                                {row.cellName}
                              </button>
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
                    {/* ✅ 우측 정렬로 변경 */}
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
                        <tr
                          key={row.memberId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-indigo-600">
                            <button
                              onClick={() =>
                                navigate(
                                  `/admin/prayers/members/${row.memberId}`
                                )
                              }
                              className="hover:underline"
                            >
                              {displayName}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-gray-700 font-medium">
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
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">
                              {row.totalCount.toLocaleString()}건
                            </span>
                          </td>
                          {/* ✅ 우측 정렬로 변경 */}
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

        {/* 2. Cells Summary List */}
        {!loading && !error && mode === "cells" && cellSummaryPage && (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden mb-4">
              {cellSummaryPage.content.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
                  조건에 맞는 셀이 없습니다.
                </div>
              ) : (
                cellSummaryPage.content.map((row) => (
                  <div
                    key={row.cellId}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <button
                        onClick={() =>
                          navigate(`/admin/prayers/cells/${row.cellId}`)
                        }
                        className="text-lg font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        {row.cellName}
                      </button>
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
                ))
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
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
                    {/* ✅ 우측 정렬로 변경 */}
                    <th
                      className="px-6 py-3 text-right font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                      onClick={() => requestSort("latestCreatedAt")}
                    >
                      최근 작성일 {getSortIndicator("latestCreatedAt")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {cellSummaryPage.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-10 text-center text-gray-400 text-sm"
                      >
                        조건에 맞는 셀이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    cellSummaryPage.content.map((row) => (
                      <tr
                        key={row.cellId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-indigo-600">
                          <button
                            onClick={() =>
                              navigate(`/admin/prayers/cells/${row.cellId}`)
                            }
                            className="hover:underline"
                          >
                            {row.cellName}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">
                            {row.totalCount.toLocaleString()}건
                          </span>
                        </td>
                        {/* ✅ 우측 정렬로 변경 */}
                        <td className="px-6 py-4 text-gray-500 text-right">
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
