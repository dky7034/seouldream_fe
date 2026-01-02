// src/pages/CellPrayersPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { cellService } from "../services/cellService";
import { memberService } from "../services/memberService";
import { semesterService } from "../services/semesterService";
import { formatDisplayName } from "../utils/memberUtils";
import { normalizeNumberInput } from "../utils/numberUtils";
import type { Page, PrayerDto, GetPrayersParams, SemesterDto } from "../types";
import Pagination from "../components/Pagination";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import { useAuth } from "../hooks/useAuth";
import {
  UserGroupIcon,
  ArrowLeftIcon,
  FunnelIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/solid";

// ─────────────────────────────────────────────────────────────
// ✅ 헬퍼 함수 및 스타일
// ─────────────────────────────────────────────────────────────

const toLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const mm = month.toString().padStart(2, "0");
  const dd = day.toString().padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

const getThisWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const diffToSunday = day;

  const sunday = new Date(now);
  sunday.setDate(now.getDate() - diffToSunday);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  return {
    startDate: toLocalDateStr(sunday),
    endDate: toLocalDateStr(saturday),
  };
};

// 스크롤바 숨김 스타일
const scrollbarHideStyle: React.CSSProperties = {
  msOverflowStyle: "none" /* IE and Edge */,
  scrollbarWidth: "none" /* Firefox */,
};

// ─────────────────────────────────────────────────────────────
// ✅ 타입 정의
// ─────────────────────────────────────────────────────────────

type FilterType = "week" | "unit" | "range" | "all";
type UnitType = "month" | "semester" | "year";

