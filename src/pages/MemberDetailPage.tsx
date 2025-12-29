// src/pages/MemberDetailPage.tsx

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { memberService } from "../services/memberService";
import { prayerService } from "../services/prayerService";
import { teamService } from "../services/teamService";
import { attendanceService } from "../services/attendanceService";
import { semesterService } from "../services/semesterService";
import adminService from "../services/adminService";
import type {
  MemberDto,
  PrayerDto,
  MemberAttendanceSummaryDto,
  TeamDto,
  AttendanceDto,
  SemesterDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { translateRole } from "../utils/roleUtils";
import MultiSelect from "../components/MultiSelect";
import ConfirmModal from "../components/ConfirmModal";
import AttendanceMatrix from "../components/AttendanceMatrix";
import { FaCalendarAlt, FaClock } from "react-icons/fa";

// -------------------------------------------------------------------------
// [Helpers] 날짜 및 나이 계산
// -------------------------------------------------------------------------

/** Date 객체를 YYYY-MM-DD 문자열로 변환 */
const toISODate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** 특정 날짜(date)가 학기(semester)의 '월 범위' 안에 들어가는지 체크 */
const isDateInSemesterMonthRange = (date: Date, semester: SemesterDto) => {
  const targetYm = date.getFullYear() * 12 + date.getMonth();
  const s = new Date(semester.startDate);
  const sYm = s.getFullYear() * 12 + s.getMonth();
  const e = new Date(semester.endDate);
  const eYm = e.getFullYear() * 12 + e.getMonth();
  return targetYm >= sYm && targetYm <= eYm;
};

// ✅ 날짜 포맷팅 (KST 적용)
const safeFormatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  const targetStr =
    dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;
  const date = new Date(targetStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// -------------------------------------------------------------------------
// [Components] UI 카드 컴포넌트들
// -------------------------------------------------------------------------

const InfoCard: React.FC<{
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, children, actions, className }) => (
  <div className={`bg-white shadow overflow-hidden sm:rounded-lg ${className}`}>
    <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
      <h3 className="text-lg leading-6 font-medium text-gray-900 break-keep">
        {title}
      </h3>
      {actions}
    </div>
    <div className="border-t border-gray-200">{children}</div>
  </div>
);

const InfoDl: React.FC<{ items: { dt: string; dd: React.ReactNode }[] }> = ({
  items,
}) => (
  <dl className="divide-y divide-gray-200">
    {items.map((item, index) => (
      <div
        key={index}
        className={`px-4 py-3 sm:px-6 flex flex-col sm:grid sm:grid-cols-3 sm:gap-4 ${
          index % 2 === 0 ? "bg-gray-50" : "bg-white"
        }`}
      >
        <dt className="text-xs sm:text-sm font-medium text-gray-500 mb-1 sm:mb-0">
          {item.dt}
        </dt>
        <dd className="text-sm text-gray-900 sm:col-span-2 break-keep">
          {item.dd}
        </dd>
      </div>
    ))}
  </dl>
);

// --- 기본 정보 카드 ---
const BasicInfoCard: React.FC<{
  member: MemberDto;
  isCurrentUser: boolean;
  onEditProfile: () => void;
}> = ({ member, isCurrentUser, onEditProfile }) => {
  const ageDisplay =
    member.age !== undefined && member.age !== null
      ? `(만 ${member.age}세)`
      : "";

  const displayBirthDate = safeFormatDate(member.birthDate);

  return (
    <InfoCard
      title="기본 정보"
      actions={
        isCurrentUser && (
          <button
            onClick={onEditProfile}
            className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 whitespace-nowrap"
          >
            수정
          </button>
        )
      }
    >
      <InfoDl
        items={[
          { dt: "이름", dd: member.name },
          { dt: "아이디", dd: member.username },
          { dt: "이메일", dd: member.email },
          { dt: "연락처", dd: member.phone },
          { dt: "생년월일", dd: `${displayBirthDate} ${ageDisplay}` },
          { dt: "주소", dd: member.address || "정보 없음" },
        ]}
      />
    </InfoCard>
  );
};

// --- 교회 정보 카드 ---
const ChurchInfoCard: React.FC<{ member: MemberDto }> = ({ member }) => (
  <InfoCard title="교회 정보">
    <InfoDl
      items={[
        { dt: "셀", dd: member.cell?.name || "없음" },
        {
          dt: "셀 배정일",
          dd: member.cellAssignmentDate
            ? safeFormatDate(member.cellAssignmentDate)
            : "미배정",
        },
        { dt: "역할", dd: translateRole(member.role) },
        { dt: "등록연도", dd: member.joinYear },
        {
          dt: "상태",
          dd: (
            <span
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                member.active
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {member.active ? "활동" : "비활동"}
            </span>
          ),
        },
      ]}
    />
  </InfoCard>
);

// --- 팀 카드 ---
const TeamsCard: React.FC<{
  memberTeams: TeamDto[];
  onManageClick: () => void;
  canManage: boolean;
}> = ({ memberTeams, onManageClick, canManage }) => (
  <InfoCard
    title="소속 팀"
    actions={
      canManage && (
        <button
          onClick={onManageClick}
          className="text-sm text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
        >
          + 관리
        </button>
      )
    }
  >
    <div className="px-4 py-5">
      {memberTeams.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {memberTeams.map((t) => (
            <Link
              key={t.id}
              to={`/admin/teams/${t.id}`}
              className="px-2.5 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full hover:bg-blue-200 transition-colors"
            >
              {t.name}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">소속된 팀이 없습니다.</p>
      )}
    </div>
  </InfoCard>
);

// --- 기도제목 카드 ---
const PrayersCard: React.FC<{ prayers: PrayerDto[] }> = ({ prayers }) => (
  <InfoCard title={`기도제목 (${prayers.length})`}>
    <div className="max-h-96 overflow-y-auto">
      {prayers.length > 0 ? (
        <ul className="divide-y divide-gray-200">
          {prayers.map((p) => (
            <li
              key={p.id}
              className="px-4 py-4 hover:bg-gray-50 transition-colors"
            >
              <Link to={`/admin/prayers/${p.id}`} className="block">
                <p className="text-sm text-gray-800 hover:text-indigo-600 font-medium transition-colors break-keep">
                  {p.content}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {safeFormatDate(p.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-gray-500">기도제목이 없습니다.</p>
      )}
    </div>
  </InfoCard>
);

// ─────────────────────────────────────────────────────────────
// [핵심] 출석 요약 카드
// ─────────────────────────────────────────────────────────────
const AttendanceSummaryCard: React.FC<{
  summary: MemberAttendanceSummaryDto | null;
  memberId: number;
  memberName: string;
  cellAssignmentDate?: string;
  memberJoinDate?: string;
  memberJoinYear?: number;
  attendances: AttendanceDto[];
  semesters: SemesterDto[];
  activeSemester: SemesterDto | null;
  onSemesterChange: (id: number) => void;
  unitType: "semester" | "month";
  onUnitTypeChange: (type: "semester" | "month") => void;
  selectedMonth: number | null;
  onMonthSelect: (month: number) => void;
  onMatrixMonthChange: (increment: number) => void;
  startDate: string;
  endDate: string;
  userRole?: string;
}> = ({
  summary,
  memberId,
  memberName,
  cellAssignmentDate,
  memberJoinDate,
  memberJoinYear,
  attendances,
  semesters,
  activeSemester,
  onSemesterChange,
  unitType,
  onUnitTypeChange,
  selectedMonth,
  onMonthSelect,
  startDate,
  endDate,
  userRole,
}) => {
  const totalSummary = summary?.totalSummary;
  const isExecutive = userRole === "EXECUTIVE";

  const semesterMonths = useMemo(() => {
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
  }, [activeSemester]);

  // ✅ [수정] 미체크(빈칸) 계산 로직 - timezone safe 적용
  const uncheckedCount = useMemo(() => {
    if (!startDate || !endDate) return 0;

    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    filterStart.setHours(0, 0, 0, 0);
    filterEnd.setHours(23, 59, 59, 999);

    // 날짜 문자열을 안전하게 로컬 시간 Date 객체로 변환하는 헬퍼 함수
    const getSafeDateObj = (dateStr: string) => {
      const safeStr = dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`;
      const d = new Date(safeStr);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    let baseDate: Date;

    // 배정일/가입일 처리 강화
    if (cellAssignmentDate) {
      baseDate = getSafeDateObj(cellAssignmentDate);
    } else if (memberJoinDate) {
      baseDate = getSafeDateObj(memberJoinDate);
    } else if (memberJoinYear) {
      baseDate = new Date(memberJoinYear, 0, 1);
      baseDate.setHours(0, 0, 0, 0);
    } else {
      baseDate = new Date("2000-01-01T00:00:00");
      baseDate.setHours(0, 0, 0, 0);
    }

    const effectiveStart = filterStart < baseDate ? baseDate : filterStart;
    if (effectiveStart > filterEnd) return 0;

    const targetSundays = new Set<string>();
    const current = new Date(effectiveStart);

    // 시작일이 일요일이 아니면 다음 일요일로
    if (current.getDay() !== 0) {
      current.setDate(current.getDate() + (7 - current.getDay()));
    }

    // 기간 내 일요일 수집
    while (current <= filterEnd) {
      targetSundays.add(toISODate(current));
      current.setDate(current.getDate() + 7);
    }

    // 출석 기록 수집
    const recordedDates = new Set<string>();
    attendances.forEach((att) => {
      if ((att.status === "PRESENT" || att.status === "ABSENT") && att.date) {
        recordedDates.add(att.date.substring(0, 10));
      }
    });

    // 미체크 카운트
    let missingCount = 0;
    targetSundays.forEach((sunday) => {
      if (!recordedDates.has(sunday)) {
        missingCount++;
      }
    });

    return missingCount;
  }, [
    startDate,
    endDate,
    cellAssignmentDate,
    memberJoinDate,
    memberJoinYear,
    attendances,
  ]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, ".");

  return (
    <InfoCard title="출석 요약 & 현황">
      <div className="p-4 sm:p-6 space-y-6">
        <div className="bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-auto">
                <div className="flex items-center bg-white px-3 py-2 rounded-md border border-gray-300 shadow-sm w-full sm:w-auto">
                  <FaCalendarAlt className="text-indigo-500 mr-2 text-sm flex-shrink-0" />
                  <select
                    value={activeSemester?.id || ""}
                    onChange={(e) => onSemesterChange(Number(e.target.value))}
                    className="bg-transparent text-gray-700 font-semibold text-sm focus:outline-none cursor-pointer w-full sm:min-w-[140px]"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex bg-gray-200 p-1 rounded-lg w-full sm:w-auto">
                <button
                  onClick={() => onUnitTypeChange("month")}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    unitType === "month"
                      ? "bg-white text-indigo-700 shadow ring-1 ring-black/5"
                      : "text-gray-500 hover:bg-gray-300"
                  }`}
                >
                  월별 보기
                </button>
                <button
                  onClick={() => onUnitTypeChange("semester")}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    unitType === "semester"
                      ? "bg-white text-indigo-700 shadow ring-1 ring-black/5"
                      : "text-gray-500 hover:bg-gray-300"
                  }`}
                >
                  학기 전체
                </button>
              </div>
            </div>

            {unitType === "month" && activeSemester && (
              <div className="animate-fadeIn mt-1">
                <span className="text-xs font-bold text-gray-500 block mb-2 px-1">
                  {activeSemester.name} 상세 월 선택:
                </span>
                <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar snap-x">
                  {semesterMonths.map((m) => (
                    <button
                      key={m}
                      onClick={() => onMonthSelect(m)}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full border transition-all snap-start ${
                        selectedMonth === m
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {m}월
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1 sm:gap-2 text-xs text-gray-500 border-t border-gray-200 pt-3 mt-1">
            <div className="flex items-center">
              <FaClock className="mr-1.5 text-gray-400" />
              <span className="font-medium whitespace-nowrap">조회 기간:</span>
            </div>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
              {formatDate(startDate)} ~ {formatDate(endDate)}
            </span>
          </div>
        </div>

        {totalSummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-center border-t border-b py-4">
            {isExecutive ? (
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col items-center justify-center">
                <p className="text-sm font-medium text-indigo-600 whitespace-nowrap">
                  출석률
                </p>
                <p className="mt-2 text-3xl font-bold text-indigo-700">
                  {totalSummary.attendanceRate.toFixed(0)}
                  <span className="text-lg ml-0.5">%</span>
                </p>
              </div>
            ) : (
              <></>
            )}

            <div
              className={`p-4 rounded-xl border flex flex-col items-center justify-center ${
                uncheckedCount > 0
                  ? "bg-red-50 border-red-100"
                  : "bg-gray-50 border-gray-200"
              } ${!isExecutive ? "sm:col-span-2" : ""}`}
            >
              <p
                className={`text-sm font-medium whitespace-nowrap ${
                  uncheckedCount > 0 ? "text-red-600" : "text-gray-500"
                }`}
              >
                미체크
              </p>
              <p
                className={`mt-2 text-3xl font-bold ${
                  uncheckedCount > 0 ? "text-red-700" : "text-gray-600"
                }`}
              >
                {uncheckedCount}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4 text-center">
            선택된 기간에 대한 데이터가 없습니다.
          </p>
        )}

        <div className="pt-2">
          <h4 className="text-sm font-medium text-gray-700 mb-3 ml-1 break-keep">
            {unitType === "semester"
              ? `[${activeSemester?.name}] 전체 현황`
              : `${selectedMonth}월 상세 현황 (학기 교집합)`}
          </h4>
          <AttendanceMatrix
            mode={unitType === "month" ? "month" : "semester"}
            startDate={startDate}
            endDate={endDate}
            year={new Date(startDate).getFullYear()}
            month={new Date(startDate).getMonth() + 1}
            members={[{ memberId, memberName }]}
            attendances={attendances}
            loading={false}
            limitStartDate={activeSemester?.startDate}
            limitEndDate={activeSemester?.endDate}
            showAttendanceRate={isExecutive}
          />
        </div>
      </div>
    </InfoCard>
  );
};

// ... (이후 AdminActionsCard, TeamManagementModal, TempPasswordModal 등 기존과 동일) ...
// Main Page 등 나머지는 변경 없음.

const AdminActionsCard: React.FC<{
  onResetPassword: () => void;
  isResetting: boolean;
}> = ({ onResetPassword, isResetting }) => (
  <InfoCard title="관리자 도구" className="border-l-4 border-red-500">
    <div className="p-6">
      <p className="text-sm text-gray-600 mb-4 break-keep">
        주의: 아래 버튼은 사용자 계정에 직접적인 영향을 미칩니다.
      </p>
      <button
        onClick={onResetPassword}
        disabled={isResetting}
        className="w-full bg-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-red-700 disabled:bg-red-300"
      >
        {isResetting ? "초기화 중..." : "비밀번호 강제 초기화"}
      </button>
    </div>
  </InfoCard>
);

const TeamManagementModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedTeamIds: number[]) => Promise<void>;
  memberName: string;
  allTeams: TeamDto[];
  memberTeams: TeamDto[];
}> = ({ isOpen, onClose, onSave, memberName, allTeams, memberTeams }) => {
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>(() =>
    memberTeams.map((t) => t.id)
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(selectedTeamIds);
    setIsSaving(false);
    onClose();
  };

  const teamOptions = allTeams.map((t) => ({ value: t.id, label: t.name }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4 break-keep">
          {memberName}님의 팀 관리
        </h2>
        <div className="mb-6 max-h-60 overflow-y-auto">
          <MultiSelect
            options={teamOptions}
            selectedValues={selectedTeamIds}
            onChange={setSelectedTeamIds}
          />
        </div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            disabled={isSaving}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
};

const TempPasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  password: string;
}> = ({ isOpen, onClose, password }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gray-800 break-keep">
          임시 비밀번호 생성 완료
        </h2>
        <p className="text-sm text-gray-600 mb-4 break-keep">
          사용자에게 아래 임시 비밀번호를 전달하고, 로그인 후 즉시 비밀번호를
          변경하도록 안내해주세요.
        </p>
        <div className="p-3 bg-gray-100 rounded-md text-center">
          <p className="text-lg font-mono font-bold text-indigo-600 break-all">
            {password}
          </p>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

const MemberDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [member, setMember] = useState<MemberDto | null>(null);
  const [prayers, setPrayers] = useState<PrayerDto[]>([]);
  const [attendanceSummary, setAttendanceSummary] =
    useState<MemberAttendanceSummaryDto | null>(null);
  const [attendanceList, setAttendanceList] = useState<AttendanceDto[]>([]);
  const [memberTeams, setMemberTeams] = useState<TeamDto[]>([]);
  const [allTeams, setAllTeams] = useState<TeamDto[]>([]);

  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [activeSemester, setActiveSemester] = useState<SemesterDto | null>(
    null
  );
  const [unitType, setUnitType] = useState<"semester" | "month">("semester");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [showConfirmResetModal, setShowConfirmResetModal] = useState(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(
    null
  );
  const [temporaryPassword, setTemporaryPassword] = useState<string>("");

  const memberIdNum = useMemo(() => {
    if (!id) return null;
    const num = Number(id);
    return Number.isNaN(num) ? null : num;
  }, [id]);

  useEffect(() => {
    const loadSemesters = async () => {
      try {
        const data = await semesterService.getAllSemesters(true);
        const sortedData = data.sort(
          (a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
        setSemesters(sortedData);

        if (sortedData.length > 0) {
          const now = new Date();
          const currentSemester = sortedData.find((sem) =>
            isDateInSemesterMonthRange(now, sem)
          );

          if (currentSemester) {
            setActiveSemester(currentSemester);
          } else {
            setActiveSemester(sortedData[0]);
          }
          setUnitType("semester");
          setSelectedMonth(null);
        }
      } catch (err) {
        console.error("학기 로딩 실패", err);
      }
    };
    loadSemesters();
  }, []);

  const periodRange = useMemo(() => {
    if (!activeSemester) return { startDate: "", endDate: "" };

    const { startDate: semStart, endDate: semEnd } = activeSemester;

    if (unitType === "semester" || selectedMonth === null) {
      return { startDate: semStart, endDate: semEnd };
    }

    let targetYear = new Date(semStart).getFullYear();
    const startMonthIndex = new Date(semStart).getMonth() + 1;

    if (selectedMonth < startMonthIndex) {
      targetYear += 1;
    }

    const m = selectedMonth;
    const monthStartStr = `${targetYear}-${String(m).padStart(2, "0")}-01`;
    const lastDayObj = new Date(targetYear, m, 0);
    const monthEndStr = `${targetYear}-${String(m).padStart(2, "0")}-${String(
      lastDayObj.getDate()
    ).padStart(2, "0")}`;

    const finalStart = monthStartStr < semStart ? semStart : monthStartStr;
    const finalEnd = monthEndStr > semEnd ? semEnd : monthEndStr;

    return {
      startDate: finalStart,
      endDate: finalEnd,
    };
  }, [activeSemester, unitType, selectedMonth]);

  const handleSemesterChange = (semesterId: number) => {
    const target = semesters.find((s) => s.id === semesterId);
    if (target) {
      setActiveSemester(target);
      setSelectedMonth(null);
      setUnitType("semester");
    }
  };

  const handleUnitTypeChange = (type: "semester" | "month") => {
    setUnitType(type);
    if (type === "semester") {
      setSelectedMonth(null);
      return;
    }
    if (activeSemester) {
      const now = new Date();
      if (isDateInSemesterMonthRange(now, activeSemester)) {
        setSelectedMonth(now.getMonth() + 1);
      } else {
        const s = new Date(activeSemester.startDate);
        setSelectedMonth(s.getMonth() + 1);
      }
    }
  };

  const handleMatrixMonthChange = useCallback(
    (increment: number) => {
      if (unitType !== "month" || !activeSemester || !periodRange.startDate)
        return;

      const currentStart = new Date(periodRange.startDate);
      const targetDate = new Date(
        currentStart.getFullYear(),
        currentStart.getMonth() + increment,
        1
      );

      if (isDateInSemesterMonthRange(targetDate, activeSemester)) {
        setSelectedMonth(targetDate.getMonth() + 1);
      }
    },
    [unitType, activeSemester, periodRange.startDate]
  );

  const fetchMemberDetails = useCallback(async () => {
    setError(null);

    if (!memberIdNum || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [memberData, prayerData, memberTeamsData, allTeamsPage] =
        await Promise.all([
          memberService.getMemberById(memberIdNum),
          prayerService.getPrayers({ memberId: memberIdNum }),
          memberService.getMemberTeams(memberIdNum),
          user.role === "EXECUTIVE"
            ? teamService.getAllTeams({})
            : Promise.resolve([]),
        ]);

      if (
        user.role !== "EXECUTIVE" &&
        user.role !== "CELL_LEADER" &&
        user.memberId !== memberData.id
      ) {
        throw new Error("권한이 없습니다.");
      }
      if (user.role === "CELL_LEADER" && user.cellId !== memberData.cell?.id) {
        throw new Error("자신이 속한 셀의 멤버 정보만 조회할 수 있습니다.");
      }

      setMember(memberData);
      setPrayers(prayerData.content);
      setMemberTeams(memberTeamsData);
      setAllTeams(Array.isArray(allTeamsPage) ? [] : allTeamsPage.content);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "멤버 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [memberIdNum, user]);

  const fetchAttendanceSummary = useCallback(async () => {
    if (!memberIdNum || !periodRange.startDate) return;

    try {
      const summaryData = await attendanceService.getMemberAttendanceSummary(
        memberIdNum,
        {
          startDate: periodRange.startDate,
          endDate: periodRange.endDate,
          groupBy: "DAY",
        }
      );
      setAttendanceSummary(summaryData);

      const listData = await attendanceService.getAttendances({
        memberId: memberIdNum,
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
        page: 0,
        size: 2000,
        sort: "date,asc",
      });
      setAttendanceList(listData.content || []);
    } catch (err) {
      console.error("Failed to fetch attendance data:", err);
    }
  }, [memberIdNum, periodRange]);

  useEffect(() => {
    fetchMemberDetails();
  }, [fetchMemberDetails]);

  useEffect(() => {
    if (member) {
      fetchAttendanceSummary();
    }
  }, [member, fetchAttendanceSummary]);

  const handleTeamSave = useCallback(
    async (newTeamIds: number[]) => {
      if (!memberIdNum) return;
      const currentTeamIds = new Set(memberTeams.map((t) => t.id));
      const selectedTeamIds = new Set(newTeamIds);

      const toAdd = [...selectedTeamIds].filter(
        (tid) => !currentTeamIds.has(tid)
      );
      const toRemove = [...currentTeamIds].filter(
        (tid) => !selectedTeamIds.has(tid)
      );

      try {
        await Promise.all([
          ...toAdd.map((teamId) =>
            memberService.addMemberToTeam(memberIdNum, teamId)
          ),
          ...toRemove.map((teamId) =>
            memberService.removeMemberFromTeam(memberIdNum, teamId)
          ),
        ]);
        const updatedMemberTeams = await memberService.getMemberTeams(
          memberIdNum
        );
        setMemberTeams(updatedMemberTeams);
      } catch (error) {
        console.error("Failed to update teams:", error);
      }
    },
    [memberIdNum, memberTeams]
  );

  const handleResetPassword = async () => {
    if (!memberIdNum) return;
    setShowConfirmResetModal(false);
    setIsResettingPassword(true);
    setResetPasswordError(null);

    try {
      const response = await adminService.resetPassword(memberIdNum);
      setTemporaryPassword(response.temporaryPassword);
      setShowTempPasswordModal(true);
    } catch (error: any) {
      console.error("resetPassword error:", error);
      setResetPasswordError(
        error.response?.data?.message || "비밀번호 초기화에 실패했습니다."
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (loading && !member)
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="text-gray-600">로딩 중입니다...</p>
      </div>
    );
  if (error) return <div className="p-4 text-red-600 text-center">{error}</div>;
  if (!member)
    return (
      <div className="p-4 text-red-600 text-center">
        멤버 정보를 찾을 수 없습니다.
      </div>
    );
  const isExecutive = user?.role === "EXECUTIVE";

  return (
    <div className="container mx-auto px-4 py-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-keep">
          {member.name} 상세 정보
        </h1>
        <div className="flex gap-2 w-full sm:w-auto">
          {isExecutive && (
            <button
              onClick={() => navigate(`/admin/users/${id}/edit`)}
              className="flex-1 sm:flex-none bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 text-center whitespace-nowrap"
            >
              수정
            </button>
          )}
          <button
            onClick={() => navigate(-1)}
            className="flex-1 sm:flex-none bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 text-center whitespace-nowrap"
          >
            뒤로 가기
          </button>
        </div>
      </div>

      {resetPasswordError && (
        <div className="mb-4 p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
          {resetPasswordError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BasicInfoCard
            member={member}
            isCurrentUser={user?.memberId === member.id && isExecutive}
            onEditProfile={() => navigate("/my-profile")}
          />
          <AttendanceSummaryCard
            summary={attendanceSummary}
            memberId={member.id}
            memberName={member.name}
            cellAssignmentDate={member.cellAssignmentDate}
            memberJoinDate={member.createdAt}
            memberJoinYear={member.joinYear}
            attendances={attendanceList}
            semesters={semesters}
            activeSemester={activeSemester}
            onSemesterChange={handleSemesterChange}
            unitType={unitType}
            onUnitTypeChange={handleUnitTypeChange}
            selectedMonth={selectedMonth}
            onMonthSelect={setSelectedMonth}
            onMatrixMonthChange={handleMatrixMonthChange}
            startDate={periodRange.startDate}
            endDate={periodRange.endDate}
            userRole={user?.role}
          />
        </div>

        <div className="space-y-6">
          <ChurchInfoCard member={member} />
          <TeamsCard
            memberTeams={memberTeams}
            onManageClick={() => setIsTeamModalOpen(true)}
            canManage={isExecutive}
          />
          {isExecutive && (
            <AdminActionsCard
              onResetPassword={() => setShowConfirmResetModal(true)}
              isResetting={isResettingPassword}
            />
          )}
          <PrayersCard prayers={prayers} />
        </div>
      </div>

      <TeamManagementModal
        key={isTeamModalOpen ? "modal-open" : "modal-closed"}
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        onSave={handleTeamSave}
        memberName={member.name}
        allTeams={allTeams}
        memberTeams={memberTeams}
      />
      <ConfirmModal
        isOpen={showConfirmResetModal}
        onClose={() => setShowConfirmResetModal(false)}
        onConfirm={handleResetPassword}
        title="비밀번호 초기화 확인"
        message={`정말로 ${member.name}님의 비밀번호를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
      />
      <TempPasswordModal
        isOpen={showTempPasswordModal}
        onClose={() => setShowTempPasswordModal(false)}
        password={temporaryPassword}
      />
    </div>
  );
};

export default MemberDetailPage;
