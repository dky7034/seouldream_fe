// src/pages/DashboardPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  FaBirthdayCake,
  FaPrayingHands,
  FaBullhorn,
  FaPlus,
  FaChartLine,
  FaExclamationTriangle,
} from "react-icons/fa";
import { BookmarkIcon } from "@heroicons/react/24/solid";
import { dashboardService } from "../services/dashboardService";
import { noticeService } from "../services/noticeService";
import { prayerService } from "../services/prayerService";
import { statisticsService } from "../services/statisticsService";
import { reportService } from "../services/reportService";
import { semesterService } from "../services/semesterService";
import type {
  DashboardDto,
  BirthdayInfo,
  RecentPrayerInfo,
  RecentNoticeInfo,
  OverallAttendanceSummaryDto,
  OverallAttendanceStatDto,
  AggregatedTrendDto,
  AttendanceSummaryGroupBy,
  IncompleteCheckReportDto,
  SemesterDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { translateRole } from "../utils/roleUtils";
import CellLeaderDashboard from "./CellLeaderDashboard";
import AttendanceFilterBar from "../components/AttendanceFilterBar";

// --- 날짜 유틸리티 ---
const getPeriodDates = (
  period: string
): { startDate: string; endDate: string } => {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case "1m":
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case "3m":
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case "6m":
      startDate.setMonth(endDate.getMonth() - 6);
      break;
    case "12m":
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(endDate.getMonth() - 3);
  }

  const toISODateString = (date: Date) => date.toISOString().split("T")[0];

  return {
    startDate: toISODateString(startDate),
    endDate: toISODateString(endDate),
  };
};

