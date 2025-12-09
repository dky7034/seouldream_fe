import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { memberService } from "../services/memberService";
import type { MemberDto, User } from "../types";
import { translateRole } from "../utils/roleUtils";
import { formatDisplayName } from "../utils/memberUtils";

type SortConfig = {
  key: keyof MemberDto;
  direction: "ascending" | "descending";
};

interface CellMembersManagerProps {
  user: User;
}

// 만 나이 계산 함수
const calculateAge = (birthDateString: string): number | null => {
  if (!birthDateString) return null;
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const CellMembersManager: React.FC<CellMembersManagerProps> = ({ user }) => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "name",
    direction: "ascending",
  });

  const fetchMembers = useCallback(async () => {
    if (!user.cellId) {
      setError("셀 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await memberService.getAllMembers({
        cellId: user.cellId,
        size: 200,
        active: true,
      });
      setMembers(data.content);
    } catch (err) {
      setError("셀 멤버를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user.cellId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const sortedMembers = useMemo(() => {
    if (!sortConfig.key) return members;

    const sorted = [...members].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      // null / undefined 처리: 항상 뒤로
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let compare = 0;

      if (typeof aVal === "string" && typeof bVal === "string") {
        compare = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        compare = aVal - bVal;
      } else {
        // 그 외는 문자열로 변환 후 비교 (enum 문자열 등)
        compare = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === "ascending" ? compare : -compare;
    });

    return sorted;
  }, [members, sortConfig]);

  const requestSort = (key: keyof MemberDto) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Admin 페이지들과 통일된 정렬 인디케이터
  const renderSortIndicator = (key: keyof MemberDto) => {
    const isActive = sortConfig.key === key;
    const baseClass = "ml-1 text-xs";

    if (!isActive) {
      return <span className={`${baseClass} text-gray-300`}>↕</span>;
    }

    return (
      <span className={`${baseClass} text-indigo-500`}>
        {sortConfig.direction === "ascending" ? "▲" : "▼"}
      </span>
    );
  };

  if (error) {
    return <p className="mt-4 text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">셀원 목록</h2>

      {loading && <p>로딩 중...</p>}

      {!loading && (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => requestSort("name")}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                >
                  이름
                  {renderSortIndicator("name")}
                </th>
                <th
                  onClick={() => requestSort("role")}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                >
                  역할
                  {renderSortIndicator("role")}
                </th>
                <th
                  onClick={() => requestSort("birthDate")}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                >
                  생년월일
                  {renderSortIndicator("birthDate")}
                </th>
                <th
                  onClick={() => requestSort("joinYear")}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                >
                  등록연도
                  {renderSortIndicator("joinYear")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedMembers.map((member) => (
                <tr
                  key={member.id}
                  className={!member.active ? "bg-gray-100 text-gray-500" : ""}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => navigate(`/admin/users/${member.id}`)}
                      className={`font-semibold ${
                        !member.active
                          ? "text-gray-500"
                          : "text-indigo-600 hover:text-indigo-900"
                      }`}
                    >
                      {formatDisplayName(member, sortedMembers)}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {member.birthDate}{" "}
                    {member.birthDate &&
                      `(만 ${calculateAge(member.birthDate)}세)`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {member.joinYear}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {member.active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {user.memberId === member.id && (
                      <button
                        onClick={() =>
                          navigate(`/admin/users/${member.id}/edit`)
                        }
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        수정
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sortedMembers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    셀에 등록된 멤버가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CellMembersManager;