const CellPrayersPage: React.FC = () => {
  const { cellId } = useParams<{ cellId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─────────────────────────────────────────────────────────────
  // ✅ State
  // ─────────────────────────────────────────────────────────────

  const [pageData, setPageData] = useState<Page<PrayerDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // 필터 상태
  const [filterType, setFilterType] = useState<FilterType>("week");
  const [unitType, setUnitType] = useState<UnitType>("month");

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    semesterId: "" as number | "",
  });

  // 데이터 상태
  const [cellName, setCellName] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";
  const hasActiveSemesters = semesters.length > 0;

  // ─────────────────────────────────────────────────────────────
  // ✅ Effects
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    const fetchCellName = async () => {
      if (cellId) {
        try {
          const cellData = await cellService.getCellById(Number(cellId));
          setCellName(cellData.name);
        } catch (e) {
          console.error("Failed to fetch cell name:", e);
        }
      }
    };

    const fetchAllMembers = async () => {
      try {
        const res = await memberService.getAllMembers({
          page: 0,
          size: 2000,
          sort: "id,asc",
        });
        setAllMembersForNameCheck(
          res.content.map((m) => ({
            id: m.id,
            name: m.name,
            birthDate: m.birthDate,
          }))
        );
      } catch (e) {
        console.error("동명이인 목록 로딩 실패:", e);
      }
    };

    const fetchSemesters = async () => {
      try {
        const data = await semesterService.getAllSemesters(true);
        setSemesters(data);
      } catch (err) {
        console.error("학기 목록 로딩 실패:", err);
      }
    };

    const fetchAvailableYears = async () => {
      try {
        const years = await prayerService.getAvailableYears();
        setAvailableYears(years);
      } catch (err) {
        console.error("연도 목록 로딩 실패:", err);
      }
    };

    fetchCellName();
    fetchAllMembers();
    fetchSemesters();
    fetchAvailableYears();
  }, [user, cellId]);

  // ─────────────────────────────────────────────────────────────
  // ✅ 헬퍼 함수
  // ─────────────────────────────────────────────────────────────

  const getFormattedName = useCallback(
    (id?: number, name?: string) => {
      if (!name) return "-";
      if (!id) return name;
      const found = allMembersForNameCheck.find((m) => m.id === id);
      if (found) {
        return formatDisplayName(found, allMembersForNameCheck).replace(
          " (",
          "("
        );
      }
      return name;
    },
    [allMembersForNameCheck]
  );

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  const yearOptions = useMemo(() => {
    const validYears = availableYears.sort((a, b) => b - a);
    if (validYears.length === 0) {
      const cy = new Date().getFullYear();
      return [{ value: cy, label: `${cy}년` }];
    }
    return validYears.map((y) => ({ value: y, label: `${y}년` }));
  }, [availableYears]);

  // ─────────────────────────────────────────────────────────────
  // ✅ 기도제목 조회
  // ─────────────────────────────────────────────────────────────

  const fetchPrayers = useCallback(async () => {
    if (!cellId || !user) return;

    if (!isExecutive && !isCellLeader) {
      setError("접근 권한이 없습니다.");
      return;
    }
    if (isCellLeader && user.cellId && String(user.cellId) !== cellId) {
      setError("본인의 셀 기도제목만 조회할 수 있습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const params: GetPrayersParams = {
      page: currentPage,
      size: 10,
      cellId: Number(cellId),
      sort: "createdAt,desc",
      isDeleted: false,
    };

    if (filterType === "week") {
      const { startDate, endDate } = getThisWeekRange();
      params.startDate = startDate;
      params.endDate = endDate;
    } else if (filterType === "range") {
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
    } else if (filterType === "unit") {
      if (unitType === "semester") {
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          params.startDate = semester.startDate;
          params.endDate = semester.endDate;
        }
      } else if (unitType === "month") {
        params.year = normalizeNumberInput(filters.year);
        params.month = normalizeNumberInput(filters.month);
      } else if (unitType === "year") {
        params.year = normalizeNumberInput(filters.year);
      }
    }

    try {
      const data = await prayerService.getPrayers(params);
      setPageData(data);
    } catch (e) {
      console.error("셀별 기도제목 로딩 실패:", e);
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    cellId,
    currentPage,
    user,
    isExecutive,
    isCellLeader,
    filterType,
    unitType,
    filters,
    semesters,
  ]);

  useEffect(() => {
    fetchPrayers();
  }, [fetchPrayers]);

  // ─────────────────────────────────────────────────────────────
  // ✅ 렌더링
  // ─────────────────────────────────────────────────────────────

  const titleText = useMemo(() => {
    const base =
      cellName != null ? `${cellName} 기도제목` : `셀 ID ${cellId} 기도제목`;

    let rangeSuffix = "";
    if (filterType === "week") rangeSuffix = " (이번 주)";
    else if (filterType === "all") rangeSuffix = " (전체 기간)";
    else if (filterType === "unit") {
      if (unitType === "month") rangeSuffix = ` (${filters.month}월)`;
      if (unitType === "semester") {
        const sem = semesters.find((s) => s.id === filters.semesterId);
        rangeSuffix = sem ? ` (${sem.name})` : " (학기별)";
      }
      if (unitType === "year") rangeSuffix = ` (${filters.year}년)`;
    } else if (filterType === "range") rangeSuffix = " (지정 기간)";

    return base + rangeSuffix;
  }, [cellName, cellId, filterType, unitType, filters, semesters]);

  if (!user)
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-sm text-center max-w-sm w-full">
          <p className="text-red-600 text-sm font-bold">로그인이 필요합니다.</p>
        </div>
      </div>
    );

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 truncate">
              <UserGroupIcon className="h-7 w-7 text-indigo-500 flex-shrink-0" />
              <span className="truncate">{titleText}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1 whitespace-nowrap">
              선택한 셀에 속한 모든 멤버의 기도제목을 조회합니다.
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-bold shadow-sm transition-all whitespace-nowrap"
          >
            <ArrowLeftIcon className="h-4 w-4" /> 뒤로가기
          </button>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-gray-50 pb-4">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <h3 className="font-bold text-gray-700 whitespace-nowrap">
                조회 조건 설정
              </h3>
            </div>

            {/* Segment Control (Filter Type) - Horizontal Scroll */}
            <div
              className="bg-gray-100 p-1 rounded-xl flex text-xs font-bold overflow-x-auto scrollbar-hide"
              style={scrollbarHideStyle}
            >
              {[
                { id: "week", label: "이번 주" },
                { id: "unit", label: "월/학기/년" },
                { id: "range", label: "기간 지정" },
                { id: "all", label: "전체 기간" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterType(tab.id as FilterType);
                    setCurrentPage(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                    filterType === tab.id
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {(filterType === "week" || filterType === "all") && (
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                {filterType === "week"
                  ? "이번 주(일~토)에 등록된 기도제목을 조회합니다."
                  : "기간 제한 없이 모든 기도제목을 조회합니다."}
              </p>
            )}

            {filterType === "range" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
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
            )}

            {filterType === "unit" && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                {/* Unit Type Selection */}
                <div className="flex gap-2">
                  {(["month", "semester", "year"] as UnitType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setUnitType(type);
                        setCurrentPage(0);
                      }}
                      disabled={type === "semester" && !hasActiveSemesters}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${
                        type === "semester" && !hasActiveSemesters
                          ? "bg-gray-100 text-gray-300 cursor-not-allowed border-gray-100"
                          : unitType === type
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {type === "month"
                        ? "월별"
                        : type === "semester"
                        ? "학기별"
                        : "연간"}
                    </button>
                  ))}
                </div>

                {unitType === "month" && (
                  <div className="pt-2 border-t border-gray-200/50">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-3">
                      <div className="w-full sm:w-auto">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">
                          연도
                        </label>
                        <select
                          value={filters.year}
                          onChange={(e) =>
                            handleFilterChange("year", Number(e.target.value))
                          }
                          className="w-full sm:w-32 py-2 border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-100"
                        >
                          {yearOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-bold text-gray-500">
                          월 선택
                        </label>
                        <span className="text-[10px] text-gray-400 font-normal sm:hidden">
                          좌우로 스크롤
                        </span>
                      </div>

                      {/* 가로 스크롤 적용 */}
                      <div
                        className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:pb-0 scrollbar-hide"
                        style={scrollbarHideStyle}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (m) => (
                            <button
                              key={m}
                              onClick={() => handleFilterChange("month", m)}
                              className={`
                                flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap
                                ${
                                  filters.month === m
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                }
                              `}
                            >
                              {m}월
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {unitType === "semester" && (
                  <div className="pt-2 border-t border-gray-200/50">
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-xs font-bold text-gray-500">
                        학기 선택
                      </label>
                      <span className="text-[10px] text-gray-400 font-normal sm:hidden">
                        좌우로 스크롤
                      </span>
                    </div>
                    {/* 가로 스크롤 적용 */}
                    <div
                      className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:pb-0 scrollbar-hide"
                      style={scrollbarHideStyle}
                    >
                      {semesters.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleFilterChange("semesterId", s.id)}
                          className={`
                            flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap
                            ${
                              filters.semesterId === s.id
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }
                          `}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {unitType === "year" && (
                  <div className="pt-2 border-t border-gray-200/50">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">
                      연도 선택
                    </label>
                    <select
                      value={filters.year}
                      onChange={(e) =>
                        handleFilterChange("year", Number(e.target.value))
                      }
                      className="w-full sm:w-32 py-2 border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-100"
                    >
                      {yearOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error / Loading */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* Content List */}
        {!loading && pageData && !error && (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden mb-4">
              {pageData.content.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
                  조건에 맞는 기도제목이 없습니다.
                </div>
              ) : (
                pageData.content.map((prayer) => (
                  <div
                    key={prayer.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                  >
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-50">
                      <div className="text-xs text-gray-500 font-bold">
                        <span className="text-gray-400 font-medium mr-1">
                          멤버:
                        </span>
                        {getFormattedName(
                          prayer.member?.id,
                          prayer.member?.name
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 font-medium whitespace-nowrap">
                        <CalendarDaysIcon className="h-3.5 w-3.5" />
                        {new Date(prayer.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <Link
                      to={`/admin/prayers/${prayer.id}`}
                      className="block text-sm font-medium text-gray-800 leading-relaxed mb-3 line-clamp-3 hover:text-indigo-600 transition-colors"
                    >
                      {prayer.content}
                    </Link>

                    <div className="text-right">
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-md font-bold whitespace-nowrap">
                        작성:{" "}
                        {getFormattedName(
                          prayer.createdBy?.id,
                          prayer.createdBy?.name
                        )}
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
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs w-32 whitespace-nowrap">
                      멤버(기도대상)
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      내용
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs w-32 whitespace-nowrap">
                      작성자(셀장)
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs w-32 whitespace-nowrap">
                      작성일
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {pageData.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-gray-400"
                      >
                        조건에 맞는 기도제목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    pageData.content.map((prayer) => (
                      <tr
                        key={prayer.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                          {getFormattedName(
                            prayer.member?.id,
                            prayer.member?.name
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={`/admin/prayers/${prayer.id}`}
                            className="text-indigo-600 hover:text-indigo-900 line-clamp-2 font-medium"
                          >
                            {prayer.content}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-medium">
                          {getFormattedName(
                            prayer.createdBy?.id,
                            prayer.createdBy?.name
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                          {new Date(prayer.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={pageData.number}
              totalPages={pageData.totalPages}
              totalElements={pageData.totalElements}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default CellPrayersPage;
