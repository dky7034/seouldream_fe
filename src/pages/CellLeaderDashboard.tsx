import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom"; // ✅ [추가] 페이지 이동을 위한 훅
import { useAuth } from "../hooks/useAuth";
import { cellService } from "../services/cellService";
import { attendanceService } from "../services/attendanceService";
import { semesterService } from "../services/semesterService";
import { noticeService } from "../services/noticeService";
import { prayerService } from "../services/prayerService";
import { memberService } from "../services/memberService";
import { formatDisplayName } from "../utils/memberUtils";
import AttendanceMatrix from "../components/AttendanceMatrix";
import NewsCenterCard from "../components/dashboard/NewsCenterCard";
import { FaUserClock } from "react-icons/fa"; // 아이콘이 없다면 fa에서 적절한 것 import

import type {
  CellLeaderDashboardDto,
  AttendanceDto,
  CellMemberAttendanceSummaryDto,
  SemesterDto,
  DashboardDto,
  RecentNoticeInfo,
  RecentPrayerInfo,
} from "../types";

import {
  FaUsers,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCalendarAlt,
  FaBullhorn,
} from "react-icons/fa";

type UnitType = "semester" | "month";

// --------------------
// Helpers (Pure Functions)
// --------------------
const parseLocal = (dateStr: string | undefined | null) => {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const formatDateKorean = (dateStr: string | undefined | null) => {
  if (!dateStr) return "";
  const date = parseLocal(dateStr);
  if (!date) return dateStr || "";
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
};

const normalizeISODate = (v: string | undefined | null) => {
  if (!v) return "";
  return v.slice(0, 10);
};

const toLocalISODate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isDateInThisWeek = (dateStr: string) => {
  if (!dateStr) return false;
  const targetDate = new Date(dateStr);
  const today = new Date();
  const dayOfWeek = today.getDay();

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return targetDate >= startOfWeek && targetDate <= endOfWeek;
};

const getAttendanceMemberId = (att: any): string | number | null => {
  if (att?.memberId !== undefined && att?.memberId !== null)
    return att.memberId;
  const m = att?.member;
  if (!m) return null;
  if (typeof m === "number" || typeof m === "string") return m;
  if (typeof m === "object") {
    if (m.id !== undefined && m.id !== null) return m.id;
    if (m.memberId !== undefined && m.memberId !== null) return m.memberId;
  }
  return null;
};

const calculateMemberStats = (
  member: CellMemberAttendanceSummaryDto,
  attendanceMap: Map<string, "PRESENT" | "ABSENT">,
  startDate: string,
  endDate: string
) => {
  if (!startDate || !endDate) return { present: 0, absent: 0, unchecked: 0 };
  const pStart = parseLocal(startDate);
  const pEnd = parseLocal(endDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!pStart || !pEnd) return { present: 0, absent: 0, unchecked: 0 };

  const effectiveEnd = pEnd < today ? pEnd : today;
  const baseDateStr = normalizeISODate(
    member.cellAssignmentDate || `${member.joinYear}-01-01`
  );
  const baseDate = parseLocal(baseDateStr) || new Date(member.joinYear, 0, 1);
  const effectiveStart = pStart < baseDate ? baseDate : pStart;

  let presentCount = 0;
  let absentCount = 0;
  let uncheckedCount = 0;

  if (effectiveStart <= effectiveEnd) {
    const current = new Date(effectiveStart);
    const endTimeValue = effectiveEnd.getTime();

    while (current.getTime() <= endTimeValue) {
      if (current.getDay() === 0) {
        const dateKey = toLocalISODate(current);
        const key = `${member.memberId}-${dateKey}`;
        const status = attendanceMap.get(key);
        if (status === "PRESENT") presentCount++;
        else if (status === "ABSENT") absentCount++;
        else uncheckedCount++;
      }
      current.setDate(current.getDate() + 1);
    }
  }
  return {
    present: presentCount,
    absent: absentCount,
    unchecked: uncheckedCount,
  };
};

// --------------------
// Sub Components
// --------------------

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
}> = React.memo(({ title, value, icon }) => (
  <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-lg flex items-center border border-gray-100 h-full">
    <div className="bg-indigo-50 text-indigo-600 p-3 sm:p-4 rounded-full mr-4 flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs sm:text-sm font-medium text-gray-500 break-keep leading-tight">
        {title}
      </p>
      <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-800">
        {value}
      </p>
    </div>
  </div>
));

