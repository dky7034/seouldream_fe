// src/components/statistics/DemographicsSection.tsx
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DashboardDemographicsDto } from "../types";

interface Props {
  data: DashboardDemographicsDto;
}

export const DemographicsSection: React.FC<Props> = ({ data }) => {
  // 데이터 개수에 따라 차트의 최소 너비를 동적으로 계산 (항목당 40px 확보)
  // 데이터가 적으면 기본 800px, 많으면 그만큼 늘어남 -> 가로 스크롤 생성용
  const minChartWidth = Math.max(data.distribution.length * 40, 800);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. 상단 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <SummaryCard label="전체 성도" value={data.totalMemberCount} />
        <SummaryCard label="셀 배정 인원" value={data.cellMemberCount} />
        <SummaryCard label="활성 셀" value={data.totalCellCount} />
        <SummaryCard
          label="지난 학기 대비"
          value={data.previousSemesterCount}
          isChange
        />
      </div>

      {/* 2. 연령대 분포 */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">연령대별 구성</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
          <AgeGroupBadge
            label="10대 이하"
            count={data.count10sAndUnder}
            total={data.cellMemberCount}
            color="bg-blue-100 text-blue-800"
          />
          <AgeGroupBadge
            label="20대"
            count={data.count20s}
            total={data.cellMemberCount}
            color="bg-green-100 text-green-800"
          />
          <AgeGroupBadge
            label="30대"
            count={data.count30s}
            total={data.cellMemberCount}
            color="bg-yellow-100 text-yellow-800"
          />
          <AgeGroupBadge
            label="40대 이상"
            count={data.count40sAndOver}
            total={data.cellMemberCount}
            color="bg-purple-100 text-purple-800"
          />
        </div>
      </div>

      {/* 3. 출생년도별 성별 분포 차트 */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            출생년도별 분포
          </h3>
          <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1">
            <span>↔️</span> 좌우로 스크롤하여 모든 연도를 확인하세요.
          </p>
        </div>

        {/* 차트 영역 (가로 스크롤 가능) */}
        <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
          {/* ✅ 핵심 수정: 여기서 height를 "400px"로 고정해야 에러가 안 납니다. */}
          <div style={{ height: "400px", minWidth: `${minChartWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.distribution}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                barSize={16}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="birthYear"
                  interval={0} // 모든 라벨 표시
                  angle={-45} // 라벨 기울기
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12, fill: "#4b5563" }}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(229, 231, 235, 0.4)" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    padding: "12px",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px" }} />
                <Bar
                  dataKey="maleCount"
                  name="형제"
                  stackId="a"
                  fill="#60a5fa"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="femaleCount"
                  name="자매"
                  stackId="a"
                  fill="#f472b6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 서브 컴포넌트 ---

const SummaryCard = ({
  label,
  value,
  isChange = false,
}: {
  label: string;
  value: number;
  isChange?: boolean;
}) => (
  <div className="bg-white p-3 md:p-4 rounded-lg shadow border border-gray-100 flex flex-col justify-between h-full">
    <div className="text-xs md:text-sm text-gray-500 mb-1 break-keep">
      {label}
    </div>
    <div
      className={`text-xl md:text-2xl font-bold ${
        isChange ? "text-gray-400" : "text-gray-900"
      }`}
    >
      {isChange && value === 0 ? "-" : value.toLocaleString()}
    </div>
  </div>
);

const AgeGroupBadge = ({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) => {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
  return (
    <div className={`p-3 rounded-lg flex flex-col justify-center ${color}`}>
      <div className="text-xs font-semibold mb-1">{label}</div>
      <div className="text-lg md:text-xl font-bold">{count}명</div>
      <div className="text-xs opacity-75 mt-auto">{percentage}%</div>
    </div>
  );
};
