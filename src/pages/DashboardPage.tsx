// DashboardPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  FaBirthdayCake,
  FaPrayingHands,
  FaBullhorn,
  FaPlus,
  FaChartLine,
  FaUsers,
  // FaArrowUp,
  // FaArrowDown,
  // FaMinus,
} from "react-icons/fa";
import { BookmarkIcon } from "@heroicons/react/24/solid";
import { dashboardService } from "../services/dashboardService";
import { noticeService } from "../services/noticeService";
import { prayerService } from "../services/prayerService";
import type {
  DashboardDto,
  BirthdayInfo,
  RecentPrayerInfo,
  RecentNoticeInfo,
  OverallAttendanceSummaryDto,
  CellAttendanceSummaryDto,
  // AttendanceKeyMetricsDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { translateRole } from "../utils/roleUtils";
import CellLeaderDashboard from "./CellLeaderDashboard";

// 동명이인일 때만 생년월일을 붙여주는 생일 전용 이름 포맷터
const formatBirthdayDisplayName = (b: BirthdayInfo, list: BirthdayInfo[]) => {
  const sameNameCount = list.filter(
    (x) => x.memberName === b.memberName
  ).length;

  // 동명이인이 있을 때만 (MM/DD) 붙이기
  if (sameNameCount > 1) {
    const date = new Date(b.birthDate);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${b.memberName} (${mm}/${dd})`;
  }

  // 유일한 이름이면 이름만
  return b.memberName;
};

// 최대 표시 개수 상수
const MAX_NEWS_ITEMS = 5;
const MAX_BIRTHDAY_ITEMS = 5;

// 공용 타입
type NewsTab = "notices" | "prayers" | "birthdays";
type BirthdayFilter = "today" | "weekly" | "monthly";

// --- 공용 Card 컴포넌트 ---
interface CardProps {
  icon?: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  icon,
  title,
  actions,
  children,
  className = "",
}) => (
  <div
    className={`bg-white p-6 rounded-2xl shadow-lg h-full flex flex-col ${className}`}
  >
    <div className="flex justify-between items-center mb-4 border-b pb-3">
      <div className="flex items-center">
        {icon && <div className="text-xl text-gray-500 mr-3">{icon}</div>}
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      {actions}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

// --- 상단 요약 칩 ---
const TopSummaryChips: React.FC<{ data: DashboardDto }> = ({ data }) => {
  const todayBirthdays = data.totalTodayBirthdays;
  const recentPrayers = data.recentPrayers.length;
  const notices = data.recentNotices.length;

  return (
    <div className="flex flex-wrap gap-3">
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-pink-50 text-pink-700 text-xs sm:text-sm">
        <FaBirthdayCake className="mr-2" />
        오늘 생일 {todayBirthdays}명
      </div>
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-blue-50 text-blue-700 text-xs sm:text-sm">
        <FaPrayingHands className="mr-2" />
        최근 기도제목 {recentPrayers}개
      </div>
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-yellow-50 text-yellow-700 text-xs sm:text-sm">
        <FaBullhorn className="mr-2" />
        최신 공지 {notices}개
      </div>
    </div>
  );
};

const OverallAttendanceSummaryCard: React.FC<{
  summary: OverallAttendanceSummaryDto;
}> = ({ summary }) => {
  const { attendanceRate } = summary.totalSummary;
  return (
    <div className="grid grid-cols-1 gap-4 text-center">
      <div className="p-4 bg-indigo-50 rounded-lg">
        <p className="text-sm font-medium text-indigo-500">기간 총 출석률</p>
        <p className="mt-1 text-3xl font-semibold text-indigo-600">
          {attendanceRate.toFixed(1)}%
        </p>
      </div>
    </div>
  );
};

// --- 출석 통계 카드 안에 들어가는 셀 상위 N개 섹션 ---
const TopCellAttendanceSection: React.FC<{
  summaries: CellAttendanceSummaryDto[];
  limit?: number;
}> = ({ summaries, limit = 5 }) => {
  if (!summaries || summaries.length === 0) {
    return null;
  }

  const sorted = [...summaries].sort(
    (a, b) => b.totalSummary.attendanceRate - a.totalSummary.attendanceRate
  );
  const top = sorted.slice(0, limit);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FaUsers className="text-purple-500" />
          <h4 className="text-sm font-semibold text-gray-800">
            셀별 출석률 상위 {limit}팀
          </h4>
        </div>
        <Link
          to="/admin/cells"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          전체 셀 보기
        </Link>
      </div>
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 font-medium w-16">
                순위
              </th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">
                셀 이름
              </th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium w-24">
                출석률
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((s, index) => (
              <tr
                key={s.cellId}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
              >
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full ${
                      index === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : index === 1
                        ? "bg-gray-100 text-gray-700"
                        : index === 2
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Link
                    to={`/admin/cells/${s.cellId}`}
                    className="text-gray-800 hover:text-indigo-600 font-medium"
                  >
                    {s.cellName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-semibold text-gray-800">
                  {s.totalSummary.attendanceRate.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- 기간 선택 필터 ---
const PeriodFilter: React.FC<{
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
}> = ({ selectedPeriod, onSelectPeriod }) => {
  const periods = [
    { id: "1m", label: "1개월" },
    { id: "3m", label: "3개월" },
    { id: "6m", label: "6개월" },
    { id: "12m", label: "1년" },
  ];

  return (
    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
      {periods.map((period) => (
        <button
          key={period.id}
          onClick={() => onSelectPeriod(period.id)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md ${
            selectedPeriod === period.id
              ? "bg-white text-indigo-700 shadow"
              : "text-gray-600 hover:bg-gray-200"
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
};

// --- 공동체 소식 탭 카드 ---
interface NewsCenterCardProps {
  data: DashboardDto;
  canManageNotices: boolean;
  totalNotices: number;
  totalPrayers: number;
  totalTodayBirthdays: number;
  totalWeeklyBirthdays: number;
  totalMonthlyBirthdays: number;
}

const NewsCenterCard: React.FC<NewsCenterCardProps> = ({
  data,
  canManageNotices,
  totalNotices,
  totalPrayers,
  totalTodayBirthdays,
  totalWeeklyBirthdays,
  totalMonthlyBirthdays,
}) => {
  const [activeTab, setActiveTab] = useState<NewsTab>("notices");
  const [birthdayFilter, setBirthdayFilter] = useState<BirthdayFilter>("today");

  const getBirthdayList = (): BirthdayInfo[] => {
    switch (birthdayFilter) {
      case "today":
        return data.todayBirthdays;
      case "weekly":
        return data.weeklyBirthdays;
      case "monthly":
        return data.monthlyBirthdays;
      default:
        return [];
    }
  };

  const getTotalBirthdayCount = (): number => {
    switch (birthdayFilter) {
      case "today":
        return totalTodayBirthdays;
      case "weekly":
        return totalWeeklyBirthdays;
      case "monthly":
        return totalMonthlyBirthdays;
      default:
        return 0;
    }
  };

  const notices: RecentNoticeInfo[] = data.recentNotices;
  const prayers: RecentPrayerInfo[] = data.recentPrayers;
  const birthdays = getBirthdayList();
  const totalBirthdays = getTotalBirthdayCount();

  const renderBirthdaysContent = () => {
    const items = birthdays.slice(0, MAX_BIRTHDAY_ITEMS);

    return (
      <div className="space-y-4">
        {/* 생일 필터: 탭 아래, 본문 상단 */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
            {[
              { id: "today", label: "오늘" },
              { id: "weekly", label: "이번 주" },
              { id: "monthly", label: "이번 달" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setBirthdayFilter(option.id as BirthdayFilter)}
                className={
                  birthdayFilter === option.id
                    ? "px-3 py-1 text-xs font-medium rounded-full bg-pink-100 text-pink-700 border border-pink-300"
                    : "px-3 py-1 text-xs font-medium rounded-full bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 생일 리스트 */}
        {birthdays.length > 0 ? (
          <>
            <ul className="space-y-3">
              {items.map((b) => (
                <li
                  key={`${b.memberId}-${b.birthDate}`}
                  className="flex items-center space-x-3 text-gray-700"
                >
                  <FaBirthdayCake className="text-pink-400" />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {formatBirthdayDisplayName(
                        b,
                        data.monthlyBirthdays // 동명이인 판단 기준을 월 전체로 고정
                      )}
                      님의 생일을 축하합니다!
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(b.birthDate).getMonth() + 1}월{" "}
                      {new Date(b.birthDate).getDate()}일
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {totalBirthdays > MAX_BIRTHDAY_ITEMS && (
              <div className="pt-2 flex justify-between items-center text-xs text-gray-400">
                <span>
                  외 {totalBirthdays - MAX_BIRTHDAY_ITEMS}명 더 있습니다.
                </span>
                <div className="space-x-4">
                  <Link
                    to="/birthdays"
                    className="text-indigo-500 hover:text-indigo-700 font-medium"
                  >
                    월별 생일자 보기
                  </Link>
                  <Link
                    to="/admin/users"
                    className="text-indigo-500 hover:text-indigo-700 font-medium"
                  >
                    전체 멤버 보기
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-center py-6">
            선택한 기간에 해당하는 생일이 없습니다.
          </p>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (activeTab === "notices") {
      const items = notices.slice(0, MAX_NEWS_ITEMS);

      return notices.length > 0 ? (
        <div className="space-y-2">
          <ul className="divide-y divide-gray-100">
            {items.map((n) => (
              <li key={n.noticeId} className="py-2">
                <Link
                  to={`/admin/notices/${n.noticeId}`}
                  className="block hover:bg-gray-50 p-2 rounded-md group"
                >
                  <p className="font-medium text-gray-800 group-hover:text-indigo-600 flex items-center">
                    {n.pinned && (
                      <BookmarkIcon className="h-4 w-4 text-red-500 mr-1 flex-shrink-0" />
                    )}
                    {n.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {totalNotices > MAX_NEWS_ITEMS && (
            <div className="pt-2 flex justify-between items-center text-xs text-gray-400">
              <span>외 {totalNotices - MAX_NEWS_ITEMS}개 더 있습니다.</span>
              <Link
                to="/admin/notices"
                className="text-indigo-500 hover:text-indigo-700 font-medium"
              >
                전체 공지 보기
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-6">
          아직 등록된 공지사항이 없습니다.
        </p>
      );
    }

    if (activeTab === "prayers") {
      const items = prayers.slice(0, MAX_NEWS_ITEMS);

      return prayers.length > 0 ? (
        <div className="space-y-2">
          <ul className="divide-y divide-gray-100">
            {items.map((p) => (
              <li key={p.prayerId} className="py-2">
                <Link
                  to={`/admin/prayers/${p.prayerId}`}
                  className="block hover:bg-gray-50 p-2 rounded-md group"
                >
                  <p className="font-medium text-gray-800 truncate group-hover:text-indigo-600">
                    {p.content}
                  </p>
                  <p className="text-sm text-gray-500">
                    {p.memberName} |{" "}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {totalPrayers > MAX_NEWS_ITEMS && (
            <div className="pt-2 flex justify-between items-center text-xs text-gray-400">
              <span>외 {totalPrayers - MAX_NEWS_ITEMS}개 더 있습니다.</span>
              <Link
                to="/admin/prayers"
                className="text-indigo-500 hover:text-indigo-700 font-medium"
              >
                전체 기도제목 보기
              </Link>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-6">
          최근 등록된 기도제목이 없습니다.
        </p>
      );
    }

    // 생일 탭
    return renderBirthdaysContent();
  };

  return (
    <Card
      icon={<FaBullhorn className="text-yellow-500" />}
      title="공동체 소식"
      actions={
        activeTab === "notices" && canManageNotices ? (
          <Link
            to="/admin/notices/add"
            className="inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <FaPlus className="mr-1" /> 공지 등록
          </Link>
        ) : null
      }
    >
      {/* 상단 탭 (공지 / 기도 / 생일) */}
      <div className="mb-4">
        <div className="inline-flex space-x-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("notices")}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
              activeTab === "notices"
                ? "bg-white text-indigo-700 shadow"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            공지사항
          </button>
          <button
            onClick={() => setActiveTab("prayers")}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
              activeTab === "prayers"
                ? "bg-white text-indigo-700 shadow"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            기도제목
          </button>
          <button
            onClick={() => setActiveTab("birthdays")}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
              activeTab === "birthdays"
                ? "bg-white text-indigo-700 shadow"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            생일
          </button>
        </div>
      </div>

      {/* 탭별 본문 */}
      {renderContent()}
    </Card>
  );
};

// --- 메인 Dashboard ---
const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("3m");
  const [totalNotices, setTotalNotices] = useState(0);
  const [totalPrayers, setTotalPrayers] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [data, noticesPage, prayersPage] = await Promise.all([
        dashboardService.getDashboardData(period),
        noticeService.getAllNotices({ size: 1 }),
        prayerService.getPrayers({ size: 1, sort: "createdAt,desc" }),
      ]);

      setDashboardData(data);
      setTotalNotices(noticesPage.totalElements);
      setTotalPrayers(prayersPage.totalElements);
    } catch (err) {
      setError("대시보드 데이터를 불러오는 데 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">
          로그인 후 대시보드를 확인할 수 있습니다.
        </p>
      </div>
    );
  }

  const isExecutive = user.role === "EXECUTIVE";
  const isCellLeader = user.role === "CELL_LEADER";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500" />
          <p className="text-sm text-gray-500">
            대시보드 데이터를 불러오는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md w-full text-center">
          <p className="text-red-700 mb-3">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (isCellLeader) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <CellLeaderDashboard user={user} />
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <p className="text-gray-500">
          아직 대시보드에 표시할 데이터가 없습니다. 출석을 기록하고, 기도제목과
          공지를 등록해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">
            대시보드
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            환영합니다,{" "}
            <span className="font-semibold text-indigo-600">{user.name}</span>님
            ({translateRole(user.role)}){" "}
            {isExecutive
              ? "공동체 출석 현황과 셀 상황을 한눈에 확인할 수 있습니다."
              : "공동체 소식과 출석 흐름을 요약해서 보여드립니다."}
          </p>
          <div className="mt-4">
            <TopSummaryChips data={dashboardData} />
          </div>
        </div>

        {/* 메인 레이아웃 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 왼쪽: 출석/참여 섹션 */}
          <div className="xl:col-span-2 space-y-6">
            {isExecutive && (
              <Card
                title="출석 통계"
                icon={<FaChartLine className="text-teal-500" />}
                actions={
                  <PeriodFilter
                    selectedPeriod={period}
                    onSelectPeriod={setPeriod}
                  />
                }
              >
                {dashboardData.overallAttendanceSummary && (
                  <div className="mt-6">
                    <OverallAttendanceSummaryCard
                      summary={dashboardData.overallAttendanceSummary}
                    />
                  </div>
                )}

                {dashboardData.cellAttendanceSummaries &&
                  dashboardData.cellAttendanceSummaries.length > 0 && (
                    <TopCellAttendanceSection
                      summaries={dashboardData.cellAttendanceSummaries}
                      limit={5} // 필요하면 10으로 변경 가능
                    />
                  )}
              </Card>
            )}

            {!isExecutive && dashboardData.overallAttendanceSummary && (
              <Card
                title="공동체 출석 요약"
                icon={<FaChartLine className="text-teal-500" />}
                actions={
                  <PeriodFilter
                    selectedPeriod={period}
                    onSelectPeriod={setPeriod}
                  />
                }
              >
                <OverallAttendanceSummaryCard
                  summary={dashboardData.overallAttendanceSummary}
                />
              </Card>
            )}
          </div>

          {/* 오른쪽: 소식 센터 (공지/기도/생일 탭) */}
          <div className="space-y-6">
            <NewsCenterCard
              data={dashboardData}
              canManageNotices={isExecutive}
              totalNotices={totalNotices}
              totalPrayers={totalPrayers}
              totalTodayBirthdays={dashboardData.totalTodayBirthdays}
              totalWeeklyBirthdays={dashboardData.totalWeeklyBirthdays}
              totalMonthlyBirthdays={dashboardData.totalMonthlyBirthdays}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
