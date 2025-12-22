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

// [수정] Props 인터페이스: allMembers 추가
interface CellMembersManagerProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
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

const CellMembersManager: React.FC<CellMembersManagerProps> = ({
  user,
  allMembers, // [추가]
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
              const age =
                member.birthDate && calculateAge(member.birthDate || "");
              const isMe = user.memberId === member.id;

              // [수정] 동명이인 처리: 전체 리스트(allMembers)를 기준 비교
              const found = allMembers.find((am) => am.id === member.id);
              const displayName = found
                ? formatDisplayName(found, allMembers)
                : member.name;

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
                        {member.birthDate
                          ? `${member.birthDate}${
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

                  {/* 하단: 내 정보 수정 버튼 (경로 수정됨) */}
                  {isMe && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // ✅ 수정 페이지로 바로 이동하도록 변경
                          navigate(`/admin/users/${member.id}/edit`);
                        }}
                        className="text-[11px] px-3 py-1 rounded-md border border-indigo-500 text-indigo-600 hover:bg-indigo-50"
                      >
                        내 정보 수정
                      </button>
                    </div>
                  )}
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
                  // [수정] 동명이인 처리
                  const found = allMembers.find((am) => am.id === member.id);
                  const displayName = found
                    ? formatDisplayName(found, allMembers)
                    : member.name;

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
                        {member.birthDate}{" "}
                        {member.birthDate &&
                          `(만 ${calculateAge(member.birthDate)}세)`}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        {member.joinYear}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                        {member.cellAssignmentDate || "미배정"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {/* 내 정보일 때만 수정 버튼 보임 */}
                        {user.memberId === member.id && (
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}/edit`)
                            }
                            className="text-indigo-600 hover:text-indigo-900 mr-2 sm:mr-4"
                          >
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sortedMembers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
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
