// src/pages/BirthdaysPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { memberService } from "../services/memberService";
import type { MemberDto, GetAllMembersParams, Page } from "../types";
import { FaBirthdayCake } from "react-icons/fa";
import { formatDisplayName } from "../utils/memberUtils";
import { useAuth } from "../hooks/useAuth";
import Pagination from "../components/Pagination";

type SortKey = "name" | "birthDate" | "cell.name";

const BirthdaysPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [birthdayPage, setBirthdayPage] = useState<Page<MemberDto> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔹 URL → 초기 month 파싱
  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const monthFromUrl = Number(searchParams.get("month"));
  const initialMonth =
    !isNaN(monthFromUrl) && monthFromUrl >= 1 && monthFromUrl <= 12
      ? monthFromUrl
      : defaultMonth;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  // 🔹 URL → 초기 sortKey 파싱
  const getValidSortKey = (value: string | null): SortKey => {
    if (value === "name") return "name";
    if (value === "birthDate") return "birthDate";
    if (value === "cell.name") return "cell.name";
    return "birthDate"; // 기본값
  };

  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "ascending" | "descending";
  }>(() => {
    const key = getValidSortKey(searchParams.get("sortKey"));
    const dirParam = searchParams.get("sortDir");
    const direction: "ascending" | "descending" =
      dirParam === "descending" ? "descending" : "ascending";
    return { key, direction };
  });

  // 🔹 URL → 초기 page 파싱
  const pageFromUrl = Number(searchParams.get("page"));
  const initialPage = !isNaN(pageFromUrl) && pageFromUrl >= 0 ? pageFromUrl : 0;

  const [currentPage, setCurrentPage] = useState(initialPage);

  // 🔹 브라우저 뒤로가기/앞으로가기 등으로 쿼리가 바뀔 때 상태 동기화
  useEffect(() => {
    const key = getValidSortKey(searchParams.get("sortKey"));
    const dirParam = searchParams.get("sortDir");
    const direction: "ascending" | "descending" =
      dirParam === "descending" ? "descending" : "ascending";

    const pageParam = Number(searchParams.get("page"));
    const safePage = !isNaN(pageParam) && pageParam >= 0 ? pageParam : 0;

    const monthParam = Number(searchParams.get("month"));
    const safeMonth =
      !isNaN(monthParam) && monthParam >= 1 && monthParam <= 12
        ? monthParam
        : defaultMonth;

    setSortConfig((prev) =>
      prev.key === key && prev.direction === direction
        ? prev
        : { key, direction }
    );
    setCurrentPage((prev) => (prev === safePage ? prev : safePage));
    setSelectedMonth((prev) => (prev === safeMonth ? prev : safeMonth));
  }, [searchParams, defaultMonth]);

  const loadBirthdays = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const sortString = `${sortConfig.key},${
        sortConfig.direction === "ascending" ? "asc" : "desc"
      }`;

      const params: GetAllMembersParams = {
        month: selectedMonth,
        page: currentPage,
        size: 20,
        sort: sortString,
      };

      if (user.role === "CELL_LEADER" && user.cellId) {
        params.cellId = user.cellId;
      }

      const data = await memberService.getAllMembers(params);
      setBirthdayPage(data);
    } catch (err) {
      setError("생일자 정보를 불러오는 데 실패했습니다.");
      setBirthdayPage(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, currentPage, user, sortConfig]);

  useEffect(() => {
    loadBirthdays();
  }, [loadBirthdays]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setCurrentPage(0);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("month", String(month));
    nextParams.set("page", "0");
    nextParams.set("sortKey", sortConfig.key);
    nextParams.set("sortDir", sortConfig.direction);
    setSearchParams(nextParams);
  };

  const requestSort = (key: SortKey) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    const nextSort = { key, direction };
    setSortConfig(nextSort);
    setCurrentPage(0);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("sortKey", nextSort.key);
    nextParams.set("sortDir", nextSort.direction);
    nextParams.set("page", "0");
    nextParams.set("month", String(selectedMonth));
    setSearchParams(nextParams);
  };

  const renderSortIndicator = (key: SortKey) => {
    const isActive = sortConfig.key === key;
    if (!isActive) return <span className="ml-1 text-gray-300">↕</span>;
    return (
      <span className="ml-1 text-indigo-500">
        {sortConfig.direction === "ascending" ? "▲" : "▼"}
      </span>
    );
  };

  const handlePageChange = (page: number) => {
    const safePage = page < 0 ? 0 : page;
    setCurrentPage(safePage);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(safePage));
    nextParams.set("month", String(selectedMonth));
    nextParams.set("sortKey", sortConfig.key);
    nextParams.set("sortDir", sortConfig.direction);
    setSearchParams(nextParams);
  };

  const totalElements = birthdayPage?.totalElements ?? 0;
  const content = birthdayPage?.content ?? [];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 헤더 영역 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
              <FaBirthdayCake className="mr-2 sm:mr-3 text-pink-500" />
              월별 생일자
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              선택한 달 기준으로 생일자를 확인할 수 있습니다.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              조회할 달
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="block w-full md:w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 상태 영역 */}
        {loading ? (
          <div className="text-center py-10 text-gray-600">로딩 중...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-600">{error}</div>
        ) : (
          <>
            {/* 요약 정보 */}
            <div className="mb-4 text-sm text-gray-700">
              <strong>{selectedMonth}월 생일자:</strong> 총 {totalElements}명
            </div>

            {/* 모바일 카드 뷰 (md 미만) */}
            <div className="space-y-3 md:hidden">
              {content.length > 0 ? (
                content.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white rounded-lg shadow-sm p-4 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/admin/users/${member.id}`}
                        className="text-sm font-semibold text-indigo-600 hover:underline"
                      >
                        {formatDisplayName(member, content)}
                      </Link>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {member.cell?.name || "*소속 셀 없음"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      생년월일: {member.birthDate}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
                  {selectedMonth}월 생일자가 없습니다.
                </div>
              )}
            </div>

            {/* 데스크톱 테이블 뷰 (md 이상) */}
            <div className="hidden md:block">
              <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          onClick={() => requestSort("name")}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        >
                          이름{renderSortIndicator("name")}
                        </th>
                        <th
                          onClick={() => requestSort("birthDate")}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        >
                          생년월일{renderSortIndicator("birthDate")}
                        </th>
                        <th
                          onClick={() => requestSort("cell.name")}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        >
                          셀{renderSortIndicator("cell.name")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {content.length > 0 ? (
                        content.map((member) => (
                          <tr key={member.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <Link
                                to={`/admin/users/${member.id}`}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                {formatDisplayName(member, content)}
                              </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.birthDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.cell?.name || "*소속 셀 없음"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-6 py-4 text-center text-gray-500"
                          >
                            {selectedMonth}월 생일자가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 페이징 */}
            {birthdayPage && birthdayPage.totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={birthdayPage.number}
                  totalPages={birthdayPage.totalPages}
                  totalElements={birthdayPage.totalElements}
                  onPageChange={handlePageChange}
                  itemLabel="명"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BirthdaysPage;
