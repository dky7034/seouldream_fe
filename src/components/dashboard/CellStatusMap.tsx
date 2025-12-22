// src/components/dashboard/CellStatusMap.tsx
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { FaSquare, FaCheckCircle } from "react-icons/fa";
import type { CellAttendanceSummaryDto } from "../../types";

interface CellStatusMapProps {
  cellSummaries: CellAttendanceSummaryDto[];
}

const CellStatusMap: React.FC<CellStatusMapProps> = ({ cellSummaries }) => {
  // 가나다순 정렬 (중립적)
  const sortedCells = useMemo(() => {
    return [...cellSummaries].sort((a, b) =>
      a.cellName.localeCompare(b.cellName, "ko")
    );
  }, [cellSummaries]);

  // 상태 판별 헬퍼
  const getStatusColor = (rate: number) => {
    if (rate >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-200"; // 매우 좋음
    if (rate >= 80) return "bg-blue-50 text-blue-700 border-blue-200"; // 양호
    if (rate >= 70) return "bg-yellow-50 text-yellow-700 border-yellow-200"; // 보통
    return "bg-rose-50 text-rose-700 border-rose-200"; // 관심 필요
  };

  const getStatusLabel = (rate: number) => {
    if (rate >= 90) return "안정";
    if (rate >= 80) return "양호";
    if (rate >= 70) return "보통";
    return "관심";
  };

  if (!cellSummaries || cellSummaries.length === 0) return null;

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* 헤더 & 범례 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
          <FaSquare className="text-indigo-500" />
          전체 셀 현황 지도
        </h3>

        {/* 범례 (Legend) */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            안정(90%↑)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>양호(80%↑)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            보통(70%↑)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>관심(70%↓)
          </span>
        </div>
      </div>

      {/* 그리드 맵 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {sortedCells.map((cell) => {
          const rate = cell.totalSummary?.attendanceRate ?? 0;
          const statusClass = getStatusColor(rate);

          return (
            <Link
              key={cell.cellId}
              to={`/admin/cells/${cell.cellId}`}
              className={`flex flex-col p-3 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${statusClass}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className="font-bold text-sm truncate w-full"
                  title={cell.cellName}
                >
                  {cell.cellName}
                </span>
              </div>
              <div className="flex justify-between items-end mt-auto">
                <span className="text-[10px] opacity-80">
                  {getStatusLabel(rate)}
                </span>
                <span className="text-sm font-extrabold">
                  {rate.toFixed(0)}%
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 만약 100% 출석 셀이 있다면 칭찬 문구 추가 (긍정적 강화) */}
      {sortedCells.some(
        (c) => (c.totalSummary?.attendanceRate ?? 0) === 100
      ) && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs sm:text-sm text-gray-600">
          <FaCheckCircle className="text-emerald-500" />
          <span>
            이번 기간 <strong>출석률 100%</strong>를 달성한 셀이 있습니다!
            격려해주세요.
          </span>
        </div>
      )}
    </div>
  );
};

export default CellStatusMap;
