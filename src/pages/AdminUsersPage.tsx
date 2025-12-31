// src/pages/AdminUsersPage.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import type { GetAllMembersParams, MemberDto, Page, CellDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import { translateRole } from "../utils/roleUtils";
import { formatDisplayName } from "../utils/memberUtils";
import Pagination from "../components/Pagination";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import { useDebounce } from "../hooks/useDebounce";
import {
  UsersIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
} from "@heroicons/react/24/solid";

// ✅ 정렬 키에 attendanceRate 추가
type SortConfig = {
  key: keyof MemberDto | "cellName" | "attendanceRate";
  direction: "ascending" | "descending";
};

const AdminUsersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [memberPage, setMemberPage] = useState<Page<MemberDto> | null>(null);
  const [cells, setCells] = useState<CellDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [memberToDelete, setMemberToDelete] = useState<MemberDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [availableJoinYears, setAvailableJoinYears] = useState<number[]>([]);

  // 필터 초기값 로드
  const [filters, setFilters] = useState(() => {
    const cellIdParam = searchParams.get("cellId");
    return {
      name: searchParams.get("name") ?? "",
      year: searchParams.get("year") ?? "all",
      gender: searchParams.get("gender") ?? "all",
      role: searchParams.get("role") ?? "all",
      cellId: cellIdParam ? Number(cellIdParam) : null,
    };
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const key = searchParams.get("sortKey") as SortConfig["key"] | null;
    const dir = searchParams.get("sortDir") as SortConfig["direction"] | null;
    return {
      key: key ?? "name",
      direction: dir ?? "ascending",
    };
  });

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? Number(pageParam) : 0;
  });

  const debouncedNameFilter = useDebounce(filters.name, 500);

  // URL 동기화
  const syncSearchParams = useCallback(
    (nextFilters = filters, nextSort = sortConfig, nextPage = currentPage) => {
      const params: Record<string, string> = {};

      if (nextFilters.name) params.name = nextFilters.name;
      if (nextFilters.year !== "all") params.year = String(nextFilters.year);
      if (nextFilters.gender !== "all") params.gender = nextFilters.gender;
      if (nextFilters.role !== "all") params.role = nextFilters.role;
      if (nextFilters.cellId) params.cellId = String(nextFilters.cellId);

      params.sortKey = nextSort.key;
      params.sortDir = nextSort.direction;
      params.page = String(nextPage);

      setSearchParams(params, { replace: true });
    },
    [filters, sortConfig, currentPage, setSearchParams]
  );

  // --- 멤버 목록 조회 ---
  const fetchMembers = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") {
      setLoading(false);
      setError("사용자 관리 페이지에 접근할 권한이 없습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sortKeyMap: Record<string, string> = {
        cellName: "cell.name",
        attendanceRate: "attendanceRate",
      };

      const backendSortKey =
        sortKeyMap[sortConfig.key as string] || (sortConfig.key as string);

      const params: GetAllMembersParams = {
        page: currentPage,
        size: 10,
        sort: `${backendSortKey},${
          sortConfig.direction === "ascending" ? "asc" : "desc"
        }`,
      };

      if (debouncedNameFilter) params.name = debouncedNameFilter;
      if (filters.year !== "all") params.joinYear = Number(filters.year);
      if (filters.gender !== "all")
        params.gender = filters.gender as "MALE" | "FEMALE";
      if (filters.role !== "all")
        params.role = filters.role as "EXECUTIVE" | "CELL_LEADER" | "MEMBER";
      if (filters.cellId) params.cellId = filters.cellId;

      const data = await memberService.getAllMembers(params);
      setMemberPage(data);
    } catch (err) {
      console.error(err);
      setError("멤버 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, sortConfig, debouncedNameFilter, filters]);

  // --- 메타 데이터 로딩 ---
  const fetchAvailableJoinYears = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") return;
    try {
      const years = await memberService.getAvailableJoinYears();
      if (Array.isArray(years)) {
        setAvailableJoinYears(years);
      }
    } catch (err) {
      console.error("등록 연도 목록 조회 실패:", err);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "EXECUTIVE") {
      fetchMembers();
    } else if (user) {
      setError("사용자 관리 페이지에 접근할 권한이 없습니다.");
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [user, fetchMembers]);

  useEffect(() => {
    if (user?.role !== "EXECUTIVE") return;
    cellService
      .getAllCells({ size: 1000, active: true })
      .then((page) => setCells(page.content))
      .catch((err) => console.error("셀 목록 조회 실패:", err));
    fetchAvailableJoinYears();
  }, [user, fetchAvailableJoinYears]);

  const leaderCellMap = useMemo(() => {
    const map = new Map<number, string>();
    if (cells.length > 0) {
      for (const cell of cells) {
        if (cell.leader) map.set(cell.leader.id, cell.name);
      }
    }
    return map;
  }, [cells]);

  const yearOptions = useMemo(() => {
    if (!availableJoinYears || availableJoinYears.length === 0) return [];
    return [...availableJoinYears].sort((a, b) => b - a);
  }, [availableJoinYears]);

  const cellOptions = useMemo(
    () => cells.map((c) => ({ value: c.id, label: c.name })),
    [cells]
  );

  // --- 핸들러 ---
  const requestSort = (key: SortConfig["key"]) => {
    let direction: SortConfig["direction"] = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    const nextSort: SortConfig = { key, direction };
    const nextPage = 0;
    setSortConfig(nextSort);
    setCurrentPage(nextPage);
    syncSearchParams(filters, nextSort, nextPage);
  };

  const getSortIndicator = (key: SortConfig["key"]) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  const handleDelete = (member: MemberDto) => {
    setMemberToDelete(member);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    setDeleteError(null);
    try {
      await memberService.deleteMember(memberToDelete.id);
      setShowDeleteConfirm(false);
      setMemberToDelete(null);
      fetchMembers();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message || "멤버 삭제에 실패했습니다."
      );
    }
  };

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      const nextPage = 0;
      setCurrentPage(nextPage);
      syncSearchParams(next, sortConfig, nextPage);
      return next;
    });
  };

  const resetFilters = () => {
    const nextFilters = {
      name: "",
      year: "all",
      gender: "all",
      role: "all",
      cellId: null as number | null,
    };
    const nextPage = 0;
    setFilters(nextFilters);
    setCurrentPage(nextPage);
    syncSearchParams(nextFilters, sortConfig, nextPage);
  };

  if (error && (!user || user.role !== "EXECUTIVE")) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <p className="mt-4 text-red-600 text-center text-sm sm:text-base">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <UsersIcon className="h-8 w-8 text-indigo-500" />
              사용자 관리
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              전체 멤버를 조회하고, 셀·역할·연도별로 필터링하거나 상세 정보를
              수정·삭제할 수 있는 페이지입니다.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/users/add")}
            className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-sm transition-all"
            disabled={loading}
          >
            <PlusIcon className="h-4 w-4" /> 새 멤버 추가
          </button>
        </div>

        {error && user?.role === "EXECUTIVE" && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* 필터 영역 (디자인 통일: border-gray-300, shadow-sm, rounded-lg) */}
        <div className="mb-6 p-5 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                이름 검색
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="이름으로 검색..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange("name", e.target.value)}
                  className="w-full pl-9 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white shadow-sm transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                셀
              </label>
              <div className="h-[38px]">
                <SimpleSearchableSelect
                  options={cellOptions}
                  value={filters.cellId}
                  onChange={(val) => handleFilterChange("cellId", val)}
                  placeholder="전체 셀"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                성별
              </label>
              <select
                value={filters.gender}
                onChange={(e) => handleFilterChange("gender", e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white shadow-sm"
              >
                <option value="all">모든 성별</option>
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                등록 연도
              </label>
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange("year", e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white shadow-sm"
              >
                <option value="all">모든 연도</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                역할
              </label>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange("role", e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white shadow-sm"
              >
                <option value="all">모든 역할</option>
                <option value="EXECUTIVE">임원</option>
                <option value="CELL_LEADER">셀장</option>
                <option value="MEMBER">셀원</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-xs font-bold text-gray-600 shadow-sm transition-all"
            >
              필터 초기화
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center min-h-[30vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {!loading && memberPage && (
          <>
            {/* 🔹 모바일: 카드 리스트 */}
            <div className="space-y-3 md:hidden mb-4">
              {memberPage.content.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                  조건에 맞는 멤버가 없습니다.
                </div>
              ) : (
                memberPage.content.map((member) => {
                  const displayName = formatDisplayName(
                    member,
                    memberPage.content
                  );
                  const cellName =
                    member.role === "CELL_LEADER"
                      ? leaderCellMap.get(member.id) ||
                        member.cell?.name ||
                        "N/A"
                      : member.cell?.name || "*소속 셀 없음";

                  const rate = member.attendanceRate;
                  const rateText =
                    rate !== undefined ? `${rate.toFixed(0)}%` : "-";

                  return (
                    <div
                      key={member.id}
                      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-xs space-y-2 ${
                        !member.active ? "bg-gray-50 opacity-80" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}`)
                            }
                            className={`text-base font-bold ${
                              !member.active
                                ? "text-gray-500"
                                : "text-indigo-600 hover:text-indigo-800"
                            }`}
                          >
                            {displayName}
                          </button>
                          <p className="mt-0.5 text-xs text-gray-500">
                            등록: {member.joinYear}년
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full ${
                              member.role === "EXECUTIVE"
                                ? "bg-red-100 text-red-700"
                                : member.role === "CELL_LEADER"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {translateRole(member.role)}
                          </span>
                          <span
                            className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full ${
                              member.active
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {member.active ? "활성" : "비활성"}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-50">
                        <span className="text-gray-500 font-medium">
                          <span className="text-gray-400 mr-1">셀:</span>
                          {cellName}
                        </span>
                        <span className="text-gray-900 font-bold">
                          출석률 {rateText}
                        </span>
                      </div>

                      {/* ✅ 모바일 버튼 스타일 통일 (배경 있는 버튼) */}
                      <div className="pt-3 mt-1 border-t border-gray-50 flex justify-end gap-2">
                        <button
                          onClick={() =>
                            navigate(`/admin/users/${member.id}/edit`)
                          }
                          className="flex items-center gap-1 bg-gray-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-50"
                        >
                          <PencilIcon className="h-3 w-3" /> 수정
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          className="flex items-center gap-1 bg-gray-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-50"
                        >
                          <TrashIcon className="h-3 w-3" /> 삭제
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 🔹 데스크탑: 테이블 */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden mb-6">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th
                      onClick={() => requestSort("name")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >
                      이름{getSortIndicator("name")}
                    </th>
                    <th
                      onClick={() => requestSort("role")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >
                      역할{getSortIndicator("role")}
                    </th>
                    <th
                      onClick={() => requestSort("cellName")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >
                      셀{getSortIndicator("cellName")}
                    </th>
                    <th
                      onClick={() => requestSort("attendanceRate")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >
                      출석률{getSortIndicator("attendanceRate")}
                    </th>
                    <th
                      onClick={() => requestSort("joinYear")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >
                      등록연도{getSortIndicator("joinYear")}
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      상태
                    </th>
                    {/* ✅ 우측 정렬된 관리 헤더 */}
                    <th className="relative px-6 py-3 text-right font-bold text-gray-500 uppercase text-xs">
                      {/* 관리 */}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {memberPage.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        조건에 맞는 멤버가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    memberPage.content.map((member) => {
                      const rate = member.attendanceRate;
                      const rateText =
                        rate !== undefined ? `${rate.toFixed(0)}%` : "-";

                      return (
                        <tr
                          key={member.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            !member.active ? "bg-gray-50" : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                            <button
                              onClick={() =>
                                navigate(`/admin/users/${member.id}`)
                              }
                              className="hover:underline"
                            >
                              {formatDisplayName(member, memberPage.content)}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 inline-flex text-xs font-bold rounded-full ${
                                member.role === "EXECUTIVE"
                                  ? "bg-red-100 text-red-700"
                                  : member.role === "CELL_LEADER"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {translateRole(member.role)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">
                            {member.role === "CELL_LEADER"
                              ? leaderCellMap.get(member.id) ||
                                member.cell?.name ||
                                "-"
                              : member.cell?.name || "-"}
                          </td>
                          {/* ✅ 출석률: 검정 텍스트 유지 */}
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                            {rateText}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            {member.joinYear}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 inline-flex text-xs font-bold rounded-full ${
                                member.active
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {member.active ? "활성" : "비활성"}
                            </span>
                          </td>
                          {/* ✅ 데스크탑 버튼 스타일 (텍스트형 + 우측 정렬) */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  navigate(`/admin/users/${member.id}/edit`)
                                }
                                className="text-gray-400 hover:text-indigo-600 font-bold text-xs transition-colors"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(member)}
                                className="text-gray-400 hover:text-red-500 font-bold text-xs transition-colors"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={memberPage.number}
              totalPages={memberPage.totalPages}
              totalElements={memberPage.totalElements}
              onPageChange={(page) => {
                setCurrentPage(page);
                syncSearchParams(filters, sortConfig, page);
              }}
              itemLabel="명"
            />
          </>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full">
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                멤버 삭제 확인
              </h2>
              <p className="text-sm text-gray-600 mb-4 break-keep">
                정말로 &quot;
                <span className="font-bold text-gray-900">
                  {memberToDelete && memberPage
                    ? formatDisplayName(memberToDelete, memberPage.content)
                    : memberToDelete?.name ?? ""}
                </span>
                &quot; 멤버를 삭제하시겠습니까?
              </p>
              <div className="p-3 bg-red-50 rounded-lg mb-6">
                <p className="text-xs text-red-600 font-medium">
                  ⚠️ 삭제 후에는 해당 멤버와 연결된 출석, 기도제목, 셀 정보 등에
                  영향을 줄 수 있습니다.
                </p>
              </div>
              {deleteError && (
                <div className="p-3 text-xs font-bold text-red-700 bg-red-100 border border-red-200 rounded-lg mb-4">
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

export default AdminUsersPage;
