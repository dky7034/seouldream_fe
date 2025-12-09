// src/pages/BirthdaysPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { memberService } from "../services/memberService";
import type { MemberDto, GetAllMembersParams, Page } from "../types";
import { FaBirthdayCake } from "react-icons/fa";
import { formatDisplayName } from "../utils/memberUtils";
import { useAuth } from "../hooks/useAuth";
import Pagination from "../components/Pagination"; // Import Pagination

type SortKey = "name" | "birthDate" | "cell.name";

const BirthdaysPage: React.FC = () => {
  const { user } = useAuth();
  const [birthdayPage, setBirthdayPage] = useState<Page<MemberDto> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "ascending" | "descending";
  }>({
    key: "birthDate",
    direction: "ascending",
  });

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

  useEffect(() => {
    setCurrentPage(0);
  }, [selectedMonth, sortConfig]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const requestSort = (key: SortKey) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <FaBirthdayCake className="mr-3 text-pink-500" />
          월별 생일자
        </h1>
        <div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="p-2 border rounded-md"
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

      {loading ? (
        <p>로딩 중...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-700">
            <strong>{selectedMonth}월 생일자:</strong> 총{" "}
            {birthdayPage?.totalElements ?? 0}명
          </div>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
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
                {birthdayPage && birthdayPage.content.length > 0 ? (
                  birthdayPage.content.map((member) => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <Link
                          to={`/admin/users/${member.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {formatDisplayName(member, birthdayPage.content)}
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
          {birthdayPage && birthdayPage.totalPages > 1 && (
            <Pagination
              currentPage={birthdayPage.number}
              totalPages={birthdayPage.totalPages}
              onPageChange={setCurrentPage}
              totalElements={birthdayPage.totalElements}
            />
          )}
        </>
      )}
    </div>
  );
};

export default BirthdaysPage;
