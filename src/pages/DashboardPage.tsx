// src/pages/DashboardPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
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

// --- 공통 날짜 포맷 유틸 ---
const formatDateKorean = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${m}월 ${d}일`;
};

const formatDateGroupLabel = (
  groupBy: AttendanceSummaryGroupBy,
  raw: string
): string => {
  if (!raw) return raw;

  if (groupBy === "SEMESTER") {
    return raw;
  }

  if (groupBy === "QUARTER") {
    const match = raw.match(/^(\d{4})-Q([1-4])$/);
    if (match) {
      const year = match[1];
      const quarter = match[2];
      return `${year}년 ${quarter}분기`;
    }
    return raw;
  }

  if (groupBy === "HALF_YEAR") {
    const match = raw.match(/^(\d{4})-H([12])$/);
    if (match) {
      const year = match[1];
      const half = match[2] === "1" ? "상반기" : "하반기";
      return `${year}년 ${half}`;
    }
    return raw;
  }

  if (groupBy === "YEAR") {
    const match = raw.match(/^(\d{4})$/);
    if (match) {
      return `${match[1]}년`;
    }
    return raw;
  }

  if (groupBy === "MONTH") {
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = match[1];
      const month = parseInt(match[2], 10);
      return `${year}년 ${month}월`;
    }
    return raw;
  }

  if (groupBy === "WEEK") {
    const match = raw.match(/^(\d{4})-W(\d{1,2})$/);
    if (match) {
      const year = match[1];
      const week = parseInt(match[2], 10);
      return `${year}년 ${week}주차`;
    }
    return raw;
  }

  if (groupBy === "DAY") {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = match[1];
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      return `${year}년 ${month}월 ${day}일`;
    }
    return raw;
  }

  return raw;
};

// --- 날짜 유틸리티 ---
const toISODateString = (date: Date) => date.toISOString().split("T")[0];

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

  return {
    startDate: toISODateString(startDate),
    endDate: toISODateString(endDate),
  };
};

// 이번 주 범위 (주일 기준: 일요일 ~ 토요일)
const getThisWeekRange = (): { startDate: string; endDate: string } => {
  const today = new Date();
  const day = today.getDay(); // 0: 일, 1: 월, ... 6: 토

  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  return {
    startDate: toISODateString(sunday),
    endDate: toISODateString(saturday),
  };
};

// 이번 달 범위 (1일 ~ 말일)
const getThisMonthRange = (): { startDate: string; endDate: string } => {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: toISODateString(first),
    endDate: toISODateString(last),
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

// 요약 모드: 1/3/6개월, 학기별, 올해 전체
type SummaryMode = "1M" | "3M" | "6M" | "SEMESTER" | "YEAR";

// 출석 누락 리포트 필터
type IncompleteFilter = "WEEK" | "MONTH" | "SEMESTER";

const computeTrendRange = (
  isExecutive: boolean,
  summaryMode: SummaryMode,
  period: string,
  semesters: SemesterDto[],
  selectedSemesterId: number | null
): { startDate: string; endDate: string } => {
  // 일반 사용자는 기존처럼 period 기준
  if (!isExecutive) {
    return getPeriodDates(period);
  }

  // 임원 + 1/3/6개월
  if (summaryMode === "1M" || summaryMode === "3M" || summaryMode === "6M") {
    const mapped =
      summaryMode === "1M" ? "1m" : summaryMode === "3M" ? "3m" : "6m";
    return getPeriodDates(mapped);
  }

  // 임원 + 올해 전체
  if (summaryMode === "YEAR") {
    const currentYear = new Date().getFullYear();
    return {
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
    };
  }

  // 임원 + 학기별
  if (summaryMode === "SEMESTER") {
    const semester = semesters.find((s) => s.id === selectedSemesterId);
    if (semester) {
      return {
        startDate: semester.startDate,
        endDate: semester.endDate,
      };
    }
  }

  // 안전장치: 기본 3개월
  return getPeriodDates("3m");
};

// 출석 누락 리포트용 기간 계산
const computeIncompleteRange = (
  filter: IncompleteFilter,
  semesters: SemesterDto[],
  selectedSemesterId: number | null
): { startDate: string; endDate: string } => {
  if (filter === "WEEK") {
    return getThisWeekRange();
  }

  if (filter === "MONTH") {
    return getThisMonthRange();
  }

  // filter === "SEMESTER"
  let semester: SemesterDto | undefined =
    semesters.find((s) => s.id === selectedSemesterId) ??
    semesters.find((s) => s.isActive) ??
    semesters[0];

  if (semester) {
    return {
      startDate: semester.startDate,
      endDate: semester.endDate,
    };
  }

  // 학기가 하나도 없으면 이번 달 기준으로 fallback
  return getThisMonthRange();
};

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
  const weeklyPrayers = data.weeklyPrayerCount ?? 0;
  const weeklyNotices = data.weeklyNoticeCount ?? 0;

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

// --- 출석 요약 카드 ---
type OverallSummaryLike =
  | OverallAttendanceSummaryDto
  | OverallAttendanceStatDto
  | null
  | undefined;

const OverallAttendanceSummaryCard: React.FC<{
  summary: OverallSummaryLike;
  label?: string;
}> = ({ summary, label = "기간 총 출석률" }) => {
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

  if (
    (summary as OverallAttendanceSummaryDto).totalSummary &&
    typeof (summary as OverallAttendanceSummaryDto).totalSummary === "object"
  ) {
    attendanceRate = (summary as OverallAttendanceSummaryDto).totalSummary
      .attendanceRate;
  }

  if (
    (attendanceRate === undefined || isNaN(attendanceRate)) &&
    typeof (summary as OverallAttendanceStatDto).attendanceRate === "number"
  ) {
    attendanceRate = (summary as OverallAttendanceStatDto).attendanceRate;
  }

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

// --- 출석률 상세 추이 컴포넌트 ---
const AttendanceTrend: React.FC<{
  data?: AggregatedTrendDto[] | null;
  selectedGroupBy: AttendanceSummaryGroupBy;
  title: string;
  dateRange?: { startDate: string; endDate: string } | null;
}> = ({ data, selectedGroupBy, title, dateRange }) => {
  const items = data ?? [];
  if (items.length === 0) {
    return (
      <div className="mt-4 h-24 flex items-center justify-center text-sm text-gray-500">
        출석률 추이 데이터가 없습니다.
      </div>
    );
  }

  const shouldLimitItems =
    selectedGroupBy === "DAY" || selectedGroupBy === "WEEK";
  const MAX_ITEMS = 12;

  const slicedData = useMemo(() => {
    const base = items.filter(
      (item) => typeof item.attendanceRate === "number"
    );
    if (!shouldLimitItems) return base;
    return base.length > MAX_ITEMS ? base.slice(-MAX_ITEMS) : base;
  }, [items, shouldLimitItems]);

  const summary = useMemo(() => {
    if (!slicedData.length) return null;

    const sorted = [...slicedData];
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const max = sorted.reduce((acc, cur) =>
      cur.attendanceRate > acc.attendanceRate ? cur : acc
    );
    const min = sorted.reduce((acc, cur) =>
      cur.attendanceRate < acc.attendanceRate ? cur : acc
    );

    return {
      start: first,
      end: last,
      startRate: first.attendanceRate,
      endRate: last.attendanceRate,
      diff: last.attendanceRate - first.attendanceRate,
      max,
      min,
    };
  }, [slicedData]);

  const formatDiff = (diff: number) => {
    const fixed = diff.toFixed(1);
    if (diff > 0) return `+${fixed}p`;
    if (diff < 0) return `${fixed}p`;
    return "변화 없음";
  };

  return (
    <div className="bg-white/0 p-0 rounded-lg mt-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h2 className="text-sm sm:text-base font-semibold text-gray-800">
          {title}
        </h2>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-[11px] sm:text-xs">
              조회 기간 (필터 기준)
            </p>
            <p className="text-[11px] sm:text-xs text-gray-700 mt-0.5">
              {dateRange
                ? `${formatDateKorean(
                    dateRange.startDate
                  )} ~ ${formatDateKorean(dateRange.endDate)}`
                : "기간이 설정되지 않았습니다."}
            </p>
            <p className="mt-1.5 font-medium text-gray-800 text-xs sm:text-sm">
              {summary.startRate.toFixed(1)}% → {summary.endRate.toFixed(1)}%{" "}
              <span className="ml-2 text-[11px] sm:text-xs text-blue-600">
                ({formatDiff(summary.diff)})
              </span>
            </p>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-gray-500">
              ({formatDateGroupLabel(selectedGroupBy, summary.start.dateGroup)}{" "}
              → {formatDateGroupLabel(selectedGroupBy, summary.end.dateGroup)}
              기준)
            </p>
          </div>

          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-[11px] sm:text-xs">최고 출석률</p>
            <p className="font-medium text-gray-800 text-xs sm:text-sm">
              {summary.max.attendanceRate.toFixed(1)}%{" "}
              <span className="ml-1 text-[11px] sm:text-xs text-gray-600">
                ({formatDateGroupLabel(selectedGroupBy, summary.max.dateGroup)})
              </span>
            </p>
          </div>

          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-[11px] sm:text-xs">최저 출석률</p>
            <p className="font-medium text-gray-800 text-xs sm:text-sm">
              {summary.min.attendanceRate.toFixed(1)}%{" "}
              <span className="ml-1 text-[11px] sm:text-xs text-gray-600">
                ({formatDateGroupLabel(selectedGroupBy, summary.min.dateGroup)})
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {slicedData.map((item) => (
          <div key={item.dateGroup} className="space-y-1">
            <div className="flex justify-between text-[11px] sm:text-xs text-gray-600">
              <span>
                {formatDateGroupLabel(selectedGroupBy, item.dateGroup)}
              </span>
              <span>
                {item.attendanceRate.toFixed(1)}% ({item.presentRecords}/
                {item.totalRecords})
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${item.attendanceRate}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {shouldLimitItems && items.length > MAX_ITEMS && (
        <p className="mt-2 text-[11px] text-gray-400">
          * 최근 {MAX_ITEMS}개의 데이터만 표시합니다.
        </p>
      )}
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
        선택한 기간 동안 출석이 누락된 셀이 없습니다.
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
            to="/admin/incomplete-checks-report"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            전체 현황 보기
          </Link>
        </div>
      )}
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
    <div className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-1 border border-sky-100">
      {options.map((option) => {
        const isActive = selectedGroupBy === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelectGroupBy(option.id)}
            className={`min-w-[52px] px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium rounded-full transition-colors duration-150
              ${
                isActive
                  ? "bg-sky-500 text-white shadow-sm"
                  : "bg-transparent text-sky-700 hover:bg-white/70 hover:text-sky-800"
              }
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

