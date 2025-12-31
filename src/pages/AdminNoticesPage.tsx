// src/pages/AdminNoticesPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { noticeService } from "../services/noticeService";
import { semesterService } from "../services/semesterService";
import { memberService } from "../services/memberService";
import { formatDisplayName } from "../utils/memberUtils";
import type {
  GetAllNoticesParams,
  NoticeDto,
  Page,
  SemesterDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import Pagination from "../components/Pagination";
import { useDebounce } from "../hooks/useDebounce";
import { normalizeNumberInput } from "../utils/numberUtils";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import {
  MegaphoneIcon,
  FunnelIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  ExclamationCircleIcon,
  TrashIcon,
  PencilIcon,
} from "@heroicons/react/24/solid";

type SortKey = "createdAt";
type UnitType = "year" | "month" | "semester";

const AdminNoticesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const [noticePage, setNoticePage] = useState<Page<NoticeDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // 동명이인 판별을 위한 전체 멤버 리스트
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<NoticeDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;

  // ✅ 날짜 포맷팅 함수
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

  // ───────────────── URL 기반 초기값 설정 ─────────────────
  const [filters, setFilters] = useState(() => {
    const title = searchParams.get("title") ?? "";
    const pinnedParam = searchParams.get("pinned");
    const pinned =
      pinnedParam === "true" || pinnedParam === "false" ? pinnedParam : "all";

    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const semesterIdParam = searchParams.get("semesterId");

    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";

    const safeNumber = (val: string | null) => {
      if (!val) return "";
      const num = Number(val);
      return isNaN(num) ? "" : num;
    };

    let initialYear: number | "" = "";

    if (yearParam && yearParam !== "all") {
      const parsed = Number(yearParam);
      if (!isNaN(parsed)) initialYear = parsed;
    }

    return {
      title,
      pinned,
      startDate,
      endDate,
      year: initialYear,
      month: safeNumber(monthParam),
      semesterId: safeNumber(semesterIdParam),
    };
  });

  const [sortOrder, setSortOrder] = useState(() => {
    return searchParams.get("sort") || "createdAt,desc";
  });

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? Number(pageParam) : 0;
  });

  const [filterType, setFilterType] = useState<"unit" | "range">(() => {
    const ft = searchParams.get("filterType");
    return ft === "range" ? "range" : "unit";
  });

  const [unitType, setUnitType] = useState<UnitType>(() => {
    const ut = searchParams.get("unitType");
    if (ut === "year" || ut === "month" || ut === "semester") {
      return ut;
    }
    return "year";
  });

  const debouncedTitleFilter = useDebounce(filters.title, 500);

  const memberNameMap = useMemo(() => {
    const map = new Map<number, string>();
    if (allMembersForNameCheck.length === 0) return map;
    allMembersForNameCheck.forEach((m) => {
      map.set(m.id, formatDisplayName(m, allMembersForNameCheck));
    });
    return map;
  }, [allMembersForNameCheck]);

  const getFormattedName = useCallback(
    (id?: number, name?: string) => {
      if (!name) return "알 수 없음";
      if (!id) return name;
      return memberNameMap.get(id) || name;
    },
    [memberNameMap]
  );

  const syncSearchParams = useCallback(
    (
      nextFilters = filters,
      nextFilterType: "unit" | "range" = filterType,
      nextUnitType: UnitType = unitType,
      nextSortOrder = sortOrder,
      nextPage = currentPage
    ) => {
      const params: Record<string, string> = {};

      if (nextFilters.title) params.title = nextFilters.title;
      if (nextFilters.pinned !== "all") params.pinned = nextFilters.pinned;

      params.filterType = nextFilterType;
      params.unitType = nextUnitType;
      params.sort = nextSortOrder;
      params.page = String(nextPage);

      if (nextFilterType === "range") {
        if (nextFilters.startDate) params.startDate = nextFilters.startDate;
        if (nextFilters.endDate) params.endDate = nextFilters.endDate;
      } else {
        if (nextFilters.year === "") {
          params.year = "all";
        } else if (typeof nextFilters.year === "number") {
          params.year = String(nextFilters.year);
        }

        if (typeof nextFilters.month === "number")
          params.month = String(nextFilters.month);
        if (typeof nextFilters.semesterId === "number")
          params.semesterId = String(nextFilters.semesterId);
      }

      setSearchParams(params, { replace: true });
    },
    [filters, filterType, unitType, sortOrder, currentPage, setSearchParams]
  );

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("Failed to fetch semesters:", err);
      setSemesters([]);
    }
  }, []);

  const fetchNotices = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError("로그인 후 공지사항 목록 페이지에 접근할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    let params: GetAllNoticesParams = {
      page: currentPage,
      size: 10,
      title: debouncedTitleFilter,
      pinned: filters.pinned === "all" ? undefined : filters.pinned === "true",
      sort: sortOrder,
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
          year:
            filters.year === ""
              ? undefined
              : normalizeNumberInput(filters.year),
          month: normalizeNumberInput(filters.month),
        };
      }
    }

    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    );

    try {
      const data = await noticeService.getAllNotices(cleanedParams);
      setNoticePage(data);
    } catch (err) {
      console.error(err);
      setError("공지사항 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    user,
    currentPage,
    debouncedTitleFilter,
    filters.year,
    filters.month,
    filters.startDate,
    filters.endDate,
    filters.pinned,
    filters.semesterId,
    filterType,
    sortOrder,
    semesters,
  ]);

  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await noticeService.getAvailableYears();
      setAvailableYears(years);
    } catch (err) {
      console.error("Failed to fetch available years for notices:", err);
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
        console.error("동명이인 목록 로딩 실패:", e);
      }
    };
    fetchAllMembers();
  }, [user]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  useEffect(() => {
    if (user) {
      Promise.all([fetchAvailableYears(), fetchSemesters()]);
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

  const handleDelete = (notice: NoticeDto) => {
    setNoticeToDelete(notice);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!noticeToDelete) return;
    setDeleteError(null);
    try {
      await noticeService.deleteNotice(noticeToDelete.id);
      setShowDeleteConfirm(false);
      setNoticeToDelete(null);
      fetchNotices();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message || "공지사항 삭제에 실패했습니다."
      );
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirm(false);
    setNoticeToDelete(null);
    setDeleteError(null);
  };

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    const nextFilters = { ...filters, [field]: value };
    const nextPage = 0;
    setFilters(nextFilters);
    setCurrentPage(nextPage);
    syncSearchParams(nextFilters, filterType, unitType, sortOrder, nextPage);
  };

  const handleUnitTypeClick = (type: UnitType) => {
    const cy = new Date().getFullYear();
    const baseYear = filters.year === "" ? "" : filters.year || "";
    let nextFilters = { ...filters };

    if (type === "year") {
      nextFilters = {
        ...filters,
        year: baseYear,
        month: "" as const,
        semesterId: "" as const,
      };
    } else if (type === "month") {
      const targetYear = baseYear === "" ? cy : baseYear;
      nextFilters = {
        ...filters,
        year: targetYear,
        month: (filters.month as number) || currentMonth,
        semesterId: "" as const,
      };
    } else if (type === "semester") {
      nextFilters = {
        ...filters,
        year: "" as const,
        month: "" as const,
        semesterId: filters.semesterId || ("" as const),
      };

      if (semesters.length > 0 && !nextFilters.semesterId) {
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

        if (target) {
          nextFilters.semesterId = target.id;
        }
      }
    }

    const nextPage = 0;
    setUnitType(type);
    setFilters(nextFilters);
    setCurrentPage(nextPage);
    syncSearchParams(nextFilters, filterType, type, sortOrder, nextPage);
  };

  const handleUnitValueClick = (value: number) => {
    const cy = new Date().getFullYear();
    const baseYear = filters.year === "" ? cy : filters.year || cy;

    const nextFilters = {
      ...filters,
      year: baseYear,
      month: value,
      semesterId: "" as const,
    };

    const nextPage = 0;
    setFilters(nextFilters);
    setCurrentPage(nextPage);
    syncSearchParams(nextFilters, filterType, unitType, sortOrder, nextPage);
  };

  const handleSemesterClick = (semesterId: number) => {
    const nextFilters = {
      ...filters,
      semesterId: semesterId as typeof filters.semesterId,
      year: "" as typeof filters.year,
      month: "" as typeof filters.month,
    };

    const nextPage = 0;
    setFilters(nextFilters);
    setCurrentPage(nextPage);
    syncSearchParams(nextFilters, filterType, unitType, sortOrder, nextPage);
  };

  const requestSort = (key: SortKey) => {
    // 현재는 createdAt만 지원
    let nextDirection: "asc" | "desc" = "desc";
    const [currentKey, currentDir] = sortOrder.split(",");

    if (currentKey === key && currentDir === "desc") {
      nextDirection = "asc";
    }
    const nextSort = `${key},${nextDirection}`;
    setSortOrder(nextSort);
    setCurrentPage(0);
    syncSearchParams(filters, filterType, unitType, nextSort, 0);
  };

  const getSortIndicator = (key: SortKey) => {
    const [currentKey, currentDir] = sortOrder.split(",");
    if (currentKey !== key) return " ↕";
    return currentDir === "asc" ? " ▲" : " ▼";
  };

  const yearOptions = useMemo(() => {
    const validYears = availableYears
      .filter((year): year is number => typeof year === "number" && year > 1970)
      .sort((a, b) => b - a);
    const cy = new Date().getFullYear();

    // 연도 옵션이 비어있어도 최소한 현재 연도는 보여주도록 함
    const options =
      validYears.length > 0
        ? validYears.map((year) => ({ value: year, label: `${year}년` }))
        : [{ value: cy, label: `${cy}년` }];

    return [{ value: "", label: "전체 연도" }, ...options];
  }, [availableYears]);

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="pt-2 border-t border-gray-200/50 mt-2">
            <label className="text-xs font-bold text-gray-500 mb-2 block">
              월 선택
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleUnitValueClick(m)}
                  className={`py-1.5 rounded-md text-xs font-bold transition-colors ${
                    filters.month === m
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {m}월
                </button>
              ))}
            </div>
          </div>
        );
      case "semester":
        if (semesters.length === 0) {
          return (
            <div className="mt-3 rounded-md bg-yellow-50 p-3 text-[11px] sm:text-xs text-yellow-800 border border-yellow-100">
              현재 활성 상태인 학기가 없습니다.
            </div>
          );
        }
        return (
          <div className="pt-2 border-t border-gray-200/50 mt-2">
            <label className="text-xs font-bold text-gray-500 mb-2 block">
              학기 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {semesters.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSemesterClick(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${
                    filters.semesterId === s.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (error && !user) {
    return (
      <div className="bg-gray-50 min-h-screen flex justify-center items-center p-4">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <p className="text-red-600 text-sm font-bold">{error}</p>
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
              <MegaphoneIcon className="h-7 w-7 text-indigo-500" />
              공지사항 {user?.role === "EXECUTIVE" ? "관리" : "목록"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {user?.role === "EXECUTIVE"
                ? "공지사항을 등록하고 고정 공지를 관리합니다."
                : "등록된 공지사항 목록을 확인합니다."}
            </p>
          </div>
          {user?.role === "EXECUTIVE" && (
            <button
              onClick={() => navigate("/admin/notices/add")}
              className="flex items-center justify-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-sm transition-all"
            >
              <PlusIcon className="h-4 w-4" /> 새 공지사항
            </button>
          )}
        </div>

        {error && user && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5" /> {error}
          </div>
        )}

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
                onClick={() => {
                  setFilterType("unit");
                  setCurrentPage(0);
                  syncSearchParams(filters, "unit", unitType, sortOrder, 0);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterType === "unit"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                단위별 조회
              </button>
              <button
                onClick={() => {
                  setFilterType("range");
                  setCurrentPage(0);
                  syncSearchParams(filters, "range", unitType, sortOrder, 0);
                }}
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
                  {/* 1. 연도 선택 */}
                  <div className="w-full sm:w-32">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">
                      연도
                    </label>
                    <div className="relative">
                      <select
                        value={filters.year === "" ? "" : filters.year}
                        onChange={(e) =>
                          handleFilterChange(
                            "year",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        // ✅ 수정: py-2, px-1, border-gray-300, shadow-sm
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
                    {/* ✅ 수정: 개별 버튼 + gap-2 */}
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

            {/* Bottom Row Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  제목 검색
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="검색..."
                    value={filters.title}
                    onChange={(e) =>
                      handleFilterChange("title", e.target.value)
                    }
                    // ✅ 수정: py-2, border-gray-300, rounded-lg, shadow-sm
                    className="w-full pl-10 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  고정 여부
                </label>
                <select
                  value={filters.pinned}
                  onChange={(e) => handleFilterChange("pinned", e.target.value)}
                  // ✅ 수정: py-2, border-gray-300, rounded-lg, shadow-sm
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white shadow-sm"
                >
                  <option value="all">전체</option>
                  <option value="true">고정된 공지만</option>
                  <option value="false">고정되지 않은 공지만</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">
                  정렬 순서
                </label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => requestSort("createdAt")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      sortOrder === "createdAt,desc"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    최신순
                  </button>
                  <button
                    onClick={() => {
                      const nextSort = "createdAt,asc";
                      setSortOrder(nextSort);
                      setCurrentPage(0);
                      syncSearchParams(
                        filters,
                        filterType,
                        unitType,
                        nextSort,
                        0
                      );
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      sortOrder === "createdAt,asc"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    오래된순
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* List */}
        {!loading && noticePage && (
          <>
            {noticePage.content.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
                조건에 맞는 공지사항이 없습니다.
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="space-y-3 md:hidden mb-4">
                  {noticePage.content.map((notice) => (
                    <div
                      key={notice.id}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-all"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex-1">
                          <Link
                            to={`/admin/notices/${notice.id}`}
                            className="text-lg font-bold text-indigo-600 hover:text-indigo-800 line-clamp-1"
                          >
                            {notice.title}
                          </Link>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <span className="text-xs text-gray-500">
                              작성:{" "}
                              <span className="font-medium text-gray-700">
                                {safeFormatDate(notice.createdAt)}
                              </span>
                            </span>
                            <span className="text-xs text-gray-500">
                              작성자:{" "}
                              <span className="font-medium text-gray-700">
                                {getFormattedName(
                                  notice.createdBy?.id,
                                  notice.createdBy?.name
                                )}
                              </span>
                            </span>
                          </div>
                        </div>
                        {notice.pinned && (
                          <div className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg flex items-center gap-1">
                            <MapPinIcon className="h-3 w-3" />
                            <span className="text-[10px] font-bold">고정</span>
                          </div>
                        )}
                      </div>

                      {user?.role === "EXECUTIVE" && (
                        <div className="pt-3 mt-2 border-t border-gray-50 flex justify-end gap-2">
                          <button
                            onClick={() =>
                              navigate(`/admin/notices/${notice.id}/edit`)
                            }
                            className="bg-gray-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-50 flex items-center gap-1"
                          >
                            <PencilIcon className="h-3 w-3" /> 수정
                          </button>
                          <button
                            onClick={() => handleDelete(notice)}
                            className="bg-gray-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-50 flex items-center gap-1"
                          >
                            <TrashIcon className="h-3 w-3" /> 삭제
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden mb-4">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                          제목
                        </th>
                        <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                          고정
                        </th>
                        <th
                          className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                          onClick={() => requestSort("createdAt")}
                        >
                          작성일 {getSortIndicator("createdAt")}
                        </th>
                        <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                          작성자
                        </th>
                        {/* ✅ 관리 헤더 우측 정렬 유지 */}
                        <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase text-xs">
                          {/* 관리 */}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {noticePage.content.map((notice) => (
                        <tr
                          key={notice.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-indigo-600">
                            <Link
                              to={`/admin/notices/${notice.id}`}
                              className="hover:underline"
                            >
                              {notice.title}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            {notice.pinned && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                                <MapPinIcon className="h-3 w-3" />
                                <span className="text-xs font-bold">고정</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {safeFormatDate(notice.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-gray-700 font-medium">
                            {getFormattedName(
                              notice.createdBy?.id,
                              notice.createdBy?.name
                            )}
                          </td>
                          {/* ✅ 관리 열: 우측 정렬 + 텍스트 버튼 스타일 */}
                          <td className="px-6 py-4 text-right">
                            {user?.role === "EXECUTIVE" && (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() =>
                                    navigate(`/admin/notices/${notice.id}/edit`)
                                  }
                                  className="text-gray-400 hover:text-indigo-600 font-bold text-xs"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleDelete(notice)}
                                  className="text-gray-400 hover:text-red-500 font-bold text-xs"
                                >
                                  삭제
                                </button>
                              </div>
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
              currentPage={noticePage.number}
              totalPages={noticePage.totalPages}
              totalElements={noticePage.totalElements}
              onPageChange={(page) => {
                setCurrentPage(page);
                syncSearchParams(
                  filters,
                  filterType,
                  unitType,
                  sortOrder,
                  page
                );
              }}
            />
          </>
        )}

        {/* Delete Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                공지사항 삭제
              </h3>
              <p className="text-sm text-gray-600 mb-2 break-keep">
                정말로{" "}
                <span className="font-bold text-gray-900">
                  "{noticeToDelete?.title}"
                </span>{" "}
                공지사항을 삭제하시겠습니까?
              </p>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-4">
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

export default AdminNoticesPage;
