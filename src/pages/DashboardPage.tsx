// src/pages/DashboardPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPrayingHands,
  FaBullhorn,
  FaChartLine,
  FaExclamationTriangle,
  FaUserPlus,
  FaUserTag,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaUserFriends,
  FaChevronRight,
  FaCalendarAlt,
} from "react-icons/fa";

import { dashboardService } from "../services/dashboardService";
import { noticeService } from "../services/noticeService";
import { prayerService } from "../services/prayerService";
import { statisticsService } from "../services/statisticsService";
import { reportService } from "../services/reportService";
import { semesterService } from "../services/semesterService";

import { useAuth } from "../hooks/useAuth";
import { translateRole } from "../utils/roleUtils";
import {
  getPeriodDates,
  getThisWeekRange,
  toISODateString,
} from "../utils/dateutils";

import type {
  DashboardDto,
  OverallAttendanceSummaryDto,
  OverallAttendanceStatDto,
  IncompleteCheckReportDto,
  SemesterDto,
  AttendanceSummaryGroupBy,
  AggregatedTrendDto,
  UnassignedMemberDto,
} from "../types";

import CellLeaderDashboard from "./CellLeaderDashboard";
import AttendanceFilterBar from "../components/AttendanceFilterBar";
import NewsCenterCard from "../components/dashboard/NewsCenterCard";
import CellStatusMap from "../components/dashboard/CellStatusMap";
import { DemographicsSection } from "../components/DemographicsSection";

// --- 타입 정의 ---
type SummaryMode = "SEMESTER" | "YEAR";
type IncompleteFilter = "WEEK" | "MONTH" | "SEMESTER";

