// src/components/dashboard/DashboardAttendanceTrendCard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { statisticsService } from "../../services/statisticsService";
import type {
  AggregatedTrendDto,
  AttendanceSummaryGroupBy,
  AttendanceStatus,
} from "../../types";
import { useAuth } from "../../hooks/useAuth";
import AttendanceTrend from "../attendance/AttendanceTrend";

type Props = {
  // 임원 대시보드: 전체 기준이면 props 없이 사용 가능
  // 셀장 대시보드: cellId를 넘겨서 “내 셀 기준”으로만 조회하게 할 수도 있음
  cellId?: number;
  memberId?: number;
  status?: AttendanceStatus;
};

const DashboardAttendanceTrendCard: React.FC<Props> = ({
  cellId,
  memberId,
  status,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<AggregatedTrendDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<AttendanceSummaryGroupBy>("MONTH");

  // 🕒 예시: 최근 6개월
  const dateRange = useMemo(() => {
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 5); // 최근 6개월 (0 포함)

    const sy = startDate.getFullYear();
    const sm = startDate.getMonth() + 1;

    const pad = (n: number) => n.toString().padStart(2, "0");

    return {
      startDate: `${sy}-${pad(sm)}-01`,
      endDate: `${endYear}-${pad(endMonth)}-31`, // 어차피 백엔드에서 실제 날짜로 잘라 쓴다면 대략 값이어도 무방
    };
  }, []);

  useEffect(() => {
    // 권한에 따라 제한하고 싶다면 여기에서 체크
    if (!user) return;

    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = {
          ...dateRange,
          groupBy,
        };
        if (cellId) params.cellId = cellId;
        if (memberId) params.memberId = memberId;
        if (status) params.status = status;

        const cleaned = Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) => v !== null && v !== "" && v !== undefined
          )
        );

        const result = await statisticsService.getAttendanceTrend(cleaned);
        setData(result);
      } catch (e) {
        console.error(e);
        setError("출석률 추이 데이터를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user, dateRange, groupBy, cellId, memberId, status]);

  if (!user) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">
          {cellId ? "내 셀 출석률 추이" : "전체 출석률 추이"}
        </h2>

        {/* 대시보드에서는 그룹 단위를 너무 많이 열어두지 말고 2~3개 정도만 */}
        <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
          <button
            type="button"
            onClick={() => setGroupBy("MONTH")}
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
              groupBy === "MONTH"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            월별
          </button>
          <button
            type="button"
            onClick={() => setGroupBy("QUARTER")}
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
              groupBy === "QUARTER"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            분기별
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-center text-gray-600 mb-4 text-sm">
          출석률 추이 로딩 중...
        </p>
      )}
      {error && (
        <p className="text-center text-red-600 mb-4 text-sm">{error}</p>
      )}

      {!loading && !error && data.length > 0 && (
        <AttendanceTrend
          data={data}
          selectedGroupBy={groupBy}
          title={cellId ? "내 셀 출석률 추이" : "전체 출석률 추이"}
          dateRange={dateRange}
        />
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-center text-gray-500 mb-4 text-sm">
          선택된 조건에 해당하는 출석률 추이 데이터가 없습니다.
        </p>
      )}
    </div>
  );
};

export default DashboardAttendanceTrendCard;