const SummaryChips: React.FC<{
  incompleteCount: number;
  memberCount: number;
  weeklyNoticeCount: number;
  weeklyPrayerCount: number;
}> = React.memo(({ incompleteCount, memberCount, weeklyNoticeCount }) => (
  <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 sm:mt-2">
    <div className="inline-flex items-center px-3 py-2 rounded-full bg-amber-50 text-amber-700 text-xs sm:text-sm font-medium border border-amber-100">
      <FaUsers className="mr-2" />
      {memberCount > 0 ? `셀원 ${memberCount}명` : `셀원 없음`}
    </div>

    {incompleteCount > 0 && (
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-rose-50 text-rose-700 text-xs sm:text-sm font-medium border border-rose-100">
        <FaExclamationTriangle className="mr-2" />
        출석 체크 누락 {incompleteCount}주
      </div>
    )}

    <div className="inline-flex items-center px-3 py-2 rounded-full bg-yellow-50 text-yellow-700 text-xs sm:text-sm font-medium border border-yellow-100">
      <FaBullhorn className="mr-2" />
      이번 주 공지 {weeklyNoticeCount}개
    </div>
  </div>
));

const MatrixStatusLegend: React.FC<{ label: string }> = React.memo(
  ({ label }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 px-4 py-3 rounded-t-2xl border-b border-gray-100 gap-3">
      <div className="flex items-center gap-2">
        <FaInfoCircle className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">
          {label} 출석 현황
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs sm:text-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></span>
          <span className="text-gray-600">출석</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></span>
          <span className="text-gray-600">결석</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-gray-300 shadow-sm border border-gray-400"></span>
          <span className="text-gray-500">미체크/예정</span>
        </div>
      </div>
    </div>
  )
);

