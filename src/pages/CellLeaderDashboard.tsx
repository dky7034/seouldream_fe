// src/pages/CellLeaderDashboard.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { cellService } from "../services/cellService";
import { attendanceService } from "../services/attendanceService";
import type {
  CellLeaderDashboardDto,
  User,
  AttendanceSummaryQueryParams,
  AttendanceDto,
  Page,
  CellMemberAttendanceSummaryDto,
} from "../types";
import {
  FaChartBar,
  FaUsers,
  FaUserCheck,
  FaExclamationTriangle,
} from "react-icons/fa";

interface CellLeaderDashboardProps {
  user: User;
}

type Period = "week" | "month" | "default" | "year";

// 공통 숫자 카드
const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
}> = ({ title, value, icon }) => (
  <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg flex items-center">
    <div className="bg-indigo-100 text-indigo-600 p-3 sm:p-4 rounded-full mr-4 sm:mr-6 flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">
        {title}
      </p>
      <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-800">
        {value}
      </p>
    </div>
  </div>
);

// 한국식 날짜 포맷
const formatDateKorean = (dateStr: string | undefined | null) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${m}월 ${d}일`;
};

// 주일(일요일) 기준 이번 주 범위 계산
const getThisWeekRangeFromSunday = (): {
  startDate: string;
  endDate: string;
} => {
  const today = new Date();
  const day = today.getDay(); // 0: 일요일
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const toISO = (date: Date) => date.toISOString().split("T")[0];

  return {
    startDate: toISO(sunday),
    endDate: toISO(saturday),
  };
};

// 상단 요약 칩
const SummaryChips: React.FC<{
  dashboardSummary: CellLeaderDashboardDto | null;
  thisWeekAttendanceRate: number | null;
  memberCount: number;
}> = ({ dashboardSummary, thisWeekAttendanceRate, memberCount }) => {
  const periodAttendanceRate =
    dashboardSummary && !isNaN(dashboardSummary.attendanceRate)
      ? dashboardSummary.attendanceRate
      : null;

  const incompleteWeeks = dashboardSummary?.incompleteCheckCount ?? 0;

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 sm:mt-2">
      {/* 선택 기간 출석률 */}
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-indigo-50 text-indigo-700 text-xs sm:text-sm">
        <FaChartBar className="mr-2" />
        {periodAttendanceRate !== null
          ? `선택 기간 출석률 ${periodAttendanceRate.toFixed(1)}%`
          : "선택 기간 출석률 정보 없음"}
      </div>

      {/* 이번 주 출석률 */}
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-sky-50 text-sky-700 text-xs sm:text-sm">
        <FaUserCheck className="mr-2" />
        {thisWeekAttendanceRate !== null
          ? `이번 주 출석률 ${thisWeekAttendanceRate.toFixed(1)}%`
          : "이번 주 출석 데이터 없음"}
      </div>

      {/* 셀 멤버 수 + 미완료 주수 */}
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-amber-50 text-amber-700 text-xs sm:text-sm">
        <FaUsers className="mr-2" />
        {memberCount > 0
          ? `현재 셀 멤버 ${memberCount}명 · 미완료 출석 ${incompleteWeeks}주`
          : `미완료 출석 ${incompleteWeeks}주`}
      </div>
    </div>
  );
};

// 선택 기간 출석 현황 테이블
const PeriodAttendanceTable: React.FC<{
  attendances: AttendanceDto[];
  period: Period;
  range: { startDate?: string; endDate?: string };
}> = ({ attendances, period, range }) => {
  const periodLabelMap: Record<Period, string> = {
    week: "이번 주",
    month: "이번 달",
    default: "현재 학기",
    year: "올해",
  };

  const title = `${periodLabelMap[period]} 출석 현황`;

  const description =
    range.startDate && range.endDate
      ? `기준 기간: ${formatDateKorean(range.startDate)} ~ ${formatDateKorean(
          range.endDate
        )}`
      : "기준 기간: 현재 학기(임원단이 설정한 학기 기준) 출석 기록입니다.";

  const sorted = useMemo(
    () =>
      attendances && attendances.length > 0
        ? [...attendances].sort((a, b) => {
            if (a.member.name === b.member.name) {
              return a.date.localeCompare(b.date);
            }
            return a.member.name.localeCompare(b.member.name, "ko");
          })
        : [],
    [attendances]
  );

  const translateStatus = (status: "PRESENT" | "ABSENT") =>
    status === "PRESENT" ? "출석" : "결석";

  if (sorted.length === 0) {
    return (
      <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-4 rounded-xl">
        선택한 기간({periodLabelMap[period]})에 등록된 출석 데이터가 없습니다.
        {range.startDate && range.endDate && (
          <>
            {" "}
            ({formatDateKorean(range.startDate)} ~{" "}
            {formatDateKorean(range.endDate)})
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-2 bg-white border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-800">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {description}
          </p>
        </div>
        <p className="text-[11px] sm:text-xs text-gray-400">
          * 각 날짜별 개별 출석 기록입니다.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">
                이름
              </th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">
                날짜
              </th>
              <th className="px-3 py-2 text-center text-gray-500 font-medium">
                상태
              </th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">
                메모
              </th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">
                등록자
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr
                key={a.id}
                className="border-t border-gray-50 hover:bg-gray-50/70"
              >
                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                  {a.member.name}
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                  {formatDateKorean(a.date)}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium ${
                      a.status === "PRESENT"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-rose-50 text-rose-700 border border-rose-100"
                    }`}
                  >
                    {translateStatus(a.status)}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600 max-w-[160px]">
                  {a.memo ? (
                    <span className="line-clamp-1 sm:line-clamp-2">
                      {a.memo}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-[11px] sm:text-xs">
                      메모 없음
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                  {a.createdBy?.name ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 우리 셀원 목록 테이블 (최근 출석일 / 연속 결석 포함, 모바일 최적화)
const CellMemberList: React.FC<{
  members: CellMemberAttendanceSummaryDto[];
}> = ({ members }) => {
  const sortedMembers = useMemo(
    () =>
      members && members.length > 0
        ? [...members].sort((a, b) =>
            a.memberName.localeCompare(b.memberName, "ko")
          )
        : [],
    [members]
  );

  if (!sortedMembers || sortedMembers.length === 0) {
    return (
      <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-4 rounded-xl">
        아직 등록된 셀원이 없습니다. 멤버 관리에서 셀원을 배정해 주세요.
      </div>
    );
  }

  const formatGender = (gender: "MALE" | "FEMALE") =>
    gender === "MALE" ? "형제" : "자매";

  const renderConsecutiveAbsences = (count: number) => {
    if (count <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
          0회
        </span>
      );
    }

    const isDanger = count >= 3;
    const baseClass =
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium border";
    const colorClass = isDanger
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

    return (
      <span className={`${baseClass} ${colorClass}`}>
        {count}회{/* 필요하면 ' 연속 결석' 텍스트 추가 가능 */}
      </span>
    );
  };

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-2 bg-white border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-800">
            우리 셀원 목록
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            셀에 속한 모든 멤버의 기본 정보와 출석 상태를 한눈에 확인할 수
            있습니다.
          </p>
        </div>
        <p className="text-[11px] sm:text-xs text-gray-400">
          총 {sortedMembers.length}명
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">
                이름
              </th>
              <th className="px-3 py-2 text-center text-gray-500 font-medium hidden sm:table-cell">
                성별
              </th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium hidden sm:table-cell">
                생년월일
              </th>
              <th className="px-3 py-2 text-center text-gray-500 font-medium hidden md:table-cell">
                입회 연도
              </th>
              <th className="px-3 py-2 text-center text-gray-500 font-medium hidden md:table-cell">
                활성 여부
              </th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">
                최근 출석일
              </th>
              <th className="px-3 py-2 text-center text-gray-500 font-medium">
                연속 결석
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((m) => (
              <tr
                key={m.memberId}
                className="border-t border-gray-50 hover:bg-gray-50/70"
              >
                <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                  {m.memberName}
                </td>
                <td className="px-3 py-2 text-center text-gray-700 hidden sm:table-cell">
                  {formatGender(m.gender)}
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap hidden sm:table-cell">
                  {formatDateKorean(m.birthDate)}
                </td>
                <td className="px-3 py-2 text-center text-gray-700 hidden md:table-cell">
                  {m.joinYear}
                </td>
                <td className="px-3 py-2 text-center hidden md:table-cell">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium ${
                      m.active
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}
                  >
                    {m.active ? "활동 중" : "비활동"}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                  {m.lastAttendanceDate ? (
                    formatDateKorean(m.lastAttendanceDate)
                  ) : (
                    <span className="text-gray-400 text-[11px] sm:text-xs">
                      출석 기록 없음
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {renderConsecutiveAbsences(m.consecutiveAbsences)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 메인 컴포넌트
const CellLeaderDashboard: React.FC<CellLeaderDashboardProps> = ({ user }) => {
  const [period, setPeriod] = useState<Period>("default");
  const [dashboardSummary, setDashboardSummary] =
    useState<CellLeaderDashboardDto | null>(null);

  // 선택 기간 출석 목록
  const [periodAttendances, setPeriodAttendances] = useState<AttendanceDto[]>(
    []
  );
  // 이번 주 출석률 계산용
  const [thisWeekAttendances, setThisWeekAttendances] = useState<
    AttendanceDto[]
  >([]);
  // 셀원 출석 요약 목록
  const [members, setMembers] = useState<CellMemberAttendanceSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekRange = useMemo(() => getThisWeekRangeFromSunday(), []);

  // 선택 기간에 따른 날짜 범위 계산
  const periodRange = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      return { startDate: weekRange.startDate, endDate: weekRange.endDate };
    }
    if (period === "month") {
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const toISO = (date: Date) => date.toISOString().split("T")[0];
      return { startDate: toISO(firstDay), endDate: toISO(lastDay) };
    }
    if (period === "year") {
      const year = now.getFullYear();
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }
    // 현재 학기: 백엔드 기준
    return { startDate: undefined, endDate: undefined };
  }, [period, weekRange.startDate, weekRange.endDate]);

  const thisWeekAttendanceRate: number | null = useMemo(() => {
    if (!thisWeekAttendances || thisWeekAttendances.length === 0) return null;
    const total = thisWeekAttendances.length;
    const present = thisWeekAttendances.filter(
      (a) => a.status === "PRESENT"
    ).length;
    if (total === 0) return null;
    return (present / total) * 100;
  }, [thisWeekAttendances]);

  const fetchDashboardData = useCallback(async () => {
    if (!user || !user.cellId) {
      setLoading(false);
      setError("담당 셀 정보를 찾을 수 없습니다. 관리자에게 문의해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    const now = new Date();
    const summaryParams: AttendanceSummaryQueryParams = {};

    switch (period) {
      case "week":
        summaryParams.startDate = weekRange.startDate;
        summaryParams.endDate = weekRange.endDate;
        break;
      case "month":
        summaryParams.year = now.getFullYear();
        summaryParams.month = now.getMonth() + 1;
        break;
      case "year":
        summaryParams.year = now.getFullYear();
        break;
      case "default":
      default:
        // 현재 학기: 백엔드 기본값
        break;
    }

    try {
      const summaryPromise = cellService.getDashboardSummary(
        user.cellId,
        summaryParams
      );

      const baseAttendanceParams = {
        cellId: user.cellId,
        page: 0,
        size: 200,
        sort: "date,asc" as const,
      };

      // 선택 기간 출석 목록
      const periodAttendancePromise = attendanceService.getAttendances(
        periodRange.startDate && periodRange.endDate
          ? {
              ...baseAttendanceParams,
              startDate: periodRange.startDate,
              endDate: periodRange.endDate,
            }
          : baseAttendanceParams
      );

      // 이번 주 출석 목록 (항상 고정)
      const thisWeekAttendancePromise = attendanceService.getAttendances({
        cellId: user.cellId,
        startDate: weekRange.startDate,
        endDate: weekRange.endDate,
        page: 0,
        size: 200,
        sort: "date,asc",
      });

      const [summary, periodPage, thisWeekPage] = await Promise.all([
        summaryPromise,
        periodAttendancePromise,
        thisWeekAttendancePromise,
      ]);

      setDashboardSummary(summary as CellLeaderDashboardDto);

      const periodData = periodPage as Page<AttendanceDto>;
      setPeriodAttendances(periodData.content ?? []);

      const weekData = thisWeekPage as Page<AttendanceDto>;
      setThisWeekAttendances(weekData.content ?? []);
    } catch (err) {
      console.error(err);
      setError("셀 대시보드 데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    user,
    period,
    periodRange.startDate,
    periodRange.endDate,
    weekRange.startDate,
    weekRange.endDate,
  ]);

  // 셀원 출석 요약 목록 조회
  const fetchMembers = useCallback(async () => {
    if (!user || !user.cellId) {
      setMembersLoading(false);
      return;
    }
    setMembersLoading(true);
    try {
      // 🔧 서비스 메서드 이름과 맞추기
      const list = await cellService.getMemberAttendanceSummary(user.cellId);
      setMembers(list ?? []);
    } catch (err) {
      console.error("셀원 출석 요약 목록 조회 실패:", err);
    } finally {
      setMembersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-indigo-500" />
            <p className="text-xs sm:text-sm text-gray-500">
              우리 셀 데이터를 불러오는 중입니다...
            </p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm sm:text-base text-center p-4 rounded-xl">
          {error}
        </div>
      );
    }

    if (!dashboardSummary) {
      return (
        <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-4 rounded-xl">
          해당 기간에 대한 대시보드 데이터가 없습니다.
        </div>
      );
    }

    return (
      <div className="space-y-5 sm:space-y-6">
        {/* 숫자 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="총 출석 인원 (연인원)"
            value={dashboardSummary.presentRecords.toLocaleString()}
            icon={<FaUserCheck size={22} />}
          />
          <StatCard
            title="현재 셀 멤버 수"
            value={members.length.toLocaleString()}
            icon={<FaUsers size={22} />}
          />
          <StatCard
            title="선택 기간 출석률"
            value={`${dashboardSummary.attendanceRate.toFixed(1)}%`}
            icon={<FaChartBar size={22} />}
          />
          <StatCard
            title="미완료 출석 체크 주수"
            value={`${dashboardSummary.incompleteCheckCount}주`}
            icon={<FaExclamationTriangle size={22} />}
          />
        </div>

        {/* 선택 기간 출석 현황 */}
        <PeriodAttendanceTable
          attendances={periodAttendances}
          period={period}
          range={periodRange}
        />

        {/* 우리 셀원 목록 */}
        <div className="mt-4">
          {membersLoading ? (
            <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-4 rounded-xl">
              셀원 목록을 불러오는 중입니다...
            </div>
          ) : (
            <CellMemberList members={members} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 상단 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            우리 셀 대시보드
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
            {user.cellName && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                {user.cellName}
              </span>
            )}
            <span className="hidden sm:inline-block">
              셀 출석 상황과 멤버 현황을 한 눈에 확인할 수 있습니다.
            </span>
          </div>

          {/* 상단 요약 칩 */}
          <SummaryChips
            dashboardSummary={dashboardSummary}
            thisWeekAttendanceRate={thisWeekAttendanceRate}
            memberCount={members.length}
          />
        </div>

        {/* 기간 선택 토글 */}
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg self-start">
          {(["week", "month", "default", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
                period === p
                  ? "bg-white text-indigo-700 shadow"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p === "week" && "이번 주"}
              {p === "month" && "이번 달"}
              {p === "default" && "현재 학기"}
              {p === "year" && "올해"}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div>{renderContent()}</div>
    </div>
  );
};

export default CellLeaderDashboard;
