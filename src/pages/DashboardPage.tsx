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
  UnassignedMemberDto,
} from "../types";

import CellLeaderDashboard from "./CellLeaderDashboard";
import AttendanceFilterBar from "../components/AttendanceFilterBar";
import NewsCenterCard from "../components/dashboard/NewsCenterCard";
import CellStatusMap from "../components/dashboard/CellStatusMap";
import { DemographicsSection } from "../components/DemographicsSection";

// --- 타입 정의 ---
type IncompleteFilter = "WEEK" | "MONTH" | "SEMESTER";

// 스크롤바 숨김 스타일
const scrollbarHideStyle: React.CSSProperties = {
  msOverflowStyle: "none",
  scrollbarWidth: "none",
};

// 날짜 포맷팅 함수 (Display Only)
const safeFormatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  const y = dateStr.substring(0, 4);
  const m = dateStr.substring(5, 7);
  const d = dateStr.substring(8, 10);
  return `${y}.${m}.${d}`;
};

// --- Helper Functions ---

const computeTrendRange = (
  isExecutive: boolean,
  semesters: SemesterDto[],
  selectedSemesterId: number | null,
) => {
  let range = { startDate: "", endDate: "" };

  if (isExecutive) {
    // 임원: 선택된 학기(혹은 현재 학기) 기준
    const semester = semesters.find((s) => s.id === selectedSemesterId);
    if (semester) {
      range = { startDate: semester.startDate, endDate: semester.endDate };
    } else {
      // 학기 정보 없으면 올해 전체
      const year = new Date().getFullYear();
      range = {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }
  } else {
    // 셀리더: 최근 3개월 (기존 로직 유지)
    range = getPeriodDates("3m");
  }

  // Future Cap (오늘 이후 데이터 조회 방지)
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (range.endDate) {
    const rangeEnd = new Date(range.endDate);
    rangeEnd.setHours(23, 59, 59, 999);
    if (rangeEnd > today) {
      range.endDate = toISODateString(new Date());
    }
  }

  return range;
};

const computeIncompleteRange = (
  filter: IncompleteFilter,
  semesters: SemesterDto[],
  selectedSemesterId: number | null,
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
      requestedRange = {
        startDate: semester.startDate,
        endDate: semester.endDate,
      };
    } else {
      requestedRange = getThisWeekRange();
    }
  }

  // 선택 학기 범위로 clamp
  const selectedSemester = semesters.find((s) => s.id === selectedSemesterId);

  if (selectedSemester) {
    if (requestedRange.startDate < selectedSemester.startDate) {
      requestedRange.startDate = selectedSemester.startDate;
    }
    if (requestedRange.endDate > selectedSemester.endDate) {
      requestedRange.endDate = selectedSemester.endDate;
    }
  }

  // Future cap
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (requestedRange.endDate) {
    const reqEnd = new Date(requestedRange.endDate);
    reqEnd.setHours(23, 59, 59, 999);
    if (reqEnd > today) {
      requestedRange.endDate = toISODateString(new Date());
    }
  }

  // startDate > endDate 역전 방지
  if (requestedRange.startDate && requestedRange.endDate) {
    if (requestedRange.startDate > requestedRange.endDate) {
      if (selectedSemester) {
        requestedRange = {
          startDate: selectedSemester.startDate,
          endDate: selectedSemester.endDate,
        };
      } else {
        const tmp = requestedRange.startDate;
        requestedRange.startDate = requestedRange.endDate;
        requestedRange.endDate = tmp;
      }
      const fixedEnd = new Date(requestedRange.endDate);
      fixedEnd.setHours(23, 59, 59, 999);
      if (fixedEnd > today) {
        requestedRange.endDate = toISODateString(new Date());
      }
      if (requestedRange.startDate > requestedRange.endDate) {
        requestedRange.endDate = requestedRange.startDate;
      }
    }
  }

  return requestedRange;
};

