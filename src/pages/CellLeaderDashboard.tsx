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
import AttendanceMatrix from "../components/AttendanceMatrix";
import type {
  CellLeaderDashboardDto,
  AttendanceDto,
  CellMemberAttendanceSummaryDto,
  SemesterDto,
} from "../types";
import {
  FaUsers,
  FaHeartBroken,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCalendarAlt,
} from "react-icons/fa";

type UnitType = "semester" | "month";
type AttendanceStatus = "PRESENT" | "ABSENT";

// --------------------
// Helpers
// --------------------

// 날짜 문자열(YYYY-MM-DD)을 로컬 시간 00:00:00 Date로 변환
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

// --------------------
// Sub Components
// --------------------

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
}> = ({ title, value, icon }) => (
  <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg flex items-center border border-gray-100">
    <div className="bg-indigo-50 text-indigo-600 p-3 sm:p-4 rounded-full mr-4 sm:mr-6 flex-shrink-0">
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

const SummaryChips: React.FC<{
  incompleteCount: number;
  memberCount: number;
}> = ({ incompleteCount, memberCount }) => (
  <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 sm:mt-2">
    <div className="inline-flex items-center px-3 py-2 rounded-full bg-amber-50 text-amber-700 text-xs sm:text-sm font-medium">
      <FaUsers className="mr-2" />
      {memberCount > 0 ? `셀원 ${memberCount}명` : `셀원 없음`}
    </div>
    {incompleteCount > 0 && (
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-rose-50 text-rose-700 text-xs sm:text-sm font-medium">
        <FaExclamationTriangle className="mr-2" />
        출석 체크 누락 {incompleteCount}주
      </div>
    )}
  </div>
);

const MatrixStatusLegend: React.FC<{ label: string }> = ({ label }) => (
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
);

// -------------------------------------------------------------------------
// [CellMemberList] 개별 멤버 통계 (셀 배정일 기준 미체크 계산)
// -------------------------------------------------------------------------
const CellMemberList: React.FC<{
  members: CellMemberAttendanceSummaryDto[];
  attendances: AttendanceDto[];
  startDate: string;
  endDate: string;
}> = ({ members, attendances, startDate, endDate }) => {
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
    const map = new Map<string, AttendanceStatus>();

    for (const att of attendances) {
      const mId = getAttendanceMemberId(att);
      const dateKey = normalizeISODate(att?.date);
      if (!mId || !dateKey) continue;

      if (att.status !== "PRESENT" && att.status !== "ABSENT") continue;
      map.set(`${mId}-${dateKey}`, att.status);
    }

    return map;
  }, [attendances]);

  if (!sortedMembers || sortedMembers.length === 0) {
    return (
      <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-4 rounded-xl">
        아직 등록된 셀원이 없습니다.
      </div>
    );
  }

  const formatGender = (gender: "MALE" | "FEMALE") =>
    gender === "MALE" ? "남자" : "여자";

  // ✅ [핵심] 개인별 출석/결석/미체크 계산 로직
  const getMemberStats = (member: CellMemberAttendanceSummaryDto) => {
    if (!startDate || !endDate) return { present: 0, absent: 0, unchecked: 0 };

    const pStart = parseLocal(startDate);
    const pEnd = parseLocal(endDate);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!pStart || !pEnd) return { present: 0, absent: 0, unchecked: 0 };

    // 1. 미래 날짜 방어 (오늘 이후는 미체크 아님)
    const effectiveEnd = pEnd < today ? pEnd : today;

    // 2. 기준일 설정: 셀 배정일 우선 -> 없으면 가입연도 1월 1일
    const baseDateStr = normalizeISODate(
      member.cellAssignmentDate || `${member.joinYear}-01-01`
    );
    const baseDate = parseLocal(baseDateStr) || new Date(member.joinYear, 0, 1);

    // 3. 유효 시작일 = Max(조회 시작일, 기준일)
    // (셀 배정일 이전의 과거 날짜는 계산에서 제외)
    const effectiveStart = pStart < baseDate ? baseDate : pStart;

    let presentCount = 0;
    let absentCount = 0;
    let uncheckedCount = 0;

    if (effectiveStart <= effectiveEnd) {
      const current = new Date(effectiveStart);

      while (current <= effectiveEnd) {
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

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm mt-6">
      <div className="px-4 pt-4 pb-2 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-800">
            셀원 목록 상세
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
              const stats = getMemberStats(m);

              return (
                <tr
                  key={m.memberId}
                  className="border-t border-gray-50 hover:bg-gray-50/70"
                >
                  <td className="px-3 py-2 text-gray-800 font-medium whitespace-nowrap">
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
};

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

    // month 모드
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

  // 3) matrixDate
  useEffect(() => {
    if (!periodRange.startDate || !periodRange.endDate) return;

    const today = new Date();
    const pStart = parseLocal(periodRange.startDate);
    const pEnd = parseLocal(periodRange.endDate);

    if (!pStart || !pEnd) return;

    if (today >= pStart && today <= pEnd) setMatrixDate(today);
    else setMatrixDate(pStart);
  }, [periodRange.startDate, periodRange.endDate]);

  // 4) month button scroll
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

  const fetchMembers = useCallback(async () => {
    if (!user?.cellId) return;

    setMembersLoading(true);
    try {
      const list = await cellService.getMemberAttendanceSummary(user.cellId);
      const sorted = (list ?? []).sort((a, b) =>
        a.memberName.localeCompare(b.memberName, "ko")
      );
      setMembers(sorted);
    } catch (err) {
      console.error("셀원 목록 조회 실패", err);
    } finally {
      setMembersLoading(false);
    }
  }, [user?.cellId]);

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

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchMatrixData();
  }, [fetchMatrixData]);

  // --------------------
  // UI Helpers
  // --------------------
  const handleMatrixMonthChange = useCallback(
    (increment: number) => {
      if (unitType === "semester" || !activeSemester) return;

      const newDate = new Date(matrixDate);
      newDate.setMonth(newDate.getMonth() + increment);

      const newYearMonth = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        1
      );
      const semStart = parseLocal(activeSemester.startDate);
      const semEnd = parseLocal(activeSemester.endDate);
      if (!semStart || !semEnd) return;

      const startLimit = new Date(
        semStart.getFullYear(),
        semStart.getMonth(),
        1
      );
      const endLimit = new Date(semEnd.getFullYear(), semEnd.getMonth(), 1);

      if (newYearMonth < startLimit || newYearMonth > endLimit) return;

      setMatrixDate(newDate);
      setSelectedMonth(newDate.getMonth() + 1);
    },
    [unitType, activeSemester, matrixDate]
  );

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

  // --------------------
  // ✅ 출석 누락 주 계산 (상단 칩) - 셀 배정일 기준 적용
  // --------------------
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

    while (cur <= endCopy) {
      if (cur.getDay() === 0) sundays.push(toLocalISODate(cur));
      cur.setDate(cur.getDate() + 1);
    }

    if (sundays.length === 0) return 0;

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

  const longTermAbsenteesCount = useMemo(() => {
    if (!members) return 0;
    return members.filter((m) => m.consecutiveAbsences >= 3).length;
  }, [members]);

  // --------------------
  // Render
  // --------------------
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
      <div className="flex flex-col gap-4">
        {/* Header & Controls ... (기존과 동일) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
              우리 셀 대시보드
            </h2>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mt-1">
              {user.cellName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                  {user.cellName}
                </span>
              )}
              {/* 학기 선택 Dropdown */}
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

          {/* Unit Toggle Buttons */}
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

        {/* Month Selection Buttons */}
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
        />
      </div>

      {/* 1. Stat Cards */}
      {dashboardSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="관심 요망 (3주↑ 결석)"
            value={`${longTermAbsenteesCount}명`}
            icon={
              <FaHeartBroken
                size={20}
                className={
                  longTermAbsenteesCount > 0 ? "text-rose-500" : "text-gray-400"
                }
              />
            }
          />
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

      {/* 2. Attendance Matrix */}
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
              onMonthChange={handleMatrixMonthChange}
              members={members.map((m) => ({
                memberId: m.memberId,
                memberName: m.memberName,
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

      {/* 3. Member List */}
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
        />
      )}
    </div>
  );
};

export default CellLeaderDashboard;
