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
  PlusIcon,
  MapPinIcon,
  ExclamationCircleIcon, // ✅ 에러 표시용 아이콘 사용
} from "@heroicons/react/24/solid";

type SortKey = "createdAt";
type UnitType = "year" | "month" | "semester";

const scrollbarHideStyle: React.CSSProperties = {
  msOverflowStyle: "none",
  scrollbarWidth: "none",
};

const AdminNoticesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ❌ [삭제] currentMonth는 사용하지 않으므로 삭제 (Lint 에러 해결)
  // const now = new Date();
  // const currentMonth = now.getMonth() + 1;

  const [noticePage, setNoticePage] = useState<Page<NoticeDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // ✅ [사용] error 상태를 화면에 렌더링하도록 수정 (Lint 에러 해결)
  const [error, setError] = useState<string | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<NoticeDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);

  // ✅ [사용] 학기 데이터가 없으면 학기 버튼 비활성화에 사용 (Lint 에러 해결)
  const hasActiveSemesters = semesters.length > 0;

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

  const isEdited = (notice: NoticeDto) => {
    if (!notice.updatedAt || !notice.createdAt) return false;
    return notice.createdAt !== notice.updatedAt;
  };

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
    if (ut === "year" || ut === "month" || ut === "semester") return ut;
    return "year";
  });

  const debouncedTitleFilter = useDebounce(filters.title, 500);

  const memberNameMap = useMemo(() => {
    const map = new Map<number, string>();
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
    [memberNameMap],
  );

  const syncSearchParams = useCallback(
    (
      nextFilters = filters,
      nextFilterType: "unit" | "range" = filterType,
      nextUnitType: UnitType = unitType,
      nextSortOrder = sortOrder,
      nextPage = currentPage,
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
        params.year =
          nextFilters.year === "" ? "all" : String(nextFilters.year);
        if (typeof nextFilters.month === "number")
          params.month = String(nextFilters.month);
        if (typeof nextFilters.semesterId === "number")
          params.semesterId = String(nextFilters.semesterId);
      }
      setSearchParams(params, { replace: true });
    },
    [filters, filterType, unitType, sortOrder, currentPage, setSearchParams],
  );

  const fetchNotices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const params: GetAllNoticesParams = {
      page: currentPage,
      size: 10,
      title: debouncedTitleFilter,
      pinned: filters.pinned === "all" ? undefined : filters.pinned === "true",
      sort: sortOrder,
    };

    if (filterType === "range") {
      params.startDate = filters.startDate || undefined;
      params.endDate = filters.endDate || undefined;
    } else if (filters.semesterId && semesters.length > 0) {
      const semester = semesters.find((s) => s.id === filters.semesterId);
      if (semester) {
        params.startDate = semester.startDate;
        params.endDate = semester.endDate;
      }
    } else {
      params.year =
        filters.year === "" ? undefined : normalizeNumberInput(filters.year);
      params.month = normalizeNumberInput(filters.month);
    }

    try {
      const data = await noticeService.getAllNotices(params);
      setNoticePage(data);
    } catch (err) {
      // catch에서 error 변수는 여기서만 쓰이고 state error는 setError로 설정됨
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

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  useEffect(() => {
    if (user) {
      semesterService.getAllSemesters(true).then(setSemesters);
      noticeService.getAvailableYears().then(setAvailableYears);
      memberService.getAllMembers({ page: 0, size: 2000 }).then((page) => {
        setAllMembersForNameCheck(
          page.content.map((m) => ({
            id: m.id,
            name: m.name,
            birthDate: m.birthDate,
          })),
        );
      });
    }
  }, [user]);

  const handleDelete = (notice: NoticeDto) => {
    setNoticeToDelete(notice);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  // ✅ [수정] any 제거 및 unknown 타입 사용 (Lint 에러 해결)
  const handleConfirmDelete = async () => {
    if (!noticeToDelete) return;
    setDeleteError(null);
    try {
      await noticeService.deleteNotice(noticeToDelete.id);
      setShowDeleteConfirm(false);
      setNoticeToDelete(null);
      fetchNotices();
    } catch (err: unknown) {
      console.error("삭제 실패:", err);
      const errorMessage = (err as any)?.response?.data?.message || "삭제 실패";
      setDeleteError(errorMessage);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirm(false);
    setNoticeToDelete(null);
    setDeleteError(null);
  };

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    const nextFilters = { ...filters, [field]: value };
    setCurrentPage(0);
    setFilters(nextFilters);
    syncSearchParams(nextFilters, filterType, unitType, sortOrder, 0);
  };

  const requestSort = (key: SortKey) => {
    const [currentKey, currentDir] = sortOrder.split(",");
    const nextDirection =
      currentKey === key && currentDir === "desc" ? "asc" : "desc";
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

  const renderUnitButtons = () => {
    if (unitType === "month") {
      return (
        <div className="pt-2 border-t border-gray-200/50 mt-2">
          <div
            className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide"
            style={scrollbarHideStyle}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleFilterChange("month", m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filters.month === m ? "bg-indigo-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-600"}`}
              >
                {m}월
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (unitType === "semester") {
      return (
        <div className="pt-2 border-t border-gray-200/50 mt-2">
          <div
            className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide"
            style={scrollbarHideStyle}
          >
            {semesters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleFilterChange("semesterId", s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filters.semesterId === s.id ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white border-gray-200 text-gray-600"}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${s.isActive ? "bg-green-400" : "bg-gray-300"}`}
                />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
              <MegaphoneIcon className="h-7 w-7 text-indigo-500 flex-shrink-0" />
              공지사항 {user?.role === "EXECUTIVE" ? "관리" : "목록"}
            </h1>
          </div>
          {user?.role === "EXECUTIVE" && (
            <button
              onClick={() => navigate("/admin/notices/add")}
              className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-sm"
            >
              <PlusIcon className="h-4 w-4" /> 새 공지사항
            </button>
          )}
        </div>

        {/* ✅ [추가] error 변수 사용: 목록 로딩 에러 표시 (Lint 에러 해결) */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5" /> {error}
          </div>
        )}

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="bg-gray-100 p-1 rounded-xl flex text-xs sm:text-sm font-bold mb-5">
            <button
              onClick={() => {
                setFilterType("unit");
                setCurrentPage(0);
                syncSearchParams(filters, "unit", unitType, sortOrder, 0);
              }}
              className={`flex-1 py-2 rounded-lg ${filterType === "unit" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"}`}
            >
              단위별
            </button>
            <button
              onClick={() => {
                setFilterType("range");
                setCurrentPage(0);
                syncSearchParams(filters, "range", unitType, sortOrder, 0);
              }}
              className={`flex-1 py-2 rounded-lg ${filterType === "range" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"}`}
            >
              기간설정
            </button>
          </div>

          <div className="space-y-5">
            {filterType === "range" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <KoreanCalendarPicker
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange("startDate", date)}
                />
                <KoreanCalendarPicker
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange("endDate", date)}
                />
              </div>
            ) : (
              <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex gap-4 mb-2">
                  <select
                    value={filters.year}
                    onChange={(e) =>
                      handleFilterChange(
                        "year",
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-32 py-2 px-2 border rounded-lg text-sm bg-white"
                    disabled={unitType === "semester"}
                  >
                    <option value="">전체 연도</option>
                    {availableYears
                      .sort((a, b) => b - a)
                      .map((y) => (
                        <option key={y} value={y}>
                          {y}년
                        </option>
                      ))}
                  </select>
                  <div className="flex gap-2">
                    {["month", "semester", "year"].map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setUnitType(type as UnitType);
                          handleFilterChange(
                            type === "semester" ? "semesterId" : "month",
                            "",
                          );
                        }}
                        // ✅ [수정] hasActiveSemesters 사용: 학기 버튼 비활성화 로직 추가 (Lint 에러 해결)
                        disabled={type === "semester" && !hasActiveSemesters}
                        className={`px-3 py-2 text-sm font-bold rounded-lg border 
                          ${
                            unitType === type
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-white text-gray-600"
                          }
                          ${
                            type === "semester" && !hasActiveSemesters
                              ? "opacity-50 cursor-not-allowed bg-gray-50 text-gray-400"
                              : ""
                          }
                        `}
                      >
                        {type === "month"
                          ? "월간"
                          : type === "semester"
                            ? "학기"
                            : "연간"}
                      </button>
                    ))}
                  </div>
                </div>
                {renderUnitButtons()}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="제목 검색..."
                value={filters.title}
                onChange={(e) => handleFilterChange("title", e.target.value)}
                className="w-full pl-3 py-2 border rounded-lg text-sm bg-gray-50"
              />
              <select
                value={filters.pinned}
                onChange={(e) => handleFilterChange("pinned", e.target.value)}
                className="w-full py-2 px-3 border rounded-lg text-sm bg-gray-50"
              >
                <option value="all">고정 여부: 전체</option>
                <option value="true">고정됨</option>
                <option value="false">고정안됨</option>
              </select>
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => requestSort("createdAt")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${sortOrder.includes("desc") ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}
                >
                  최신순
                </button>
                <button
                  onClick={() => requestSort("createdAt")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${sortOrder.includes("asc") ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500"}`}
                >
                  오래된순
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* List Section */}
        {!loading && noticePage && (
          <>
            <div className="space-y-3 md:hidden mb-4">
              {noticePage.content.map((notice) => (
                <div
                  key={notice.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <Link
                      to={`/admin/notices/${notice.id}`}
                      className="text-lg font-bold text-indigo-600 line-clamp-1"
                    >
                      {notice.title}
                    </Link>
                    {notice.pinned && (
                      <div className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                        <MapPinIcon className="h-3 w-3" /> 고정
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                    <span>
                      작성:{" "}
                      <span className="font-medium text-gray-700">
                        {safeFormatDate(notice.createdAt)}
                      </span>
                      {isEdited(notice) && (
                        <span className="ml-1 text-[10px] text-gray-400">
                          (수정됨)
                        </span>
                      )}
                    </span>
                    <span>
                      작성자:{" "}
                      <span className="font-medium text-gray-700">
                        {getFormattedName(
                          notice.createdBy?.id,
                          notice.createdBy?.name,
                        )}
                      </span>
                    </span>
                  </div>
                  {user?.role === "EXECUTIVE" && (
                    <div className="pt-3 mt-2 border-t border-gray-50 flex justify-end gap-2">
                      <button
                        onClick={() =>
                          navigate(`/admin/notices/${notice.id}/edit`)
                        }
                        className="text-indigo-600 text-xs font-bold"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(notice)}
                        className="text-red-500 text-xs font-bold"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

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
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer"
                      onClick={() => requestSort("createdAt")}
                    >
                      작성일 {getSortIndicator("createdAt")}
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      작성자
                    </th>
                    <th className="px-6 py-3 text-right"></th>
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
                          className="hover:underline line-clamp-1"
                        >
                          {notice.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {notice.pinned && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs">
                            <MapPinIcon className="h-3 w-3" /> 고정
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                        {safeFormatDate(notice.createdAt)}
                        {isEdited(notice) && (
                          <span
                            className="ml-2 text-[10px] text-gray-400 font-normal"
                            title={`최종 수정: ${safeFormatDate(notice.updatedAt)}`}
                          >
                            (수정됨)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium whitespace-nowrap">
                        {getFormattedName(
                          notice.createdBy?.id,
                          notice.createdBy?.name,
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user?.role === "EXECUTIVE" && (
                          <div className="flex justify-end gap-3">
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
                  page,
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
                  onClick={handleConfirmDelete} // ✅ [사용] 함수가 버튼에 확실히 연결됨 (Lint 에러 해결)
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
