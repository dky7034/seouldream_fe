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
}

/**
 * ✅ Recharts Tooltip content props는 버전별 타입 export가 흔들립니다.
 * 필요한 필드만 직접 타입으로 정의하면 가장 안전합니다.
 */
type BirthYearTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    dataKey?: string;
    value?: number | string;
  }>;
};

/**
 * 출생년도별 분포 Tooltip
 * - 남/여 + 총원(남+여) 표시
 */
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
      <div className="text-sm font-bold text-gray-700 mb-2">{label}년</div>

      {/* 총원 */}
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
        <span className="text-gray-500 font-medium">총원</span>
        <span className="font-extrabold text-gray-900">{total}명</span>
      </div>

      {/* 남/여 */}
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
}) => {
  // 1) 차트 너비 동적 계산 (데이터 많으면 가로 스크롤)
  const minChartWidth = Math.max(data.distribution.length * 45, 800);

  // 2) 미배정 인원 계산 (음수 방지)
  // NOTE: 임원단이 셀에 소속된 경우 중복 차감될 수 있으므로 Math.max 필수
  const unassignedCount = Math.max(
    0,
    data.totalMemberCount - data.cellMemberCount - (data.executiveCount ?? 0)
  );

  // 3) 연령대별(2030) 집계 로직
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = {
      age20s: { male: 0, female: 0, total: 0 },
      age30s: { male: 0, female: 0, total: 0 },
    };

    data.distribution.forEach((item) => {
      // item.birthYear: number, maleCount/femaleCount: number ✅
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
      {/* 상단 요약 카드 */}
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
            value={unassignedCount}
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
          label="임원단"
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

        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <div style={{ height: "400px", minWidth: `${minChartWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.distribution}
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

                {/* ✅ 총원 포함 Tooltip */}
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

// ─────────────────────────────────────────────────────────────
// Sub Components (디자인 유지)
// ─────────────────────────────────────────────────────────────

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