// --- Sub Components ---

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
    <div
      className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 scrollbar-hide"
      style={scrollbarHideStyle}
    >
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-yellow-50 text-yellow-700 text-xs sm:text-sm border border-yellow-100 whitespace-nowrap flex-shrink-0">
        <FaBullhorn className="mr-2" /> 이번 주 공지{" "}
        {data.weeklyNoticeCount ?? 0}개
      </div>
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-blue-50 text-blue-700 text-xs sm:text-sm border border-blue-100 whitespace-nowrap flex-shrink-0">
        <FaPrayingHands className="mr-2" /> 이번 주 기도제목{" "}
        {data.weeklyPrayerCount ?? 0}개
      </div>
      {data.newcomerCount > 0 && (
        <div className="inline-flex items-center px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-medium border border-emerald-100 whitespace-nowrap flex-shrink-0">
          <FaUserPlus className="mr-2" /> 이번 주 새가족 {data.newcomerCount}명
        </div>
      )}
      <div
        className={`inline-flex items-center px-3 py-2 rounded-full text-xs sm:text-sm font-medium border whitespace-nowrap flex-shrink-0 ${attendanceChangeColor(
          data.attendanceChange,
        )}`}
      >
        {getAttendanceChangeIcon(data.attendanceChange)} 지난주 대비 출석 인원{" "}
        {data.attendanceChange > 0 ? "+" : ""} {data.attendanceChange}명
      </div>
      {data.unassignedMemberCount > 0 && (
        <div className="inline-flex items-center px-3 py-2 rounded-full bg-orange-50 text-orange-700 text-xs sm:text-sm font-medium border border-orange-100 whitespace-nowrap flex-shrink-0">
          <FaUserTag className="mr-2" />셀 미배정 인원{" "}
          {data.unassignedMemberCount}명
        </div>
      )}
    </div>
  );
};

