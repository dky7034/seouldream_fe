// src/pages/MemberPrayersPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { memberService } from "../services/memberService";
import { semesterService } from "../services/semesterService";
import { formatDisplayName } from "../utils/memberUtils";
import { normalizeNumberInput } from "../utils/numberUtils";
import type { Page, PrayerDto, GetPrayersParams, SemesterDto } from "../types";
import Pagination from "../components/Pagination";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import { useAuth } from "../hooks/useAuth";

// ─────────────────────────────────────────────────────────────
// ✅ 헬퍼 함수 (날짜 계산 로직 분리)
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

type FilterType = "week" | "unit" | "range" | "all";
type UnitType = "month" | "semester" | "year";

const MemberPrayersPage: React.FC = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─────────────────────────────────────────────────────────────
  // ✅ State
  // ─────────────────────────────────────────────────────────────

  const [pageData, setPageData] = useState<Page<PrayerDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const [filterType, setFilterType] = useState<FilterType>("week");
  const [unitType, setUnitType] = useState<UnitType>("month");

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    semesterId: "" as number | "",
  });

  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // 멤버 이름 캐싱용 Map (id -> formattedName)
  const [memberMap, setMemberMap] = useState<Map<number, string>>(new Map());
  // 현재 조회 대상 멤버의 이름 (페이지 타이틀용)
  const [targetMemberName, setTargetMemberName] = useState<string | null>(null);

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";
  const hasActiveSemesters = semesters.length > 0;

  // ─────────────────────────────────────────────────────────────
  // ✅ Data Fetching (Initial)
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    // 1. 전체 멤버 로딩 및 Map 생성 (O(1) 조회를 위해)
    const fetchAllMembers = async () => {
      try {
        const res = await memberService.getAllMembers({
          page: 0,
          size: 2000,
          sort: "id,asc",
        });

        const map = new Map<number, string>();
        const members = res.content;

        members.forEach((m) => {
          // formatDisplayName 내부 로직을 활용하여 미리 포맷팅
          const formatted = formatDisplayName(m, members).replace(" (", "(");
          map.set(m.id, formatted);
        });

        setMemberMap(map);
      } catch (e) {
        console.error("멤버 목록 로딩 실패:", e);
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

    // 병렬 처리로 초기 로딩 속도 향상
    Promise.all([fetchAllMembers(), fetchSemesters(), fetchAvailableYears()]);
  }, [user]);

  // ─────────────────────────────────────────────────────────────
  // ✅ Helper Functions
  // ─────────────────────────────────────────────────────────────

  // 1. 이름 조회 최적화 (Map 조회 O(1))
  const getFormattedName = useCallback(
    (id?: number, name?: string) => {
      if (!name) return "-";
      if (!id) return name;
      return memberMap.get(id) || name;
    },
    [memberMap]
  );

  // 2. 날짜 파라미터 계산 로직 분리
  const getDateParams = useCallback(() => {
    const params: Partial<GetPrayersParams> = {};

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
    return params;
  }, [filterType, unitType, filters, semesters]);

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
  // ✅ Main Fetch Logic
  // ─────────────────────────────────────────────────────────────

  const fetchPrayers = useCallback(async () => {
    if (!memberId || !user) return;
    if (!isExecutive && !isCellLeader) {
      setError("접근 권한이 없습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const dateParams = getDateParams(); // 날짜 로직 분리 적용

    const params: GetPrayersParams = {
      page: currentPage,
      size: 10,
      memberId: Number(memberId),
      sort: "createdAt,desc",
      isDeleted: false,
      ...dateParams,
    };

    try {
      const data = await prayerService.getPrayers(params);
      setPageData(data);

      // 첫 로딩 시, 해당 멤버 이름 설정 (페이지 타이틀용)
      if (data.content.length > 0 && !targetMemberName) {
        setTargetMemberName(data.content[0].member?.name ?? null);
      }
    } catch (e) {
      console.error("기도제목 로딩 실패:", e);
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    memberId,
    currentPage,
    user,
    isExecutive,
    isCellLeader,
    getDateParams, // 의존성 단순화
    targetMemberName,
  ]);

  useEffect(() => {
    fetchPrayers();
  }, [fetchPrayers]);

  // 페이지 타이틀 계산 (Map 사용으로 간소화)
  const displayTitle = useMemo(() => {
    let namePart = `멤버 ID ${memberId}`;

    // 1순위: Map에서 조회 (가장 정확한 포맷)
    if (memberId && memberMap.has(Number(memberId))) {
      namePart = memberMap.get(Number(memberId))!;
    }
    // 2순위: API 응답에서 가져온 이름
    else if (targetMemberName) {
      namePart = targetMemberName;
    }

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

    return `${namePart}님의 기도제목${rangeSuffix}`;
  }, [
    memberId,
    memberMap,
    targetMemberName,
    filterType,
    unitType,
    filters,
    semesters,
  ]);

  if (!user) return <div className="p-8 text-center">로그인이 필요합니다.</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            {/* ✅ [UI 개선] 제목 스타일 수정 */}
            {/* 1. text-xl: 모바일 기본 크기를 줄임 (기존 text-2xl -> text-xl) */}
            {/* 2. sm:text-3xl: 태블릿/데스크탑에서는 크게 유지 */}
            {/* 3. tracking-tight: 자간을 살짝 좁혀서 한 줄에 더 많이 들어가게 함 */}
            {/* 4. break-keep: 한글 단어 중간에서 줄바꿈 되지 않도록 설정 */}
            {/* 5. leading-snug: 줄 간격을 좁혀서 줄바꿈 되더라도 덩어리감 유지 */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight break-keep leading-snug">
              {displayTitle}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              선택한 멤버의 기도제목을 확인하세요.
            </p>
          </div>
          <div>
            <button
              onClick={() => navigate(-1)}
              className="text-xs sm:text-sm px-3 py-2 rounded-md border bg-white hover:bg-gray-50 transition-colors"
            >
              뒤로가기
            </button>
          </div>
        </div>

        {/* 필터 UI 섹션 */}
        <div className="bg-white p-4 sm:p-5 rounded-lg shadow border border-gray-200 mb-6 space-y-5">
          {/* 탭 버튼 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                className={`py-3 text-sm font-medium rounded-lg border transition-all active:scale-95 ${
                  filterType === tab.id
                    ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 하단 옵션 영역 */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            {(filterType === "week" || filterType === "all") && (
              <p className="text-sm text-gray-600 text-center py-2">
                {filterType === "week"
                  ? "이번 주(일~토)에 등록된 기도제목을 조회합니다."
                  : "등록된 모든 기도제목을 조회합니다."}
              </p>
            )}

            {filterType === "range" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    시작일
                  </label>
                  <KoreanCalendarPicker
                    value={filters.startDate}
                    onChange={(d) => handleFilterChange("startDate", d)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
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
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-2">
                  {(["month", "semester", "year"] as UnitType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setUnitType(type);
                        setCurrentPage(0);
                      }}
                      disabled={type === "semester" && !hasActiveSemesters}
                      className={`py-2.5 text-sm rounded-lg font-medium transition-colors ${
                        type === "semester" && !hasActiveSemesters
                          ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                          : unitType === type
                          ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                          : "bg-white text-gray-500 border hover:bg-gray-50"
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
                  <div className="space-y-4">
                    <select
                      value={filters.year}
                      onChange={(e) =>
                        handleFilterChange("year", Number(e.target.value))
                      }
                      className="block w-full border-gray-300 rounded-lg shadow-sm text-base py-3 px-4 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {yearOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <button
                          key={m}
                          onClick={() => handleFilterChange("month", m)}
                          className={`py-3 rounded-lg text-sm sm:text-base font-medium transition-all active:scale-95 ${
                            filters.month === m
                              ? "bg-blue-500 text-white shadow-md transform scale-105"
                              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {m}월
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {unitType === "semester" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {semesters.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleFilterChange("semesterId", s.id)}
                        className={`py-3 px-4 rounded-lg text-sm sm:text-base font-medium border transition-all active:scale-95 text-left flex justify-between items-center ${
                          filters.semesterId === s.id
                            ? "bg-blue-500 text-white border-blue-500 shadow-md"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span>{s.name}</span>
                        {filters.semesterId === s.id && (
                          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white bg-opacity-50">
                            선택됨
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {unitType === "year" && (
                  <div>
                    <select
                      value={filters.year}
                      onChange={(e) =>
                        handleFilterChange("year", Number(e.target.value))
                      }
                      className="block w-full border-gray-300 rounded-lg shadow-sm text-base py-3 px-4 focus:ring-blue-500 focus:border-blue-500"
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

        {/* 에러 및 로딩 */}
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {/* 데이터 리스트 */}
        {!loading && pageData && !error && (
          <>
            {/* 📱 모바일: 카드 리스트 (수정됨) */}
            <div className="space-y-3 md:hidden mb-4">
              {pageData.content.length === 0 ? (
                <div className="bg-white rounded-lg shadow border border-gray-100 p-8 text-center text-sm text-gray-500">
                  조건에 맞는 기도제목이 없습니다.
                </div>
              ) : (
                pageData.content.map((prayer) => (
                  <div
                    key={prayer.id}
                    className="bg-white rounded-lg shadow border border-gray-100 p-4 text-xs flex flex-col gap-3"
                  >
                    {/* 1. 상단: 날짜 (우측 정렬) */}
                    <div className="flex justify-end border-b border-gray-50 pb-2">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        📅 {new Date(prayer.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* 2. 중단: 내용 (꽉 찬 너비 사용) */}
                    <div>
                      <Link
                        to={`/admin/prayers/${prayer.id}`}
                        className="block text-sm font-semibold text-indigo-600 hover:text-indigo-800 leading-relaxed break-keep"
                      >
                        {prayer.content}
                      </Link>
                    </div>

                    {/* 3. 하단: 작성자 정보 (우측 정렬) */}
                    <div className="text-right">
                      <p className="text-[11px] text-gray-400 bg-gray-50 inline-block px-2 py-1 rounded">
                        작성:{" "}
                        <span className="font-medium text-gray-600">
                          {getFormattedName(
                            prayer.createdBy?.id,
                            prayer.createdBy?.name
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      내용
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-32">
                      작성자
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-32">
                      작성일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pageData.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        조건에 맞는 기도제목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    pageData.content.map((prayer) => (
                      <tr key={prayer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Link
                            to={`/admin/prayers/${prayer.id}`}
                            className="text-indigo-600 hover:text-indigo-900 line-clamp-2"
                          >
                            {prayer.content}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getFormattedName(
                            prayer.createdBy?.id,
                            prayer.createdBy?.name
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
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

export default MemberPrayersPage;
