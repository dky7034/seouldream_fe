// src/pages/CellLeaderDashboard.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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

import type {
  CellLeaderDashboardDto,
  AttendanceDto,
  CellMemberAttendanceSummaryDto,
  SemesterDto,
  DashboardDto,
  BirthdayInfo,
  RecentNoticeInfo,
  RecentPrayerInfo,
} from "../types";

import {
  FaUsers,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCalendarAlt,
  FaBullhorn,
  FaPrayingHands,
  FaBirthdayCake,
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

// [최적화] 통계 계산 로직을 순수 함수로 분리
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
    // 날짜 루프 최적화를 위해 TimeValue 사용
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

const calculateBirthdays = (members: CellMemberAttendanceSummaryDto[]) => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDate = today.getDate();

  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(currentDate - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const todayBirthdays: BirthdayInfo[] = [];
  const weeklyBirthdays: BirthdayInfo[] = [];
  const monthlyBirthdays: BirthdayInfo[] = [];

  members.forEach((m) => {
    if (!m.birthDate) return;
    const birthDate = new Date(m.birthDate);
    const mMonth = birthDate.getMonth();
    const mDate = birthDate.getDate();

    if (mMonth === currentMonth) {
      monthlyBirthdays.push({
        memberId: m.memberId,
        memberName: m.memberName,
        birthDate: m.birthDate,
      } as BirthdayInfo);
    }

    if (mMonth === currentMonth && mDate === currentDate) {
      todayBirthdays.push({
        memberId: m.memberId,
        memberName: m.memberName,
        birthDate: m.birthDate,
      } as BirthdayInfo);
    }

    const thisYearBirthday = new Date(currentYear, mMonth, mDate);
    if (thisYearBirthday >= startOfWeek && thisYearBirthday <= endOfWeek) {
      weeklyBirthdays.push({
        memberId: m.memberId,
        memberName: m.memberName,
        birthDate: m.birthDate,
      } as BirthdayInfo);
    }
  });

  const sortFn = (a: BirthdayInfo, b: BirthdayInfo) => {
    const da = new Date(a.birthDate);
    const db = new Date(b.birthDate);
    if (da.getMonth() !== db.getMonth()) return da.getMonth() - db.getMonth();
    return da.getDate() - db.getDate();
  };

  return {
    today: todayBirthdays,
    weekly: weeklyBirthdays.sort(sortFn),
    monthly: monthlyBirthdays.sort(sortFn),
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
  weeklyBirthdayCount: number;
}> = React.memo(
  ({
    incompleteCount,
    memberCount,
    weeklyNoticeCount,
    weeklyPrayerCount,
    weeklyBirthdayCount,
  }) => (
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

      <div className="inline-flex items-center px-3 py-2 rounded-full bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium border border-blue-100">
        <FaPrayingHands className="mr-2" />
        이번 주 기도제목 {weeklyPrayerCount}개
      </div>

      <div className="inline-flex items-center px-3 py-2 rounded-full bg-pink-50 text-pink-700 text-xs sm:text-sm font-medium border border-pink-100">
        <FaBirthdayCake className="mr-2" />
        이번 주 생일 {weeklyBirthdayCount}명
      </div>
    </div>
  )
);

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
  displayNameMap: Map<number, string>; // [최적화] 배열 대신 Map 사용
}> = React.memo(
  ({ members, attendances, startDate, endDate, displayNameMap }) => {
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

    // [최적화] 모든 멤버의 통계를 한 번에 계산 (useMemo)
    // 렌더링 시마다 getMemberStats를 호출하는 비용을 제거
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

    if (!sortedMembers || sortedMembers.length === 0) {
      return (
        <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-4 rounded-xl">
          아직 등록된 셀원이 없습니다.
        </div>
      );
    }

    const formatGender = (gender: "MALE" | "FEMALE") =>
      gender === "MALE" ? "남자" : "여자";

    return (
      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm mt-6">
        <div className="px-4 pt-4 pb-2 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-800">
              셀원 목록
            </h3>
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
                  등록 연도
                </th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">
                  최근 출석
                </th>
                <th className="px-3 py-2 text-center text-gray-500 font-medium">
                  출석 / 결석 / 미체크
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m) => {
                // [최적화] Map에서 O(1)로 조회
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
                    className="border-t border-gray-50 hover:bg-gray-50/70"
                  >
                    <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">
                      {displayName}
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
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {m.lastAttendanceDate ? (
                        formatDateKorean(m.lastAttendanceDate)
                      ) : (
                        <span className="text-gray-400 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="text-emerald-600 font-bold">
                        {stats.present}
                      </span>
                      <span className="text-gray-300 mx-1.5">/</span>
                      <span className="text-rose-500 font-bold">
                        {stats.absent}
                      </span>
                      <span className="text-gray-300 mx-1.5">/</span>
                      <span className="text-gray-400 font-bold">
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

      const birthdays = calculateBirthdays(sortedMembers);

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
        todayBirthdays: birthdays.today,
        weeklyBirthdays: birthdays.weekly,
        monthlyBirthdays: birthdays.monthly,
        totalTodayBirthdays: birthdays.today.length,
        totalWeeklyBirthdays: birthdays.weekly.length,
        totalMonthlyBirthdays: birthdays.monthly.length,
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

  // [최적화] 뉴스 센터 데이터에 Map 기반 이름 포맷팅 적용 (O(N) -> O(1) 조회)
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

    const formatBirthdays = (list: BirthdayInfo[]) =>
      list.map((b) => ({
        ...b,
        memberName: formatName(b.memberId, b.memberName),
      }));

    return {
      ...newsData,
      recentPrayers: formattedPrayers,
      todayBirthdays: formatBirthdays(newsData.todayBirthdays),
      weeklyBirthdays: formatBirthdays(newsData.weeklyBirthdays),
      monthlyBirthdays: formatBirthdays(newsData.monthlyBirthdays),
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

  // [최적화] realIncompleteCheckCount는 계산량이 많으므로 useMemo 유지 + 내부 로직 최적화
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

    // 2. 출석 데이터를 Set으로 변환 (O(1) lookup)
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

      // 해당 일요일 기준 유효한 멤버 필터링
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
          weeklyBirthdayCount={formattedNewsData?.totalWeeklyBirthdays ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-6">
          {dashboardSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                title="현재 셀 멤버"
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
                  // [최적화] 매트릭스에는 필요한 정보만 Map에서 꺼내 전달
                  members={members.map((m) => ({
                    memberId: m.memberId,
                    memberName: displayNameMap.get(m.memberId) || m.memberName,
                  }))}
                  attendances={matrixAttendances}
                  loading={matrixLoading}
                  limitStartDate={activeSemester.startDate}
                  limitEndDate={activeSemester.endDate}
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
              displayNameMap={displayNameMap} // [최적화] Map 전달
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
              totalTodayBirthdays={formattedNewsData.totalTodayBirthdays}
              totalWeeklyBirthdays={formattedNewsData.totalWeeklyBirthdays}
              totalMonthlyBirthdays={formattedNewsData.totalMonthlyBirthdays}
              baseRoute="cell"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CellLeaderDashboard;
