// src/components/CellMembersManager.tsx
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
  allMembers: { id: number; name: string; birthDate?: string }[];
}

// ✅ [추가] 날짜 포맷팅 함수 (KST 적용)
const safeFormatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  // T는 있는데 Z가 없으면 Z를 붙여줌 (UTC 인식 유도 -> 브라우저가 KST 변환)
  const targetStr =
    dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;

  const date = new Date(targetStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ✅ [수정] 만 나이 계산 함수 (safeFormatDate 사용)
const calculateAge = (birthDateString: string): number | null => {
  if (!birthDateString) return null;
  // KST로 변환된 날짜 문자열 사용
  const formattedDate = safeFormatDate(birthDateString);
  if (!formattedDate) return null;

  const birthDate = new Date(formattedDate);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const CellMembersManager: React.FC<CellMembersManagerProps> = ({
  user,
  allMembers,
}) => {
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

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let compare = 0;

      if (typeof aVal === "string" && typeof bVal === "string") {
        compare = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        compare = aVal - bVal;
      } else {
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

  return (
    <div className="space-y-6">
      {/* 헤더 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">셀원 목록</h2>
          <p className="mt-1 text-sm text-gray-500">
            현재 셀에 속한 멤버 정보를 확인할 수 있습니다.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-center mt-4 text-sm text-red-600">{error}</p>
      )}

      {loading && !error && (
        <p className="text-center mt-4 text-sm text-gray-500">로딩 중...</p>
      )}

      {!loading && !error && (
        <>
          {/* ✅ 모바일: 카드형 리스트 */}
          <div className="sm:hidden space-y-3">
            {sortedMembers.map((member) => {
              const age = calculateAge(member.birthDate || "");
              const isMe = user.memberId === member.id;

              const found = allMembers.find((am) => am.id === member.id);
              const displayName = found
                ? formatDisplayName(found, allMembers)
                : member.name;

              // ✅ 날짜 포맷팅 적용
              const displayBirthDate = safeFormatDate(member.birthDate);

              return (
                <div
                  key={member.id}
                  onClick={() => navigate(`/admin/users/${member.id}`)}
                  className={`w-full text-left bg-white rounded-lg shadow-sm px-4 py-3 border ${
                    !member.active ? "opacity-70 bg-gray-50" : ""
                  }`}
                >
                  {/* 상단: 이름 + 역할 뱃지 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-gray-900 text-sm">
                      {displayName}
                      {isMe && (
                        <span className="ml-2 text-[11px] text-indigo-600 font-medium">
                          나
                        </span>
                      )}
                    </div>
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
                  </div>

                  {/* 중간: 생년월일 / 나이 / 등록연도 */}
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">생년월일</span>
                      <span>
                        {displayBirthDate
                          ? `${displayBirthDate}${
                              age != null ? ` (만 ${age}세)` : ""
                            }`
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">등록연도</span>
                      <span>{member.joinYear ?? "-"}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {sortedMembers.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500 bg-white rounded-lg shadow-sm">
                셀에 등록된 멤버가 없습니다.
              </div>
            )}
          </div>

          {/* ✅ 데스크톱: 테이블 뷰 */}
          <div className="hidden sm:block bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => requestSort("name")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    이름
                    {renderSortIndicator("name")}
                  </th>
                  <th
                    onClick={() => requestSort("role")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    역할
                    {renderSortIndicator("role")}
                  </th>
                  <th
                    onClick={() => requestSort("birthDate")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    생년월일
                    {renderSortIndicator("birthDate")}
                  </th>
                  <th
                    onClick={() => requestSort("joinYear")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    등록연도
                    {renderSortIndicator("joinYear")}
                  </th>
                  <th
                    onClick={() => requestSort("cellAssignmentDate")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    셀 배정일
                    {renderSortIndicator("cellAssignmentDate")}
                  </th>
                  <th className="relative px-4 sm:px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedMembers.map((member) => {
                  const found = allMembers.find((am) => am.id === member.id);
                  const displayName = found
                    ? formatDisplayName(found, allMembers)
                    : member.name;

                  // ✅ 날짜 포맷팅 적용
                  const displayBirthDate = safeFormatDate(member.birthDate);
                  const displayAssignedDate = safeFormatDate(
                    member.cellAssignmentDate
                  );

                  return (
                    <tr
                      key={member.id}
                      className={
                        !member.active ? "bg-gray-100 text-gray-500" : ""
                      }
                    >
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => navigate(`/admin/users/${member.id}`)}
                          className={`font-semibold ${
                            !member.active
                              ? "text-gray-500 cursor-default"
                              : "text-indigo-600 hover:text-indigo-900"
                          }`}
                        >
                          {displayName}
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
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
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        {displayBirthDate}{" "}
                        {displayBirthDate &&
                          `(만 ${calculateAge(member.birthDate || "")}세)`}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        {member.joinYear}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        {displayAssignedDate || "미배정"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {/* 수정 버튼 로직 제거됨 */}
                      </td>
                    </tr>
                  );
                })}
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
        </>
      )}
    </div>
  );
};

export default CellMembersManager;