// ✅ 날짜 포맷팅 함수
const safeFormatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  const targetStr =
    dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;

  const date = new Date(targetStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

// --- Helper Functions ---
const computeTrendRange = (
  isExecutive: boolean,
  summaryMode: SummaryMode,
  period: string,
  semesters: SemesterDto[],
  selectedSemesterId: number | null
) => {
  if (!isExecutive) return getPeriodDates(period);

  const currentYear = new Date().getFullYear();
  let range = {
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`,
  };

  if (summaryMode === "YEAR") {
    range = {
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
    };
  } else if (summaryMode === "SEMESTER") {
    const semester = semesters.find((s) => s.id === selectedSemesterId);
    if (semester) {
      range = { startDate: semester.startDate, endDate: semester.endDate };
    }
  }
  return range;
};

const computeIncompleteRange = (
  filter: IncompleteFilter,
  semesters: SemesterDto[],
  selectedSemesterId: number | null
) => {
  let requestedRange = { startDate: "", endDate: "" };

  if (filter === "WEEK") {
    requestedRange = getThisWeekRange();
  } else if (filter === "MONTH") {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    requestedRange = {
      startDate: toISODateString(first),
      endDate: toISODateString(last),
    };
  } else {
    const semester =
      semesters.find((s) => s.id === selectedSemesterId) ??
      semesters.find((s) => s.isActive) ??
      semesters[0];
    if (semester) {
      return { startDate: semester.startDate, endDate: semester.endDate };
    }
    return getThisWeekRange();
  }

  const semester = semesters.find((s) => s.id === selectedSemesterId);
  if (!semester) return requestedRange;

  const reqStart = new Date(requestedRange.startDate);
  const semStart = new Date(semester.startDate);
  const finalStart = reqStart > semStart ? reqStart : semStart;

  const reqEnd = new Date(requestedRange.endDate);
  const semEnd = new Date(semester.endDate);
  const finalEnd = reqEnd < semEnd ? reqEnd : semEnd;

  if (finalStart > finalEnd) {
    return { startDate: semester.startDate, endDate: semester.endDate };
  }

  return {
    startDate: toISODateString(finalStart),
    endDate: toISODateString(finalEnd),
  };
};

const formatDateGroupLabel = (
  groupBy: AttendanceSummaryGroupBy,
  raw: string
): string => {
  if (!raw) return raw;
  if (groupBy === "SEMESTER") return raw;
  if (groupBy === "YEAR") return `${raw}년`;
  if (groupBy === "MONTH") {
    const [y, m] = raw.split("-");
    return `${y}년 ${parseInt(m)}월`;
  }
  if (groupBy === "WEEK") {
    const [y, w] = raw.split("-W");
    return `${y}년 ${w}주차`;
  }
  return safeFormatDate(raw);
};

// --- Sub Components ---
const DashboardFilterToolbar: React.FC<{
  summaryMode: SummaryMode;
  onSummaryModeChange: (m: SummaryMode) => void;
  groupBy: AttendanceSummaryGroupBy;
  onGroupByChange: (g: AttendanceSummaryGroupBy) => void;
  semesters: SemesterDto[];
  selectedSemesterId: number | null;
  onSemesterChange: (id: number) => void;
}> = ({
  summaryMode,
  onSummaryModeChange,
  groupBy,
  onGroupByChange,
  semesters,
  selectedSemesterId,
  onSemesterChange,
}) => {
  return (
    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaCalendarAlt className="text-gray-400" />
          </div>
          <select
            value={summaryMode}
            onChange={(e) => onSummaryModeChange(e.target.value as SummaryMode)}
            className="pl-9 pr-8 py-2 w-full sm:w-auto text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm cursor-pointer"
          >
            <option value="SEMESTER">학기별 조회</option>
            <option value="YEAR">연간 조회 (올해)</option>
          </select>
        </div>

        {summaryMode === "SEMESTER" && semesters.length > 0 && (
          <select
            value={selectedSemesterId ?? ""}
            onChange={(e) => onSemesterChange(Number(e.target.value))}
            className="py-2 pl-3 pr-8 w-full sm:w-auto text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm cursor-pointer"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startDate.substring(0, 4)})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 hidden sm:inline">
          그래프 단위:
        </span>
        <div className="flex bg-white rounded-md shadow-sm border border-gray-200 p-1">
          {(["DAY", "MONTH"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onGroupByChange(opt)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                groupBy === opt
                  ? "bg-indigo-50 text-indigo-700 font-bold"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt === "DAY" ? "일" : "월"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Card: React.FC<{
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}> = ({ icon, title, children, className = "", actions }) => (
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

const TopSummaryChips: React.FC<{ data: DashboardDto }> = ({ data }) => {
  const getAttendanceChangeIcon = (change: number) => {
    if (change > 0) return <FaArrowUp className="mr-2" />;
    if (change < 0) return <FaArrowDown className="mr-2" />;
    return <FaMinus className="mr-2" />;
  };

  const attendanceChangeColor = (change: number) => {
    if (change > 0) return "bg-indigo-50 text-indigo-700 border-indigo-100";
    if (change < 0) return "bg-gray-100 text-gray-600 border-gray-200";
    return "bg-gray-50 text-gray-500 border-gray-100";
  };

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-yellow-50 text-yellow-700 text-xs sm:text-sm border border-yellow-100">
        <FaBullhorn className="mr-2" />
        이번 주 공지 {data.weeklyNoticeCount ?? 0}개
      </div>
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-blue-50 text-blue-700 text-xs sm:text-sm border border-blue-100">
        <FaPrayingHands className="mr-2" />
        이번 주 기도제목 {data.weeklyPrayerCount ?? 0}개
      </div>
      {data.newcomerCount > 0 && (
        <div className="inline-flex items-center px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-medium border border-emerald-100">
          <FaUserPlus className="mr-2" />
          이번 주 새가족 {data.newcomerCount}명
        </div>
      )}
      <div
        className={`inline-flex items-center px-3 py-2 rounded-full text-xs sm:text-sm font-medium border ${attendanceChangeColor(
          data.attendanceChange
        )}`}
      >
        {getAttendanceChangeIcon(data.attendanceChange)}
        지난주 대비 출석 인원 {data.attendanceChange > 0 ? "+" : ""}
        {data.attendanceChange}명
      </div>
      {data.unassignedMemberCount > 0 && (
        <div className="inline-flex items-center px-3 py-2 rounded-full bg-orange-50 text-orange-700 text-xs sm:text-sm font-medium border border-orange-100">
          <FaUserTag className="mr-2" />셀 미배정 인원{" "}
          {data.unassignedMemberCount}명
        </div>
      )}
    </div>
  );
};

// ✅ [수정] 출석 인원 상세 표기 및 툴팁 추가
const OverallAttendanceSummaryCard: React.FC<{
  summary: OverallAttendanceSummaryDto | OverallAttendanceStatDto | null;
  label?: string;
}> = ({ summary, label = "기간 총 출석률" }) => {
  if (!summary) return <div className="text-center p-4">데이터 없음</div>;

  let rate: number | undefined;
  let present: number | undefined;
  let possible: number | undefined;

  // DTO 구조에 따른 데이터 추출
  if ("totalSummary" in summary && summary.totalSummary) {
    rate = summary.totalSummary.attendanceRate;
    present = summary.totalSummary.totalPresent;
    possible = summary.totalSummary.totalPossible;
  } else if ("attendanceRate" in summary) {
    // OverallAttendanceStatDto (통계 서비스 사용 시)
    rate = summary.attendanceRate;
    present = (summary as any).totalPresent;
    possible = (summary as any).totalPossible ?? summary.totalRecords;
  }

  // 출석률이 너무 낮으면 색상 변경 등 시각적 강조 가능
  const rateColor = (rate || 0) < 10 ? "text-red-500" : "text-indigo-600";

  return (
    <div className="grid grid-cols-1 gap-4 text-center">
      <div className="p-4 sm:p-5 bg-indigo-50 rounded-lg relative group">
        <div className="flex justify-center items-center gap-1 mb-1">
          <p className="text-xs sm:text-sm font-medium text-indigo-500">
            {label}
          </p>
          {/* 툴팁 */}
          <div className="relative group/tooltip cursor-help">
            <span className="text-xs text-indigo-400">ⓘ</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              전체 재적 인원 대비 출석률입니다.
              <br />
              (보고서 미제출도 모수에 포함)
            </div>
          </div>
        </div>

        {/* 🔴 [수정 완료] toFixed(1) -> toFixed(0) 으로 변경하여 정수 표현 */}
        <p className={`mt-1 text-2xl sm:text-3xl font-semibold ${rateColor}`}>
          {typeof rate === "number" ? `${rate.toFixed(0)}%` : "-"}
        </p>

        {/* 상세 수치 (출석/대상) */}
        {typeof present === "number" && typeof possible === "number" && (
          <p className="text-xs text-gray-500 mt-1">
            ({present}명 출석 / 총 {possible}명 대상)
          </p>
        )}
      </div>
    </div>
  );
};

// ✅ [수정] 소수점 제거 (.toFixed(0))
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
        데이터가 없습니다.
      </div>
    );
  }
  const shouldLimit = selectedGroupBy === "DAY" || selectedGroupBy === "WEEK";
  const MAX_ITEMS = 12;
  const slicedData =
    shouldLimit && items.length > MAX_ITEMS ? items.slice(-MAX_ITEMS) : items;

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm sm:text-base font-semibold text-gray-800">
          {title}
        </h2>
        {dateRange && (
          <span className="text-[10px] text-gray-400">
            {safeFormatDate(dateRange.startDate)} ~{" "}
            {safeFormatDate(dateRange.endDate)}
          </span>
        )}
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {slicedData.map((item) => (
          <div key={item.dateGroup} className="space-y-1">
            <div className="flex justify-between text-[11px] sm:text-xs text-gray-600">
              <span>
                {formatDateGroupLabel(selectedGroupBy, item.dateGroup)}
              </span>
              <span>
                {item.attendanceRate.toFixed(0)}% ({item.presentRecords}/
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
    </div>
  );
};

const IncompleteAttendanceSection: React.FC<{
  reports: IncompleteCheckReportDto[];
}> = ({ reports }) => {
  if (!reports || reports.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        누락된 셀이 없습니다.
      </div>
    );
  }
  const top = reports.slice(0, 5);
  return (
    <div>
      <div className="border border-gray-100 rounded-xl overflow-hidden mt-2">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                셀 이름
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">
                횟수
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                최근 누락
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((r, i) => (
              <tr
                key={r.cellId}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-3 py-2">
                  <Link
                    to={`/admin/cells/${r.cellId}`}
                    className="font-medium hover:text-indigo-600"
                  >
                    {r.cellName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center text-red-600 font-bold">
                  {r.missedDatesCount}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {safeFormatDate(r.missedDates[r.missedDates.length - 1])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reports.length > 5 && (
        <div className="text-right mt-2">
          <Link
            to="/admin/incomplete-checks-report"
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            전체 보기
          </Link>
        </div>
      )}
    </div>
  );
};

const IncompleteFilterTabs: React.FC<{
  value: IncompleteFilter;
  onChange: (v: IncompleteFilter) => void;
  disableSemester?: boolean;
}> = ({ value, onChange, disableSemester }) => (
  <div className="inline-flex gap-1 bg-gray-100 p-1 rounded-lg">
    {[
      { id: "WEEK", label: "이번 주" },
      { id: "MONTH", label: "이번 달" },
      { id: "SEMESTER", label: "학기" },
    ].map((opt) => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id as IncompleteFilter)}
        disabled={opt.id === "SEMESTER" && disableSemester}
        className={`px-3 py-1.5 text-xs font-medium rounded-md ${
          value === opt.id
            ? "bg-white text-indigo-700 shadow"
            : "text-gray-600 hover:bg-gray-200"
        } ${
          opt.id === "SEMESTER" && disableSemester
            ? "opacity-50 cursor-not-allowed"
            : ""
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// --- Main Page Component ---
const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [loadingSub, setLoadingSub] = useState(true);
  const [loadingIncomplete, setLoadingIncomplete] = useState(false);

  const [dashboardData, setDashboardData] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [period, setPeriod] = useState("3m");
  const [groupBy, setGroupBy] = useState<AttendanceSummaryGroupBy>("MONTH");
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("SEMESTER");
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    null
  );

  const [incompleteFilter, setIncompleteFilter] =
    useState<IncompleteFilter>("WEEK");

  const incompleteDateRange = useMemo(() => {
    return computeIncompleteRange(
      incompleteFilter,
      semesters,
      selectedSemesterId
    );
  }, [incompleteFilter, semesters, selectedSemesterId]);

  const [totalNotices, setTotalNotices] = useState(0);
  const [totalPrayers, setTotalPrayers] = useState(0);
  const [incompleteCheckData, setIncompleteCheckData] = useState<
    IncompleteCheckReportDto[]
  >([]);
  const [unassignedList, setUnassignedList] = useState<UnassignedMemberDto[]>(
    []
  );

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";

  // 학기 목록 로딩
  useEffect(() => {
    let alive = true;
    if (!isExecutive) return;

    (async () => {
      try {
        const fullList = await semesterService.getAllSemesters();
        if (!alive) return;

        const activeList = fullList.filter((s) => s.isActive);
        setSemesters(activeList);

        const today = new Date();
        const currentMonthTotal =
          today.getFullYear() * 12 + (today.getMonth() + 1);

        const currentSemester = activeList.find((s) => {
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

        const targetSemester = currentSemester || activeList[0];
        if (targetSemester) setSelectedSemesterId(targetSemester.id);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isExecutive]);

  const handleSummaryModeChange = (mode: SummaryMode) => {
    setSummaryMode(mode);
    setLoadingMain(true);
  };
  const handleSemesterChange = (id: number) => {
    setSelectedSemesterId(id);
    setLoadingMain(true);
  };
  const handleGroupByChange = (g: AttendanceSummaryGroupBy) => {
    setGroupBy(g);
    setLoadingCharts(true);
  };
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    setLoadingMain(true);
  };
  const handleIncompleteFilterChange = (filter: IncompleteFilter) => {
    setIncompleteFilter(filter);
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (isExecutive && semesters.length === 0) return;

    setError(null);

    const { startDate, endDate } = computeTrendRange(
      isExecutive,
      summaryMode,
      period,
      semesters,
      selectedSemesterId
    );

    try {
      // 1) 메인 (DashboardDto)
      const mainData = await dashboardService.getDashboardData(period, {
        startDate,
        endDate,
      });

      // 2) 차트 + Summary
      setLoadingCharts(true);
      const chartPromise = statisticsService.getAttendanceTrend({
        startDate,
        endDate,
        groupBy,
      });

      const summaryPromise = (async () => {
        if (isExecutive && selectedSemesterId) {
          if (summaryMode === "YEAR") {
            const currentYear = new Date().getFullYear();
            return await statisticsService.getOverallAttendance({
              year: currentYear,
            } as any);
          }
          const sm = semesters.find((s) => s.id === selectedSemesterId);
          if (sm) {
            return await statisticsService.getOverallAttendance({
              startDate: sm.startDate,
              endDate: sm.endDate,
            } as any);
          }
        }
        return mainData.overallAttendanceSummary;
      })();

      const [trendData, finalSummary] = await Promise.all([
        chartPromise,
        summaryPromise,
      ]);

      // 3) 부가 데이터
      setLoadingSub(true);
      const [noticesPage, prayersPage, unassignedData] = await Promise.all([
        noticeService.getAllNotices({ size: 1 }),
        prayerService.getPrayers({ size: 1, sort: "createdAt,desc" }),
        isExecutive
          ? statisticsService.getUnassignedMembers()
          : Promise.resolve([]),
      ]);

      // ✅ [필터링] 미배정 인원에서 임원단(EXECUTIVE) 제외
      const filteredUnassigned = (unassignedData as any[]).filter(
        (m) => m.role !== "EXECUTIVE"
      );

      setTotalNotices(noticesPage.totalElements);
      setTotalPrayers(prayersPage.totalElements);
      setUnassignedList(filteredUnassigned);

      // Dashboard 데이터 업데이트
      setDashboardData({
        ...mainData,
        overallAttendanceSummary:
          finalSummary ?? mainData.overallAttendanceSummary,
        attendanceTrend: trendData,
        unassignedMemberCount: filteredUnassigned.length,
      });

      setLoadingMain(false);
      setLoadingCharts(false);
      setLoadingSub(false);
    } catch (err) {
      console.error(err);
      setError("데이터 일부를 불러오지 못했습니다.");
      setLoadingMain(false);
      setLoadingCharts(false);
      setLoadingSub(false);
    }
  }, [
    user,
    period,
    groupBy,
    summaryMode,
    selectedSemesterId,
    semesters,
    isExecutive,
  ]);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      void fetchData();
    });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  useEffect(() => {
    if (!isExecutive) return;

    const fetchIncompleteReport = async () => {
      setLoadingIncomplete(true);
      try {
        const data = await reportService.getIncompleteCheckReport({
          startDate: incompleteDateRange.startDate,
          endDate: incompleteDateRange.endDate,
        });
        setIncompleteCheckData(data);
      } catch (e) {
        console.error("누락 리포트 로딩 실패", e);
      } finally {
        setLoadingIncomplete(false);
      }
    };

    fetchIncompleteReport();
  }, [isExecutive, incompleteDateRange]);

  if (!user) return <div>로그인이 필요합니다.</div>;
  if (isCellLeader)
    return (
      <div className="bg-gray-50 min-h-screen p-4 sm:p-8">
        <CellLeaderDashboard />
      </div>
    );

  if (error && !dashboardData)
    return <div className="p-8 text-center text-red-500">{error}</div>;

  const summaryLabel = (() => {
    if (!isExecutive) return "기간 총 출석률";
    if (summaryMode === "YEAR")
      return `${new Date().getFullYear()}년 전체 출석률`;
    if (summaryMode === "SEMESTER") {
      const s = semesters.find((x) => x.id === selectedSemesterId);
      return s?.name ? `${s.name} 출석률` : "학기별";
    }
    return "기간별 출석률";
  })();

  const incompleteRangeLabel = incompleteDateRange
    ? `${safeFormatDate(incompleteDateRange.startDate)} ~ ${safeFormatDate(
        incompleteDateRange.endDate
      )}`
    : "";

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">
            대시보드
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-semibold text-indigo-600">{user.name}</span>
            님({translateRole(user.role)}) 환영합니다.
          </p>

          <div className="mt-4 min-h-[40px]">
            {loadingMain ? (
              <div className="flex gap-2 animate-pulse">
                <div className="h-8 w-32 bg-gray-200 rounded-full"></div>
                <div className="h-8 w-32 bg-gray-200 rounded-full"></div>
                <div className="h-8 w-32 bg-gray-200 rounded-full"></div>
              </div>
            ) : (
              dashboardData && <TopSummaryChips data={dashboardData} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {isExecutive && (
              <Card
                title="출석 통계"
                icon={<FaChartLine className="text-teal-500" />}
              >
                <div className="mb-6">
                  <DashboardFilterToolbar
                    summaryMode={summaryMode}
                    onSummaryModeChange={handleSummaryModeChange}
                    groupBy={groupBy}
                    onGroupByChange={handleGroupByChange}
                    semesters={semesters}
                    selectedSemesterId={selectedSemesterId}
                    onSemesterChange={handleSemesterChange}
                  />
                </div>

                {loadingCharts ? (
                  <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2" />
                    <span className="text-xs">데이터 분석 중...</span>
                  </div>
                ) : (
                  <>
                    <OverallAttendanceSummaryCard
                      summary={dashboardData?.overallAttendanceSummary || null}
                      label={summaryLabel}
                    />
                    <AttendanceTrend
                      data={dashboardData?.attendanceTrend}
                      selectedGroupBy={groupBy}
                      title="출석률 추이"
                      dateRange={computeTrendRange(
                        isExecutive,
                        summaryMode,
                        period,
                        semesters,
                        selectedSemesterId
                      )}
                    />
                    {dashboardData?.cellAttendanceSummaries && (
                      <CellStatusMap
                        cellSummaries={dashboardData.cellAttendanceSummaries}
                      />
                    )}
                  </>
                )}

                <div className="mt-8 border-t pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                    <div className="flex items-center gap-2">
                      <FaExclamationTriangle className="text-orange-500" />
                      <h4 className="font-semibold text-gray-800">
                        출석 누락 리포트
                      </h4>
                    </div>
                    <IncompleteFilterTabs
                      value={incompleteFilter}
                      onChange={handleIncompleteFilterChange}
                      disableSemester={semesters.length === 0}
                    />
                  </div>

                  {incompleteDateRange && (
                    <p className="text-[11px] text-gray-400 text-right mb-2">
                      조회 기간: {incompleteRangeLabel}
                    </p>
                  )}

                  {loadingIncomplete ? (
                    <div className="py-4 text-center text-xs text-gray-400">
                      데이터 불러오는 중...
                    </div>
                  ) : (
                    <IncompleteAttendanceSection
                      reports={incompleteCheckData}
                    />
                  )}
                </div>

                {/* ✅ [위치 이동] 미배정 인원 상세 리스트 (통계 위로) */}
                <div id="unassigned-section" className="mt-8 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FaUserTag className="text-orange-500 text-lg" />
                      <h4 className="font-semibold text-gray-800">
                        셀 미배정 인원 목록 ({unassignedList.length}명)
                      </h4>
                    </div>
                  </div>

                  {loadingSub ? (
                    <div className="py-8 text-center bg-gray-50 rounded-lg animate-pulse">
                      목록을 불러오고 있습니다...
                    </div>
                  ) : (
                    <>
                      {/* 모바일 뷰 */}
                      <div className="block md:hidden bg-gray-50 p-3 space-y-3 rounded-lg">
                        {unassignedList.slice(0, 5).map((member) => {
                          return (
                            <div
                              key={member.id}
                              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <button
                                    onClick={() =>
                                      navigate(`/admin/users/${member.id}`)
                                    }
                                    className="text-base font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                  >
                                    {member.name}
                                    <FaChevronRight
                                      size={10}
                                      className="opacity-50"
                                    />
                                  </button>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                        member.gender === "MALE"
                                          ? "bg-blue-50 text-blue-700"
                                          : "bg-pink-50 text-pink-700"
                                      }`}
                                    >
                                      {member.gender === "MALE"
                                        ? "남자"
                                        : "여자"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                                <div>
                                  <span className="text-gray-400 block">
                                    연락처
                                  </span>
                                  {member.phone}
                                </div>
                                <div>
                                  <span className="text-gray-400 block">
                                    등록
                                  </span>
                                  {member.registeredDate?.substring(0, 4) ||
                                    "-"}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  navigate(`/admin/users/${member.id}/edit`)
                                }
                                className="w-full py-1.5 bg-indigo-50 text-indigo-600 rounded text-xs font-semibold hover:bg-indigo-100"
                              >
                                셀 배정하기
                              </button>
                            </div>
                          );
                        })}

                        {unassignedList.length === 0 && (
                          <div className="text-center py-4 text-xs text-gray-500">
                            셀 미배정 인원이 없습니다.
                          </div>
                        )}

                        {unassignedList.length > 5 && (
                          <div className="text-center pt-2">
                            <Link
                              to="/admin/statistics"
                              className="text-xs text-indigo-500 hover:underline"
                            >
                              전체 보기
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* 데스크탑 뷰 */}
                      <div className="hidden md:block overflow-x-auto border border-gray-100 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                이름
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                성별
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                연락처
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                등록 연도
                              </th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">
                                관리
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {unassignedList.slice(0, 5).map((member) => {
                              return (
                                <tr
                                  key={member.id}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-900">
                                    <button
                                      onClick={() =>
                                        navigate(`/admin/users/${member.id}`)
                                      }
                                      className="text-indigo-600 hover:underline"
                                    >
                                      {member.name}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                                    <span
                                      className={`px-2 py-0.5 rounded ${
                                        member.gender === "MALE"
                                          ? "bg-blue-50 text-blue-700"
                                          : "bg-pink-50 text-pink-700"
                                      }`}
                                    >
                                      {member.gender === "MALE"
                                        ? "남자"
                                        : "여자"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                    {member.phone}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                                    {member.registeredDate?.substring(0, 4) ||
                                      "-"}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center text-xs">
                                    <button
                                      onClick={() =>
                                        navigate(
                                          `/admin/users/${member.id}/edit`
                                        )
                                      }
                                      className="text-indigo-600 hover:text-indigo-800 font-medium"
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
                                  colSpan={5}
                                  className="px-4 py-6 text-center text-xs text-gray-500"
                                >
                                  셀 미배정 인원이 없습니다.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>

                        {unassignedList.length > 5 && (
                          <div className="bg-gray-50 px-4 py-2 text-right border-t border-gray-100">
                            <Link
                              to="/admin/statistics"
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              전체 보기 &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* 공동체 구성 통계 */}
                {loadingCharts
                  ? null
                  : dashboardData?.demographics && (
                      <div className="mt-8 border-t pt-6">
                        <div className="flex items-center gap-2 mb-4">
                          <FaUserFriends className="text-blue-500 text-lg" />
                          <h4 className="font-semibold text-gray-800">
                            공동체 구성 통계
                          </h4>
                        </div>
                        <DemographicsSection
                          data={dashboardData.demographics}
                        />
                      </div>
                    )}
              </Card>
            )}

            {!isExecutive && (
              <Card title="출석 요약" icon={<FaChartLine />}>
                <div className="mb-4">
                  <AttendanceFilterBar
                    period={period}
                    groupBy={groupBy}
                    onChangePeriod={handlePeriodChange}
                    onChangeGroupBy={handleGroupByChange}
                  />
                </div>
                <OverallAttendanceSummaryCard
                  summary={dashboardData?.overallAttendanceSummary || null}
                />
                <AttendanceTrend
                  data={dashboardData?.attendanceTrend}
                  selectedGroupBy={groupBy}
                  title="출석률 추이"
                  dateRange={computeTrendRange(
                    isExecutive,
                    summaryMode,
                    period,
                    semesters,
                    selectedSemesterId
                  )}
                />
              </Card>
            )}
          </div>

          <div className="space-y-6 xl:col-span-1 xl:sticky xl:top-24 self-start">
            {loadingMain ? (
              <div className="h-64 bg-white rounded-2xl shadow-lg p-6 animate-pulse"></div>
            ) : (
              dashboardData && (
                <NewsCenterCard
                  data={dashboardData}
                  canManageNotices={isExecutive}
                  totalNotices={totalNotices}
                  totalPrayers={totalPrayers}
                  baseRoute="admin"
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
