// src/pages/StatisticsPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FaChartLine,
  FaUserFriends,
  FaUserSlash,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaChevronRight,
} from "react-icons/fa";

import { statisticsService } from "../services/statisticsService";
import { semesterService } from "../services/semesterService";
import { dashboardService } from "../services/dashboardService";
import { DemographicsSection } from "../components/DemographicsSection";

import type {
  NewcomerStatDto,
  SemesterSummaryDto,
  UnassignedMemberDto,
  SemesterDto,
  DashboardDemographicsDto,
} from "../types";

// 스크롤바 숨김 스타일 (인라인 적용용)
const scrollbarHideStyle: React.CSSProperties = {
  msOverflowStyle: "none" /* IE and Edge */,
  scrollbarWidth: "none" /* Firefox */,
};

// --- 섹션 헤더 컴포넌트 ---
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  colorClass: string;
}> = ({ icon, title, description, colorClass }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-1">
      <div className={`p-2 rounded-lg ${colorClass}`}>{icon}</div>
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
    {description && (
      <p className="text-sm text-gray-500 ml-11">{description}</p>
    )}
  </div>
);

// --- 만 나이 계산 헬퍼 함수 ---
const calculateAge = (member: UnassignedMemberDto): number | null => {
  if (member.age !== undefined && member.age !== null && member.age !== 0) {
    return member.age;
  }
  if (member.birthDate) {
    const today = new Date();
    const birthDate = new Date(member.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  if (member.birthYear) {
    return new Date().getFullYear() - Number(member.birthYear);
  }
  return null;
};

// --- CustomTooltip ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const countData = payload.find((p: any) => p.dataKey === "count");
    const growthData = payload.find((p: any) => p.dataKey === "growthRate");

    return (
      <div className="bg-white p-4 border border-gray-100 shadow-xl rounded-xl min-w-[150px]">
        <p className="text-sm font-bold text-gray-700 mb-2">{label}</p>
        <div className="space-y-1">
          {countData && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center text-gray-500">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mr-2" />
                등록 인원
              </span>
              <span className="font-bold text-gray-800">
                {countData.value}명
              </span>
            </div>
          )}
          {growthData && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center text-gray-500">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
                증감률
              </span>
              <span
                className={`font-bold ${
                  growthData.value > 0
                    ? "text-red-500"
                    : growthData.value < 0
                    ? "text-blue-500"
                    : "text-gray-500"
                }`}
              >
                {/* 소수점 제거하여 정수로 표시 */}
                {Number(growthData.value).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// --- NewcomerGrowthChart ---
const NewcomerGrowthChart = React.memo(
  ({ data }: { data: NewcomerStatDto[] }) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-[350px] w-full bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-400 bg-opacity-50">
          <FaChartLine size={48} className="mb-4 opacity-20" />
          <p>데이터가 없습니다.</p>
        </div>
      );
    }

    return (
      <div className="h-[350px] w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-500 mb-2 px-2">
          월별 등록 추이 분석
        </h3>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="label"
                scale="band"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                dx={-10}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                unit="%"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                dx={10}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "transparent" }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value) => (
                  <span className="text-sm text-gray-500 font-medium ml-1">
                    {value}
                  </span>
                )}
              />
              <Bar
                yAxisId="left"
                dataKey="count"
                name="등록 인원"
                barSize={32}
                fill="url(#colorCount)"
                radius={[6, 6, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="growthRate"
                name="증감률"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
);

// --- AgeGroupPieChart ---
const AgeGroupPieChart = React.memo(
  ({ data }: { data: SemesterSummaryDto["ageGroupSummary"] }) => {
    const total = data.twenties + data.thirties;

    if (total === 0) {
      return (
        <div className="h-[200px] w-full flex items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
          데이터 없음
        </div>
      );
    }

    const chartData = [
      { name: "20대", value: data.twenties, color: "#86efac" },
      { name: "30대", value: data.thirties, color: "#fde047" },
    ];

    return (
      <div className="h-[200px] w-full flex items-center justify-center">
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
);

// --- GenderRatioChart ---
const GenderRatioChart = React.memo(
  ({ data }: { data: DashboardDemographicsDto }) => {
    const { male, female } = useMemo(() => {
      let m = 0;
      let f = 0;
      data.distribution.forEach((item) => {
        m += item.maleCount;
        f += item.femaleCount;
      });
      return { male: m, female: f };
    }, [data]);

    const total = male + female;

    if (total === 0) {
      return (
        <div className="h-[200px] w-full flex items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
          데이터 없음
        </div>
      );
    }

    const chartData = [
      { name: "남자", value: male, color: "#60a5fa" },
      { name: "여자", value: female, color: "#f472b6" },
    ];

    return (
      <div className="h-[200px] w-full flex items-center justify-center">
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
);

// --- 메인 페이지 ---
const StatisticsPage: React.FC = () => {
  const navigate = useNavigate();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    null
  );

  const [newcomerStats, setNewcomerStats] = useState<NewcomerStatDto[]>([]);
  const [semesterSummary, setSemesterSummary] =
    useState<SemesterSummaryDto | null>(null);

  const [detailDemographics, setDetailDemographics] =
    useState<DashboardDemographicsDto | null>(null);
  const [unassignedList, setUnassignedList] = useState<UnassignedMemberDto[]>(
    []
  );

  // 1. 학기 목록 로딩 (모든 학기 조회)
  useEffect(() => {
    semesterService.getAllSemesters().then((list) => {
      // 최신순 정렬
      const sortedList = list.sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      setSemesters(sortedList);

      if (sortedList.length > 0) {
        // 현재 날짜가 포함된 학기를 찾거나, 없으면 최신 학기를 선택
        const today = new Date();
        const currentMonthTotal =
          today.getFullYear() * 12 + (today.getMonth() + 1);

        const currentSemester = sortedList.find((s) => {
          const start = new Date(s.startDate);
          const end = new Date(s.endDate);
          const startMonthTotal =
            start.getFullYear() * 12 + (start.getMonth() + 1);
          const endMonthTotal = end.getFullYear() * 12 + (end.getMonth() + 1);

          return (
            currentMonthTotal >= startMonthTotal &&
            currentMonthTotal <= endMonthTotal
          );
        });

        const targetId = currentSemester
          ? currentSemester.id
          : sortedList[0].id;
        setSelectedSemesterId(targetId);
      } else {
        setIsInitialLoading(false);
      }
    });
  }, []);

  // 2. 데이터 Fetching
  useEffect(() => {
    if (!selectedSemesterId) return;
    let ignore = false;

    const fetchData = async () => {
      if (!isInitialLoading) setIsRefetching(true);

      try {
        const semester = semesters.find((s) => s.id === selectedSemesterId);
        if (!semester) return;

        // 미래 날짜 제한 로직 (Today Cap)
        const { startDate, endDate } = semester;
        const today = new Date();
        const endObj = new Date(endDate);

        today.setHours(23, 59, 59, 999);
        endObj.setHours(23, 59, 59, 999);

        // 오늘보다 미래라면, 오늘 날짜로 잘라서 API 요청
        const effectiveEndDate =
          endObj > today
            ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
                2,
                "0"
              )}-${String(today.getDate()).padStart(2, "0")}`
            : endDate;

        const [newcomers, summary, dashboardData, unassigned] =
          await Promise.all([
            statisticsService.getNewcomerStats(
              "MONTH",
              startDate,
              effectiveEndDate
            ),
            statisticsService.getSemesterSummary(selectedSemesterId),
            dashboardService.getDashboardData("SEMESTER", {
              startDate,
              endDate: effectiveEndDate,
            }),
            statisticsService.getUnassignedMembers(),
          ]);

        if (ignore) return;

        setNewcomerStats(newcomers);
        setSemesterSummary(summary);
        if (dashboardData.demographics) {
          setDetailDemographics(dashboardData.demographics);
        }

        // 임원(EXECUTIVE) 제외 필터링
        const filteredUnassigned = (unassigned as any[]).filter(
          (m) => m.role !== "EXECUTIVE"
        );
        setUnassignedList(filteredUnassigned);
      } catch (error) {
        if (!ignore) console.error("통계 데이터 로드 실패:", error);
      } finally {
        if (!ignore) {
          setIsInitialLoading(false);
          setIsRefetching(false);
        }
      }
    };

    fetchData();
    return () => {
      ignore = true;
    };
  }, [selectedSemesterId, semesters, isInitialLoading]);

  // 파생 데이터
  const { totalNewcomers, lastNewcomerStat } = useMemo(() => {
    const total = newcomerStats.reduce((acc, cur) => acc + cur.count, 0);
    const last =
      newcomerStats.length > 0 ? newcomerStats[newcomerStats.length - 1] : null;
    return { totalNewcomers: total, lastNewcomerStat: last };
  }, [newcomerStats]);

  const processedUnassignedList = useMemo(() => {
    return unassignedList.map((member) => ({
      ...member,
      displayAge: calculateAge(member),
    }));
  }, [unassignedList]);

  const scrollToUnassigned = () => {
    const element = document.getElementById("unassigned-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500" />
      </div>
    );
  }

  if (!isInitialLoading && semesters.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500">
        등록된 학기 정보가 없습니다. 관리자에게 문의하세요.
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 & 필터 (모바일 최적화: 가로 스크롤 칩) */}
        <div className="mb-8 space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 whitespace-nowrap">
              통계 및 리포트
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              공동체의 성장 흐름과 구성원 현황을 상세하게 분석합니다.
            </p>
          </div>

          <div className="border-t border-gray-200/50 pt-4">
            <div className="flex justify-between items-end mb-2">
              <label className="text-xs font-bold text-gray-500">
                학기 선택
              </label>
              <span className="text-[10px] text-gray-400 font-normal sm:hidden">
                좌우로 스크롤하여 선택
              </span>
            </div>

            <div
              className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap scrollbar-hide"
              style={scrollbarHideStyle}
            >
              {semesters.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSemesterId(s.id)}
                  className={`
                    flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm whitespace-nowrap
                    ${
                      selectedSemesterId === s.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-1 ring-indigo-600"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }
                  `}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      s.isActive ? "bg-green-400" : "bg-gray-300"
                    }`}
                  ></span>
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 영역 */}
        <div
          className={`space-y-10 transition-opacity duration-200 ${
            isRefetching ? "opacity-50 pointer-events-none" : "opacity-100"
          }`}
        >
          {/* 섹션 1: 변화 리포트 */}
          <section>
            <SectionHeader
              icon={<FaChartLine size={20} />}
              title="변화 리포트"
              description="선택하신 학기의 월별 등록 추이와 전월 대비 성장률을 분석하여 공동체의 양적 성장 흐름을 파악합니다."
              colorClass="bg-indigo-100 text-indigo-600"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <NewcomerGrowthChart data={newcomerStats} />
              </div>

              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold opacity-90">
                    선택 기간 새가족
                  </h3>
                  <div className="text-4xl font-bold mt-2">
                    {totalNewcomers}명
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                    <p className="text-sm opacity-80 mb-1">
                      최근 추이 ({lastNewcomerStat?.label || "-"})
                    </p>
                    <div className="flex items-center text-lg font-bold">
                      {lastNewcomerStat ? (
                        <>
                          {lastNewcomerStat.growthRate > 0 ? (
                            <FaArrowUp className="mr-2 text-green-300" />
                          ) : lastNewcomerStat.growthRate < 0 ? (
                            <FaArrowDown className="mr-2 text-red-300" />
                          ) : (
                            <FaMinus className="mr-2 text-gray-300" />
                          )}
                          {Math.abs(lastNewcomerStat.growthRate).toFixed(0)}%
                          {lastNewcomerStat.growthRate > 0
                            ? " 증가"
                            : lastNewcomerStat.growthRate < 0
                            ? " 감소"
                            : " 변동 없음"}
                        </>
                      ) : (
                        "데이터 없음"
                      )}
                    </div>
                  </div>
                  <p className="text-sm opacity-75 leading-relaxed">
                    선택하신 학기 기간 동안의
                    <br /> 월별 등록 추이 및 전월 대비 증감률입니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 섹션 2: 구성원 통계 분석 */}
          <section>
            <SectionHeader
              icon={<FaUserFriends size={20} />}
              title="구성원 통계 분석"
              description="공동체의 연령대 및 성별 분포를 확인할 수 있습니다."
              colorClass="bg-green-100 text-green-600"
            />

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. 이번 학기 연령 구성비 (왼쪽) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-between">
                  <div className="w-full text-left mb-2">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      연령 구성비{" "}
                      <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        2030
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      20대/30대 비율 분포
                    </p>
                  </div>
                  {semesterSummary ? (
                    <div className="w-full max-w-[300px]">
                      <AgeGroupPieChart
                        data={semesterSummary.ageGroupSummary}
                      />
                    </div>
                  ) : (
                    <div className="h-[200px] w-full flex items-center justify-center text-gray-400">
                      데이터 로딩 중...
                    </div>
                  )}
                </div>

                {/* 2. 성별 비율 (오른쪽) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-between">
                  <div className="w-full text-left mb-2">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      성별 비율{" "}
                      <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        전체
                      </span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      남자/여자 구성 분포
                    </p>
                  </div>
                  {detailDemographics ? (
                    <div className="w-full max-w-[300px]">
                      <GenderRatioChart data={detailDemographics} />
                    </div>
                  ) : (
                    <div className="h-[200px] w-full flex items-center justify-center text-gray-400">
                      데이터 없음
                    </div>
                  )}
                </div>
              </div>

              {/* 3. 상세 지표 */}
              <div className="w-full">
                {detailDemographics ? (
                  <DemographicsSection
                    data={detailDemographics}
                    onUnassignedClick={scrollToUnassigned}
                  />
                ) : (
                  <div className="h-[200px] flex items-center justify-center bg-white rounded-lg border border-gray-100 text-gray-400">
                    데이터 로딩 중...
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 섹션 3: 셀 미배정 인원 관리 */}
          <section id="unassigned-section">
            <SectionHeader
              icon={<FaUserSlash size={20} />}
              title="셀 미배정 인원 관리"
              description="등록되었으나 아직 셀에 소속되지 않은 인원 목록입니다."
              colorClass="bg-orange-100 text-orange-600"
            />

            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-700">
                  셀 미배정 인원 목록 ({processedUnassignedList.length}명)
                </h3>
              </div>

              {/* [모바일] 리스트 뷰 */}
              <div className="block md:hidden bg-gray-50 p-3 space-y-3">
                {processedUnassignedList.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <button
                          onClick={() => navigate(`/admin/users/${member.id}`)}
                          className="text-lg font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          {member.name}
                          <FaChevronRight size={12} className="opacity-50" />
                        </button>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              member.gender === "MALE"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-pink-50 text-pink-700"
                            }`}
                          >
                            {member.gender === "MALE" ? "남자" : "여자"}
                          </span>
                          <span className="text-sm text-gray-500">
                            {member.birthDate || member.birthYear || "-"}
                            {member.displayAge !== null &&
                              ` (만 ${member.displayAge}세)`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-4">
                      <div>
                        <span className="block text-xs text-gray-400">
                          연락처
                        </span>
                        {member.phone}
                      </div>
                      <div>
                        <span className="block text-xs text-gray-400">
                          등록 연도
                        </span>
                        {member.registeredDate?.substring(0, 4) || "-"}
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/admin/users/${member.id}/edit`)}
                      className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-md text-sm font-semibold hover:bg-indigo-100 transition-colors"
                    >
                      셀 배정하기
                    </button>
                  </div>
                ))}
                {processedUnassignedList.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    미배정 인원이 없습니다.
                  </div>
                )}
              </div>

              {/* [데스크탑] 테이블 뷰 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        이름
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        성별
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        생년월일
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        연락처
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        등록 연도
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {processedUnassignedList.map((member) => (
                      <tr
                        key={member.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}`)
                            }
                            className="text-indigo-600 hover:text-indigo-900 hover:underline font-semibold"
                          >
                            {member.name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              member.gender === "MALE"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-pink-50 text-pink-700"
                            }`}
                          >
                            {member.gender === "MALE" ? "남자" : "여자"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.birthDate || member.birthYear || "-"}
                          {member.displayAge !== null ? (
                            <span className="text-gray-400 ml-1">
                              (만 {member.displayAge}세)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.registeredDate?.substring(0, 4) || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}/edit`)
                            }
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            셀 배정
                          </button>
                        </td>
                      </tr>
                    ))}
                    {processedUnassignedList.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-10 text-center text-sm text-gray-500"
                        >
                          미배정 인원이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;
