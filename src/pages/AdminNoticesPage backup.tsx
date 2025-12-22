// src/pages/AdminNoticesPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { noticeService } from "../services/noticeService";
import { semesterService } from "../services/semesterService";
import type {
  GetAllNoticesParams,
  NoticeDto,
  Page,
  SemesterDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { MapPinIcon } from "@heroicons/react/24/solid";
import Pagination from "../components/Pagination";
import { useDebounce } from "../hooks/useDebounce";
import { normalizeNumberInput } from "../utils/numberUtils";

const AdminNoticesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [noticePage, setNoticePage] = useState<Page<NoticeDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<NoticeDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const hasActiveSemesters = semesters.length > 0;

  const [filters, setFilters] = useState({
    title: "",
    pinned: "all",
    startDate: "",
    endDate: "",
    year: currentYear as number | "",
    month: "" as number | "",
    quarter: "" as number | "",
    half: "" as number | "",
    semesterId: "" as number | "",
  });

  const [sortOrder, setSortOrder] = useState("createdAt,desc");
  const [currentPage, setCurrentPage] = useState(0);
  const [filterType, setFilterType] = useState<"unit" | "range">("unit");
  const [unitType, setUnitType] = useState<
    "year" | "half" | "quarter" | "month" | "semester"
  >("year");

  const debouncedTitleFilter = useDebounce(filters.title, 500);

  // YYYY-MM-DD -> MM/DD
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [, month, day] = dateStr.split("-");
    return `${month}/${day}`;
  };

  // 기간 요약
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

  // 학기 목록 조회
  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("Failed to fetch semesters:", err);
      setSemesters([]);
    }
  }, []);

  // 공지 목록 조회
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
          year: normalizeNumberInput(filters.year),
          month: normalizeNumberInput(filters.month),
          quarter: normalizeNumberInput(filters.quarter),
          half: normalizeNumberInput(filters.half),
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
    filters.quarter,
    filters.half,
    filters.startDate,
    filters.endDate,
    filters.pinned,
    filters.semesterId,
    filterType,
    sortOrder,
    semesters,
  ]);

  // 연도 목록 조회
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
    fetchNotices();
  }, [fetchNotices]);

  useEffect(() => {
    if (user) {
      fetchAvailableYears();
      fetchSemesters();
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

  // 삭제 관련
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

  // 필터 / 단위 변경
  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  const handleUnitTypeClick = (
    type: "year" | "half" | "quarter" | "month" | "semester"
  ) => {
    setUnitType(type);

    setFilters((prev) => {
      const cy = new Date().getFullYear();
      const baseYear = prev.year || cy;

      if (type === "year") {
        return {
          ...prev,
          year: baseYear,
          month: "",
          quarter: "",
          half: "",
          semesterId: "",
        };
      }

      if (type === "half") {
        return {
          ...prev,
          year: baseYear,
          half: (prev.half as number) || 1,
          month: "",
          quarter: "",
          semesterId: "",
        };
      }

      if (type === "quarter") {
        return {
          ...prev,
          year: baseYear,
          quarter: (prev.quarter as number) || 1,
          month: "",
          half: "",
          semesterId: "",
        };
      }

      if (type === "month") {
        return {
          ...prev,
          year: baseYear,
          month: (prev.month as number) || currentMonth,
          quarter: "",
          half: "",
          semesterId: "",
        };
      }

      // 학기 모드
      return {
        ...prev,
        year: "",
        month: "",
        quarter: "",
        half: "",
        semesterId: prev.semesterId || "",
      };
    });

    setCurrentPage(0);
  };

  const handleUnitValueClick = (
    unit: "month" | "quarter" | "half",
    value: number
  ) => {
    setFilters((prev) => {
      const cy = new Date().getFullYear();
      const baseYear = prev.year || cy;

      return {
        ...prev,
        year: baseYear,
        month: unit === "month" ? value : "",
        quarter: unit === "quarter" ? value : "",
        half: unit === "half" ? value : "",
        semesterId: "",
      };
    });

    setCurrentPage(0);
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
  };

  // 연도 옵션
  const yearOptions = useMemo(() => {
    if (availableYears.length === 0) {
      const cy = new Date().getFullYear();
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
  }, [availableYears]);

  // 단위별 버튼 렌더링
  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                type="button"
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
                type="button"
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
                type="button"
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
              현재 활성 상태인 학기가 없습니다. 공지 화면에서 학기 선택을
              사용하려면 최소 1개 이상의 학기를 활성화해 주세요.
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

  // 로그인 안 된 상태에서 에러
  if (error && !user) {
    return (
      <div className="bg-gray-50 min-h-screen flex justify-center items-center px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <p className="mt-1 text-red-600 text-sm sm:text-base">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              공지사항 {user?.role === "EXECUTIVE" ? "관리" : "목록"}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {user?.role === "EXECUTIVE"
                ? "공지사항을 등록·수정·삭제하고, 고정 공지를 관리하는 페이지입니다."
                : "공지사항 목록을 확인하는 페이지입니다."}
            </p>
          </div>
          {user?.role === "EXECUTIVE" && (
            <button
              onClick={() => navigate("/admin/notices/add")}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
            >
              + 새 공지사항
            </button>
          )}
        </div>

        {error && user && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* ====== 기간 필터 영역 ====== */}
        <div className="p-4 bg-gray-50 rounded-lg mb-3 sm:mb-4 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <h3 className="text-base sm:text-lg font-semibold">
              조회 기간 설정 (작성일 기준)
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
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
                type="button"
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
                    <p className="mt-1 text-[11px] sm:text-xs text-red-500">
                      활성화된 학기가 없어 학기 단위 조회를 사용할 수 없습니다.
                    </p>
                  )}
                </div>
              </div>
              {renderUnitButtons()}
            </div>
          )}

          <hr />

          {/* 제목 / 고정여부 / 정렬 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                제목 검색
              </label>
              <input
                type="text"
                placeholder="제목으로 검색..."
                value={filters.title}
                onChange={(e) => handleFilterChange("title", e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                고정 여부
              </label>
              <select
                value={filters.pinned}
                onChange={(e) => handleFilterChange("pinned", e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
              >
                <option value="all">전체</option>
                <option value="true">고정된 공지만</option>
                <option value="false">고정되지 않은 공지만</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                정렬 순서
              </label>
              <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
                <button
                  onClick={() => setSortOrder("createdAt,desc")}
                  className={`w-full px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
                    sortOrder === "createdAt,desc"
                      ? "bg-white text-indigo-700 shadow"
                      : "text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  최신순
                </button>
                <button
                  onClick={() => setSortOrder("createdAt,asc")}
                  className={`w-full px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
                    sortOrder === "createdAt,asc"
                      ? "bg-white text-indigo-700 shadow"
                      : "text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  오래된순
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 기간 요약 한 줄 */}
        {periodSummary && (
          <p className="mb-4 text-[11px] sm:text-xs text-gray-500">
            {periodSummary}
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center min-h-[30vh]">
            <p className="text-xs sm:text-sm text-gray-500">
              공지사항을 불러오는 중입니다...
            </p>
          </div>
        )}

        {!loading && noticePage && (
          <>
            <div className="bg-white shadow-md rounded-lg overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        제목
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        고정
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작성일
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작성자
                      </th>
                      <th className="relative px-4 sm:px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {noticePage.content.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500"
                        >
                          등록된 공지사항이 없거나, 조건에 맞는 공지사항이
                          없습니다.
                        </td>
                      </tr>
                    ) : (
                      noticePage.content.map((notice) => (
                        <tr key={notice.id}>
                          <td className="px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium">
                            <Link
                              to={`/admin/notices/${notice.id}`}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              {notice.title}
                            </Link>
                          </td>
                          <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            {notice.pinned && (
                              <div className="inline-flex items-center gap-1">
                                <MapPinIcon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
                                <span className="text-[11px] sm:text-xs text-indigo-600 font-medium">
                                  고정
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            {new Date(notice.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            {notice.createdBy?.name ?? "알 수 없음"}
                          </td>
                          <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                            {user?.role === "EXECUTIVE" && (
                              <>
                                <button
                                  onClick={() =>
                                    navigate(`/admin/notices/${notice.id}/edit`)
                                  }
                                  className="text-indigo-600 hover:text-indigo-900 mr-3"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleDelete(notice)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  삭제
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              currentPage={noticePage.number}
              totalPages={noticePage.totalPages}
              totalElements={noticePage.totalElements}
              onPageChange={setCurrentPage}
            />
          </>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-sm w-full">
              <h2 className="text-lg sm:text-xl font-bold mb-4">
                공지사항 삭제 확인
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                정말로 &quot;{noticeToDelete?.title}&quot; 공지사항을
                삭제하시겠습니까?
              </p>
              {deleteError && (
                <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md mb-4">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleCloseDeleteModal}
                  className="bg-gray-300 text-gray-800 px-3 sm:px-4 py-2 rounded-md mr-2 text-xs sm:text-sm"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm"
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

export default AdminNoticesPage;