// 동명이인일 때만 생년월일을 붙여주는 생일 전용 이름 포맷터
const formatBirthdayDisplayName = (b: BirthdayInfo, list: BirthdayInfo[]) => {
  const sameNameCount = list.filter(
    (x) => x.memberName === b.memberName
  ).length;

  if (sameNameCount > 1) {
    const date = new Date(b.birthDate);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${b.memberName} (${mm}/${dd})`;
  }

  return b.memberName;
};

const MAX_NEWS_ITEMS = 5;
const MAX_BIRTHDAY_ITEMS = 5;

type NewsTab = "notices" | "prayers" | "birthdays";
type BirthdayFilter = "today" | "weekly" | "monthly";

type TrendPoint = {
  label: string;
  rate: number;
};

// 요약 모드: 기본(최근 기간), 올해 전체, 학기별
type SummaryMode = "RECENT" | "YEAR" | "SEMESTER";

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
    className={`bg-white p-4 sm:p-6 rounded-2xl shadow-lg h-full flex flex-col ${className}`}
  >
    <div className="flex justify-between items-center mb-4 border-b pb-3">
      <div className="flex items-center min-w-0">
        {icon && (
          <div className="text-lg sm:text-xl text-gray-500 mr-3">{icon}</div>
        )}
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
          {title}
        </h3>
      </div>
      {actions && <div className="flex-shrink-0 ml-2">{actions}</div>}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

// --- 상단 요약 칩 ---
const TopSummaryChips: React.FC<{ data: DashboardDto }> = ({ data }) => {
  const todayBirthdays = data.totalTodayBirthdays;
  const weeklyPrayers = (data as any).weeklyPrayerCount ?? 0;
  const weeklyNotices = (data as any).weeklyNoticeCount ?? 0;

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-pink-50 text-pink-700 text-xs sm:text-sm">
        <FaBirthdayCake className="mr-2" />
        오늘 생일 {todayBirthdays}명
      </div>
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-blue-50 text-blue-700 text-xs sm:text-sm">
        <FaPrayingHands className="mr-2" />
        이번 주 기도제목 {weeklyPrayers}개
      </div>
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-yellow-50 text-yellow-700 text-xs sm:text-sm">
        <FaBullhorn className="mr-2" />
        이번 주 공지 {weeklyNotices}개
      </div>
    </div>
  );
};

// --- 출석 요약 카드 (DashboardDto & OverallAttendanceStatDto 모두 지원)
type OverallSummaryLike =
  | OverallAttendanceSummaryDto
  | OverallAttendanceStatDto
  | null
  | undefined;

const OverallAttendanceSummaryCard: React.FC<{
  summary: OverallSummaryLike;
  label?: string;
}> = ({ summary, label = "기간 총 출석률" }) => {
  // summary 자체가 없으면 안전하게 처리
  if (!summary) {
    return (
      <div className="grid grid-cols-1 gap-4 text-center">
        <div className="p-4 sm:p-5 bg-gray-50 rounded-lg">
          <p className="text-xs sm:text-sm font-medium text-gray-400">
            {label}
          </p>
          <p className="mt-1 text-base sm:text-lg text-gray-400">
            통계 데이터가 없습니다.
          </p>
        </div>
      </div>
    );
  }

  let attendanceRate: number | undefined;

  // 1) DashboardDto.overallAttendanceSummary 형태:
  // { periodSummaries: [...], totalSummary: { attendanceRate: number, ... } }
  if (
    (summary as OverallAttendanceSummaryDto).totalSummary &&
    typeof (summary as OverallAttendanceSummaryDto).totalSummary === "object"
  ) {
    attendanceRate = (summary as OverallAttendanceSummaryDto).totalSummary
      .attendanceRate;
  }

  // 2) OverallAttendanceStatDto 형태:
  // { totalRecords: number, attendanceRate: number }
  if (
    (attendanceRate === undefined || isNaN(attendanceRate)) &&
    typeof (summary as OverallAttendanceStatDto).attendanceRate === "number"
  ) {
    attendanceRate = (summary as OverallAttendanceStatDto).attendanceRate;
  }

  // 그래도 못 찾으면 메시지로 대체
  if (attendanceRate === undefined || isNaN(attendanceRate)) {
    return (
      <div className="grid grid-cols-1 gap-4 text-center">
        <div className="p-4 sm:p-5 bg-gray-50 rounded-lg">
          <p className="text-xs sm:text-sm font-medium text-gray-400">
            {label}
          </p>
          <p className="mt-1 text-base sm:text-lg text-gray-400">
            출석률 정보를 불러올 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 text-center">
      <div className="p-4 sm:p-5 bg-indigo-50 rounded-lg">
        <p className="text-xs sm:text-sm font-medium text-indigo-500">
          {label}
        </p>
        <p className="mt-1 text-2xl sm:text-3xl font-semibold text-indigo-600">
          {attendanceRate.toFixed(1)}%
        </p>
      </div>
    </div>
  );
};

// --- 미니 출석률 추이 요약 컴포넌트 (스파크라인) ---
const AttendanceTrendMini: React.FC<{
  trend?: AggregatedTrendDto[] | null;
}> = ({ trend }) => {
  if (!trend || trend.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-sm text-gray-500">
        추이 데이터가 없습니다.
      </div>
    );
  }

  const MAX_POINTS = 12;
  const points =
    trend.length > MAX_POINTS ? trend.slice(trend.length - MAX_POINTS) : trend;

  const mapped: TrendPoint[] = points.map((item) => ({
    label: item.dateGroup,
    rate: item.attendanceRate,
  }));

  const maxRate =
    mapped.reduce(
      (max: number, p: TrendPoint) => (p.rate > max ? p.rate : max),
      0
    ) || 100;

  const latest = mapped[mapped.length - 1];
  const prev = mapped.length > 1 ? mapped[mapped.length - 2] : undefined;
  const diff = prev ? latest.rate - prev.rate : 0;
  const diffLabel = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";

  return (
    <div className="mt-5 sm:mt-7">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs sm:text-sm font-medium text-gray-700">
          출석률 추이
        </p>
        <div className="flex items-center space-x-2 text-xs sm:text-sm">
          <span className="text-gray-500">최근 기준</span>
          <span className="font-semibold text-indigo-600">
            {latest.rate.toFixed(1)}%
          </span>
          {prev && (
            <span
              className={
                direction === "up"
                  ? "text-emerald-600"
                  : direction === "down"
                  ? "text-rose-600"
                  : "text-gray-500"
              }
            >
              {direction === "up" ? "▲ " : direction === "down" ? "▼ " : "― "}
              {diffLabel}
            </span>
          )}
        </div>
      </div>

      {/* 그래프 영역 - 제목과 겹치지 않도록 여유를 줌 */}
      <div className="flex items-end space-x-1 h-20 sm:h-24 pt-1">
        {mapped.map((p: TrendPoint, idx: number) => {
          const height = Math.max(8, (p.rate / maxRate) * 70);
          const showLabel =
            mapped.length <= 4 ||
            idx === 0 ||
            idx === mapped.length - 1 ||
            idx === Math.floor(mapped.length / 2);

          return (
            <div
              key={`${p.label}-${idx}`}
              className="flex-1 flex flex-col items-center"
            >
              <div
                className="w-full rounded-t-md bg-indigo-200 hover:bg-indigo-400 transition-colors"
                style={{ height: `${height}px` }}
                title={`${p.label}: ${p.rate.toFixed(1)}%`}
              />
              <span className="mt-1 text-[9px] text-gray-500 truncate max-w-[3rem]">
                {showLabel ? p.label : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- 출석 누락 현황 섹션 ---
const IncompleteAttendanceSection: React.FC<{
  reports: IncompleteCheckReportDto[];
  limit?: number;
}> = ({ reports, limit = 5 }) => {
  if (!reports || reports.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        최근 기간 동안 출석이 누락된 셀이 없습니다.
      </div>
    );
  }

  const top = reports.slice(0, limit);

  return (
    <div>
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">
                  셀 이름
                </th>
                <th className="px-3 py-2 text-center text-gray-500 font-medium">
                  누락 횟수
                </th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">
                  최근 누락일
                </th>
              </tr>
            </thead>
            <tbody>
              {top.map((r, index) => (
                <tr
                  key={r.cellId}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                >
                  <td className="px-3 py-2">
                    <Link
                      to={`/admin/cells/${r.cellId}`}
                      className="text-gray-800 hover:text-indigo-600 font-medium"
                    >
                      {r.cellName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center text-red-600 font-semibold">
                    {r.missedDatesCount}회
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.missedDates[r.missedDates.length - 1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {reports.length > limit && (
        <div className="mt-3 text-right">
          <Link
            to="/admin/reports/incomplete-checks"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            전체 현황 보기
          </Link>
        </div>
      )}
    </div>
  );
};

// --- 기간 선택 필터 (그래프용) ---
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
    <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
      {periods.map((period) => (
        <button
          key={period.id}
          onClick={() => onSelectPeriod(period.id)}
          className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
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

// --- 그룹화 선택 필터 (그래프용) ---
const GroupByFilter: React.FC<{
  selectedGroupBy: AttendanceSummaryGroupBy;
  onSelectGroupBy: (groupBy: AttendanceSummaryGroupBy) => void;
}> = ({ selectedGroupBy, onSelectGroupBy }) => {
  const options: { id: AttendanceSummaryGroupBy; label: string }[] = [
    { id: "DAY", label: "일별" },
    { id: "WEEK", label: "주별" },
    { id: "MONTH", label: "월별" },
  ];

  return (
    <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelectGroupBy(option.id)}
          className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
            selectedGroupBy === option.id
              ? "bg-white text-indigo-700 shadow"
              : "text-gray-600 hover:bg-gray-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

// --- 요약 모드 선택 필터 (최근 / 올해 / 학기별) ---
const SummaryModeFilter: React.FC<{
  summaryMode: SummaryMode;
  onChange: (mode: SummaryMode) => void;
}> = ({ summaryMode, onChange }) => {
  const modes: { id: SummaryMode; label: string }[] = [
    { id: "RECENT", label: "최근 기간" },
    { id: "YEAR", label: "올해 전체" },
    { id: "SEMESTER", label: "학기별" },
  ];

  return (
    <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
            summaryMode === m.id
              ? "bg-white text-indigo-700 shadow"
              : "text-gray-600 hover:bg-gray-200"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
};

// --- 공동체 소식 카드 ---
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
        <div className="flex justify-center">
          <div className="inline-flex flex-wrap items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
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

        {birthdays.length > 0 ? (
          <>
            <ul className="space-y-3">
              {items.map((b) => (
                <li
                  key={`${b.memberId}-${b.birthDate}`}
                  className="flex items-center space-x-3 text-gray-700"
                >
                  <FaBirthdayCake className="text-pink-400 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm sm:text-base">
                      {formatBirthdayDisplayName(b, data.monthlyBirthdays)}
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
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] sm:text-xs text-gray-400">
                <span>
                  외 {totalBirthdays - MAX_BIRTHDAY_ITEMS}명 더 있습니다.
                </span>
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  <Link
                    to="/birthdays"
                    className="text-indigo-500 hover:text-indigo-700 font-medium"
                  >
                    월별 생일자 보기
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-center py-6 text-sm">
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
                  <p className="font-medium text-gray-800 group-hover:text-indigo-600 flex items-center text-sm">
                    {n.pinned && (
                      <BookmarkIcon className="h-4 w-4 text-red-500 mr-1 flex-shrink-0" />
                    )}
                    <span className="truncate">{n.title}</span>
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {totalNotices > MAX_NEWS_ITEMS && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] sm:text-xs text-gray-400">
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
        <p className="text-gray-500 text-center py-6 text-sm">
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
                  <p className="font-medium text-gray-800 truncate group-hover:text-indigo-600 text-sm">
                    {p.content}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    {p.memberName} |{" "}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {totalPrayers > MAX_NEWS_ITEMS && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] sm:text-xs text-gray-400">
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
        <p className="text-gray-500 text-center py-6 text-sm">
          최근 등록된 기도제목이 없습니다.
        </p>
      );
    }

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
            className="inline-flex items-center text-[11px] sm:text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <FaPlus className="mr-1" /> 공지 등록
          </Link>
        ) : null
      }
    >
      <div className="mb-4">
        <div className="inline-flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
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

  // 그래프용
  const [period, setPeriod] = useState("1m");
  const [groupBy, setGroupBy] = useState<AttendanceSummaryGroupBy>("WEEK");

  // 요약용 (올해/학기)
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("RECENT");
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    null
  );

  const [totalNotices, setTotalNotices] = useState(0);
  const [totalPrayers, setTotalPrayers] = useState(0);
  const [incompleteCheckData, setIncompleteCheckData] = useState<
    IncompleteCheckReportDto[]
  >([]);

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";

  // 학기 목록 불러오기 (임원만)
  useEffect(() => {
    if (!isExecutive) return;

    const fetchSemesters = async () => {
      try {
        const list = await semesterService.getAllSemesters();
        setSemesters(list);

        const active = list.find((s) => s.isActive);
        if (active) {
          setSelectedSemesterId(active.id);
        } else if (list.length > 0) {
          setSelectedSemesterId(list[0].id);
        }
      } catch (err) {
        console.error("학기 목록 조회 실패:", err);
      }
    };

    fetchSemesters();
  }, [isExecutive]);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getPeriodDates(period);

      const [mainData, noticesPage, prayersPage, trendData, incompleteData] =
        await Promise.all([
          dashboardService.getDashboardData(period),
          noticeService.getAllNotices({ size: 1 }),
          prayerService.getPrayers({ size: 1, sort: "createdAt,desc" }),
          statisticsService.getAttendanceTrend({ startDate, endDate, groupBy }),
          user.role === "EXECUTIVE"
            ? reportService.getIncompleteCheckReport({ startDate, endDate })
            : Promise.resolve([] as IncompleteCheckReportDto[]),
        ]);

      let summaryToUse:
        | OverallAttendanceSummaryDto
        | OverallAttendanceStatDto
        | null = mainData.overallAttendanceSummary;

      // 임원 & 요약 모드가 RECENT가 아니면 overall-attendance API 사용
      if (user.role === "EXECUTIVE" && summaryMode !== "RECENT") {
        try {
          if (summaryMode === "YEAR") {
            const currentYear = new Date().getFullYear();
            const yearSummary = await statisticsService.getOverallAttendance({
              year: currentYear,
            } as any);

            summaryToUse = yearSummary;
          } else if (
            summaryMode === "SEMESTER" &&
            selectedSemesterId &&
            semesters.length > 0
          ) {
            const semester = semesters.find((s) => s.id === selectedSemesterId);
            if (semester) {
              const semesterSummary =
                await statisticsService.getOverallAttendance({
                  startDate: semester.startDate,
                  endDate: semester.endDate,
                } as any);

              summaryToUse = semesterSummary;
            }
          }
        } catch (summaryErr) {
          console.error("요약 통계 조회 실패:", summaryErr);
          // 실패하면 mainData.overallAttendanceSummary 그대로 사용
        }
      }

      setDashboardData({
        ...mainData,
        overallAttendanceSummary:
          summaryToUse ?? mainData.overallAttendanceSummary,
        attendanceTrend: trendData,
      });
      setTotalNotices(noticesPage.totalElements);
      setTotalPrayers(prayersPage.totalElements);
      setIncompleteCheckData(incompleteData);
    } catch (err) {
      console.error(err);
      setError("대시보드 데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user, period, groupBy, summaryMode, selectedSemesterId, semesters]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-4 border-b-4 border-indigo-500" />
          <p className="text-xs sm:text-sm text-gray-500">
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
          <p className="text-red-700 mb-3 text-sm sm:text-base">{error}</p>
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <CellLeaderDashboard user={user} />
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <p className="text-gray-500 text-sm sm:text-base">
          아직 대시보드에 표시할 데이터가 없습니다. 출석을 기록하고, 기도제목과
          공지를 등록해 보세요.
        </p>
      </div>
    );
  }

  const summaryLabel = (() => {
    if (!isExecutive) return "기간 총 출석률";
    switch (summaryMode) {
      case "YEAR": {
        const currentYear = new Date().getFullYear();
        return `${currentYear}년 전체 출석률`;
      }
      case "SEMESTER": {
        const semester = semesters.find((s) => s.id === selectedSemesterId);
        return semester ? `${semester.name} 출석률` : "학기별 출석률";
      }
      default:
        return "기간 총 출석률";
    }
  })();

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">
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
            {/* 임원: 출석 통계 + 출석 누락 리포트까지 한 카드에서 */}
            {isExecutive && dashboardData.overallAttendanceSummary && (
              <Card
                title="출석 통계"
                icon={<FaChartLine className="text-teal-500" />}
                // ✅ actions 제거 (위 헤더를 가볍게)
              >
                {/* ✅ 1) 제목 아래에 필터 영역 배치 */}
                <div className="mb-4 space-y-3">
                  {/* 그래프용 컨트롤 (기간 + 단위) */}
                  <div className="w-full">
                    <AttendanceFilterBar
                      period={period}
                      groupBy={groupBy}
                      onChangePeriod={setPeriod}
                      onChangeGroupBy={setGroupBy}
                    />
                  </div>

                  {/* 요약 모드 컨트롤 (최근/올해/학기별) + 학기 선택 */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <SummaryModeFilter
                      summaryMode={summaryMode}
                      onChange={setSummaryMode}
                    />

                    {summaryMode === "SEMESTER" && semesters.length > 0 && (
                      <select
                        className="text-xs sm:text-sm border border-gray-300 rounded-md px-2 py-1 bg-white self-start sm:self-auto"
                        value={selectedSemesterId ?? ""}
                        onChange={(e) =>
                          setSelectedSemesterId(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        {semesters.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {s.isActive ? " (진행중)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* ✅ 2) 상단: 요약 카드 */}
                <div className="mt-2 sm:mt-4">
                  <OverallAttendanceSummaryCard
                    summary={dashboardData.overallAttendanceSummary}
                    label={summaryLabel}
                  />
                </div>

                {/* ✅ 3) 중간: 출석률 추이 */}
                <AttendanceTrendMini trend={dashboardData.attendanceTrend} />

                {/* ✅ 4) 하단: 출석 누락 리포트 */}
                <div className="mt-6 sm:mt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <FaExclamationTriangle className="text-orange-500" />
                    <h4 className="text-sm font-semibold text-gray-800">
                      출석 누락 리포트
                    </h4>
                  </div>
                  <IncompleteAttendanceSection reports={incompleteCheckData} />
                </div>
              </Card>
            )}

            {/* 일반 사용자: 단순 요약 + 추이 그래프만 */}
            {!isExecutive && dashboardData.overallAttendanceSummary && (
              <Card
                title="공동체 출석 요약"
                icon={<FaChartLine className="text-teal-500" />}
              >
                {/* 제목 아래 필터 */}
                <div className="mb-4">
                  <AttendanceFilterBar
                    period={period}
                    groupBy={groupBy}
                    onChangePeriod={setPeriod}
                    onChangeGroupBy={setGroupBy}
                  />
                </div>

                <div className="mt-2 sm:mt-4">
                  <OverallAttendanceSummaryCard
                    summary={dashboardData.overallAttendanceSummary}
                  />
                </div>

                <AttendanceTrendMini trend={dashboardData.attendanceTrend} />
              </Card>
            )}
          </div>

          {/* 오른쪽: 소식 센터 */}
          <div className="space-y-6 xl:col-span-1 xl:sticky xl:top-24 self-start">
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
