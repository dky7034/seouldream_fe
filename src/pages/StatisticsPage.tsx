import React, { useEffect, useState } from "react";
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
  FaFilter,
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

// ✅ [추가] 만 나이 계산 헬퍼 함수
// 백엔드에서 age가 null로 올 경우 프론트에서 계산
const calculateAge = (member: UnassignedMemberDto): number | null => {
  // 1. 백엔드에서 준 age가 있으면 그대로 사용
  if (member.age !== undefined && member.age !== null && member.age !== 0) {
    return member.age;
  }

  // 2. birthDate('YYYY-MM-DD')가 있으면 계산
  if (member.birthDate) {
    const today = new Date();
    const birthDate = new Date(member.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    // 생일이 안 지났으면 1살 뺌
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  // 3. birthYear만 있으면 대략 계산 (현재연도 - 태어난연도)
  if (member.birthYear) {
    return new Date().getFullYear() - Number(member.birthYear);
  }

  return null;
};

// --- 차트 컴포넌트 ---
const NewcomerGrowthChart = ({ data }: { data: NewcomerStatDto[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full bg-white p-4 rounded-lg shadow border border-gray-100 flex items-center justify-center text-gray-400">
        데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full bg-white p-4 rounded-lg shadow border border-gray-100">
      <div style={{ width: "100%", height: "100%", minHeight: "250px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
          >
            <CartesianGrid stroke="#f5f5f5" vertical={false} />
            <XAxis dataKey="label" scale="band" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#82ca9d"
              unit="%"
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px" }} />
            <Bar
              yAxisId="left"
              dataKey="count"
              name="등록 인원"
              barSize={30}
              fill="#8884d8"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="growthRate"
              name="증감률"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const AgeGroupPieChart = ({
  data,
}: {
  data: SemesterSummaryDto["ageGroupSummary"];
}) => {
  const total = data.under20s + data.twenties + data.thirties + data.over40s;

  if (total === 0) {
    return (
      <div className="h-[250px] w-full flex items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
        데이터 없음
      </div>
    );
  }

  const chartData = [
    { name: "10대 이하", value: data.under20s, color: "#93c5fd" },
    { name: "20대", value: data.twenties, color: "#86efac" },
    { name: "30대", value: data.thirties, color: "#fde047" },
    { name: "40대 이상", value: data.over40s, color: "#d8b4fe" },
  ];

  return (
    <div className="h-[250px] w-full flex items-center justify-center">
      <div style={{ width: "100%", height: "100%", minHeight: "200px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- 메인 페이지 ---
const StatisticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    semesterService.getAllSemesters().then((list) => {
      setSemesters(list);

      const today = new Date();
      const currentMonthTotal =
        today.getFullYear() * 12 + (today.getMonth() + 1);

      const currentSemester = list.find((s) => {
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

      const targetSemester =
        currentSemester || list.find((s) => s.isActive) || list[0];

      if (targetSemester) {
        setSelectedSemesterId(targetSemester.id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedSemesterId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const semester = semesters.find((s) => s.id === selectedSemesterId);
        const currentYear = new Date().getFullYear();
        const startDate = semester?.startDate || `${currentYear}-01-01`;
        const endDate = semester?.endDate || `${currentYear}-12-31`;

        const [newcomers, summary, dashboardData, unassigned] =
          await Promise.all([
            statisticsService.getNewcomerStats("MONTH", startDate, endDate),
            statisticsService.getSemesterSummary(selectedSemesterId),
            dashboardService.getDashboardData("SEMESTER", {
              startDate,
              endDate,
            }),
            statisticsService.getUnassignedMembers(),
          ]);

        setNewcomerStats(newcomers);
        setSemesterSummary(summary);

        if (dashboardData.demographics) {
          setDetailDemographics(dashboardData.demographics);
        }

        setUnassignedList(unassigned);
      } catch (error) {
        console.error("통계 데이터 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSemesterId, semesters]);

  if (loading && !semesterSummary) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500" />
      </div>
    );
  }

  const totalNewcomers = newcomerStats.reduce((acc, cur) => acc + cur.count, 0);
  const lastNewcomerStat =
    newcomerStats.length > 0 ? newcomerStats[newcomerStats.length - 1] : null;

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 & 필터 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">통계 및 리포트</h1>
            <p className="mt-1 text-sm text-gray-500">
              공동체의 성장 흐름과 구성원 현황을 상세하게 분석합니다.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <FaFilter className="text-gray-400 ml-2" />
            <select
              className="text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer pr-8 focus:outline-none"
              value={selectedSemesterId ?? ""}
              onChange={(e) => setSelectedSemesterId(Number(e.target.value))}
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-8">
          {/* 섹션 1: 변화 리포트 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <FaChartLine size={20} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">변화 리포트</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <NewcomerGrowthChart data={newcomerStats} />
              </div>

              {/* 인사이트 카드 */}
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
                          {Math.abs(lastNewcomerStat.growthRate)}%
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
                    선택하신 학기 기간 동안의<br></br> 월별 등록 추이 및 전월
                    대비 증감률입니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 섹션 2: 구성원 통계 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-green-100 rounded-lg text-green-600">
                <FaUserFriends size={20} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                구성원 통계 분석
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
                <h3 className="font-semibold text-gray-700 mb-4 text-center">
                  연령대별 구성비
                </h3>
                {semesterSummary && (
                  <AgeGroupPieChart data={semesterSummary.ageGroupSummary} />
                )}

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">전체 인원</div>
                    <div className="font-bold text-gray-800">
                      {semesterSummary?.totalMemberCount}명
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                    <div className="text-xs text-gray-500">운영 셀</div>
                    <div className="font-bold text-gray-800">
                      {semesterSummary?.totalCellCount}개
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                {detailDemographics ? (
                  <DemographicsSection data={detailDemographics} />
                ) : (
                  <div className="h-[350px] flex items-center justify-center bg-white rounded-lg border border-gray-100 text-gray-400">
                    데이터 로딩 중...
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 섹션 3: 미배정 양육 관리 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                <FaUserSlash size={20} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                미배정 양육 관리
              </h2>
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-700">
                  미배정 성도 목록 ({unassignedList.length}명)
                </h3>
              </div>

              {/* [모바일 전용] 카드 리스트 뷰 */}
              <div className="block md:hidden bg-gray-50 p-3 space-y-3">
                {unassignedList.map((member) => {
                  // ✅ 계산된 나이 가져오기
                  const displayAge = calculateAge(member);

                  return (
                    <div
                      key={member.id}
                      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          {/* 이름 클릭 시 이동 */}
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}`)
                            }
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
                              {member.gender === "MALE" ? "형제" : "자매"}
                            </span>
                            <span className="text-sm text-gray-500">
                              {member.birthDate || member.birthYear || "-"}
                              {/* ✅ 모바일: 계산된 만 나이 표시 */}
                              {displayAge !== null && ` (만 ${displayAge}세)`}
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
                          {/* 등록 연도만 표시 */}
                          <span className="block text-xs text-gray-400">
                            등록 연도
                          </span>
                          {member.registeredDate?.substring(0, 4) || "-"}
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          navigate(`/admin/users/${member.id}/edit`)
                        }
                        className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-md text-sm font-semibold hover:bg-indigo-100 transition-colors"
                      >
                        셀 배정하기
                      </button>
                    </div>
                  );
                })}
                {unassignedList.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    미배정 성도가 없습니다.
                  </div>
                )}
              </div>

              {/* [데스크탑 전용] 테이블 뷰 */}
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
                    {unassignedList.map((member) => {
                      // ✅ 계산된 나이 가져오기
                      const displayAge = calculateAge(member);

                      return (
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
                              {member.gender === "MALE" ? "형제" : "자매"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member.birthDate || member.birthYear || "-"}
                            {/* ✅ 데스크탑: 계산된 만 나이 표시 */}
                            {displayAge !== null ? (
                              <span className="text-gray-400 ml-1">
                                (만 {displayAge}세)
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
                      );
                    })}
                    {unassignedList.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-10 text-center text-sm text-gray-500"
                        >
                          미배정 성도가 없습니다.
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
