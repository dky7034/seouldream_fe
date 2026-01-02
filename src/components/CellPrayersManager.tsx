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
import { formatDisplayName } from "../utils/memberUtils";

// ✅ [확정] 정렬 기준: meetingDate
type SortKey = "meetingDate" | "memberName" | "creatorName";

type SortConfig = {
  key: SortKey;
  direction: "ascending" | "descending";
};

// ✅ [확정] 백엔드 정렬 필드명 매핑
const sortKeyMap: Record<SortKey, string> = {
  meetingDate: "meetingDate",
  memberName: "member.name",
  creatorName: "createdBy.name",
};

interface CellPrayersManagerProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

type UnitType = "year" | "month" | "semester";

const CellPrayersManager: React.FC<CellPrayersManagerProps> = ({
  user,
  allMembers,
}) => {
  const navigate = useNavigate();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [prayerPage, setPrayerPage] = useState<Page<PrayerDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  // ✅ [확정] 기본 정렬: 최신 모임 날짜(meetingDate) 내림차순
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "meetingDate",
    direction: "descending",
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [filterType, setFilterType] = useState<"unit" | "range">("unit");

  const [unitType, setUnitType] = useState<UnitType>("year");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prayerToDelete, setPrayerToDelete] = useState<number | null>(null);

  const isCellLeader = user.role === "CELL_LEADER";

  const getFormattedName = useCallback(
    (id: number, originalName: string) => {
      const found = allMembers.find((m) => m.id === id);
      return found ? formatDisplayName(found, allMembers) : originalName;
    },
    [allMembers]
  );

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

      const targetId = currentSemester
        ? currentSemester.id
        : semesters[semesters.length - 1].id;

      setFilters((prev) => ({ ...prev, semesterId: targetId }));
    }
  }, [semesters, unitType, filters.semesterId]);

  const fetchPrayers = useCallback(async () => {
    if (!user.cellId) {
      setError("셀장 정보에 셀 ID가 없습니다. 관리자에게 문의하세요.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const sortField = sortKeyMap[sortConfig.key];
    const effectiveFilterType: "unit" | "range" = isCellLeader
      ? "unit"
      : filterType;

    // ✅ 필터링 로직: startDate, endDate가 이제 meetingDate 기준이 됨 (백엔드 로직 변경 반영)
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
      params = {
        ...params,
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
    } else {
      if (unitType === "semester" && filters.semesterId) {
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

  const handleSemesterButtonClick = () => {
    let targetId: number | string = "";
    if (semesters.length > 0) {
      const today = new Date();
      const currentSemester = semesters.find((s) => {
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return today >= start && today <= end;
      });
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
                  등록된 학기가 없습니다.
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">
            {user.cellName ? `${user.cellName} 기도제목` : "내 셀 기도제목"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            셀원들의 기도제목을 조회하고 관리합니다.
          </p>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg mb-6 space-y-4">
        {/* 필터 영역 (이전과 동일, 생략) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-2">
          <h3 className="text-lg font-semibold">조회 기간 설정</h3>
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

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      {loading && (
        <p className="text-center text-sm text-gray-500">로딩 중...</p>
      )}

      {!loading && prayerPage && (
        <>
          {/* ✅ 모바일: 카드형 리스트 */}
          <div className="sm:hidden space-y-3">
            {prayerPage.content.map((prayer) => {
              // ✅ [수정] 작성일 대신 meetingDate 표시
              // meetingDate는 "YYYY-MM-DD" 문자열로 옴.
              const dateDisplay = prayer.meetingDate;

              return (
                <div
                  key={prayer.id}
                  className={`bg-white rounded-lg shadow-sm px-4 py-3 border ${
                    prayer.isDeleted ? "opacity-70 bg-gray-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900 text-sm">
                      {getFormattedName(prayer.member.id, prayer.member.name)}
                    </div>
                    {/* 모임 날짜 표시 */}
                    <div className="text-[11px] text-gray-500">
                      {dateDisplay}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/admin/prayers/${prayer.id}`)}
                    className="mt-2 text-left w-full"
                  >
                    <p className="text-sm text-gray-800 line-clamp-2">
                      {prayer.content}
                    </p>
                  </button>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
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
                  {/* ✅ [수정] 작성일 -> 모임 날짜 컬럼 */}
                  <th
                    onClick={() => requestSort("meetingDate")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    모임 날짜{renderSortIndicator("meetingDate")}
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
                      {getFormattedName(
                        prayer.createdBy.id,
                        prayer.createdBy.name
                      )}
                    </td>
                    {/* ✅ [수정] meetingDate 표시 */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {prayer.meetingDate}
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
