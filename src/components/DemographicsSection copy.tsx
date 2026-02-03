// src/components/DemographicsSection.tsx
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
  // ✅ [추가] 외부(DashboardPage)에서 계산된 정확한 미배정 인원수
  realUnassignedCount?: number;
}

// ... (BirthYearTooltip 컴포넌트는 기존과 동일, 생략) ...
type BirthYearTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    dataKey?: string;
    value?: number | string;
  }>;
};

const BirthYearTooltip: React.FC<BirthYearTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const getValue = (key: "maleCount" | "femaleCount") =>
    Number(payload.find((p) => p.dataKey === key)?.value ?? 0);

  const male = getValue("maleCount");
  const female = getValue("femaleCount");
  const total = male + female;

  return (
    <div
      className="rounded-xl bg-white shadow-lg border border-gray-100 px-3 py-3"
      style={{ minWidth: 160 }}
    >
      <div className="text-sm font-bold text-gray-700 mb-2">{label}년생</div>
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
        <span className="text-gray-500 font-medium">총원</span>
        <span className="font-extrabold text-gray-900">{total}명</span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">남자</span>
          <span className="font-bold text-blue-600">{male}명</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">여자</span>
          <span className="font-bold text-pink-500">{female}명</span>
        </div>
      </div>
    </div>
  );
};

export const DemographicsSection: React.FC<Props> = ({
  data,
  onUnassignedClick,
  realUnassignedCount, // ✅ 구조 분해 할당으로 받음
}) => {
  const validDistribution = useMemo(() => {
    return data.distribution.filter(
      (item) => item.maleCount + item.femaleCount > 0,
    );
  }, [data.distribution]);

  const minChartWidth = Math.max(validDistribution.length * 45, 800);

  /**
   * 3) 미배정 인원 결정 (수정됨)
   * - props로 realUnassignedCount(6명)가 들어오면 그걸 씁니다.
   * - 없으면 기존 공식대로 계산합니다.
   */
  const unassignedCount =
    realUnassignedCount !== undefined
      ? realUnassignedCount
      : Math.max(0, data.totalMemberCount - data.cellMemberCount);

  const groupStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = {
      daehak: { male: 0, female: 0, total: 0 },
      cheongnyeon: { male: 0, female: 0, total: 0 },
    };

    data.distribution.forEach((item) => {
      const koreanAge = currentYear - item.birthYear + 1;
      if (koreanAge <= 28) {
        result.daehak.male += item.maleCount;
        result.daehak.female += item.femaleCount;
        result.daehak.total += item.maleCount + item.femaleCount;
      } else {
        result.cheongnyeon.male += item.maleCount;
        result.cheongnyeon.female += item.femaleCount;
        result.cheongnyeon.total += item.maleCount + item.femaleCount;
      }
    });
    return result;
  }, [data.distribution]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <SummaryCard label="전체 인원" value={data.totalMemberCount} />

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
            value={unassignedCount} // ✅ 이제 6명으로 나옵니다
            icon={<FaUserSlash className="text-orange-400" />}
            highlightColor="text-orange-600"
            bgColor="bg-orange-50"
            borderColor="border-orange-100"
          />
        </div>

        <SummaryCard
          label="셀 배정"
          value={data.cellMemberCount}
          icon={<FaUserCheck className="text-green-400" />}
          highlightColor="text-green-700"
          bgColor="bg-green-50"
          borderColor="border-green-100"
        />

        <SummaryCard
          label="관리자"
          value={data.executiveCount ?? 0}
          icon={<FaCrown className="text-purple-400" />}
          highlightColor="text-purple-700"
          bgColor="bg-purple-50"
          borderColor="border-purple-100"
        />

        <SummaryCard
          label="셀장"
          value={data.cellLeaderCount ?? 0}
          icon={<FaUserTie className="text-blue-400" />}
          highlightColor="text-blue-700"
          bgColor="bg-blue-50"
          borderColor="border-blue-100"
        />
      </div>

      {/* ... 나머지 차트 부분은 기존과 동일하므로 그대로 두시면 됩니다 ... */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">그룹별 현황</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            기준: {new Date().getFullYear()}년
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailGroupCard
            label="대학부"
            subLabel="28세 이하"
            maleCount={groupStats.daehak.male}
            femaleCount={groupStats.daehak.female}
            totalCount={groupStats.daehak.total}
            colorClass="bg-indigo-50 border-indigo-100"
            iconColor="text-indigo-600"
            badgeColor="bg-indigo-100 text-indigo-700"
          />
          <DetailGroupCard
            label="청년부"
            subLabel="29세 이상"
            maleCount={groupStats.cheongnyeon.male}
            femaleCount={groupStats.cheongnyeon.female}
            totalCount={groupStats.cheongnyeon.total}
            colorClass="bg-teal-50 border-teal-100"
            iconColor="text-teal-600"
            badgeColor="bg-teal-100 text-teal-700"
          />
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800">출생년도별 분포</h3>
          <p className="text-sm text-gray-500 mt-1">
            가로로 스크롤하여 전체 연령 분포를 확인할 수 있습니다.
          </p>
        </div>
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <div style={{ height: "400px", minWidth: `${minChartWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={validDistribution}
                margin={{ top: 30, right: 10, left: 0, bottom: 5 }}
                barSize={16}
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
                  label={{
                    value: "(명)",
                    position: "top",
                    offset: 15,
                    style: { fill: "#9ca3af", fontSize: "12px" },
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(243, 244, 246, 0.6)" }}
                  content={<BirthYearTooltip />}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-sm text-gray-600 font-medium ml-1">
                      {value}
                    </span>
                  )}
                />
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

// Sub Components는 변경 없음 (SummaryCard, DetailGroupCard ...)
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

const DetailGroupCard = ({
  label,
  subLabel,
  maleCount,
  femaleCount,
  totalCount,
  colorClass,
  iconColor,
  badgeColor,
}: {
  label: string;
  subLabel: string;
  maleCount: number;
  femaleCount: number;
  totalCount: number;
  colorClass: string;
  iconColor: string;
  badgeColor: string;
}) => (
  <div
    className={`p-5 rounded-lg border ${colorClass} transition-all hover:shadow-sm`}
  >
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-bold px-3 py-1 rounded-full ${iconColor} bg-white shadow-sm border border-gray-100`}
        >
          {label}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeColor}`}>
          {subLabel}
        </span>
      </div>
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
