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
import {
  MapPinIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/solid";
import Pagination from "../components/Pagination";
import { useDebounce } from "../hooks/useDebounce";
import { normalizeNumberInput } from "../utils/numberUtils";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";

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

  // ✅ [수정] 사용되지 않던 error 변수를 아래 JSX에서 렌더링하도록 수정했습니다.
  const [error, setError] = useState<string | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<NoticeDto | null>(null);

  // ✅ [수정] 사용되지 않던 deleteError 변수를 삭제 모달 내부에서 렌더링하도록 수정했습니다.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;

  // KST 날짜 포맷터
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

  // 초기값 설정 로직
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
    const safeNumber = (val: string | null) =>
      !val || isNaN(Number(val)) ? "" : Number(val);
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

  const [sortOrder, setSortOrder] = useState(
    () => searchParams.get("sort") || "createdAt,desc"
  );
  const [currentPage, setCurrentPage] = useState(() =>
    searchParams.get("page") ? Number(searchParams.get("page")) : 0
  );
  const [filterType, setFilterType] = useState<"unit" | "range">(() =>
    searchParams.get("filterType") === "range" ? "range" : "unit"
  );
  const [unitType, setUnitType] = useState<UnitType>(() => {
    const ut = searchParams.get("unitType");
    return ut === "year" || ut === "month" || ut === "semester" ? ut : "year";
  });

  const debouncedTitleFilter = useDebounce(filters.title, 500);

  // 멤버 이름 매핑
  const memberNameMap = useMemo(() => {
    const map = new Map<number, string>();
    allMembersForNameCheck.forEach((m) =>
      map.set(m.id, formatDisplayName(m, allMembersForNameCheck))
    );
    return map;
  }, [allMembersForNameCheck]);

  const getFormattedName = useCallback(
    (id?: number, name?: string) =>
      !name ? "알 수 없음" : !id ? name : memberNameMap.get(id) || name,
    [memberNameMap]
  );

  // URL 동기화
  const syncSearchParams = useCallback(
    (
      nextFilters = filters,
      nextFilterType = filterType,
      nextUnitType = unitType,
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
        if (nextFilters.year === "") params.year = "all";
        else if (typeof nextFilters.year === "number")
          params.year = String(nextFilters.year);
        if (typeof nextFilters.month === "number")
          params.month = String(nextFilters.month);
        if (typeof nextFilters.semesterId === "number")
          params.semesterId = String(nextFilters.semesterId);
      }
      setSearchParams(params, { replace: true });
    },
    [filters, filterType, unitType, sortOrder, currentPage, setSearchParams]
  );

  // 데이터 Fetching
  const fetchSemesters = useCallback(async () => {
    try {
      setSemesters(await semesterService.getAllSemesters(true));
    } catch {
      setSemesters([]);
    }
  }, []);

  const fetchNotices = useCallback(async () => {
    if (!user) return setLoading(false);
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
        if (semester)
          params = {
            ...params,
            startDate: semester.startDate,
            endDate: semester.endDate,
          };
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
      setNoticePage(await noticeService.getAllNotices(cleanedParams));
    } catch {
      setError("공지사항 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    user,
    currentPage,
    debouncedTitleFilter,
    filters,
    filterType,
    sortOrder,
    semesters,
  ]);

  const fetchAvailableYears = useCallback(async () => {
    try {
      setAvailableYears(await noticeService.getAvailableYears());
    } catch {
      setAvailableYears([]);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    memberService
      .getAllMembers({ page: 0, size: 2000, sort: "id,asc" })
      .then((res) => setAllMembersForNameCheck(res.content))
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);
  useEffect(() => {
    if (user) Promise.all([fetchAvailableYears(), fetchSemesters()]);
  }, [user, fetchAvailableYears, fetchSemesters]);

  // Handlers
  const handleDelete = (notice: NoticeDto) => {
    setNoticeToDelete(notice);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };
  const handleConfirmDelete = async () => {
    if (!noticeToDelete) return;
    try {
      await noticeService.deleteNotice(noticeToDelete.id);
      setShowDeleteConfirm(false);
      setNoticeToDelete(null);
      fetchNotices();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || "삭제 실패");
    }
  };
  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    const nextFilters = { ...filters, [field]: value };
    setFilters(nextFilters);
    setCurrentPage(0);
    syncSearchParams(nextFilters, filterType, unitType, sortOrder, 0);
  };

  const handleUnitTypeClick = (type: UnitType) => {
    const cy = new Date().getFullYear();
    const baseYear = filters.year === "" ? "" : filters.year || "";
    let nextFilters = { ...filters };

    if (type === "year")
      nextFilters = {
        ...filters,
        year: baseYear,
        month: "" as const,
        semesterId: "" as const,
      };
    else if (type === "month")
      nextFilters = {
        ...filters,
        year: baseYear === "" ? cy : baseYear,
        month: (filters.month as number) || currentMonth,
        semesterId: "" as const,
      };
    else if (type === "semester") {
      nextFilters = {
        ...filters,
        year: "" as const,
        month: "" as const,
        semesterId: filters.semesterId || ("" as const),
      };
      if (semesters.length > 0 && !nextFilters.semesterId) {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        let target = semesters.find(
          (s) =>
            s.startDate.substring(0, 7) <= ym && s.endDate.substring(0, 7) >= ym
        );
        if (!target) target = [...semesters].sort((a, b) => b.id - a.id)[0];
        if (target) nextFilters.semesterId = target.id;
      }
    }
    setUnitType(type);
    setFilters(nextFilters);
    setCurrentPage(0);
    syncSearchParams(nextFilters, filterType, type, sortOrder, 0);
  };

  const yearOptions = useMemo(() => {
    const valid = availableYears
      .filter((y): y is number => typeof y === "number" && y > 1970)
      .sort((a, b) => b - a);
    const cy = new Date().getFullYear();
    if (valid.length === 0)
      return [
        { value: "", label: "전체 연도" },
        { value: cy, label: `${cy}년` },
      ];
    return [
      { value: "", label: "전체 연도" },
      ...valid.map((y) => ({ value: y, label: `${y}년` })),
    ];
  }, [availableYears]);

  const requestSort = (key: SortKey) => {
    const [currKey, currDir] = sortOrder.split(",");
    const nextDir = currKey === key && currDir === "desc" ? "asc" : "desc";
    const nextSort = `${key},${nextDir}`;
    setSortOrder(nextSort);
    setCurrentPage(0);
    syncSearchParams(filters, filterType, unitType, nextSort, 0);
  };

  const renderUnitButtons = () => {
    if (unitType === "month") {
      return (
        <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar snap-x">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <button
              key={m}
              onClick={() => {
                const nf = { ...filters, month: m };
                setFilters(nf);
                setCurrentPage(0);
                syncSearchParams(nf, filterType, unitType, sortOrder, 0);
              }}
              className={`flex-shrink-0 snap-start px-3 py-1.5 border rounded-full text-xs font-bold ${
                filters.month === m
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {m}월
            </button>
          ))}
        </div>
      );
    }
    if (unitType === "semester") {
      if (semesters.length === 0)
        return (
          <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
            활성 학기가 없습니다.
          </div>
        );
      return (
        <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar snap-x">
          {semesters.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                const nf = {
                  ...filters,
                  semesterId: s.id,
                  year: "" as const,
                  month: "" as const,
                };
                setFilters(nf);
                setCurrentPage(0);
                syncSearchParams(nf, filterType, unitType, sortOrder, 0);
              }}
              className={`flex-shrink-0 snap-start px-3 py-1.5 border rounded-full text-xs font-bold ${
                filters.semesterId === s.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">공지사항</h1>
            <p className="text-sm text-gray-500 mt-1">
              교회 소식을 확인하고 관리합니다.
            </p>
          </div>
          {user?.role === "EXECUTIVE" && (
            <button
              onClick={() => navigate("/admin/notices/add")}
              className="flex items-center justify-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-sm transition-all"
            >
              <PlusIcon className="h-4 w-4" /> 작성하기
            </button>
          )}
        </div>

        {/* ✅ [추가] 에러 메시지 표시 영역 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Filters Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto self-start">
              <button
                onClick={() => {
                  setFilterType("unit");
                  setCurrentPage(0);
                  syncSearchParams(filters, "unit", unitType, sortOrder, 0);
                }}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  filterType === "unit"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                단위별
              </button>
              <button
                onClick={() => {
                  setFilterType("range");
                  setCurrentPage(0);
                  syncSearchParams(filters, "range", unitType, sortOrder, 0);
                }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
            <div className="space-y-4 mb-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="sm:w-1/3">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    연도
                  </label>
                  <select
                    value={filters.year === "" ? "" : filters.year}
                    onChange={(e) =>
                      handleFilterChange(
                        "year",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={unitType === "semester"}
                  >
                    {yearOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">
                    조회 단위
                  </label>
                  <div className="flex bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    {(
                      [
                        { t: "month", l: "월간" },
                        { t: "semester", l: "학기" },
                        { t: "year", l: "연간" },
                      ] as const
                    ).map((u) => (
                      <button
                        key={u.t}
                        onClick={() => handleUnitTypeClick(u.t)}
                        className={`flex-1 py-2 text-xs font-bold ${
                          unitType === u.t
                            ? "bg-indigo-50 text-indigo-600"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                        disabled={u.t === "semester" && !hasActiveSemesters}
                      >
                        {u.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {renderUnitButtons()}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="제목 검색..."
                value={filters.title}
                onChange={(e) => handleFilterChange("title", e.target.value)}
                className="w-full pl-9 border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white transition-all"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filters.pinned}
                onChange={(e) => handleFilterChange("pinned", e.target.value)}
                className="border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white"
              >
                <option value="all">모든 공지</option>
                <option value="true">📌 고정 공지</option>
                <option value="false">일반 공지</option>
              </select>
              <button
                onClick={() => requestSort("createdAt")}
                className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 whitespace-nowrap"
              >
                {sortOrder.includes("desc") ? "최신순" : "오래된순"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : !noticePage || noticePage.content.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {noticePage.content.map((notice) => (
                <div
                  key={notice.id}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-100 hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {notice.pinned && (
                          <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-bold border border-indigo-100 flex items-center gap-0.5">
                            <MapPinIcon className="h-3 w-3" /> 고정
                          </span>
                        )}
                        <Link
                          to={`/admin/notices/${notice.id}`}
                          className="text-sm sm:text-base font-bold text-gray-900 hover:text-indigo-600 line-clamp-1"
                        >
                          {notice.title}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>
                          {getFormattedName(
                            notice.createdBy?.id,
                            notice.createdBy?.name
                          )}
                        </span>
                        <span className="w-0.5 h-2.5 bg-gray-200"></span>
                        <span>{safeFormatDate(notice.createdAt)}</span>
                      </div>
                    </div>
                    {user?.role === "EXECUTIVE" && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            navigate(`/admin/notices/${notice.id}/edit`)
                          }
                          className="text-xs font-bold text-gray-400 hover:text-indigo-600 bg-gray-50 px-2 py-1 rounded-md"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(notice)}
                          className="text-xs font-bold text-gray-400 hover:text-red-600 bg-gray-50 px-2 py-1 rounded-md"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Pagination
                currentPage={noticePage.number}
                totalPages={noticePage.totalPages}
                totalElements={noticePage.totalElements}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  syncSearchParams(filters, filterType, unitType, sortOrder, p);
                }}
              />
            </div>
          </>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                공지사항 삭제
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                정말로 삭제하시겠습니까? 복구할 수 없습니다.
              </p>

              {/* ✅ [추가] 삭제 에러 메시지 표시 */}
              {deleteError && (
                <div className="mb-4 bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
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