// --- 요약 모드 선택 필터 (1/3/6개월 / 학기 / 올해 전체) ---
const SummaryModeFilter: React.FC<{
  summaryMode: SummaryMode;
  onChange: (mode: SummaryMode) => void;
}> = ({ summaryMode, onChange }) => {
  const modes: { id: SummaryMode; label: string }[] = [
    { id: "1M", label: "최근 1개월" },
    { id: "3M", label: "최근 3개월" },
    { id: "6M", label: "최근 6개월" },
    { id: "SEMESTER", label: "학기별" },
    { id: "YEAR", label: "올해 전체" },
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

// --- 출석 누락 리포트 필터 탭 ---
const IncompleteFilterTabs: React.FC<{
  value: IncompleteFilter;
  onChange: (value: IncompleteFilter) => void;
  disableSemester?: boolean;
}> = ({ value, onChange, disableSemester }) => {
  const options: { id: IncompleteFilter; label: string; disabled?: boolean }[] =
    [
      { id: "WEEK", label: "이번 주" },
      { id: "MONTH", label: "이번 달" },
      { id: "SEMESTER", label: "학기" },
    ];

  return (
    <div className="inline-flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
      {options.map((opt) => {
        const isActive = value === opt.id;
        const isDisabled = opt.id === "SEMESTER" && disableSemester;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => !isDisabled && onChange(opt.id)}
            disabled={isDisabled}
            className={`px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md ${
              isDisabled
                ? "text-gray-300 cursor-not-allowed"
                : isActive
                ? "bg-white text-indigo-700 shadow"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
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

  // 일반 사용자용 기간 (AttendanceFilterBar)
  const [period, setPeriod] = useState("1m");
  const [groupBy, setGroupBy] = useState<AttendanceSummaryGroupBy>("MONTH"); // 기본 월별

  // 임원 요약용
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("YEAR"); // 기본: 올해 전체
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    null
  );

  // 출석 누락 리포트 필터 + 범위 표시용 상태
  const [incompleteFilter, setIncompleteFilter] =
    useState<IncompleteFilter>("WEEK"); // 기본: 이번 주
  const [incompleteDateRange, setIncompleteDateRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);

  const [totalNotices, setTotalNotices] = useState(0);
  const [totalPrayers, setTotalPrayers] = useState(0);
  const [incompleteCheckData, setIncompleteCheckData] = useState<
    IncompleteCheckReportDto[]
  >([]);

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";

  // 그래프/요약용 기간
  const trendRange = computeTrendRange(
    isExecutive,
    summaryMode,
    period,
    semesters,
    selectedSemesterId
  );

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

  // 요약 모드 변경 시, 내부 period도 맞춰서 변경
  const handleSummaryModeChange = (mode: SummaryMode) => {
    setSummaryMode(mode);

    if (mode === "1M") setPeriod("1m");
    else if (mode === "3M") setPeriod("3m");
    else if (mode === "6M") setPeriod("6m");
    else if (mode === "YEAR") setPeriod("12m");
    else if (mode === "SEMESTER") setPeriod("3m"); // 학기 모드일 때 대략 3개월 기준
  };

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isExec = user.role === "EXECUTIVE";

      // 1) 그래프/요약용 기간
      const { startDate, endDate } = computeTrendRange(
        isExec,
        summaryMode,
        period,
        semesters,
        selectedSemesterId
      );

      // 2) 출석 누락 리포트용 기간
      const incompleteRange = computeIncompleteRange(
        incompleteFilter,
        semesters,
        selectedSemesterId
      );
      setIncompleteDateRange(incompleteRange);

      const [mainData, noticesPage, prayersPage, trendData, incompleteData] =
        await Promise.all([
          dashboardService.getDashboardData(period),
          noticeService.getAllNotices({ size: 1 }),
          prayerService.getPrayers({ size: 1, sort: "createdAt,desc" }),
          statisticsService.getAttendanceTrend({ startDate, endDate, groupBy }),
          isExec
            ? reportService.getIncompleteCheckReport({
                startDate: incompleteRange.startDate,
                endDate: incompleteRange.endDate,
              })
            : Promise.resolve([] as IncompleteCheckReportDto[]),
        ]);

      let summaryToUse:
        | OverallAttendanceSummaryDto
        | OverallAttendanceStatDto
        | null = mainData.overallAttendanceSummary;

      // YEAR / SEMESTER인 경우는 전체 요약 통계를 별도로 조회해서 덮어쓰기
      if (isExec && (summaryMode === "YEAR" || summaryMode === "SEMESTER")) {
        try {
          if (summaryMode === "YEAR") {
            const currentYear = new Date().getFullYear();
            const yearSummary = await statisticsService.getOverallAttendance({
              year: currentYear,
            } as any);
            summaryToUse = yearSummary;
          } else if (summaryMode === "SEMESTER") {
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
  }, [
    user,
    period,
    groupBy,
    summaryMode,
    selectedSemesterId,
    semesters,
    incompleteFilter,
  ]);

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
          <CellLeaderDashboard />
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
      case "1M":
        return "최근 1개월 출석률";
      case "3M":
        return "최근 3개월 출석률";
      case "6M":
        return "최근 6개월 출석률";
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

  const incompleteRangeLabel = (() => {
    if (!incompleteDateRange) return "";
    const base = `${formatDateKorean(
      incompleteDateRange.startDate
    )} ~ ${formatDateKorean(incompleteDateRange.endDate)}`;
    if (incompleteFilter === "WEEK") {
      return `${base} (이번 주, 주일~토요일 기준)`;
    }
    if (incompleteFilter === "MONTH") {
      return `${base} (이번 달 기준)`;
    }
    return `${base} (선택 학기 기준)`;
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
            {/* 임원: 출석 통계 + 출석 누락 리포트 */}
            {isExecutive && dashboardData.overallAttendanceSummary && (
              <Card
                title="출석 통계"
                icon={<FaChartLine className="text-teal-500" />}
              >
                {/* 필터 영역 */}
                <div className="mb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    {/* 왼쪽: 출석 통계 기간 + 일/주/월 (같은 줄) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <SummaryModeFilter
                        summaryMode={summaryMode}
                        onChange={handleSummaryModeChange}
                      />
                      <GroupByFilter
                        selectedGroupBy={groupBy}
                        onSelectGroupBy={setGroupBy}
                      />
                    </div>

                    {/* 오른쪽: 학기 선택 (학기 모드일 때만) */}
                    {summaryMode === "SEMESTER" && semesters.length > 0 && (
                      <select
                        className="text-xs sm:text-sm border border-gray-300 rounded-md px-2 py-1 bg-white self-start lg:self-auto"
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

                {/* 상단: 총 출석률 요약 */}
                <div className="mt-2 sm:mt-4">
                  <OverallAttendanceSummaryCard
                    summary={dashboardData.overallAttendanceSummary}
                    label={summaryLabel}
                  />
                </div>

                {/* 중간: 출석률 추이 */}
                <AttendanceTrend
                  data={dashboardData.attendanceTrend}
                  selectedGroupBy={groupBy}
                  title="출석률 추이"
                  dateRange={trendRange}
                />

                {/* 하단: 출석 누락 리포트 */}
                <div className="mt-6 sm:mt-8">
                  {/* 타이틀 + 필터 + 학기 선택 + 조회 기간 한 블럭 */}
                  <div className="flex flex-col gap-2 mb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FaExclamationTriangle className="text-orange-500" />
                        <h4 className="text-sm font-semibold text-gray-800">
                          출석 누락 리포트
                        </h4>
                      </div>
                      <IncompleteFilterTabs
                        value={incompleteFilter}
                        onChange={setIncompleteFilter}
                        disableSemester={semesters.length === 0}
                      />
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      {/* 학기 선택 (출석 누락 리포트 기준, 학기 모드일 때만) */}
                      {incompleteFilter === "SEMESTER" &&
                        semesters.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] sm:text-xs text-gray-500">
                              학기 선택
                            </span>
                            <select
                              className="text-xs sm:text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
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
                          </div>
                        )}

                      {/* 조회 기간 표시 */}
                      {incompleteDateRange && (
                        <p className="text-[11px] sm:text-xs text-gray-500">
                          조회 기간: {incompleteRangeLabel}
                        </p>
                      )}
                    </div>
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

                <AttendanceTrend
                  data={dashboardData.attendanceTrend}
                  selectedGroupBy={groupBy}
                  title="출석률 추이"
                  dateRange={trendRange}
                />
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
