import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { cellService } from "../services/cellService";
import { attendanceService } from "../services/attendanceService";
import { semesterService } from "../services/semesterService";
import AttendanceMatrix from "../components/AttendanceMatrix";
import type {
  CellLeaderDashboardDto,
  User,
  AttendanceSummaryQueryParams,
  AttendanceDto,
  CellMemberAttendanceSummaryDto,
  SemesterDto,
} from "../types";
import {
  FaUsers,
  FaHeartBroken, // 추가된 아이콘
  FaExclamationTriangle,
  FaInfoCircle,
  FaCalendarAlt,
} from "react-icons/fa";

interface CellLeaderDashboardProps {
  user: User;
}

type UnitType = "semester" | "month";

// --- Helpers ---
const formatDateKorean = (dateStr: string | undefined | null) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${m}월 ${d}일`;
};

// --- Sub Components ---
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
  dashboardSummary: CellLeaderDashboardDto | null;
  memberCount: number;
}> = ({ dashboardSummary, memberCount }) => {
  const incompleteWeeks = dashboardSummary?.incompleteCheckCount ?? 0;

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 sm:mt-2">
      <div className="inline-flex items-center px-3 py-2 rounded-full bg-amber-50 text-amber-700 text-xs sm:text-sm font-medium">
        <FaUsers className="mr-2" />
        {memberCount > 0 ? `셀원 ${memberCount}명` : `셀원 없음`}
      </div>
      {incompleteWeeks > 0 && (
        <div className="inline-flex items-center px-3 py-2 rounded-full bg-rose-50 text-rose-700 text-xs sm:text-sm font-medium">
          <FaExclamationTriangle className="mr-2" />
          출석 체크 누락 {incompleteWeeks}주
        </div>
      )}
    </div>
  );
};

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
        아직 등록된 셀원이 없습니다.
      </div>
    );
  }

  const formatGender = (gender: "MALE" | "FEMALE") =>
    gender === "MALE" ? "남자" : "여자";

  const renderConsecutiveAbsences = (count: number) => {
    if (count <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
          Good
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
      <span className={`${baseClass} ${colorClass}`}>{count}주 연속 결석</span>
    );
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
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((m) => (
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

// --- Main Component ---

const CellLeaderDashboard: React.FC<CellLeaderDashboardProps> = ({ user }) => {
  // 1. 상태 관리
  const [dashboardSummary, setDashboardSummary] =
    useState<CellLeaderDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<CellMemberAttendanceSummaryDto[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  // unitType이 'month'일 때만 사용되는 날짜 State
  const [matrixDate, setMatrixDate] = useState(new Date());

  const [matrixAttendances, setMatrixAttendances] = useState<AttendanceDto[]>(
    []
  );
  const [matrixLoading, setMatrixLoading] = useState(false);

  // [중요] 학기 데이터 관리
  const [activeSemester, setActiveSemester] = useState<SemesterDto | null>(
    null
  );
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);

  // 필터 State: 학기(기본값) or 월간
  const [unitType, setUnitType] = useState<UnitType>("semester");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // 월 버튼 자동 포커싱/스크롤을 위한 refs
  const monthButtonsContainerRef = useRef<HTMLDivElement | null>(null);
  const monthButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // 2. 초기 데이터 로드 (활성 학기들)
  useEffect(() => {
    const loadSemesters = async () => {
      try {
        const data = await semesterService.getAllSemesters(true);

        // 학기를 '시작일' 기준 내림차순(최신순)으로 정렬
        const sortedData = data.sort(
          (a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );

        setSemesters(sortedData);

        if (sortedData.length > 0) {
          // 오늘 날짜 문자열(KST 로컬 기준)
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const todayStr = `${year}-${month}-${day}`;

          const currentSemester = sortedData.find(
            (sem) => todayStr >= sem.startDate && todayStr <= sem.endDate
          );

          // 포함된 학기가 있으면 그 학기, 없으면 '가장 최신 학기(0번)' 선택
          setActiveSemester(currentSemester || sortedData[0]);
        }
      } catch (err) {
        console.error("학기 로딩 실패", err);
        setError("학기 정보를 불러오지 못했습니다.");
      }
    };
    loadSemesters();
  }, []);

  // 3. 학기 변경 핸들러
  const handleSemesterChange = (semesterId: number) => {
    const target = semesters.find((s) => s.id === semesterId);
    if (target) {
      setActiveSemester(target);
      // 학기가 바뀌면 '월' 선택은 초기화
      setSelectedMonth(null);
      // 기본 뷰는 '학기 전체'로 리셋
      setUnitType("semester");
    }
  };

  // 4. 기간(StartDate, EndDate) 계산 로직 - 항상 활성 학기 기준
  const periodRange = useMemo(() => {
    if (!activeSemester) return { startDate: "", endDate: "", label: "" };

    const {
      startDate: semStart,
      endDate: semEnd,
      name: semName,
    } = activeSemester;

    // A. 학기 전체 조회 (기본)
    if (unitType === "semester" || selectedMonth === null) {
      return {
        startDate: semStart,
        endDate: semEnd,
        label: semName,
      };
    }

    // B. 월간 조회 (학기 내 특정 월)
    let targetYear = new Date(semStart).getFullYear();
    const startMonthIndex = new Date(semStart).getMonth() + 1;

    // 학기가 연도를 넘어가고 선택한 월이 시작 월보다 작으면 다음 해로 계산
    if (selectedMonth < startMonthIndex) {
      targetYear += 1;
    }

    const m = selectedMonth;
    const firstDay = `${targetYear}-${String(m).padStart(2, "0")}-01`;
    const lastDayObj = new Date(targetYear, m, 0);
    const lastDay = `${targetYear}-${String(m).padStart(2, "0")}-${String(
      lastDayObj.getDate()
    ).padStart(2, "0")}`;

    return {
      startDate: firstDay,
      endDate: lastDay,
      label: `${semName} (${m}월)`,
    };
  }, [activeSemester, unitType, selectedMonth]);

  // 5. 매트릭스 기준 날짜 동기화
  useEffect(() => {
    if (periodRange.startDate) {
      const today = new Date();
      const pStart = new Date(periodRange.startDate);
      const pEnd = new Date(periodRange.endDate);

      // 오늘이 기간 내라면 오늘, 아니면 시작일
      if (today >= pStart && today <= pEnd) {
        setMatrixDate(today);
      } else {
        setMatrixDate(pStart);
      }
    }
  }, [periodRange]);

  // 월별 보기 전환/월 선택 시 자동 포커싱/스크롤
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

  // 6. 데이터 Fetching
  const fetchDashboardData = useCallback(async () => {
    if (!user?.cellId || !periodRange.startDate) return;

    setLoading(true);
    setError(null);

    try {
      const summaryParams: AttendanceSummaryQueryParams = {
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
      };

      const summary = await cellService.getDashboardSummary(
        user.cellId,
        summaryParams
      );
      setDashboardSummary(summary as CellLeaderDashboardDto);
    } catch (err) {
      console.error(err);
      setError("데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [user, periodRange]);

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
  }, [user]);

  const fetchMatrixData = useCallback(async () => {
    if (!user?.cellId || !periodRange.startDate) return;

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
  }, [user.cellId, periodRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchMatrixData();
  }, [fetchMatrixData]);

  // 7. Handlers

  // 매트릭스 월 이동 핸들러
  const handleMatrixMonthChange = (increment: number) => {
    if (unitType === "semester" || !activeSemester) return;

    const newDate = new Date(matrixDate);
    newDate.setMonth(newDate.getMonth() + increment);

    const newYearMonth = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
    const semStart = new Date(activeSemester.startDate);
    const semEnd = new Date(activeSemester.endDate);
    const startLimit = new Date(semStart.getFullYear(), semStart.getMonth(), 1);
    const endLimit = new Date(semEnd.getFullYear(), semEnd.getMonth(), 1);

    if (newYearMonth < startLimit || newYearMonth > endLimit) return;

    setMatrixDate(newDate); // 매트릭스 내부 달력 이동
    setSelectedMonth(newDate.getMonth() + 1); // 상단 월 선택 버튼 동기화
  };

  // 단위 변경 핸들러
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);

    // 1. 학기 전체 보기면 월 선택 해제
    if (type === "semester") {
      setSelectedMonth(null);
      return;
    }

    // 2. 월별 보기 선택 시
    if (!activeSemester) return;

    const today = new Date();
    const semStart = new Date(activeSemester.startDate);
    const semEnd = new Date(activeSemester.endDate);

    const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const startMonthDate = new Date(
      semStart.getFullYear(),
      semStart.getMonth(),
      1
    );
    const endMonthDate = new Date(semEnd.getFullYear(), semEnd.getMonth(), 1);

    const isCurrentMonthInSemester =
      currentMonthDate >= startMonthDate && currentMonthDate <= endMonthDate;

    if (isCurrentMonthInSemester) {
      setSelectedMonth(today.getMonth() + 1);
      setMatrixDate(today);
    } else {
      setSelectedMonth(semStart.getMonth() + 1);
      setMatrixDate(semStart);
    }
  };

  const handleMonthSelect = (m: number) => {
    setSelectedMonth(m);
  };

  const getSemesterMonths = () => {
    if (!activeSemester) return [];
    const s = new Date(activeSemester.startDate);
    const e = new Date(activeSemester.endDate);
    const months: number[] = [];
    const current = new Date(s.getFullYear(), s.getMonth(), 1);
    const end = new Date(e.getFullYear(), e.getMonth(), 1);

    while (current <= end) {
      months.push(current.getMonth() + 1);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  // 8. 추가 계산 로직
  // [NEW] 장기 결석자 수 계산 (3주 이상 연속 결석)
  const longTermAbsenteesCount = useMemo(() => {
    if (!members) return 0;
    return members.filter((m) => m.consecutiveAbsences >= 3).length;
  }, [members]);

  // --- Render ---

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
        {/* 헤더: 타이틀 + 학기 선택 Dropdown */}
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

          {/* 단위 선택: 월별 보기 -> 학기 전체 */}
          {activeSemester && (
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg self-start">
              <button
                onClick={() => handleUnitTypeClick("month")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  unitType === "month"
                    ? "bg-white text-indigo-700 shadow ring-1 ring-black/5"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
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
              >
                학기 전체
              </button>
            </div>
          )}
        </div>

        {/* 하위 월 선택 버튼 (월간 모드) */}
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
                >
                  {m}월
                </button>
              ))}
            </div>
          </div>
        )}

        <SummaryChips
          dashboardSummary={dashboardSummary}
          memberCount={members.length}
        />
      </div>

      {/* 1. 숫자 통계 */}
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
            value={`${dashboardSummary.incompleteCheckCount}회`}
            icon={<FaExclamationTriangle size={20} />}
          />
        </div>
      )}

      {/* 2. 매트릭스 */}
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

      {/* 3. 리스트 */}
      {membersLoading ? (
        <div className="bg-gray-50 text-gray-500 text-sm sm:text-base text-center p-8 rounded-xl flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2" />
          셀원 목록을 불러오는 중입니다...
        </div>
      ) : (
        <CellMemberList members={members} />
      )}
    </div>
  );
};

export default CellLeaderDashboard;
