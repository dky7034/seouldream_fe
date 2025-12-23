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
import { FaMale, FaFemale, FaCrown, FaUserTie } from "react-icons/fa"; // 아이콘 추가
import type { DashboardDemographicsDto } from "../types";

interface Props {
  data: DashboardDemographicsDto;
}

export const DemographicsSection: React.FC<Props> = ({ data }) => {
  // 1. 데이터 개수에 따라 차트 너비 계산
  const minChartWidth = Math.max(data.distribution.length * 40, 800);

  // 2. distribution 데이터를 순회하여 20대/30대 남녀 인원 직접 집계
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = {
      age20s: { male: 0, female: 0, total: 0 },
      age30s: { male: 0, female: 0, total: 0 },
    };

    data.distribution.forEach((item) => {
      // 연 나이(Year Age) 계산
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
    <div className="space-y-4 md:space-y-6">
      {/* ✅ [수정됨] 상단 요약 카드 (4열 그리드)
        - 활성 셀(Total Cell) 제거
        - 지난 학기 대비 제거 (또는 필요 시 5열로 확장 가능)
        - 임원단, 셀장 추가
      */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* 1. 전체 성도 */}
        <SummaryCard label="전체 인원" value={data.totalMemberCount} />
 
        {/* 2. 셀 배정 인원 */}
        <SummaryCard label="셀 배정 인원" value={data.cellMemberCount} />

        {/* 3. [New] 임원단 */}
        <SummaryCard
          label="임원단"
          value={data.executiveCount ?? 0} // 백엔드 배포 전 대비 0 처리
          icon={<FaCrown className="text-purple-400" />}
          highlightColor="text-purple-700"
          bgColor="bg-purple-50"
          borderColor="border-purple-100"
        />

        {/* 4. [New] 셀장 */}
        <SummaryCard
          label="셀장"
          value={data.cellLeaderCount ?? 0}
          icon={<FaUserTie className="text-blue-400" />}
          highlightColor="text-blue-700"
          bgColor="bg-blue-50"
          borderColor="border-blue-100"
        />
      </div>

      {/* 2. 연령대별 상세 구성 */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          연령대별 상세 현황
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 20대 카드 */}
          <DetailAgeCard
            label="20대"
            maleCount={stats.age20s.male}
            femaleCount={stats.age20s.female}
            totalCount={stats.age20s.total}
            colorClass="bg-green-50 border-green-100"
            iconColor="text-green-600"
          />

          {/* 30대 카드 */}
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

        <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
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
                  interval={0}
                  angle={-45}
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

// --- 서브 컴포넌트 ---

// ✅ [수정됨] 아이콘과 색상 테마를 지원하도록 확장된 SummaryCard
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
    className={`${bgColor} p-3 md:p-4 rounded-lg shadow border ${borderColor} flex flex-col justify-between h-full`}
  >
    <div className="flex justify-between items-start mb-1">
      <div className="text-xs md:text-sm text-gray-500 break-keep">{label}</div>
      {icon && <div className="text-sm opacity-80">{icon}</div>}
    </div>
    <div className={`text-xl md:text-2xl font-bold ${highlightColor}`}>
      {value.toLocaleString()}
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
}) => {
  return (
    <div
      className={`p-5 rounded-xl border ${colorClass} flex flex-col justify-between h-full`}
    >
      {/* 헤더: 연령대 제목 & 전체 인원 */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col">
          <span
            className={`text-sm font-bold tracking-wider opacity-70 ${iconColor}`}
          >
            연령대
          </span>
          <span className="text-2xl font-extrabold text-gray-800">{label}</span>
        </div>
        <div className="text-right">
          <span className="block text-3xl font-bold text-gray-900">
            {totalCount}
          </span>
          <span className="text-xs text-gray-500 font-medium">전체 인원</span>
        </div>
      </div>

      {/* 구분선 */}
      <div className="w-full h-px bg-black/5 mb-4" />

      {/* 바디: 남/여 상세 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 남자 */}
        <div className="flex items-center gap-3 bg-white/60 p-3 rounded-lg">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
            <FaMale size={18} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-semibold">남자</div>
            <div className="text-lg font-bold text-gray-800">{maleCount}명</div>
          </div>
        </div>

        {/* 여자 */}
        <div className="flex items-center gap-3 bg-white/60 p-3 rounded-lg">
          <div className="p-2 bg-pink-100 text-pink-600 rounded-full">
            <FaFemale size={18} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-semibold">여자</div>
            <div className="text-lg font-bold text-gray-800">
              {femaleCount}명
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
