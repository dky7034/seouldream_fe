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

type SortConfig = {
  key: keyof MemberDto | "cellName";
  direction: "ascending" | "descending";
};

const initialFilters = {
  name: "",
  year: "all",
  gender: "all",
  role: "all",
  cellId: null as number | null,
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

  // ───────────────── 필터/정렬/페이지 초기값을 URL에서 읽기 ─────────────────
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

  // ───────────────── URL 쿼리와 상태 동기화 함수 ─────────────────
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

  // --- 등록 연도 목록 조회 ---
  const fetchAvailableJoinYears = useCallback(async () => {
    if (!user || user.role !== "EXECUTIVE") return;

    try {
      const years = await memberService.getAvailableJoinYears();
      if (Array.isArray(years)) {
        setAvailableJoinYears(years);
      } else {
        console.error(
          "getAvailableJoinYears 응답 형식이 배열이 아닙니다:",
          years
        );
      }
    } catch (err) {
      console.error("등록 연도 목록 조회 실패:", err);
    }
  }, [user]);

  // --- 멤버 목록 로딩 ---
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

  // --- 셀 목록 + 등록 연도 목록 로딩 ---
  useEffect(() => {
    if (user?.role !== "EXECUTIVE") return;

    cellService
      .getAllCells({ size: 1000, active: true })
      .then((page) => setCells(page.content))
      .catch((err) => {
        console.error("셀 목록 조회 실패:", err);
      });

    fetchAvailableJoinYears();
  }, [user, fetchAvailableJoinYears]);

  // --- 셀장 ID -> 셀 이름 매핑 ---
  const leaderCellMap = useMemo(() => {
    const map = new Map<number, string>();
    if (cells.length > 0) {
      for (const cell of cells) {
        if (cell.leader) {
          map.set(cell.leader.id, cell.name);
        }
      }
    }
    return map;
  }, [cells]);

  // --- 등록 연도 옵션 ---
  const yearOptions = useMemo(() => {
    if (!availableJoinYears || availableJoinYears.length === 0) {
      return [];
    }
    return [...availableJoinYears].sort((a, b) => b - a);
  }, [availableJoinYears]);

  // --- 셀 드롭다운 옵션 ---
  const cellOptions = useMemo(
    () => cells.map((c) => ({ value: c.id, label: c.name })),
    [cells]
  );

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
    const nextFilters = { ...initialFilters };
    const nextPage = 0;
    setFilters(nextFilters);
    setCurrentPage(nextPage);
    // 정렬은 유지한 채 필터/페이지만 초기화
    syncSearchParams(nextFilters, sortConfig, nextPage);
  };

  // 권한 없는 경우 빠른 리턴 (레이아웃 포함)
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
        {/* 상단 제목 + 안내 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              사용자 관리
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              전체 멤버를 조회하고, 셀·역할·연도별로 필터링하거나 상세 정보를
              수정·삭제할 수 있는 페이지입니다.
            </p>
          </div>
        </div>

        {/* 에러 메시지 (EXECUTIVE일 때만 표시) */}
        {error && user?.role === "EXECUTIVE" && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* 필터 영역 */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 검색
              </label>
              <input
                type="text"
                placeholder="이름으로 검색..."
                value={filters.name}
                onChange={(e) => handleFilterChange("name", e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                셀
              </label>
              <SimpleSearchableSelect
                options={cellOptions}
                value={filters.cellId}
                onChange={(val) => handleFilterChange("cellId", val)}
                placeholder="전체 셀"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                성별
              </label>
              <select
                value={filters.gender}
                onChange={(e) => handleFilterChange("gender", e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
              >
                <option value="all">모든 성별</option>
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                등록 연도
              </label>
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange("year", e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                역할
              </label>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange("role", e.target.value)}
                className="p-2 border rounded-md w-full text-sm"
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
              className="px-3 py-1 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-xs sm:text-sm text-gray-700 font-medium shadow-sm"
            >
              필터 초기화
            </button>
          </div>
        </div>

        {/* 새 멤버 추가 버튼 (필터 아래, 우측 정렬) */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => navigate("/admin/users/add")}
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={loading}
          >
            + 새 멤버 추가
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center min-h-[30vh]">
            <p className="text-sm text-gray-500">
              멤버 목록을 불러오는 중입니다...
            </p>
          </div>
        )}

        {!loading && memberPage && (
          <>
            {/* 🔹 모바일: 카드 리스트 */}
            <div className="space-y-3 md:hidden mb-4">
              {memberPage.content.length === 0 ? (
                <div className="bg-white rounded-lg shadow border border-gray-100 p-4 text-center text-xs sm:text-sm text-gray-500">
                  조건에 맞는 멤버가 없습니다. 필터를 변경해 보세요.
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

                  return (
                    <div
                      key={member.id}
                      className={`bg-white rounded-lg shadow border border-gray-100 p-4 text-xs space-y-2 ${
                        !member.active ? "bg-gray-100 text-gray-500" : ""
                      }`}
                    >
                      {/* 상단: 이름 + 역할 + 상태 */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}`)
                            }
                            className={`text-sm font-semibold ${
                              !member.active
                                ? "text-gray-600"
                                : "text-indigo-600 hover:text-indigo-800"
                            }`}
                          >
                            {displayName}
                          </button>
                          <p className="mt-1 text-[11px] text-gray-500">
                            등록 연도: {member.joinYear}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2 inline-flex text-[11px] leading-5 font-semibold rounded-full ${
                              member.role === "EXECUTIVE"
                                ? "bg-red-100 text-red-800"
                                : member.role === "CELL_LEADER"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {translateRole(member.role)}
                          </span>
                          <span
                            className={`px-2 inline-flex text-[11px] leading-5 font-semibold rounded-full ${
                              member.active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-200 text-gray-800"
                            }`}
                          >
                            {member.active ? "활성" : "비활성"}
                          </span>
                        </div>
                      </div>

                      {/* 중간: 셀 정보 */}
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[11px] text-gray-500">
                          셀:{" "}
                          <span className="font-medium text-gray-700">
                            {cellName}
                          </span>
                        </span>
                      </div>

                      {/* 하단: 액션 버튼 */}
                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          onClick={() =>
                            navigate(`/admin/users/${member.id}/edit`)
                          }
                          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-900"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          className="text-[11px] font-medium text-red-600 hover:text-red-800"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 🔹 데스크탑: 테이블 */}
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
                      onClick={() => requestSort("role")}
                      className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    >
                      역할{getSortIndicator("role")}
                    </th>
                    <th
                      onClick={() => requestSort("cellName")}
                      className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    >
                      셀{getSortIndicator("cellName")}
                    </th>
                    <th
                      onClick={() => requestSort("joinYear")}
                      className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    >
                      등록연도{getSortIndicator("joinYear")}
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="relative px-4 sm:px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {memberPage.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500"
                      >
                        조건에 맞는 멤버가 없습니다. 필터를 변경해 보세요.
                      </td>
                    </tr>
                  ) : (
                    memberPage.content.map((member) => (
                      <tr
                        key={member.id}
                        className={
                          !member.active ? "bg-gray-100 text-gray-500" : ""
                        }
                      >
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm font-medium">
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}`)
                            }
                            className={`font-semibold ${
                              !member.active
                                ? "text-gray-500"
                                : "text-indigo-600 hover:text-indigo-900"
                            }`}
                          >
                            {formatDisplayName(member, memberPage.content)}
                          </button>
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm">
                          <span
                            className={`px-2 inline-flex text-[11px] sm:text-xs leading-5 font-semibold rounded-full ${
                              member.role === "EXECUTIVE"
                                ? "bg-red-100 text-red-800"
                                : member.role === "CELL_LEADER"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {translateRole(member.role)}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm">
                          {member.role === "CELL_LEADER"
                            ? leaderCellMap.get(member.id) ||
                              member.cell?.name ||
                              "N/A"
                            : member.cell?.name || "*소속 셀 없음"}
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm">
                          {member.joinYear}
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm">
                          <span
                            className={`px-2 inline-flex text-[11px] sm:text-xs leading-5 font-semibold rounded-full ${
                              member.active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-200 text-gray-800"
                            }`}
                          >
                            {member.active ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}/edit`)
                            }
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(member)}
                            className="text-red-600 hover:text-red-900"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
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

        {/* 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-sm w-full">
              <h2 className="text-lg sm:text-xl font-bold mb-4">
                멤버 삭제 확인
              </h2>
              <p className="text-sm text-gray-700 mb-2">
                정말로 &quot;
                {memberToDelete && memberPage
                  ? formatDisplayName(memberToDelete, memberPage.content)
                  : memberToDelete?.name ?? ""}
                &quot; 멤버를 삭제하시겠습니까?
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 mb-4">
                삭제 후에는 해당 멤버와 연결된 출석, 기도제목, 셀 정보 등에
                영향을 줄 수 있으니 신중하게 진행해 주세요.
              </p>
              {deleteError && (
                <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md mb-4">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
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

export default AdminUsersPage;