const CellMemberList: React.FC<{
  members: CellMemberAttendanceSummaryDto[];
  attendances: AttendanceDto[];
  startDate: string;
  endDate: string;
  displayNameMap: Map<number, string>;
}> = React.memo(
  ({ members, attendances, startDate, endDate, displayNameMap }) => {
    // ✅ [추가] 상세 페이지 이동을 위한 네비게이션 훅
    const navigate = useNavigate();

    const sortedMembers = useMemo(
      () =>
        members && members.length > 0
          ? [...members].sort((a, b) =>
              a.memberName.localeCompare(b.memberName, "ko")
            )
          : [],
      [members]
    );

    const attendanceMap = useMemo(() => {
      const map = new Map<string, "PRESENT" | "ABSENT">();
      for (const att of attendances) {
        const mId = getAttendanceMemberId(att);
        const dateKey = normalizeISODate(att?.date);
        if (!mId || !dateKey) continue;
        if (att.status !== "PRESENT" && att.status !== "ABSENT") continue;
        map.set(`${mId}-${dateKey}`, att.status);
      }
      return map;
    }, [attendances]);

    const memberStatsMap = useMemo(() => {
      const statsMap = new Map<
        number,
        { present: number; absent: number; unchecked: number }
      >();
      sortedMembers.forEach((m) => {
        const stats = calculateMemberStats(
          m,
          attendanceMap,
          startDate,
          endDate
        );
        statsMap.set(m.memberId, stats);
      });
      return statsMap;
    }, [sortedMembers, attendanceMap, startDate, endDate]);

    // ✅ [추가] 멤버 클릭 핸들러
    const handleMemberClick = (memberId: number) => {
      navigate(`/admin/users/${memberId}`);
    };

    if (!sortedMembers || sortedMembers.length === 0) {
      return (
        <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-4 rounded-xl border border-gray-200">
          아직 등록된 셀원이 없습니다.
        </div>
      );
    }

    const formatGender = (gender: "MALE" | "FEMALE") =>
      gender === "MALE" ? "남" : "여";

    // ✅ [신규] 모바일용 카드 아이템 컴포넌트
    const MobileMemberCard = ({
      member,
    }: {
      member: CellMemberAttendanceSummaryDto;
    }) => {
      const displayName =
        displayNameMap.get(member.memberId) || member.memberName;
      const stats = memberStatsMap.get(member.memberId) || {
        present: 0,
        absent: 0,
        unchecked: 0,
      };

      return (
        <div
          // ✅ [수정] 클릭 이벤트 및 커서 추가
          onClick={() => handleMemberClick(member.memberId)}
          className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          {/* 상단: 이름 및 기본 정보 */}
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900">
                  {displayName}
                </span>
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-medium">
                  {formatGender(member.gender)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {formatDateKorean(member.birthDate)} 생 · {member.joinYear}년
                등록
              </p>
            </div>

            {/* 최근 출석일 뱃지 */}
            <div className="text-right">
              <span className="block text-[10px] text-gray-400 mb-0.5">
                최근 출석
              </span>
              <span
                className={`text-xs font-medium ${
                  member.lastAttendanceDate
                    ? "text-indigo-600"
                    : "text-gray-300"
                }`}
              >
                {member.lastAttendanceDate
                  ? formatDateKorean(member.lastAttendanceDate).slice(5) // 연도 제외하고 월/일만 표시
                  : "-"}
              </span>
            </div>
          </div>

          {/* 하단: 출석 통계 박스 */}
          <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-2 mt-1">
            <div className="flex flex-col items-center justify-center border-r border-gray-200 last:border-0">
              <span className="text-[10px] text-gray-500 mb-0.5">출석</span>
              <span className="text-sm font-bold text-emerald-600">
                {stats.present}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center border-r border-gray-200 last:border-0">
              <span className="text-[10px] text-gray-500 mb-0.5">결석</span>
              <span className="text-sm font-bold text-rose-500">
                {stats.absent}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-[10px] text-gray-500 mb-0.5">미체크</span>
              <span className="text-sm font-bold text-gray-400">
                {stats.unchecked}
              </span>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="mt-6">
        {/* 헤더 영역 */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <FaUsers className="text-indigo-500" />
            셀원 목록
          </h3>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            총 {sortedMembers.length}명
          </span>
        </div>

        {/* 1. 모바일 뷰 (sm 미만에서만 보임) */}
        <div className="flex flex-col gap-3 sm:hidden">
          {sortedMembers.map((m) => (
            <MobileMemberCard key={m.memberId} member={m} />
          ))}
        </div>

        {/* 2. 데스크탑 뷰 (sm 이상에서만 보임 - 기존 테이블) */}
        <div className="hidden sm:block border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    이름
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    성별
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    생년월일
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    등록 연도
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    최근 출석
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    현황 (출/결/미)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedMembers.map((m) => {
                  const displayName =
                    displayNameMap.get(m.memberId) || m.memberName;
                  const stats = memberStatsMap.get(m.memberId) || {
                    present: 0,
                    absent: 0,
                    unchecked: 0,
                  };

                  return (
                    <tr
                      key={m.memberId}
                      // ✅ [수정] 클릭 이벤트 및 커서 추가
                      onClick={() => handleMemberClick(m.memberId)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {displayName}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {formatGender(m.gender)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDateKorean(m.birthDate)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {m.joinYear}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {m.lastAttendanceDate ? (
                          formatDateKorean(m.lastAttendanceDate)
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 mr-1">
                          {stats.present}
                        </span>
                        <span className="text-gray-300">/</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 mx-1">
                          {stats.absent}
                        </span>
                        <span className="text-gray-300">/</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 ml-1">
                          {stats.unchecked}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
);

// --------------------
// Main Component
// --------------------
const CellLeaderDashboard: React.FC = () => {
  const { user } = useAuth();

  const [dashboardSummary, setDashboardSummary] =
    useState<CellLeaderDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<CellMemberAttendanceSummaryDto[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // [최적화] 동명이인 처리를 위한 맵 (ID -> 포맷팅된 이름)
  const [displayNameMap, setDisplayNameMap] = useState<Map<number, string>>(
    new Map()
  );

  // Matrix & Date States
  const [matrixDate, setMatrixDate] = useState(new Date());
  const [matrixAttendances, setMatrixAttendances] = useState<AttendanceDto[]>(
    []
  );
  const [matrixLoading, setMatrixLoading] = useState(false);

  const [activeSemester, setActiveSemester] = useState<SemesterDto | null>(
    null
  );
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [unitType, setUnitType] = useState<UnitType>("semester");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // 소식 센터 State
  const [newsData, setNewsData] = useState<DashboardDto | null>(null);
  const [totalNotices, setTotalNotices] = useState(0);
  const [totalPrayers, setTotalPrayers] = useState(0);

  const monthButtonsContainerRef = useRef<HTMLDivElement | null>(null);
  const monthButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // 1) 학기 로딩
  useEffect(() => {
    const loadSemesters = async () => {
      try {
        const data = await semesterService.getAllSemesters(true);
        const sortedData = [...data].sort(
          (a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
        setSemesters(sortedData);

        if (sortedData.length > 0) {
          const todayStr = toLocalISODate(new Date());
          const currentSemester = sortedData.find(
            (sem) => todayStr >= sem.startDate && todayStr <= sem.endDate
          );
          setActiveSemester(currentSemester || sortedData[0]);
        }
      } catch (err) {
        console.error("학기 로딩 실패", err);
        setError("학기 정보를 불러오지 못했습니다.");
      }
    };
    loadSemesters();
  }, []);

  // [최적화] 전체 멤버 목록 로딩 및 Map 생성 (한 번만 실행)
  useEffect(() => {
    if (!user) return;
    const fetchAllMembersAndBuildMap = async () => {
      try {
        const res = await memberService.getAllMembers({
          page: 0,
          size: 2000,
          sort: "id,asc",
        });

        // 데이터를 받자마자 Map으로 변환
        const allList = res.content;
        const map = new Map<number, string>();

        // 동명이인 포맷팅을 여기서 일괄 처리
        allList.forEach((m) => {
          const formattedName = formatDisplayName(
            { id: m.id, name: m.name, birthDate: m.birthDate },
            allList.map((item) => ({
              id: item.id,
              name: item.name,
              birthDate: item.birthDate,
            }))
          );
          map.set(m.id, formattedName);
        });

        setDisplayNameMap(map);
      } catch (e) {
        console.error("동명이인 목록 로딩 실패:", e);
      }
    };
    fetchAllMembersAndBuildMap();
  }, [user]);

  const handleSemesterChange = useCallback(
    (semesterId: number) => {
      const target = semesters.find((s) => s.id === semesterId);
      if (!target) return;
      setActiveSemester(target);
      setSelectedMonth(null);
      setUnitType("semester");
    },
    [semesters]
  );

  // 2) 기간 계산
  const periodRange = useMemo(() => {
    if (!activeSemester) return { startDate: "", endDate: "", label: "" };
    const {
      startDate: semStartStr,
      endDate: semEndStr,
      name: semName,
    } = activeSemester;
    if (unitType === "semester" || selectedMonth === null) {
      return { startDate: semStartStr, endDate: semEndStr, label: semName };
    }
    let targetYear = new Date(semStartStr).getFullYear();
    const startMonthIndex = new Date(semStartStr).getMonth() + 1;
    if (selectedMonth < startMonthIndex) targetYear += 1;
    const m = selectedMonth;
    let start = new Date(targetYear, m - 1, 1);
    let end = new Date(targetYear, m, 0);
    const semStart = parseLocal(semStartStr) || new Date(semStartStr);
    const semEnd = parseLocal(semEndStr) || new Date(semEndStr);
    if (start < semStart) start = semStart;
    if (end > semEnd) end = semEnd;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (start > end)
      return { startDate: "", endDate: "", label: `${semName} (${m}월)` };
    return {
      startDate: toLocalISODate(start),
      endDate: toLocalISODate(end),
      label: `${semName} (${m}월)`,
    };
  }, [activeSemester, unitType, selectedMonth]);

  // 3) Matrix Date Sync
  useEffect(() => {
    if (!periodRange.startDate || !periodRange.endDate) return;
    const today = new Date();
    const pStart = parseLocal(periodRange.startDate);
    const pEnd = parseLocal(periodRange.endDate);
    if (!pStart || !pEnd) return;
    if (today >= pStart && today <= pEnd) setMatrixDate(today);
    else setMatrixDate(pStart);
  }, [periodRange.startDate, periodRange.endDate]);

  // 4) Scroll Sync
  useEffect(() => {
    if (unitType !== "month") return;
    if (!activeSemester) return;
    if (selectedMonth == null) return;
    requestAnimationFrame(() => {
      const targetBtn = monthButtonRefs.current[selectedMonth];
      if (!targetBtn) return;
      targetBtn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
      targetBtn.focus({ preventScroll: true });
    });
  }, [unitType, selectedMonth, activeSemester]);

  // --------------------
  // Fetchers
  // --------------------
  const fetchDashboardData = useCallback(async () => {
    if (!user?.cellId || !periodRange.startDate || !periodRange.endDate) return;
    setLoading(true);
    setError(null);
    try {
      const summary = await cellService.getDashboardSummary(user.cellId, {
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
      });
      setDashboardSummary(summary as CellLeaderDashboardDto);
    } catch (err) {
      console.error(err);
      setError("데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [user?.cellId, periodRange.startDate, periodRange.endDate]);

  const fetchMatrixData = useCallback(async () => {
    if (!user?.cellId || !periodRange.startDate || !periodRange.endDate) return;
    setMatrixLoading(true);
    try {
      const data = await attendanceService.getAttendances({
        cellId: user.cellId,
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
        page: 0,
        size: 2000,
        sort: "date,asc",
      });
      setMatrixAttendances(data.content ?? []);
    } catch (err) {
      console.error("매트릭스 데이터 조회 실패", err);
    } finally {
      setMatrixLoading(false);
    }
  }, [user?.cellId, periodRange.startDate, periodRange.endDate]);

  const fetchMembersAndNews = useCallback(async () => {
    if (!user?.cellId) return;
    setMembersLoading(true);

    try {
      const [memberList, noticesPage, prayersPage] = await Promise.all([
        cellService.getMemberAttendanceSummary(user.cellId),
        noticeService.getAllNotices({ size: 1000 }),
        prayerService.getPrayers({
          page: 0,
          size: 20,
          sort: "createdAt,desc",
          cellId: user.cellId,
        }),
      ]);

      const sortedMembers = (memberList ?? []).sort((a, b) =>
        a.memberName.localeCompare(b.memberName, "ko")
      );
      setMembers(sortedMembers);

      const thisWeekNoticeCount = noticesPage.content.filter((n: any) =>
        isDateInThisWeek(n.createdAt)
      ).length;

      const thisWeekPrayerCount = prayersPage.content.filter((p: any) =>
        isDateInThisWeek(p.createdAt)
      ).length;

      const mappedNotices: RecentNoticeInfo[] = noticesPage.content
        .slice(0, 5)
        .map((n: any) => ({
          noticeId: n.id || n.noticeId,
          title: n.title,
          createdAt: n.createdAt,
          pinned: n.pinned ?? false,
        }));

      const mappedPrayers: RecentPrayerInfo[] = prayersPage.content
        .slice(0, 5)
        .map((p: any) => ({
          prayerId: p.id || p.prayerId,
          memberId: p.member?.id,
          memberName: p.member?.name || "알 수 없음",
          content: p.content,
          createdAt: p.createdAt,
        }));

      const fakeDashboardData: DashboardDto = {
        recentNotices: mappedNotices,
        recentPrayers: mappedPrayers,
        todayBirthdays: [],
        weeklyBirthdays: [],
        monthlyBirthdays: [],
        totalTodayBirthdays: 0,
        totalWeeklyBirthdays: 0,
        totalMonthlyBirthdays: 0,
        weeklyNoticeCount: thisWeekNoticeCount,
        weeklyPrayerCount: thisWeekPrayerCount,
        overallAttendanceSummary: null as any,
        cellAttendanceSummaries: [],
        attendanceKeyMetrics: {
          thisWeekAttendanceRate: 0,
          periodAverageAttendanceRate: 0,
          lastYearPeriodAttendanceRate: 0,
        },
        attendanceTrend: [],
        totalLongTermAbsentees: 0,
        newcomerCount: 0,
        attendanceChange: 0,
        unassignedMemberCount: 0,
      };

      setNewsData(fakeDashboardData);
      setTotalNotices(noticesPage.totalElements);
      setTotalPrayers(prayersPage.totalElements);
    } catch (err) {
      console.error("데이터 로딩 실패", err);
    } finally {
      setMembersLoading(false);
    }
  }, [user?.cellId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchMatrixData();
  }, [fetchMatrixData]);

  useEffect(() => {
    fetchMembersAndNews();
  }, [fetchMembersAndNews]);

  const formattedNewsData = useMemo(() => {
    if (!newsData) return null;
    if (displayNameMap.size === 0) return newsData;

    const formatName = (id?: number, name?: string) => {
      if (!name) return "";
      if (!id) return name;
      return displayNameMap.get(id) || name;
    };

    const formattedPrayers = newsData.recentPrayers.map((p) => ({
      ...p,
      memberName: formatName(p.memberId, p.memberName),
    }));

    return {
      ...newsData,
      recentPrayers: formattedPrayers,
      todayBirthdays: [],
      weeklyBirthdays: [],
      monthlyBirthdays: [],
    };
  }, [newsData, displayNameMap]);

  const handleUnitTypeClick = useCallback(
    (type: UnitType) => {
      setUnitType(type);
      if (type === "semester") {
        setSelectedMonth(null);
        return;
      }
      if (!activeSemester) return;
      const today = new Date();
      const semStart = parseLocal(activeSemester.startDate);
      const semEnd = parseLocal(activeSemester.endDate);
      if (!semStart || !semEnd) return;
      const currentMonthDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      );
      const startMonthDate = new Date(
        semStart.getFullYear(),
        semStart.getMonth(),
        1
      );
      const endMonthDate = new Date(semEnd.getFullYear(), semEnd.getMonth(), 1);
      if (
        currentMonthDate >= startMonthDate &&
        currentMonthDate <= endMonthDate
      ) {
        setSelectedMonth(today.getMonth() + 1);
        setMatrixDate(today);
      } else {
        setSelectedMonth(semStart.getMonth() + 1);
        setMatrixDate(semStart);
      }
    },
    [activeSemester]
  );

  const handleMonthSelect = useCallback((m: number) => setSelectedMonth(m), []);

  const getSemesterMonths = useCallback(() => {
    if (!activeSemester) return [];
    const s = parseLocal(activeSemester.startDate);
    const e = parseLocal(activeSemester.endDate);
    if (!s || !e) return [];
    const months: number[] = [];
    const current = new Date(s.getFullYear(), s.getMonth(), 1);
    const end = new Date(e.getFullYear(), e.getMonth(), 1);
    while (current <= end) {
      months.push(current.getMonth() + 1);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [activeSemester]);

  const realIncompleteCheckCount = useMemo(() => {
    if (!periodRange.startDate || !periodRange.endDate) return 0;
    if (!members || members.length === 0) return 0;
    const start = parseLocal(periodRange.startDate);
    const end = parseLocal(periodRange.endDate);
    if (!start || !end || start > end) return 0;

    const sundays: string[] = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const endCopy = new Date(end);
    endCopy.setHours(0, 0, 0, 0);

    // 1. 일요일 날짜 목록 생성
    while (cur <= endCopy) {
      if (cur.getDay() === 0) sundays.push(toLocalISODate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    if (sundays.length === 0) return 0;

    // 2. 출석 데이터를 Set으로 변환
    const attendanceSet = new Set<string>();
    for (const att of matrixAttendances) {
      const mId = getAttendanceMemberId(att);
      const dateKey = normalizeISODate(att?.date);
      if (!mId || !dateKey) continue;
      if (att.status !== "PRESENT" && att.status !== "ABSENT") continue;
      attendanceSet.add(`${String(mId)}-${dateKey}`);
    }

    let incompleteWeeks = 0;
    for (const sundayStr of sundays) {
      const sundayDate = parseLocal(sundayStr);
      if (!sundayDate) continue;

      const activeMembers = members.filter((m) => {
        const baseDateStr = normalizeISODate(
          m.cellAssignmentDate || `${m.joinYear}-01-01`
        );
        const base = parseLocal(baseDateStr) || new Date(m.joinYear, 0, 1);
        base.setHours(0, 0, 0, 0);
        return base <= sundayDate;
      });

      if (activeMembers.length === 0) continue;

      const isMissing = activeMembers.some((m) => {
        const key = `${String(m.memberId)}-${sundayStr}`;
        return !attendanceSet.has(key);
      });

      if (isMissing) incompleteWeeks++;
    }
    return incompleteWeeks;
  }, [periodRange.startDate, periodRange.endDate, members, matrixAttendances]);

  // Render
  if (!user) return <div className="p-4">로그인 정보가 없습니다.</div>;

  if (user && !user.cellId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <div className="bg-gray-100 p-6 rounded-full mb-6">
          <FaUsers className="text-4xl text-gray-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">
          셀 배정 대기 중
        </h2>
        <p className="text-gray-500 text-center mb-6 leading-relaxed">
          관리자(임원단)로부터 셀 리더 권한은 부여받았으나,
          <br />
          아직 담당 셀이 지정되지 않았습니다.
          <br />
          <span className="font-semibold text-indigo-600">
            관리자에게 셀 배정을 요청해주세요.
          </span>
        </p>
      </div>
    );
  }

  if (loading && !dashboardSummary) {
    return (
      <div className="flex justify-center items-center h-60">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
              내 셀 대시보드
            </h2>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mt-1">
              {user.cellName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                  {user.cellName}
                </span>
              )}
              {semesters.length > 1 ? (
                <div className="flex items-center bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  <FaCalendarAlt className="text-indigo-500 mr-2 text-xs" />
                  <select
                    value={activeSemester?.id || ""}
                    onChange={(e) =>
                      handleSemesterChange(Number(e.target.value))
                    }
                    className="bg-transparent text-indigo-700 font-bold text-xs sm:text-sm focus:outline-none cursor-pointer"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} 기준
                      </option>
                    ))}
                  </select>
                </div>
              ) : activeSemester ? (
                <span className="font-medium text-indigo-600">
                  [{activeSemester.name}] 기준
                </span>
              ) : (
                <span>활성화된 학기 없음</span>
              )}
            </div>
          </div>

          {activeSemester && (
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg self-start">
              <button
                onClick={() => handleUnitTypeClick("month")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  unitType === "month"
                    ? "bg-white text-indigo-700 shadow ring-1 ring-black/5"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
                type="button"
              >
                월별 보기
              </button>
              <button
                onClick={() => handleUnitTypeClick("semester")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  unitType === "semester"
                    ? "bg-white text-indigo-700 shadow ring-1 ring-black/5"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
                type="button"
              >
                학기 전체
              </button>
            </div>
          )}
        </div>

        {/* Month Buttons */}
        {unitType === "month" && activeSemester && (
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm animate-fadeIn">
            <span className="text-xs font-bold text-gray-500 block mb-2">
              {activeSemester.name} 상세 월 선택:
            </span>
            <div
              ref={monthButtonsContainerRef}
              className="flex flex-wrap gap-2"
            >
              {getSemesterMonths().map((m) => (
                <button
                  key={m}
                  onClick={() => handleMonthSelect(m)}
                  ref={(el) => {
                    monthButtonRefs.current[m] = el;
                  }}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                    selectedMonth === m
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                  type="button"
                >
                  {m}월
                </button>
              ))}
            </div>
          </div>
        )}

        <SummaryChips
          incompleteCount={realIncompleteCheckCount}
          memberCount={members.length}
          weeklyNoticeCount={formattedNewsData?.weeklyNoticeCount ?? 0}
          weeklyPrayerCount={formattedNewsData?.weeklyPrayerCount ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-6">
          {dashboardSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                title="셀 인원"
                value={`${members.length.toLocaleString()}명`}
                icon={<FaUsers size={20} />}
              />
              <StatCard
                title="출석 체크 누락"
                value={`${realIncompleteCheckCount}주`}
                icon={<FaExclamationTriangle size={20} />}
              />
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <MatrixStatusLegend label={periodRange.label} />
            <div className="p-2 sm:p-4">
              {activeSemester ? (
                <AttendanceMatrix
                  mode={unitType}
                  startDate={periodRange.startDate}
                  endDate={periodRange.endDate}
                  year={matrixDate.getFullYear()}
                  month={matrixDate.getMonth() + 1}
                  members={members.map((m) => ({
                    memberId: m.memberId,
                    memberName: displayNameMap.get(m.memberId) || m.memberName,
                  }))}
                  attendances={matrixAttendances}
                  loading={matrixLoading}
                  limitStartDate={activeSemester.startDate}
                  limitEndDate={activeSemester.endDate}
                  showAttendanceRate={user?.role === "EXECUTIVE"}
                />
              ) : (
                <div className="text-center p-10 text-gray-400">
                  활성화된 학기 정보가 없습니다.
                </div>
              )}
            </div>
          </div>

          {membersLoading ? (
            <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-8 rounded-xl flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2" />
              셀원 목록을 불러오는 중입니다...
            </div>
          ) : (
            <CellMemberList
              members={members}
              attendances={matrixAttendances}
              startDate={periodRange.startDate}
              endDate={periodRange.endDate}
              displayNameMap={displayNameMap}
            />
          )}
        </div>

        {/* Right Column: 소식 센터 */}
        <div className="space-y-6 xl:col-span-1 xl:sticky xl:top-24 self-start">
          {formattedNewsData && (
            <NewsCenterCard
              data={formattedNewsData}
              canManageNotices={false}
              totalNotices={totalNotices}
              totalPrayers={totalPrayers}
              baseRoute="cell"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CellLeaderDashboard;
