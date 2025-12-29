// src/pages/AdminTeamsPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { teamService } from "../services/teamService";
import type { GetAllTeamsParams, TeamDto, Page } from "../types";
import { useAuth } from "../hooks/useAuth";
import Pagination from "../components/Pagination";
import { useDebounce } from "../hooks/useDebounce"; // hooks 파일이 없다면 아래 주석 처리된 인라인 훅을 사용하세요
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationCircleIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";

// useDebounce 훅이 별도 파일에 없다면 이 주석을 해제해서 사용하세요.
/*
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};
*/

type SortConfig = {
  key: keyof TeamDto;
  direction: "ascending" | "descending";
};

const AdminTeamsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [teamPage, setTeamPage] = useState<Page<TeamDto> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<TeamDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 필터 초기값
  const [filters, setFilters] = useState(() => {
    return {
      name: searchParams.get("name") ?? "",
      active: searchParams.get("active") ?? "all", // 'all' | 'true' | 'false'
    };
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const keyParam = searchParams.get("sortKey");
    const dirParam = searchParams.get("sortDir") as
      | SortConfig["direction"]
      | null;
    return {
      key: (keyParam as keyof TeamDto) ?? "name",
      direction: dirParam ?? "ascending",
    };
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
      if (nextFilters.active !== "all") params.active = nextFilters.active;

      params.sortKey = nextSort.key as string;
      params.sortDir = nextSort.direction;
      params.page = String(nextPage);

      setSearchParams(params, { replace: true });
    },
    [filters, sortConfig, currentPage, setSearchParams]
  );

  // 데이터 Fetching
  const fetchTeams = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") {
      setLoading(false);
      setError("권한이 없습니다.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const params: GetAllTeamsParams = {
        page: currentPage,
        size: 10,
        sort: `${sortConfig.key},${
          sortConfig.direction === "ascending" ? "asc" : "desc"
        }`,
      };

      if (debouncedNameFilter) params.name = debouncedNameFilter;
      if (filters.active !== "all") params.active = filters.active === "true";

      const data = await teamService.getAllTeams(params);
      setTeamPage(data);
    } catch (err) {
      console.error(err);
      setError("팀 목록 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, sortConfig, debouncedNameFilter, filters]);

  useEffect(() => {
    if (user?.role === "EXECUTIVE") fetchTeams();
    else if (user) {
      setError("권한이 없습니다.");
      setLoading(false);
    } else setLoading(false);
  }, [user, fetchTeams]);

  // Handlers
  const requestSort = (key: keyof TeamDto) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "ascending"
        ? "descending"
        : "ascending";
    const nextSort = { key, direction } as SortConfig;
    setSortConfig(nextSort);
    setCurrentPage(0);
    syncSearchParams(filters, nextSort, 0);
  };

  const getSortIndicator = (key: keyof TeamDto) =>
    sortConfig.key !== key
      ? " ↕"
      : sortConfig.direction === "ascending"
      ? " ▲"
      : " ▼";

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      setCurrentPage(0);
      syncSearchParams(next, sortConfig, 0);
      return next;
    });
  };

  const resetFilters = () => {
    const next = { name: "", active: "all" };
    setFilters(next);
    setCurrentPage(0);
    syncSearchParams(next, sortConfig, 0);
  };

  const handleDelete = (team: TeamDto) => {
    setTeamToDelete(team);
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!teamToDelete) return;
    setDeleteError(null);
    try {
      await teamService.deleteTeam(teamToDelete.id);
      setShowDeleteConfirm(false);
      setTeamToDelete(null);
      fetchTeams();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || "삭제 실패");
    }
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
              <UserGroupIcon className="h-7 w-7 text-indigo-500" />팀 관리
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              예배/사역/봉사 팀 정보를 조회하고 관리합니다.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/teams/add")}
            className="flex items-center justify-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-sm transition-all"
          >
            <PlusIcon className="h-4 w-4" /> 새 팀 추가
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                팀 이름 검색
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="검색..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange("name", e.target.value)}
                  className="w-full pl-10 py-3 border-gray-200 rounded-xl text-base bg-gray-50 focus:bg-white transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">
                상태
              </label>
              <select
                value={filters.active}
                onChange={(e) => handleFilterChange("active", e.target.value)}
                className="w-full py-3 border-gray-200 rounded-xl text-base bg-gray-50 focus:bg-white"
              >
                <option value="all">모든 상태</option>
                <option value="true">활성 팀</option>
                <option value="false">비활성 팀</option>
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
        ) : !teamPage || teamPage.content.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            조건에 맞는 팀이 없습니다.
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden mb-4">
              {teamPage.content.map((team) => (
                <div
                  key={team.id}
                  className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.99] transition-all ${
                    !team.active ? "opacity-75 bg-gray-50" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Link
                        to={`/admin/teams/${team.id}`}
                        className="text-lg font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        {team.name}
                      </Link>
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            team.active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {team.active ? "활성" : "비활성"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1 justify-end">
                        <UsersIcon className="h-3 w-3" />{" "}
                        {team.memberCount ?? 0}명
                      </span>
                    </div>
                  </div>

                  {team.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                      {team.description}
                    </p>
                  )}

                  <div className="pt-3 mt-2 border-t border-gray-50 flex justify-end gap-2">
                    {/* ✅ 모바일 버튼: 기존처럼 보이게 (배경 있음) + 한글 */}
                    <button
                      onClick={() => navigate(`/admin/teams/${team.id}/edit`)}
                      className="bg-gray-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(team)}
                      className="bg-gray-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
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
                      onClick={() => requestSort("memberCount")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >{`인원${getSortIndicator("memberCount")}`}</th>
                    <th
                      onClick={() => requestSort("active")}
                      className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs cursor-pointer hover:text-indigo-600"
                    >{`상태${getSortIndicator("active")}`}</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      설명
                    </th>
                    <th className="px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {teamPage.content.map((team) => (
                    <tr
                      key={team.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer group ${
                        !team.active ? "bg-gray-50 text-gray-400" : ""
                      }`}
                      onClick={() => navigate(`/admin/teams/${team.id}`)}
                    >
                      <td className="px-6 py-4 font-bold text-indigo-600">
                        {team.name}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">
                        {team.memberCount ?? 0}명
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            team.active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {team.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 truncate max-w-xs">
                        {team.description || "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* ✅ 데스크탑 버튼: UsersPage 테이블과 동일하게 텍스트 버튼 + 한글 */}
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() =>
                              navigate(`/admin/teams/${team.id}/edit`)
                            }
                            className="text-gray-400 hover:text-indigo-600 font-bold text-xs"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(team)}
                            className="text-gray-400 hover:text-red-500 font-bold text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <Pagination
                currentPage={teamPage.number}
                totalPages={teamPage.totalPages}
                totalElements={teamPage.totalElements}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  syncSearchParams(filters, sortConfig, p);
                }}
                itemLabel="개 팀"
              />
            </div>
          </>
        )}

        {/* Delete Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">팀 삭제</h3>
              <p className="text-sm text-gray-600 mb-2 break-keep">
                정말로{" "}
                <span className="font-bold text-gray-900">
                  "{teamToDelete?.name}"
                </span>{" "}
                팀을 삭제하시겠습니까?
              </p>
              <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 mb-4 break-keep">
                ⚠ 팀을 삭제하면 연결된 멤버들의 정보에 영향을 줄 수 있습니다.
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

export default AdminTeamsPage;
