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
// ✅ types.ts에서 공식 타입 import
import type {
  DashboardDemographicsDto,
  DemographicsDistributionDto,
} from "../types";

interface Props {
  data: DashboardDemographicsDto;
  onUnassignedClick?: () => void;
  realUnassignedCount?: number;
}

// ---------------------------
// 툴팁 컴포넌트 (순수 인원 기준 표시)
// ---------------------------
type BirthYearTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    dataKey?: string;
    value?: number | string;
    payload?: any; // 원본 데이터 접근용
  }>;
};

const BirthYearTooltip: React.FC<BirthYearTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  // 차트의 Bar는 이미 계산된 'pureMale', 'pureFemale'을 사용합니다.
  const getValue = (key: string) =>
    Number(payload.find((p) => p.dataKey === key)?.value ?? 0);

  const pureMale = getValue("pureMale");
  const pureFemale = getValue("pureFemale");
  const pureTotal = pureMale + pureFemale;

  // ✅ 원본 데이터에서 관리자 수 확인 (공식 타입 사용)
  const originalData = payload[0].payload as DemographicsDistributionDto;
  const execMale = originalData.executiveMaleCount ?? 0;
  const execFemale = originalData.executiveFemaleCount ?? 0;
  const totalExec = execMale + execFemale;

  return (
    <div
      className="rounded-xl bg-white shadow-lg border border-gray-100 px-3 py-3"
      style={{ minWidth: 170 }}
    >
      <div className="text-sm font-bold text-gray-700 mb-2">{label}년생</div>

      {/* 순수 총원 강조 */}
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
        <span className="text-gray-500 font-medium text-xs">순수 인원</span>
        <span className="font-extrabold text-indigo-600">{pureTotal}명</span>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">남자</span>
          <span className="font-bold text-blue-600">{pureMale}명</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">여자</span>
          <span className="font-bold text-pink-500">{pureFemale}명</span>
        </div>

        {/* 관리자가 있는 경우 툴팁에 작게 표시 */}
        {totalExec > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed border-gray-100 text-[10px] text-gray-400">
            관리자 제외됨: 남 {execMale} / 여 {execFemale}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------
// 메인 컴포넌트
// ---------------------------
export const DemographicsSection: React.FC<Props> = ({
  data,
  onUnassignedClick,
  realUnassignedCount,
}) => {
  // 1. 차트용 데이터 가공 (성별별 관리자 제외)
  const chartData = useMemo(() => {
    // ✅ 공식 타입으로 캐스팅하여 안전하게 접근
    const distribution = data.distribution as DemographicsDistributionDto[];

    return distribution
      .map((item) => {
        const execMale = item.executiveMaleCount ?? 0;
        const execFemale = item.executiveFemaleCount ?? 0;

        // ✅ 핵심: 성별 각각에서 관리자 수를 차감 (음수 방지)
        const pureMale = Math.max(0, item.maleCount - execMale);
        const pureFemale = Math.max(0, item.femaleCount - execFemale);

        return {
          ...item,
          pureMale, // 차트용 (남자 순수)
          pureFemale, // 차트용 (여자 순수)
          pureTotal: pureMale + pureFemale, // 필터링용 합계
        };
      })
      .filter((item) => item.pureTotal > 0); // 순수 인원이 0명이면 숨김
  }, [data.distribution]);

  const minChartWidth = Math.max(chartData.length * 45, 800);

  // 2. 미배정 인원 처리
  const unassignedCount =
    realUnassignedCount !== undefined
      ? realUnassignedCount
      : Math.max(0, data.totalMemberCount - data.cellMemberCount);

  // 3. 전체 순수 멤버 수 (전체 - 전체 관리자)
  const executiveCount = data.executiveCount ?? 0;
  const pureMemberCount = data.totalMemberCount - executiveCount;

  // 4. 그룹별 통계 (대학부/청년부) - 성별까지 정확하게 계산
  const groupStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = {
      daehak: { male: 0, female: 0, total: 0 },
      cheongnyeon: { male: 0, female: 0, total: 0 },
    };

    // ✅ 공식 타입 사용
    const distribution = data.distribution as DemographicsDistributionDto[];

    distribution.forEach((item) => {
      const koreanAge = currentYear - item.birthYear + 1;

      // ✅ 성별 별로 관리자 제외하여 집계
      const pureMaleInYear = Math.max(
        0,
        item.maleCount - (item.executiveMaleCount ?? 0),
      );
      const pureFemaleInYear = Math.max(
        0,
        item.femaleCount - (item.executiveFemaleCount ?? 0),
      );
      const pureTotalInYear = pureMaleInYear + pureFemaleInYear;

      if (pureTotalInYear <= 0) return;

      if (koreanAge <= 28) {
        result.daehak.male += pureMaleInYear;
        result.daehak.female += pureFemaleInYear;
        result.daehak.total += pureTotalInYear;
      } else {
        result.cheongnyeon.male += pureMaleInYear;
        result.cheongnyeon.female += pureFemaleInYear;
        result.cheongnyeon.total += pureTotalInYear;
      }
    });
    return result;
  }, [data.distribution]);

  return (
    <div className="space-y-6">
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <SummaryCard label="전체 인원" value={pureMemberCount} />

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
          label="관리자"
          value={executiveCount}
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

      {/* 그룹별 현황 (순수 인원으로 집계된 데이터 표시) */}
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

      {/* 출생년도별 분포 차트 (정확히 깎인 막대 그래프) */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-gray-800">출생년도별 분포</h3>
            <p className="text-sm text-gray-500 mt-1">관리자 제외</p>
          </div>
          <div className="text-[11px] text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100 self-start sm:self-center">
            총 {pureMemberCount}명 (관리자 {executiveCount}명 제외)
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <div style={{ height: "400px", minWidth: `${minChartWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
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

                {/* ✅ dataKey를 계산된 순수(Pure) 인원 키값으로 설정 */}
                <Bar
                  dataKey="pureMale"
                  name="남자"
                  stackId="a"
                  fill="#60a5fa"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pureFemale"
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

// ---------------------------
// 서브 컴포넌트들 (변경 없음)
// ---------------------------
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
    className={`p-4 sm:p-5 rounded-lg border ${colorClass} transition-all hover:shadow-sm`}
  >
    <div className="flex items-center justify-between mb-4 gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`shrink-0 text-xs sm:text-sm font-bold px-2.5 py-1 rounded-full ${iconColor} bg-white shadow-sm border border-gray-100 whitespace-nowrap`}
        >
          {label}
        </span>
        <span
          className={`shrink-0 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded ${badgeColor} whitespace-nowrap`}
        >
          {subLabel}
        </span>
      </div>
      <span className="text-xl sm:text-2xl font-extrabold text-gray-800 whitespace-nowrap">
        {totalCount}
        <span className="text-xs sm:text-sm font-medium ml-0.5">명</span>
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
      <div className="flex justify-between items-center bg-white/60 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg border border-gray-50/50">
        <span className="text-gray-500 font-medium text-xs sm:text-sm">
          남자
        </span>
        <span className="font-bold text-blue-600 ml-1">{maleCount}</span>
      </div>
      <div className="flex justify-between items-center bg-white/60 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg border border-gray-50/50">
        <span className="text-gray-500 font-medium text-xs sm:text-sm">
          여자
        </span>
        <span className="font-bold text-pink-500 ml-1">{femaleCount}</span>
      </div>
    </div>
  </div>
);
