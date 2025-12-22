// src/components/prayers/CellPrayersManager.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import type {
  GetPrayersParams,
  PrayerDto,
  Page,
  User,
  SemesterDto,
} from "../types";
import { normalizeNumberInput } from "../utils/numberUtils";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination";
import { semesterService } from "../services/semesterService";
import { formatDisplayName } from "../utils/memberUtils"; // [추가]

type SortKey = "createdAt" | "memberName" | "creatorName";

type SortConfig = {
  key: SortKey;
  direction: "ascending" | "descending";
};

const sortKeyMap: Record<SortKey, string> = {
  createdAt: "createdAt",
  memberName: "member.name",
  creatorName: "createdBy.name",
};

// [수정] Props 인터페이스: allMembers 추가
interface CellPrayersManagerProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

// ✅ 반기/분기 제거
type UnitType = "year" | "month" | "semester";

const CellPrayersManager: React.FC<CellPrayersManagerProps> = ({
  user,
  allMembers, // [추가]
}) => {
  const navigate = useNavigate();

  // ✅ 현재 연도/월 상수
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 ~ 12

  const [prayerPage, setPrayerPage] = useState<Page<PrayerDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ 학기 목록 상태
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(false);
  const [semestersError, setSemestersError] = useState<string | null>(null);

  const [filters, setFilters] = useState<{
    showDeleted: boolean;
    startDate: string;
    endDate: string;
    year: number | string;
    month: number | string;
    quarter: number | string;
    half: number | string;
    semesterId: number | string;
  }>({
    showDeleted: false,
    startDate: "",
    endDate: "",
    year: currentYear,
    month: "",
    quarter: "",
    half: "",
    semesterId: "",
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "createdAt",
    direction: "descending",
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [filterType, setFilterType] = useState<"unit" | "range">("unit");

  // ✅ 기본 포커싱: 연간(year)
  const [unitType, setUnitType] = useState<UnitType>("year");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prayerToDelete, setPrayerToDelete] = useState<number | null>(null);

  const isCellLeader = user.role === "CELL_LEADER";

  // [추가] 이름 포맷팅 헬퍼
  const getFormattedName = useCallback(
    (id: number, originalName: string) => {
      const found = allMembers.find((m) => m.id === id);
      return found ? formatDisplayName(found, allMembers) : originalName;
    },
    [allMembers]
  );

  // ✅ 학기 목록 불러오기
  const loadSemesters = useCallback(async () => {
    try {
      setSemestersLoading(true);
      setSemestersError(null);
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (e) {
      console.error("학기 목록 로딩 실패:", e);
      setSemestersError("학기 목록을 불러오지 못했습니다.");
    } finally {
      setSemestersLoading(false);
    }
  }, []);

  // ✅ 학기 목록이 로드되고, 사용자가 '학기' 탭을 눌렀을 때만 자동 포커싱
  useEffect(() => {
    if (
      semesters.length > 0 &&
      unitType === "semester" &&
      !filters.semesterId
    ) {
      const today = new Date();
      const currentSemester = semesters.find((s) => {
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return today >= start && today <= end;
      });

      // 현재 학기가 있으면 선택, 없으면 가장 최신 학기 선택
      const targetId = currentSemester
        ? currentSemester.id
        : semesters[semesters.length - 1].id;

      setFilters((prev) => ({ ...prev, semesterId: targetId }));
    }
  }, [semesters, unitType, filters.semesterId]);

  const fetchPrayers = useCallback(async () => {
    if (!user.cellId) {
      setError("셀 리더 정보에 셀 ID가 없습니다. 관리자에게 문의하세요.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const sortField = sortKeyMap[sortConfig.key];

    const effectiveFilterType: "unit" | "range" = isCellLeader
      ? "unit"
      : filterType;

    let params: GetPrayersParams = {
      page: currentPage,
      size: 10,
      sort: `${sortField},${
        sortConfig.direction === "ascending" ? "asc" : "desc"
      }`,
      isDeleted: filters.showDeleted,
      cellId: user.cellId,
    };

    if (effectiveFilterType === "range") {
      // 🔹 기간 직접 선택 (임원용)
      params = {
        ...params,
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    } else {
      // 🔹 단위 기반 조회

      if (unitType === "semester" && filters.semesterId) {
        // ✅ 학기 선택된 경우: 해당 학기의 startDate/endDate 사용
        const selected = semesters.find(
          (s) => s.id === Number(filters.semesterId)
        );

        if (selected) {
          params = {
            ...params,
            startDate: selected.startDate,
            endDate: selected.endDate,
          };
        }
      } else {
        // 🔹 연 / 월
        // ✅ 셀장은 항상 현재 연도만 조회
        const yearParam = isCellLeader
          ? currentYear
          : normalizeNumberInput(filters.year);

        params = {
          ...params,
          year: yearParam,
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
      const prayerData = await prayerService.getPrayers(cleanedParams);
      setPrayerPage(prayerData);
    } catch (err) {
      setError("기도제목을 불러오는 데 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    user.cellId,
    currentPage,
    sortConfig,
    filters,
    filterType,
    isCellLeader,
    unitType,
    semesters,
    currentYear,
  ]);

  // ✅ 컴포넌트 마운트 시 한 번 학기 목록 불러오기
  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    fetchPrayers();
  }, [fetchPrayers]);

  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    const years = [];
    for (let i = cy; i >= cy - 10; i--) {
      years.push({ value: i, label: `${i}년` });
    }
    return years;
  }, []);

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

  const renderSortIndicator = (key: SortKey) => {
    const isActive = sortConfig.key === key;
    const baseClass = "ml-1 text-xs";
    if (!isActive)
      return <span className={`${baseClass} text-gray-300`}>↕</span>;
    return (
      <span className={`${baseClass} text-indigo-500`}>
        {sortConfig.direction === "ascending" ? "▲" : "▼"}
      </span>
    );
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

  // ✅ 단위 선택 핸들러
  const handleUnitValueChange = (unit: UnitType, value: any) => {
    setFilters((prev) => {
      const next = { ...prev };

      if (unit === "year") {
        next.year = value;
        next.month = "";
        next.semesterId = "";
      } else if (unit === "month") {
        if (!next.year) next.year = currentYear;
        next.month = value;
        next.semesterId = "";
      } else if (unit === "semester") {
        next.semesterId = value;
        next.month = "";
      }

      return next;
    });

    setUnitType(unit);
    setCurrentPage(0);
  };

  // ✅ "학기" 버튼 클릭 시 자동 포커싱 로직을 포함한 핸들러
  const handleSemesterButtonClick = () => {
    let targetId: number | string = "";
    if (semesters.length > 0) {
      const today = new Date();
      const currentSemester = semesters.find((s) => {
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return today >= start && today <= end;
      });
      // 현재 날짜에 맞는 학기가 없으면 최신 학기 선택
      targetId = currentSemester
        ? currentSemester.id
        : semesters[semesters.length - 1].id;
    }
    handleUnitValueChange("semester", targetId);
  };

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                onClick={() => handleUnitValueChange("month", m)}
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
        return (
          <div className="space-y-2">
            {semestersError && (
              <p className="text-xs text-red-500">{semestersError}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {semesters.map((sem) => (
                <button
                  key={sem.id}
                  onClick={() => handleUnitValueChange("semester", sem.id)}
                  className={`px-2 py-1 border rounded-full text-xs sm:text-sm ${
                    Number(filters.semesterId) === sem.id
                      ? "bg-blue-500 text-white"
                      : "bg-white"
                  }`}
                >
                  {sem.name}
                </button>
              ))}
              {semesters.length === 0 && !semestersLoading && (
                <span className="text-xs text-gray-500 col-span-full">
                  등록된 학기가 없습니다. (임원단에서 학기를 먼저 생성해야
                  합니다.)
                </span>
              )}
            </div>
          </div>
        );
      case "year":
      default:
        return null;
    }
  };

  const effectiveFilterType: "unit" | "range" = isCellLeader
    ? "unit"
    : filterType;

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="기도제목 삭제"
        message="정말로 이 기도제목을 삭제하시겠습니까?"
      />

      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">
            {user.cellName ? `${user.cellName} 기도제목` : "내 셀 기도제목"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            셀원들의 기도제목을 기간별로 조회하고 관리할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="p-4 bg-gray-50 rounded-lg mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-2">
          <h3 className="text-lg font-semibold">조회 기간 설정</h3>

          {/* ✅ 셀장은 기간/단위 토글 숨김, 항상 단위 기반 조회만 사용 */}
          {!isCellLeader && (
            <div className="flex flex-wrap items-center gap-2">
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
          )}
        </div>

        {effectiveFilterType === "range" && !isCellLeader ? (
          // 셀장은 이 블록이 아예 렌더되지 않음
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
          // ✅ 단위 기반 조회
          <div className="space-y-4">
            <div
              className={`grid grid-cols-1 ${
                !isCellLeader ? "sm:grid-cols-2" : ""
              } gap-4`}
            >
              {!isCellLeader && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    연도
                  </label>
                  <select
                    value={filters.year}
                    onChange={(e) =>
                      handleUnitValueChange("year", e.target.value)
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
                    disabled={unitType === "semester"}
                  >
                    {yearOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  조회 단위
                </label>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {/* 월간 */}
                  <button
                    onClick={() => handleUnitValueChange("month", currentMonth)}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "month"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    월간
                  </button>

                  {/* 학기 */}
                  <button
                    onClick={handleSemesterButtonClick}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "semester"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                    disabled={semesters.length === 0}
                  >
                    학기
                  </button>

                  {/* 연간 */}
                  <button
                    onClick={() =>
                      handleUnitValueChange("year", filters.year || currentYear)
                    }
                    className={`px-3 py-1 text-sm rounded-full ${
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
          </div>
        )}

        <hr />
      </div>

      {/* 리스트/테이블 영역 */}
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      {loading && (
        <p className="text-center text-sm text-gray-500">로딩 중...</p>
      )}

      {!loading && prayerPage && (
        <>
          {/* ✅ 모바일: 카드형 리스트 */}
          <div className="sm:hidden space-y-3">
            {prayerPage.content.map((prayer) => {
              const createdDate = new Date(
                prayer.createdAt
              ).toLocaleDateString();

              return (
                <div
                  key={prayer.id}
                  className={`bg-white rounded-lg shadow-sm px-4 py-3 border ${
                    prayer.isDeleted ? "opacity-70 bg-gray-50" : ""
                  }`}
                >
                  {/* 상단: 멤버 이름 + 작성일 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900 text-sm">
                      {/* [수정] 멤버 이름 동명이인 처리 */}
                      {getFormattedName(prayer.member.id, prayer.member.name)}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {createdDate}
                    </div>
                  </div>

                  {/* 내용 */}
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/prayers/${prayer.id}`)}
                    className="mt-2 text-left w-full"
                  >
                    <p className="text-sm text-gray-800 line-clamp-2">
                      {prayer.content}
                    </p>
                  </button>

                  {/* 작성자 / 삭제 여부 */}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
                    {/* [수정] 작성자 이름 동명이인 처리 */}
                    <span>
                      작성자:{" "}
                      {getFormattedName(
                        prayer.createdBy.id,
                        prayer.createdBy.name
                      )}
                    </span>
                    {prayer.isDeleted && (
                      <span className="px-2 py-[1px] rounded-full bg-gray-200 text-gray-700">
                        삭제됨
                      </span>
                    )}
                  </div>

                  {/* 하단 버튼 */}
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/admin/prayers/${prayer.id}/edit`)
                      }
                      className="px-3 py-1 text-[11px] rounded-md border border-indigo-500 text-indigo-600 hover:bg-indigo-50"
                    >
                      수정
                    </button>
                    {!prayer.isDeleted && (
                      <button
                        type="button"
                        onClick={() => handleDelete(prayer.id)}
                        className="px-3 py-1 text-[11px] rounded-md border border-red-500 text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {prayerPage.content.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500 bg-white rounded-lg shadow-sm">
                해당 조건에 맞는 기도제목이 없습니다.
              </div>
            )}
          </div>

          {/* ✅ 데스크톱: 테이블 */}
          <div className="hidden sm:block bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => requestSort("memberName")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    멤버{renderSortIndicator("memberName")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    내용
                  </th>
                  <th
                    onClick={() => requestSort("creatorName")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    작성자{renderSortIndicator("creatorName")}
                  </th>
                  <th
                    onClick={() => requestSort("createdAt")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    작성일{renderSortIndicator("createdAt")}
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
                      {/* [수정] 멤버 이름 동명이인 처리 */}
                      {getFormattedName(prayer.member.id, prayer.member.name)}
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
                      {/* [수정] 작성자 이름 동명이인 처리 */}
                      {getFormattedName(
                        prayer.createdBy.id,
                        prayer.createdBy.name
                      )}
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
                {prayerPage.content.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      해당 조건에 맞는 기도제목이 없습니다.
                    </td>
                  </tr>
                )}
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

export default CellPrayersManager;
