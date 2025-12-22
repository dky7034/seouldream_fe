import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { attendanceService } from "../services/attendanceService";
import type {
  MemberAttendanceSummaryDto,
  MemberPeriodSummaryDto,
  GroupBy,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { translateAttendanceStatus } from "../utils/attendanceUtils";

type SortConfig = {
  key: keyof MemberPeriodSummaryDto;
  direction: "ascending" | "descending";
};

const MemberAttendanceHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MemberAttendanceSummaryDto | null>(
    null
  );

  const today = new Date();
  const oneYearAgo = new Date(new Date().setFullYear(today.getFullYear() - 1));

  const [startDate, setStartDate] = useState(
    oneYearAgo.toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

  const [groupBy, setGroupBy] = useState<GroupBy>("DAY");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "dateGroup",
    direction: "descending",
  });

  const fetchAttendanceHistory = useCallback(async () => {
    setError(null);

    // 1. 기본 파라미터/권한 체크
    if (!id) {
      setError("유효하지 않은 멤버 ID 입니다.");
      setLoading(false);
      return;
    }

    const memberIdNum = Number(id);
    if (Number.isNaN(memberIdNum)) {
      setError("유효하지 않은 멤버 ID 입니다.");
      setLoading(false);
      return;
    }

    if (!user) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await attendanceService.getMemberAttendanceSummary(
        memberIdNum,
        {
          startDate,
          endDate,
          groupBy,
        }
      );
      setSummary(data);
    } catch (err) {
      console.error(err);
      setError("출석 기록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id, user, startDate, endDate, groupBy]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  const sortedSummaries = useMemo(() => {
    if (!summary) return [];
    return [...summary.periodSummaries].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (aValue < bValue) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  }, [summary, sortConfig]);

  const requestSort = (key: keyof MemberPeriodSummaryDto) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof MemberPeriodSummaryDto) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  if (loading)
    return (
      <p className="mt-4 text-gray-600">
        로딩 중입니다. 잠시만 기다려 주세요...
      </p>
    );

  if (error) return <p className="mt-4 text-red-500">{error}</p>;

  if (!summary) {
    return (
      <p className="mt-4 text-red-500">출석 요약 정보를 찾을 수 없습니다.</p>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
        {summary.memberName}님 출석 기록
      </h1>

      {/* 필터 영역 */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {/* 날짜 범위 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex flex-col">
            <label
              htmlFor="startDate"
              className="block text-xs sm:text-sm font-medium text-gray-700"
            >
              시작일
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col">
            <label
              htmlFor="endDate"
              className="block text-xs sm:text-sm font-medium text-gray-700"
            >
              종료일
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* 그룹 기준 */}
        <div className="inline-flex items-center self-start sm:self-auto space-x-1 border border-gray-300 rounded-lg p-1 bg-white">
          <button
            type="button"
            onClick={() => setGroupBy("DAY")}
            className={`px-3 py-1 text-xs sm:text-sm rounded-md ${
              groupBy === "DAY"
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            일별
          </button>
          <button
            type="button"
            onClick={() => setGroupBy("MONTH")}
            className={`px-3 py-1 text-xs sm:text-sm rounded-md ${
              groupBy === "MONTH"
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            월별
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {groupBy === "DAY" ? (
                <tr>
                  <th
                    onClick={() => requestSort("dateGroup")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    날짜 {getSortIndicator("dateGroup")}
                  </th>
                  <th
                    onClick={() => requestSort("status")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    상태 {getSortIndicator("status")}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    메모
                  </th>
                </tr>
              ) : (
                <tr>
                  <th
                    onClick={() => requestSort("dateGroup")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    월 {getSortIndicator("dateGroup")}
                  </th>
                  <th
                    onClick={() => requestSort("presentCount")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    출석 {getSortIndicator("presentCount")}
                  </th>
                  <th
                    onClick={() => requestSort("absentCount")}
                    className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  >
                    결석 {getSortIndicator("absentCount")}
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedSummaries.map(
                (item: MemberPeriodSummaryDto, index: number) => (
                  <tr key={index}>
                    {groupBy === "DAY" ? (
                      <>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                          {item.dateGroup}
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm">
                          {item.status && (
                            <span
                              className={`px-2 inline-flex text-[11px] sm:text-xs leading-5 font-semibold rounded-full ${
                                item.status === "PRESENT"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {translateAttendanceStatus(item.status)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {item.memo || "-"}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                          {item.dateGroup}
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-green-600 font-semibold">
                          {item.presentCount ?? 0}
                        </td>
                        <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-red-600 font-semibold">
                          {item.absentCount ?? 0}
                        </td>
                      </>
                    )}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* 빈 상태 메시지 */}
        {sortedSummaries.length === 0 && (
          <div className="py-4 text-center text-sm text-gray-500">
            해당 기간의 출석 기록이 없습니다.
          </div>
        )}
      </div>

      {/* 뒤로 가기 버튼 */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          뒤로 가기
        </button>
      </div>
    </div>
  );
};

export default MemberAttendanceHistoryPage;
