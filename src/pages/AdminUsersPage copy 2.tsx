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
  UserPlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  UsersIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/solid";

type SortConfig = {
  key: keyof MemberDto | "cellName";
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

  // 필터/정렬/페이지 초기값
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
    return { key: key ?? "name", direction: dir ?? "ascending" };
  });

  const [currentPage, setCurrentPage] = useState(() =>
    searchParams.get("page") ? Number(searchParams.get("page")) : 0
  );
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

  // 데이터 Fetching
  const fetchMembers = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") {
      setLoading(false);
      setError("권한이 없습니다.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const sortKeyMap: Record<string, string> = { cellName: "cell.name" };
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

      setMemberPage(await memberService.getAllMembers(params));
    } catch (err) {
      console.error(err);
      setError("멤버 목록 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, sortConfig, debouncedNameFilter, filters]);

  const fetchAvailableJoinYears = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") return;
    try {
      const years = await memberService.getAvailableJoinYears();
      if (Array.isArray(years)) setAvailableJoinYears(years);
    } catch (err) {
      console.error("연도 목록 로드 실패", err);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "EXECUTIVE") fetchMembers();
    else if (user) {
      setError("권한이 없습니다.");
      setLoading(false);
    } else setLoading(false);
  }, [user, fetchMembers]);

  useEffect(() => {
    if (user?.role !== "EXECUTIVE") return;
    cellService
      .getAllCells({ size: 1000, active: true })
      .then((p) => setCells(p.content))
      .catch(console.error);
    fetchAvailableJoinYears();
  }, [user, fetchAvailableJoinYears]);

  // Helpers & Handlers
  const leaderCellMap = useMemo(() => {
    const map = new Map<number, string>();
    cells.forEach((c) => {
      if (c.leader) map.set(c.leader.id, c.name);
    });
    return map;
  }, [cells]);

  const yearOptions = useMemo(
    () =>
      !availableJoinYears || availableJoinYears.length === 0
        ? []
        : [...availableJoinYears].sort((a, b) => b - a),
    [availableJoinYears]
  );
  const cellOptions = useMemo(
    () => cells.map((c) => ({ value: c.id, label: c.name })),
    [cells]
  );

  const requestSort = (key: SortConfig["key"]) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "ascending"
        ? "descending"
        : "ascending";
    const nextSort = { key, direction } as SortConfig;
    setSortConfig(nextSort);
    setCurrentPage(0);
    syncSearchParams(filters, nextSort, 0);
  };

  const getSortIndicator = (key: SortConfig["key"]) =>
    sortConfig.key !== key
      ? " ↕"
      : sortConfig.direction === "ascending"
      ? " ▲"
      : " ▼";

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
      setDeleteError(err?.response?.data?.message || "삭제 실패");
    }
  };

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      setCurrentPage(0);
      syncSearchParams(next, sortConfig, 0);
      return next;
    });
  };

  const resetFilters = () => {
    const next = {
      name: "",
      year: "all",
      gender: "all",
      role: "all",
      cellId: null,
    };
    setFilters(next);
    setCurrentPage(0);
    syncSearchParams(next, sortConfig, 0);
  };

  if (error && (!user || user.role !== "EXECUTIVE"))
    return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UsersIcon className="h-7 w-7 text-indigo-500" />
              사용자 관리
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              멤버 정보를 조회하고 관리합니다.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/users/add")}
            className="flex items-center justify-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-sm transition-all"
          >
            <UserPlusIcon className="h-4 w-4" /> 새 멤버 추가
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5" /> {error}
          </div>
        )}

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <h3 className="font-bold text-gray-700">검색 필터</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
            <div className="relative">
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                이름 검색
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="검색..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange("name", e.target.value)}
                  className="w-full pl-10 py-3 border-gray-200 rounded-xl text-base bg-gray-50 focus:bg-white transition-all h-[46px]"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                소속 셀
              </label>
              {/* ✅ [수정] SimpleSearchableSelect의 컨테이너 높이와 내부 높이 조정 */}
              <div className="h-[46px]">
                <SimpleSearchableSelect
                  options={cellOptions}
                  value={filters.cellId}
                  onChange={(val) => handleFilterChange("cellId", val)}
                  placeholder="전체 셀"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                성별
              </label>
              <select
                value={filters.gender}
                onChange={(e) => handleFilterChange("gender", e.target.value)}
                className="w-full py-3 border-gray-200 rounded-xl text-base bg-gray-50 focus:bg-white h-[46px]"
              >
                <option value="all">모든 성별</option>
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                등록 연도
              </label>
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange("year", e.target.value)}
                className="w-full py-3 border-gray-200 rounded-xl text-base bg-gray-50 focus:bg-white h-[46px]"
              >
                <option value="all">모든 연도</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                역할
              </label>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange("role", e.target.value)}
                className="w-full py-3 border-gray-200 rounded-xl text-base bg-gray-50 focus:bg-white h-[46px]"
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
              className="text-xs font-bold text-gray-500 hover:text-gray-800 underline decoration-gray-300 underline-offset-2"
            >
              필터 초기화
            </button>
          </div>
        </div>

        {/* List / Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : !memberPage || memberPage.content.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            조건에 맞는 멤버가 없습니다.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden mb-4">
              {memberPage.content.map((member) => {
                const displayName = formatDisplayName(
                  member,
                  memberPage.content
                );
                const cellName =
                  member.role === "CELL_LEADER"
                    ? leaderCellMap.get(member.id) || member.cell?.name || "N/A"
                    : member.cell?.name || "미배정";

                return (
                  <div
                    key={member.id}
                    className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.99] transition-all ${
                      !member.active ? "opacity-75 bg-gray-50" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <button
                          onClick={() => navigate(`/admin/users/${member.id}`)}
                          className="text-lg font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          {displayName}
                        </button>
                        <div className="flex items-center gap-1 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              member.role === "EXECUTIVE"
                                ? "bg-red-50 text-red-700"
                                : member.role === "CELL_LEADER"
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {translateRole(member.role)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              member.active
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {member.active ? "활성" : "비활성"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>{member.joinYear}년 등록</div>
                        <div className="font-medium text-gray-700 mt-0.5">
                          {cellName}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-2 border-t border-gray-50 flex justify-end gap-2">
                      <button
                        onClick={() =>
                          navigate(`/admin/users/${member.id}/edit`)
                        }
                        className="bg-gray-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        className="bg-gray-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th
                      onClick={() => requestSort("name")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >{`이름${getSortIndicator("name")}`}</th>
                    <th
                      onClick={() => requestSort("role")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >{`역할${getSortIndicator("role")}`}</th>
                    <th
                      onClick={() => requestSort("cellName")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >{`셀${getSortIndicator("cellName")}`}</th>
                    <th
                      onClick={() => requestSort("joinYear")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >{`등록연도${getSortIndicator("joinYear")}`}</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      상태
                    </th>
                    <th className="px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {memberPage.content.map((member) => {
                    const displayName = formatDisplayName(
                      member,
                      memberPage.content
                    );
                    const cellName =
                      member.role === "CELL_LEADER"
                        ? leaderCellMap.get(member.id) ||
                          member.cell?.name ||
                          "N/A"
                        : member.cell?.name || "미배정";
                    return (
                      <tr
                        key={member.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer group ${
                          !member.active ? "bg-gray-50 text-gray-400" : ""
                        }`}
                        onClick={() => navigate(`/admin/users/${member.id}`)}
                      >
                        <td className="px-6 py-4 font-bold text-indigo-600">
                          {displayName}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              member.role === "EXECUTIVE"
                                ? "bg-red-50 text-red-700"
                                : member.role === "CELL_LEADER"
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {translateRole(member.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-700">
                          {cellName}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {member.joinYear}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              member.active
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {member.active ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div
                            className="flex justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() =>
                                navigate(`/admin/users/${member.id}/edit`)
                              }
                              className="text-gray-400 hover:text-indigo-600 font-bold text-xs"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(member)}
                              className="text-gray-400 hover:text-red-500 font-bold text-xs"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <Pagination
                currentPage={memberPage.number}
                totalPages={memberPage.totalPages}
                totalElements={memberPage.totalElements}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  syncSearchParams(filters, sortConfig, p);
                }}
                itemLabel="명"
              />
            </div>
          </>
        )}

        {/* Delete Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                멤버 삭제
              </h3>
              <p className="text-sm text-gray-600 mb-2 break-keep">
                정말로{" "}
                <span className="font-bold text-gray-900">
                  "{memberToDelete?.name}"
                </span>{" "}
                님이 삭제하시겠습니까?
              </p>
              <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 mb-4 break-keep">
                ⚠ 삭제 후에는 해당 멤버의 출석, 기도제목 등 모든 데이터가
                사라지며 복구할 수 없습니다.
              </p>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg">
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

export default AdminUsersPage;
