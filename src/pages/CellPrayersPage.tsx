// src/pages/CellPrayersPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { cellService } from "../services/cellService";
import { memberService } from "../services/memberService";
import { semesterService } from "../services/semesterService"; // ✅ 학기 서비스 추가
import { formatDisplayName } from "../utils/memberUtils";
import { normalizeNumberInput } from "../utils/numberUtils";
import type { Page, PrayerDto, GetPrayersParams, SemesterDto } from "../types";
import Pagination from "../components/Pagination";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import { useAuth } from "../hooks/useAuth";

// ─────────────────────────────────────────────────────────────
// ✅ 헬퍼 함수: 컴포넌트 외부 정의
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
  const day = now.getDay(); // 0(일) ~ 6(토)
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
  // ✅ Effects: 초기 데이터 로딩
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    // 1. 셀 이름 가져오기
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

    // 2. 전체 멤버 목록 (동명이인 처리용)
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

    // 3. 학기 목록
    const fetchSemesters = async () => {
      try {
        const data = await semesterService.getAllSemesters(true);
        setSemesters(data);
      } catch (err) {
        console.error("학기 목록 로딩 실패:", err);
      }
    };

    // 4. 연도 목록
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
  // ✅ 기도제목 조회 (fetchPrayers)
  // ─────────────────────────────────────────────────────────────

  const fetchPrayers = useCallback(async () => {
    if (!cellId || !user) return;

    // 권한 체크
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

    // 🔍 필터 로직 적용
    if (filterType === "week") {
      const { startDate, endDate } = getThisWeekRange();
      params.startDate = startDate;
      params.endDate = endDate;
    } else if (filterType === "all") {
      // 파라미터 미전송 -> 전체 조회
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
  // ✅ 렌더링 준비
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

  if (!user) return <div className="p-8 text-center">로그인이 필요합니다.</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {titleText}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              선택한 셀의 기도제목 히스토리를 확인하세요.
            </p>
          </div>
          <div>
            <button
              onClick={() => navigate(-1)}
              className="text-xs sm:text-sm px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
            >
              뒤로가기
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ✅ 필터 UI 섹션 (Mobile Optimized)
           ───────────────────────────────────────────────────────────── */}
        <div className="bg-white p-4 sm:p-5 rounded-lg shadow border border-gray-200 mb-6 space-y-5">
          {/* 1. 상단 탭 (조회 유형) */}
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

          {/* 2. 하단 옵션 영역 */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            {/* Case A: 설명 텍스트 */}
            {(filterType === "week" || filterType === "all") && (
              <p className="text-sm text-gray-600 text-center py-2">
                {filterType === "week"
                  ? "이번 주(일~토)에 등록된 기도제목을 조회합니다."
                  : "등록된 모든 기도제목 히스토리를 조회합니다."}
              </p>
            )}

            {/* Case B: 기간 직접 입력 */}
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

            {/* Case C: 단위 조회 (월/학기/년) - 모바일 최적화 */}
            {filterType === "unit" && (
              <div className="space-y-5">
                {/* 1) 단위 선택 탭: 3등분 그리드, 높이 증가 */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setUnitType("month");
                      setCurrentPage(0);
                    }}
                    className={`py-2.5 text-sm rounded-lg font-medium transition-colors ${
                      unitType === "month"
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        : "bg-white text-gray-500 border hover:bg-gray-50"
                    }`}
                  >
                    월별
                  </button>
                  <button
                    onClick={() => {
                      setUnitType("semester");
                      setCurrentPage(0);
                    }}
                    disabled={!hasActiveSemesters}
                    className={`py-2.5 text-sm rounded-lg font-medium transition-colors ${
                      !hasActiveSemesters
                        ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                        : unitType === "semester"
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        : "bg-white text-gray-500 border hover:bg-gray-50"
                    }`}
                  >
                    학기별
                  </button>
                  <button
                    onClick={() => {
                      setUnitType("year");
                      setCurrentPage(0);
                    }}
                    className={`py-2.5 text-sm rounded-lg font-medium transition-colors ${
                      unitType === "year"
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        : "bg-white text-gray-500 border hover:bg-gray-50"
                    }`}
                  >
                    연간
                  </button>
                </div>

                {/* 2) 단위별 상세 선택 UI */}
                {unitType === "month" && (
                  <div className="space-y-4">
                    {/* 연도 선택 */}
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

                    {/* 월 선택 그리드 (크고 누르기 편한 사각형) */}
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

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500 text-sm">데이터를 불러오는 중...</div>
          </div>
        )}

        {/* 데이터 리스트 */}
        {!loading && pageData && !error && (
          <>
            {/* 📱 모바일: 카드 리스트 */}
            <div className="space-y-3 md:hidden mb-4">
              {pageData.content.length === 0 ? (
                <div className="bg-white rounded-lg shadow border border-gray-100 p-8 text-center text-sm text-gray-500">
                  조건에 맞는 기도제목이 없습니다.
                </div>
              ) : (
                pageData.content.map((prayer) => (
                  <div
                    key={prayer.id}
                    className="bg-white rounded-lg shadow border border-gray-100 p-4 text-xs"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        {/* 멤버 (기도 대상) */}
                        <div className="text-[11px] font-medium text-gray-500 mb-1">
                          멤버:{" "}
                          <span className="font-semibold text-gray-800">
                            {getFormattedName(
                              prayer.member?.id,
                              prayer.member?.name
                            )}
                          </span>
                        </div>
                        {/* 내용 */}
                        <Link
                          to={`/admin/prayers/${prayer.id}`}
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 break-words"
                        >
                          {prayer.content}
                        </Link>
                        {/* 작성자 */}
                        <p className="mt-2 text-[11px] text-gray-500">
                          작성자(셀장):{" "}
                          <span className="font-semibold text-gray-800">
                            {getFormattedName(
                              prayer.createdBy?.id,
                              prayer.createdBy?.name
                            )}
                          </span>
                        </p>
                      </div>
                      <span className="px-2 py-1 inline-flex text-[11px] font-semibold rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
                        {new Date(prayer.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 🖥 데스크탑: 테이블 */}
            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">
                      멤버(기도대상)
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      내용
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">
                      작성자(셀장)
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-32 whitespace-nowrap">
                      작성일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pageData.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        조건에 맞는 기도제목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    pageData.content.map((prayer) => (
                      <tr key={prayer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {getFormattedName(
                            prayer.member?.id,
                            prayer.member?.name
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={`/admin/prayers/${prayer.id}`}
                            className="text-indigo-600 hover:text-indigo-900 line-clamp-2"
                          >
                            {prayer.content}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
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

export default CellPrayersPage;
