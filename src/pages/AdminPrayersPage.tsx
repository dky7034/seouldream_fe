import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import type {
  GetPrayersParams,
  PrayerDto,
  Page,
  SemesterDto,
  MemberDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
// import { PRAYER_VISIBILITY_MAP } from "../utils/prayerVisibilityUtils";
import { normalizeNumberInput } from "../utils/numberUtils";
import ConfirmModal from "../components/ConfirmModal";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import Pagination from "../components/Pagination";
import { semesterService } from "../services/semesterService";

type SortKey = "createdAt" | "visibility" | "memberName" | "creatorName";

type SortConfig = {
  key: SortKey;
  direction: "ascending" | "descending";
};

const sortKeyMap: Record<SortKey, string> = {
  createdAt: "createdAt",
  visibility: "visibility",
  memberName: "member.name",
  creatorName: "creatorName",
};

type UnitType = "year" | "half" | "quarter" | "month" | "semester";

const AdminPrayersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [prayerPage, setPrayerPage] = useState<Page<PrayerDto> | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [semesters, setSemesters] = useState<SemesterDto[]>([]); // 🔹 학기 목록

  const [filters, setFilters] = useState({
    visibility: "all",
    cell: "all",
    member: "all",
    creator: "all",
    showDeleted: false,
    startDate: "",
    endDate: "",
    year: "" as number | "",
    month: "" as number | "",
    quarter: "" as number | "",
    half: "" as number | "",
    semesterId: "" as number | "", // 🔹 선택 학기
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "createdAt",
    direction: "descending",
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [filterType, setFilterType] = useState<"unit" | "range">("unit");
  const [unitType, setUnitType] = useState<UnitType>("year");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prayerToDelete, setPrayerToDelete] = useState<number | null>(null);

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";
  const canManage = isExecutive || isCellLeader;

  // 🔹 학기 목록 로딩
  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("학기 목록 로딩 실패:", err);
      setSemesters([]);
    }
  }, []);

  const fetchPrayers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setError("로그인이 필요한 페이지입니다.");
      return;
    }
    if (!canManage) {
      setLoading(false);
      setError("기도제목 관리 페이지에 접근할 권한이 없습니다.");
      return;
    }
    if (isCellLeader && !user.cellId) {
      setLoading(false);
      setError("셀장 정보에 셀 ID가 없습니다. 관리자에게 문의하세요.");
      return;
    }

    setLoading(true);
    setError(null);

    const sortField = sortKeyMap[sortConfig.key];

    // 공통 기본 파라미터
    let params: GetPrayersParams = {
      page: currentPage,
      size: 10,
      sort: `${sortField},${
        sortConfig.direction === "ascending" ? "asc" : "desc"
      }`,
      isDeleted: filters.showDeleted,
    };

    // 🔹 기간 필터 처리
    if (filterType === "range") {
      // 직접 기간 선택 모드
      params = {
        ...params,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
    } else {
      // 단위 모드
      if (filters.semesterId && semesters.length > 0) {
        // ✅ 학기 선택 시: 해당 학기의 startDate/endDate로 조회
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          params = {
            ...params,
            startDate: semester.startDate,
            endDate: semester.endDate,
          };
        }
      } else {
        // 기존 연/월/분기/반기 방식
        params = {
          ...params,
          year: normalizeNumberInput(filters.year),
          month: normalizeNumberInput(filters.month),
          quarter: normalizeNumberInput(filters.quarter),
          half: normalizeNumberInput(filters.half),
        };
      }
    }

    // if (filters.visibility !== "all") {
    //   params.visibility = filters.visibility as any;
    // }

    // 🔹 권한에 따른 필터
    if (isExecutive) {
      if (filters.cell !== "all") params.cellId = Number(filters.cell);
      if (filters.member !== "all") params.memberId = Number(filters.member);
      if (filters.creator !== "all")
        params.createdById = Number(filters.creator);
    } else if (isCellLeader) {
      params.cellId = user.cellId ?? undefined;
    }

    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== null && v !== "" && v !== undefined
      )
    );

    try {
      const prayerData = await prayerService.getPrayers(cleanedParams);
      setPrayerPage(prayerData);
    } catch (err) {
      console.error("기도제목 로딩 실패:", err);
      setError("기도제목을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    user,
    canManage,
    isCellLeader,
    isExecutive,
    currentPage,
    sortConfig,
    filters,
    filterType,
    semesters,
  ]);

  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await prayerService.getAvailableYears();
      setAvailableYears(years);
    } catch (err) {
      console.error("Failed to fetch available years for prayers:", err);
      setAvailableYears([]);
    }
  }, []);

  // 1) 기도제목 데이터 조회 전용
  useEffect(() => {
    fetchPrayers();
  }, [fetchPrayers]);

  // 2) 선택 옵션(연도/학기 등) 로딩 전용
  useEffect(() => {
    if (user) {
      fetchAvailableYears();
      fetchSemesters();
    }
  }, [user, fetchAvailableYears, fetchSemesters]);

  const memberOptions: { value: number; label: string }[] = [];
  const cellOptions: { value: number; label: string }[] = [];
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

  const requestSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
    setCurrentPage(0);
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  const handleDelete = (prayerId: number) => {
    setPrayerToDelete(prayerId);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (prayerToDelete === null) return;
    try {
      await prayerService.deletePrayer(prayerToDelete);
      await fetchPrayers();
    } catch (err) {
      console.error("기도제목 삭제 실패:", err);
      alert("삭제에 실패했습니다.");
    } finally {
      setIsModalOpen(false);
      setPrayerToDelete(null);
    }
  };

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(0);
  };

  // 🔹 상단 단위 버튼(연간/반기/분기/월간/학기) 클릭
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const next = { ...prev };

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      if (type === "year") {
        if (!next.year) {
          next.year = currentYear;
        }
        next.month = "";
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "half") {
        if (!next.year) {
          next.year = currentYear;
        }
        next.half = (next.half as number) || 1;
        next.month = "";
        next.quarter = "";
        next.semesterId = "";
      } else if (type === "quarter") {
        if (!next.year) {
          next.year = currentYear;
        }
        next.quarter = (next.quarter as number) || 1;
        next.month = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "month") {
        if (!next.year) {
          next.year = currentYear;
        }
        next.month = (next.month as number) || currentMonth;
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "semester") {
        // 학기 모드에서는 연/월/분기/반기 초기화, 학기만 사용
        next.year = "";
        next.month = "";
        next.quarter = "";
        next.half = "";
        // semesterId는 아래 학기 버튼에서 선택
      }

      return next;
    });
    setCurrentPage(0);
  };

  // 월/분기/반기 값 버튼 클릭
  const handleUnitValueClick = (
    unit: "month" | "quarter" | "half",
    value: number
  ) => {
    setFilters((prev) => ({
      ...prev,
      month: unit === "month" ? value : "",
      quarter: unit === "quarter" ? value : "",
      half: unit === "half" ? value : "",
      semesterId: "", // 다른 단위를 선택하면 학기 선택 해제
    }));
    setCurrentPage(0);
  };

  // 학기 버튼 클릭
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

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                onClick={() => handleUnitValueClick("month", m)}
                className={`px-2 py-1 border rounded-full text-xs ${
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
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => i + 1).map((q) => (
              <button
                key={q}
                onClick={() => handleUnitValueClick("quarter", q)}
                className={`px-2 py-1 border rounded-full text-sm ${
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
            {Array.from({ length: 2 }, (_, i) => i + 1).map((h) => (
              <button
                key={h}
                onClick={() => handleUnitValueClick("half", h)}
                className={`px-2 py-1 border rounded-full text-sm ${
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
            <p className="text-sm text-gray-500">
              등록된 학기가 없습니다. 먼저 학기를 생성해 주세요.
            </p>
          );
        }
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {semesters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSemesterClick(s.id)}
                className={`px-2 py-1 border rounded-full text-sm ${
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

  // 동명이인 정책
  const getDisplayNameForMember = (
    memberLike:
      | { id: number; name: string; birthDate?: string }
      | MemberDto
      | null
      | undefined
  ): string => {
    if (!memberLike) return "";
    return memberLike.name;
    // const full = members.find((m) => m.id === memberLike.id) || memberLike;
    // if (!members || members.length === 0) {
    //   return full.name;
    // }
    // return formatDisplayName(full, members);
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">로그인이 필요한 페이지입니다.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="기도제목 삭제"
        message="정말로 이 기도제목을 삭제하시겠습니까?"
      />

      <div className="flex justify-between items-start mb-4 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">기도제목 관리</h1>
          <p className="mt-2 text-sm text-gray-600">
            셀과 멤버별로 등록된 기도제목을 조회하고, 공개 범위/삭제 여부를
            관리할 수 있는 페이지입니다.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/prayers/add")}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
        >
          + 새 기도제목
        </button>
      </div>

      {/* ====== 기간 필터 영역 ====== */}
      <div className="p-4 bg-gray-50 rounded-lg mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">조회 기간 설정</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilterType("unit")}
              className={`px-3 py-1 text-sm rounded-full ${
                filterType === "unit"
                  ? "bg-blue-500 text-white"
                  : "bg-white border"
              }`}
            >
              단위로 조회
            </button>
            <button
              onClick={() => setFilterType("range")}
              className={`px-3 py-1 text-sm rounded-full ${
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
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                기간 종료
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
                  disabled={unitType === "semester"} // 학기 모드일 때 연도 비활성
                >
                  <option value="">전체 연도</option>
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
                <div className="flex items-center space-x-2 mt-1">
                  <button
                    onClick={() => handleUnitTypeClick("year")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "year"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    연간
                  </button>
                  <button
                    onClick={() => handleUnitTypeClick("half")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "half"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    반기
                  </button>
                  <button
                    onClick={() => handleUnitTypeClick("quarter")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "quarter"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    분기
                  </button>
                  <button
                    onClick={() => handleUnitTypeClick("month")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "month"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    월간
                  </button>
                  <button
                    onClick={() => handleUnitTypeClick("semester")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "semester"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                    disabled={semesters.length === 0}
                  >
                    학기
                  </button>
                </div>
              </div>
            </div>
            {renderUnitButtons()}
          </div>
        )}

        <hr />

        {/* ====== 기타 필터 ====== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isExecutive && (
            <>
              <SimpleSearchableSelect
                options={cellOptions}
                value={
                  filters.cell === "all" ? undefined : Number(filters.cell)
                }
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
                  handleFilterChange(
                    "member",
                    val != null ? String(val) : "all"
                  )
                }
                placeholder="멤버 필터"
              />
              <SimpleSearchableSelect
                options={memberOptions}
                value={
                  filters.creator === "all"
                    ? undefined
                    : Number(filters.creator)
                }
                onChange={(val) =>
                  handleFilterChange(
                    "creator",
                    val != null ? String(val) : "all"
                  )
                }
                placeholder="작성자 필터"
              />
            </>
          )}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">
              삭제된 항목
            </label>
            <button
              type="button"
              onClick={() =>
                handleFilterChange("showDeleted", !filters.showDeleted)
              }
              className={`${
                filters.showDeleted ? "bg-indigo-600" : "bg-gray-200"
              } relative inline-flex items-center h-6 rounded-full w-11 transition-colors`}
            >
              <span
                className={`${
                  filters.showDeleted ? "translate-x-6" : "translate-x-1"
                } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
              />
            </button>
          </div>
        </div>
      </div>

      {loading && <p>로딩 중...</p>}
      {error && !loading && <p className="text-red-500 mb-4">{error}</p>}

      {!loading && prayerPage && (
        <>
          <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => requestSort("memberName")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    멤버(기도대상) {getSortIndicator("memberName")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    내용
                  </th>
                  <th
                    onClick={() => requestSort("creatorName")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    작성자(셀장) {getSortIndicator("creatorName")}
                  </th>
                  <th
                    onClick={() => requestSort("createdAt")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    작성일 {getSortIndicator("createdAt")}
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {prayerPage.content.map((prayer) => (
                  <tr
                    key={prayer.id}
                    className={
                      prayer.isDeleted ? "bg-gray-100 text-gray-400" : ""
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {getDisplayNameForMember(prayer.member)}
                    </td>
                    <td className="px-6 py-4 text-sm max-w-sm truncate">
                      <Link
                        to={`/admin/prayers/${prayer.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {prayer.content}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getDisplayNameForMember(prayer.createdBy as any)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(prayer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() =>
                          navigate(`/admin/prayers/${prayer.id}/edit`)
                        }
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        수정
                      </button>
                      {!prayer.isDeleted && (
                        <button
                          onClick={() => handleDelete(prayer.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={prayerPage.number}
            totalPages={prayerPage.totalPages}
            totalElements={prayerPage.totalElements}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};

export default AdminPrayersPage;