const OverallAttendanceSummaryCard: React.FC<{
  summary: OverallAttendanceSummaryDto | OverallAttendanceStatDto | null;
  label?: string;
}> = ({ summary, label = "기간 총 출석률" }) => {
  if (!summary) return <div className="text-center p-4">데이터 없음</div>;

  let rate: number | undefined;
  let present: number | undefined;
  let possible: number | undefined;

  // 1) SummaryDto
  if ("totalSummary" in summary && summary.totalSummary) {
    rate = summary.totalSummary.attendanceRate;
    present = summary.totalSummary.totalPresent;
    possible = summary.totalSummary.totalPossible ?? undefined;
  }
  // 2) StatDto
  else if ("attendanceRate" in summary) {
    rate = summary.attendanceRate;
    present = undefined;
    possible = undefined;
  }

  const rateColor = (rate || 0) < 10 ? "text-red-500" : "text-indigo-600";

  return (
    <div className="grid grid-cols-1 gap-4 text-center">
      <div className="p-4 sm:p-5 bg-indigo-50 rounded-lg relative group">
        <div className="flex justify-center items-center gap-1 mb-1">
          <p className="text-xs sm:text-sm font-medium text-indigo-500 whitespace-nowrap">
            {label}
          </p>
          <div className="relative group/tooltip cursor-help">
            <span className="text-xs text-indigo-400">ⓘ</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              전체 재적 인원 대비 출석률입니다. <br /> (보고서 미제출도 모수에
              포함)
            </div>
          </div>
        </div>
        <p className={`mt-1 text-2xl sm:text-3xl font-semibold ${rateColor}`}>
          {typeof rate === "number" ? `${rate.toFixed(0)}%` : "-"}
        </p>
        {typeof present === "number" && typeof possible === "number" && (
          <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
            ({present}명 출석 / 총 {possible}명 대상)
          </p>
        )}
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
              <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">
                셀 이름
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-500 whitespace-nowrap">
                횟수
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">
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
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link
                    to={`/admin/cells/${r.cellId}`}
                    className="font-medium hover:text-indigo-600"
                  >
                    {r.cellName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-center text-red-600 font-bold whitespace-nowrap">
                  {r.missedDatesCount}
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
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
            className="text-xs text-indigo-500 hover:text-indigo-700 whitespace-nowrap"
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
  <div className="inline-flex gap-1 bg-gray-100 p-1 rounded-lg flex-shrink-0">
    {[
      { id: "WEEK", label: "이번 주" },
      { id: "MONTH", label: "이번 달" },
      { id: "SEMESTER", label: "학기" },
    ].map((opt) => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id as IncompleteFilter)}
        disabled={opt.id === "SEMESTER" && disableSemester}
        className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
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

  // Filters (Cell Leader only)
  const [period, setPeriod] = useState("3m");
  const [groupBy, setGroupBy] = useState<AttendanceSummaryGroupBy>("MONTH");

  // Semesters (Executive only - auto select)
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(
    null,
  );

  const [incompleteFilter, setIncompleteFilter] =
    useState<IncompleteFilter>("WEEK");

  const incompleteDateRange = useMemo(() => {
    return computeIncompleteRange(
      incompleteFilter,
      semesters,
      selectedSemesterId,
    );
  }, [incompleteFilter, semesters, selectedSemesterId]);

  const [totalNotices, setTotalNotices] = useState(0);
  const [totalPrayers, setTotalPrayers] = useState(0);
  const [incompleteCheckData, setIncompleteCheckData] = useState<
    IncompleteCheckReportDto[]
  >([]);
  const [unassignedList, setUnassignedList] = useState<UnassignedMemberDto[]>(
    [],
  );

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";

  // 임원단 학기 목록 로딩 & 자동 학기 선택
  useEffect(() => {
    let alive = true;
    if (!isExecutive) return;

    (async () => {
      try {
        const fullList = await semesterService.getAllSemesters();
        if (!alive) return;

        const sortedList = fullList.sort(
          (a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
        );
        setSemesters(sortedList);

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

        const targetSemester = currentSemester || sortedList[0];
        if (targetSemester) setSelectedSemesterId(targetSemester.id);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isExecutive]);

  // For Cell Leader only
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
      semesters,
      selectedSemesterId,
    );

    try {
      // 1. 메인 대시보드 데이터 호출
      const mainData = await dashboardService.getDashboardData(period, {
        startDate,
        endDate,
      });

      // 2. 추가 데이터 병렬 호출
      setLoadingSub(true);
      const [noticesPage, prayersPage, unassignedData] = await Promise.all([
        noticeService.getAllNotices({ size: 1 }),
        prayerService.getPrayers({ size: 1, sort: "createdAt,desc" }),
        isExecutive
          ? statisticsService.getUnassignedMembers()
          : Promise.resolve([]),
      ]);

      const filteredUnassigned = (unassignedData as any[]).filter(
        (m) => m.role !== "EXECUTIVE",
      );

      setTotalNotices(noticesPage.totalElements);
      setTotalPrayers(prayersPage.totalElements);
      setUnassignedList(filteredUnassigned);

      setDashboardData({
        ...mainData,
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
  }, [user, period, semesters, selectedSemesterId, isExecutive]);

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

  const incompleteRangeLabel = incompleteDateRange
    ? `${safeFormatDate(incompleteDateRange.startDate)} ~ ${safeFormatDate(
        incompleteDateRange.endDate,
      )}`
    : "";

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 whitespace-nowrap">
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
                title="출석 현황"
                icon={<FaChartLine className="text-teal-500" />}
              >
                {/* ✅ 필터 툴바 제거됨 (자동으로 현재 학기 기준)
                   ✅ 전체 출석률 카드 제거됨 
                   ✅ 추세 그래프 제거됨 
                */}

                {loadingCharts ? (
                  <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2" />
                    <span className="text-xs">데이터 분석 중...</span>
                  </div>
                ) : (
                  <>
                    {/* 바로 셀 현황 지도 표시 */}
                    {dashboardData?.cellAttendanceSummaries ? (
                      <CellStatusMap
                        cellSummaries={dashboardData.cellAttendanceSummaries}
                      />
                    ) : (
                      <div className="py-10 text-center text-gray-400 text-sm">
                        표시할 셀 데이터가 없습니다.
                      </div>
                    )}
                  </>
                )}

                <div className="mt-8 border-t pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                    <div className="flex items-center gap-2">
                      <FaExclamationTriangle className="text-orange-500" />
                      <h4 className="font-semibold text-gray-800 whitespace-nowrap">
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
                    <p className="text-[11px] text-gray-400 text-right mb-2 whitespace-nowrap">
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

                <div id="unassigned-section" className="mt-8 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FaUserTag className="text-orange-500 text-lg" />
                      <h4 className="font-semibold text-gray-800 whitespace-nowrap">
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
                                    className="text-base font-bold text-indigo-600 hover:underline flex items-center gap-1 min-w-0"
                                  >
                                    <span className="truncate">
                                      {member.name}
                                    </span>
                                    <FaChevronRight
                                      size={10}
                                      className="opacity-50 flex-shrink-0"
                                    />
                                  </button>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
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
                                  <span className="text-gray-400 block whitespace-nowrap">
                                    연락처
                                  </span>
                                  <span className="truncate">
                                    {member.phone}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400 block whitespace-nowrap">
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
                                className="w-full py-1.5 bg-indigo-50 text-indigo-600 rounded text-xs font-semibold hover:bg-indigo-100 whitespace-nowrap"
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
                              className="text-xs text-indigo-500 hover:underline whitespace-nowrap"
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
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                                이름
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                                성별
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                                연락처
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                                등록 연도
                              </th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 whitespace-nowrap">
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
                                      className={`px-2 py-0.5 rounded whitespace-nowrap ${
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
                                          `/admin/users/${member.id}/edit`,
                                        )
                                      }
                                      className="text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
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
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
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
                          <h4 className="font-semibold text-gray-800 whitespace-nowrap">
                            공동체 구성 통계
                          </h4>
                        </div>
                        <DemographicsSection
                          data={dashboardData.demographics}
                          realUnassignedCount={unassignedList.length} // ✅ 수정됨: 정확한 인원수 전달
                          onUnassignedClick={() => {
                            document
                              .getElementById("unassigned-section")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
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
                {/* 셀리더는 요약 카드와 추세 그래프 유지 */}
                <OverallAttendanceSummaryCard
                  summary={dashboardData?.overallAttendanceSummary || null}
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
