// src/components/CellMembersManager.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { memberService } from "../services/memberService";
import type { MemberDto, User } from "../types";
import { translateRole } from "../utils/roleUtils";
import { formatDisplayName } from "../utils/memberUtils";
import {
  UserCircleIcon,
  CakeIcon,
  CalendarDaysIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";

type SortConfig = {
  key: keyof MemberDto;
  direction: "ascending" | "descending";
};

interface CellMembersManagerProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

// ✅ 날짜 포맷팅 함수 (KST 적용)
const safeFormatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  const targetStr =
    dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;
  const date = new Date(targetStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    const baseClass = "ml-1 text-xs inline-block align-middle";
    if (!isActive)
      return <span className={`${baseClass} text-gray-300`}>↕</span>;
    return (
      <span className={`${baseClass} text-indigo-500`}>
        {sortConfig.direction === "ascending" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 헤더 영역 */}
      <div className="bg-white px-5 py-4 border-b border-gray-100 sm:rounded-t-2xl sm:border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
            <UserCircleIcon className="h-6 w-6 text-indigo-500" />
            셀원 목록
            <span className="bg-indigo-100 text-indigo-700 text-xs py-0.5 px-2.5 rounded-full font-bold">
              {members.length}
            </span>
          </h2>
          <p className="mt-1 text-sm text-gray-500 whitespace-nowrap sm:whitespace-normal truncate sm:overflow-visible">
            셀에 배정된 모든 멤버 정보를 관리합니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl text-center border border-red-100">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ✅ 모바일: 카드형 리스트 (최적화됨) */}
          <div className="sm:hidden space-y-3 px-1">
            {sortedMembers.map((member) => {
              const isMe = user.memberId === member.id;
              const found = allMembers.find((am) => am.id === member.id);
              const displayName = found
                ? formatDisplayName(found, allMembers)
                : member.name;
              const displayBirthDate = safeFormatDate(member.birthDate);
              const ageDisplay =
                member.age !== undefined && member.age !== null
                  ? `(만 ${member.age}세)`
                  : "";

              return (
                <div
                  key={member.id}
                  onClick={() => navigate(`/admin/users/${member.id}`)}
                  className={`relative w-full text-left bg-white rounded-2xl shadow-sm p-4 border border-gray-100 active:scale-[0.98] transition-all ${
                    !member.active ? "opacity-75 bg-gray-50" : ""
                  }`}
                >
                  {/* 상단: 이름 + 역할 뱃지 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-lg font-bold ${
                          isMe
                            ? "bg-indigo-100 text-indigo-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {displayName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-base truncate">
                            {displayName}
                          </span>
                          {isMe && (
                            <span className="flex-shrink-0 text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 whitespace-nowrap">
                              나
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                              member.role === "EXECUTIVE"
                                ? "bg-red-50 text-red-700"
                                : member.role === "CELL_LEADER"
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {translateRole(member.role)}
                          </span>
                          {!member.active && (
                            <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-500 text-[10px] font-bold whitespace-nowrap">
                              비활동
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 하단: 정보 그리드 (whitespace-nowrap 적용) */}
                  <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-500 border-t border-gray-50 pt-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CakeIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate whitespace-nowrap">
                        {displayBirthDate || "-"} {ageDisplay}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CalendarDaysIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate whitespace-nowrap">
                        {member.joinYear ? `${member.joinYear}년 등록` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2 min-w-0">
                      <ClockIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate whitespace-nowrap">
                        배정일:{" "}
                        {safeFormatDate(member.cellAssignmentDate) || "미배정"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {sortedMembers.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                셀에 등록된 멤버가 없습니다.
              </div>
            )}
          </div>

          {/* ✅ 데스크톱: 테이블 뷰 */}
          <div className="hidden sm:block bg-white shadow-sm rounded-b-2xl border-x border-b border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  {[
                    { key: "name", label: "이름" },
                    { key: "role", label: "역할" },
                    { key: "birthDate", label: "생년월일" },
                    { key: "joinYear", label: "등록연도" },
                    { key: "cellAssignmentDate", label: "셀 배정일" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => requestSort(col.key as keyof MemberDto)}
                      className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      {col.label}{" "}
                      {renderSortIndicator(col.key as keyof MemberDto)}
                    </th>
                  ))}
                  <th className="relative px-6 py-3">
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
                  const displayBirthDate = safeFormatDate(member.birthDate);
                  const displayAssignedDate = safeFormatDate(
                    member.cellAssignmentDate
                  );
                  const ageDisplay =
                    member.age !== undefined && member.age !== null
                      ? `(만 ${member.age}세)`
                      : "";

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer group ${
                        !member.active ? "bg-gray-50 text-gray-400" : ""
                      }`}
                      onClick={() => navigate(`/admin/users/${member.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {displayName}
                          </div>
                          {user.memberId === member.id && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                              나
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full whitespace-nowrap ${
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
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {displayBirthDate}{" "}
                        <span className="text-xs text-gray-400">
                          {ageDisplay}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {member.joinYear}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {displayAssignedDate || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className="text-indigo-600 hover:text-indigo-900 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          상세보기 &rarr;
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {sortedMembers.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-400"
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
