// src/pages/AdminTeamsPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { teamService } from "../services/teamService";
import type { GetAllTeamsParams, TeamDto, Page } from "../types";
import { useAuth } from "../hooks/useAuth";
import Pagination from "../components/Pagination";

// --- 간단한 디바운스 훅 ---
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

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

  // ───────────────── URL 기반 초기값 설정 ─────────────────
  const [nameFilter, setNameFilter] = useState(() => {
    return searchParams.get("name") ?? "";
  });

  const [activeFilter, setActiveFilter] = useState<string>(() => {
    const activeParam = searchParams.get("active");
    if (activeParam === "true" || activeParam === "false") {
      return activeParam;
    }
    return "all";
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const keyParam = searchParams.get("sortKey");
    const dirParam = searchParams.get("sortDir") as
      | SortConfig["direction"]
      | null;

    const key = (keyParam as keyof TeamDto | null) ?? "name";
    const direction = dirParam ?? "ascending";

    return { key, direction };
  });

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? Number(pageParam) : 0;
  });

  const debouncedNameFilter = useDebounce(nameFilter, 500);

  // ───────────────── URL 쿼리와 상태 동기화 함수 ─────────────────
  const syncSearchParams = useCallback(
    (
      nextNameFilter: string = nameFilter,
      nextActiveFilter: string = activeFilter,
      nextSortConfig: SortConfig = sortConfig,
      nextPage: number = currentPage
    ) => {
      const params: Record<string, string> = {};

      if (nextNameFilter) params.name = nextNameFilter;
      if (nextActiveFilter !== "all") params.active = nextActiveFilter;

      params.sortKey = nextSortConfig.key as string;
      params.sortDir = nextSortConfig.direction;
      params.page = String(nextPage);

      setSearchParams(params, { replace: true });
    },
    [nameFilter, activeFilter, sortConfig, currentPage, setSearchParams]
  );

  const fetchTeams = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") return;

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
      if (activeFilter !== "all") params.active = activeFilter === "true";

      const data = await teamService.getAllTeams(params);
      setTeamPage(data);
    } catch (err) {
      console.error(err);
      setError("팀 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, sortConfig, debouncedNameFilter, activeFilter]);

  useEffect(() => {
    if (!user) {
      setError("로그인 후에 팀 관리 페이지에 접근할 수 있습니다.");
      setLoading(false);
      return;
    }
    if (user.role !== "EXECUTIVE") {
      setError("팀 관리 페이지에 접근할 권한이 없습니다.");
      setLoading(false);
      return;
    }

    fetchTeams();
  }, [user, fetchTeams]);

  const requestSort = (key: keyof TeamDto) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    const nextSort: SortConfig = { key, direction };
    const nextPage = 0;

    setSortConfig(nextSort);
    setCurrentPage(nextPage);
    syncSearchParams(nameFilter, activeFilter, nextSort, nextPage);
  };

  const getSortIndicator = (key: keyof TeamDto) => {
    if (sortConfig.key !== key) return " ↕";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
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
      setDeleteError(err?.response?.data?.message || "팀 삭제에 실패했습니다.");
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirm(false);
    setTeamToDelete(null);
    setDeleteError(null);
  };

  // 권한 에러일 때는 간단한 안내 화면
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
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* 상단 제목 */}
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              팀 관리
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              예배·사역·봉사 등의 팀 정보를 한 곳에서 관리하는 임원 전용
              페이지입니다. 팀은 멤버의 역할 배정과 사역 담당 현황을 파악할 때
              기준이 됩니다.
            </p>
          </div>
        </div>

        {/* 상단 에러 (임원 권한일 때) */}
        {error && user && user.role === "EXECUTIVE" && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* 필터 영역 */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                팀 이름 검색
              </label>
              <input
                type="text"
                placeholder="이름으로 검색..."
                value={nameFilter}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setNameFilter(nextName);
                  const nextPage = 0;
                  setCurrentPage(nextPage);
                  syncSearchParams(
                    nextName,
                    activeFilter,
                    sortConfig,
                    nextPage
                  );
                }}
                className="p-2 border rounded-md w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상태 필터
              </label>
              <select
                value={activeFilter}
                onChange={(e) => {
                  const nextActive = e.target.value;
                  setActiveFilter(nextActive);
                  const nextPage = 0;
                  setCurrentPage(nextPage);
                  syncSearchParams(
                    nameFilter,
                    nextActive,
                    sortConfig,
                    nextPage
                  );
                }}
                className="p-2 border rounded-md w-full text-sm"
              >
                <option value="all">모든 상태</option>
                <option value="true">활성 팀만</option>
                <option value="false">비활성 팀만</option>
              </select>
            </div>
          </div>
        </div>

        {/* 🔹 필터 바로 아래: 새 팀 추가 버튼 */}
        {user?.role === "EXECUTIVE" && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => navigate("/admin/teams/add")}
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={loading}
            >
              + 새 팀 추가
            </button>
          </div>
        )}

        {/* 목록 / 로딩 / 빈 상태 */}
        {loading && (
          <div className="flex items-center justify-center min-h-[30vh]">
            <p className="text-sm text-gray-500">
              팀 목록을 불러오는 중입니다...
            </p>
          </div>
        )}

        {!loading && teamPage && (
          <>
            {/* ✅ 모바일: 카드 리스트 (팀 인원 표시 추가) */}
            <div className="space-y-3 md:hidden mb-4">
              {teamPage.content.length === 0 ? (
                <div className="bg-white rounded-lg shadow border border-gray-100 p-4 text-center text-xs sm:text-sm text-gray-500">
                  조건에 맞는 팀이 없습니다. 필터를 변경해 보세요.
                </div>
              ) : (
                teamPage.content.map((team) => (
                  <div
                    key={team.id}
                    className="bg-white rounded-lg shadow border border-gray-100 p-4 text-xs"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/admin/teams/${team.id}`}
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {team.name}
                        </Link>
                        {team.description && (
                          <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                            {team.description}
                          </p>
                        )}
                        <p className="mt-2 text-[11px] text-gray-600">
                          현재 팀 인원{" "}
                          <span className="font-semibold">
                            {team.memberCount ?? 0}명
                          </span>
                        </p>
                      </div>
                      <span
                        className={`px-2 inline-flex text-[11px] leading-5 font-semibold rounded-full ${
                          team.active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {team.active ? "활성" : "비활성"}
                      </span>
                    </div>

                    {user?.role === "EXECUTIVE" && (
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          onClick={() =>
                            navigate(`/admin/teams/${team.id}/edit`)
                          }
                          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-900"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(team)}
                          className="text-[11px] font-medium text-red-600 hover:text-red-800"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ✅ 데스크탑: 테이블 (팀 인원 컬럼 + 정렬 추가) */}
            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => requestSort("name")}
                      className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    >
                      이름{getSortIndicator("name")}
                    </th>
                    <th
                      onClick={() => requestSort("memberCount")}
                      className="px-4 sm:px-6 py-3 text-right text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    >
                      인원{getSortIndicator("memberCount")}
                    </th>
                    <th
                      onClick={() => requestSort("active")}
                      className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    >
                      상태{getSortIndicator("active")}
                    </th>
                    <th className="relative px-4 sm:px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamPage.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500"
                      >
                        조건에 맞는 팀이 없습니다. 필터를 변경해 보세요.
                      </td>
                    </tr>
                  ) : (
                    teamPage.content.map((team) => (
                      <tr key={team.id}>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm font-medium">
                          <Link
                            to={`/admin/teams/${team.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {team.name}
                          </Link>
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-right text-xs sm:text-sm">
                          <span className="font-semibold">
                            {team.memberCount ?? 0}
                          </span>
                          <span className="ml-1 text-gray-500">명</span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm">
                          <span
                            className={`px-2 inline-flex text-[11px] sm:text-xs leading-5 font-semibold rounded-full ${
                              team.active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {team.active ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                          {user?.role === "EXECUTIVE" && (
                            <>
                              <button
                                onClick={() =>
                                  navigate(`/admin/teams/${team.id}/edit`)
                                }
                                className="text-indigo-600 hover:text-indigo-900 mr-3"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(team)}
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

            {/* 페이지네이션 */}
            <Pagination
              currentPage={teamPage.number}
              totalPages={teamPage.totalPages}
              totalElements={teamPage.totalElements}
              onPageChange={(page) => {
                setCurrentPage(page);
                syncSearchParams(nameFilter, activeFilter, sortConfig, page);
              }}
              itemLabel="개 팀"
            />
          </>
        )}

        {/* 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-sm w-full">
              <h2 className="text-lg sm:text-xl font-bold mb-4">
                팀 삭제 확인
              </h2>
              <p className="text-sm text-gray-700 mb-2">
                정말로 &quot;{teamToDelete?.name}&quot; 팀을 삭제하시겠습니까?
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 mb-4">
                팀을 삭제하면 해당 팀에 연결된 멤버/역할 배정 정보에 영향을 줄
                수 있습니다. 필요하다면 먼저 팀 연결 상태를 확인해 주세요.
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

export default AdminTeamsPage;
