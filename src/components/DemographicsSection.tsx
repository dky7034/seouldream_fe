import React, { useMemo } from "react";
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
import { FaCrown, FaUserTie, FaUserSlash, FaUserCheck } from "react-icons/fa";
import type { DashboardDemographicsDto } from "../types";

interface Props {
  data: DashboardDemographicsDto;
  onUnassignedClick?: () => void;
}

export const DemographicsSection: React.FC<Props> = ({
  data,
  onUnassignedClick,
}) => {
  // 1. 차트 너비 계산 (항목당 너비 확보)
  const minChartWidth = Math.max(data.distribution.length * 40, 800);

  // 2. 미배정 인원 계산
  const unassignedCount = data.totalMemberCount - data.cellMemberCount;

  // 3. 연령대별 집계
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = {
      age20s: { male: 0, female: 0, total: 0 },
      age30s: { male: 0, female: 0, total: 0 },
    };

    data.distribution.forEach((item) => {
      const age = currentYear - item.birthYear;
      if (age >= 20 && age <= 29) {
        result.age20s.male += item.maleCount;
        result.age20s.female += item.femaleCount;
        result.age20s.total += item.maleCount + item.femaleCount;
      } else if (age >= 30 && age <= 39) {
        result.age30s.male += item.maleCount;
        result.age30s.female += item.femaleCount;
        result.age30s.total += item.maleCount + item.femaleCount;
      }
    });
    return result;
  }, [data.distribution]);

  return (
    <div className="space-y-6">
      {/* 🔹 1. 상단 요약 카드 그리드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        {/* 전체 인원 */}
        <SummaryCard label="전체 인원" value={data.totalMemberCount} />

        {/* 미배정 인원 (클릭 가능) */}
        <div
          onClick={onUnassignedClick}
          className={`${
            onUnassignedClick
              ? "cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform"
              : ""
          } h-full`}
        >
          <SummaryCard
            label="미배정"
            value={unassignedCount}
            icon={<FaUserSlash className="text-orange-400" />}
            highlightColor="text-orange-600"
            bgColor="bg-orange-50"
            borderColor="border-orange-100"
          />
        </div>

        {/* 셀 배정 */}
        <SummaryCard
          label="셀 배정"
          value={data.cellMemberCount}
          icon={<FaUserCheck className="text-green-400" />}
          highlightColor="text-green-700"
          bgColor="bg-green-50"
          borderColor="border-green-100"
        />

        {/* 임원단 */}
        <SummaryCard
          label="임원단"
          value={data.executiveCount ?? 0}
          icon={<FaCrown className="text-purple-400" />}
          highlightColor="text-purple-700"
          bgColor="bg-purple-50"
          borderColor="border-purple-100"
        />

        {/* 셀장 */}
        <SummaryCard
          label="셀장"
          value={data.cellLeaderCount ?? 0}
          icon={<FaUserTie className="text-blue-400" />}
          highlightColor="text-blue-700"
          bgColor="bg-blue-50"
          borderColor="border-blue-100"
        />
      </div>

      {/* 🔹 2. 하단 상세 내용 */}
      {/* (1) 연령대별 현황 */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">연령대별 현황</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailAgeCard
            label="20대"
            maleCount={stats.age20s.male}
            femaleCount={stats.age20s.female}
            totalCount={stats.age20s.total}
            colorClass="bg-green-50 border-green-100"
            iconColor="text-green-600"
          />
          <DetailAgeCard
            label="30대"
            maleCount={stats.age30s.male}
            femaleCount={stats.age30s.female}
            totalCount={stats.age30s.total}
            colorClass="bg-yellow-50 border-yellow-100"
            iconColor="text-yellow-600"
          />
        </div>
      </div>

      {/* (2) 출생년도별 분포 차트 */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800">출생년도별 분포</h3>
          <p className="text-sm text-gray-500 mt-1">
            스크롤하여 전체 연령 분포를 확인하세요.
          </p>
        </div>

        {/* 차트 영역 */}
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <div style={{ height: "400px", minWidth: `${minChartWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.distribution}
                // 💡 상단 마진을 30으로 늘려 '(명)' 라벨 공간 확보
                margin={{ top: 30, right: 10, left: 0, bottom: 5 }}
                barSize={12}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f3f4f6"
                />
                <XAxis
                  dataKey="birthYear"
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  // 💡 [변경됨] Y축 상단에 단위 표시 추가
                  label={{
                    value: "(명)",
                    position: "top",
                    offset: 15,
                    style: { fill: "#9ca3af", fontSize: "12px" },
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(243, 244, 246, 0.6)" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  // 💡 [변경됨] 툴팁 수치 뒤에도 '명' 붙이기
                  formatter={(value: number) => [`${value}명`, undefined]}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar
                  dataKey="maleCount"
                  name="남자"
                  stackId="a"
                  fill="#60a5fa"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="femaleCount"
                  name="여자"
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

// --- Sub Components ---

const SummaryCard = ({
  label,
  value,
  icon,
  highlightColor = "text-gray-900",
  bgColor = "bg-white",
  borderColor = "border-gray-100",
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  highlightColor?: string;
  bgColor?: string;
  borderColor?: string;
}) => (
  <div
    className={`${bgColor} p-4 rounded-xl shadow-sm border ${borderColor} flex flex-col justify-between h-full min-h-[100px] transition-all duration-200 hover:shadow-md`}
  >
    <div className="flex justify-between items-start mb-2">
      <div className="text-sm font-medium text-gray-500 break-keep">
        {label}
      </div>
      {icon && <div className="text-lg opacity-90">{icon}</div>}
    </div>
    <div className={`text-2xl font-bold ${highlightColor}`}>
      {value.toLocaleString()}
      <span className="text-sm font-normal text-gray-400 ml-1">명</span>
    </div>
  </div>
);

const DetailAgeCard = ({
  label,
  maleCount,
  femaleCount,
  totalCount,
  colorClass,
  iconColor,
}: {
  label: string;
  maleCount: number;
  femaleCount: number;
  totalCount: number;
  colorClass: string;
  iconColor: string;
}) => (
  <div
    className={`p-5 rounded-lg border ${colorClass} transition-all hover:shadow-sm`}
  >
    <div className="flex justify-between items-center mb-4">
      <span
        className={`text-sm font-bold px-3 py-1 rounded-full bg-white ${iconColor} shadow-sm border border-gray-100`}
      >
        {label}
      </span>
      <span className="text-2xl font-extrabold text-gray-800">
        {totalCount}명
      </span>
    </div>

    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="flex justify-between items-center bg-white/60 px-4 py-3 rounded-lg border border-gray-50/50">
        <span className="text-gray-500 font-medium">남자</span>
        <span className="font-bold text-blue-600">{maleCount}</span>
      </div>
      <div className="flex justify-between items-center bg-white/60 px-4 py-3 rounded-lg border border-gray-50/50">
        <span className="text-gray-500 font-medium">여자</span>
        <span className="font-bold text-pink-500">{femaleCount}</span>
      </div>
    </div>
  </div>
);
