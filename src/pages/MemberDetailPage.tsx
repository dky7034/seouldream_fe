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
import {
  UserCircleIcon,
  PhoneIcon,
  EnvelopeIcon,
  HomeIcon,
  CakeIcon,
  IdentificationIcon,
  UserGroupIcon,
  KeyIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  BuildingLibraryIcon,
  XMarkIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/solid";

// ─────────────────────────────────────────────────────────────
// [Helpers]
// ─────────────────────────────────────────────────────────────

const toISODate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isDateInSemesterMonthRange = (date: Date, semester: SemesterDto) => {
  const targetYm = date.getFullYear() * 12 + date.getMonth();
  const s = new Date(semester.startDate);
  const sYm = s.getFullYear() * 12 + s.getMonth();
  const e = new Date(semester.endDate);
  const eYm = e.getFullYear() * 12 + e.getMonth();
  return targetYm >= sYm && targetYm <= eYm;
};

const safeFormatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  const targetStr =
    dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;
  const date = new Date(targetStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

const displayValue = (val: string | number | null | undefined) => {
  if (val === null || val === undefined || val === "")
    return <span className="text-gray-300">정보 없음</span>;
  return val;
};

// ─────────────────────────────────────────────────────────────
// [Components] UI Cards
// ─────────────────────────────────────────────────────────────

const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex items-start py-3 border-b border-gray-50 last:border-0">
    <div className="flex-shrink-0 mt-0.5 text-gray-400 w-5 h-5 mr-3">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <div className="text-sm text-gray-900 font-medium break-all">{value}</div>
    </div>
  </div>
);

const BasicInfoCard: React.FC<{
  member: MemberDto;
  isCurrentUser: boolean;
  onEditProfile: () => void;
}> = ({ member, isCurrentUser, onEditProfile }) => {
  const ageDisplay =
    member.age !== undefined && member.age !== null
      ? `(만 ${member.age}세)`
      : "";
  const displayBirthDate = member.birthDate
    ? safeFormatDate(member.birthDate)
    : "";
  const birthDateValue =
    displayBirthDate || ageDisplay
      ? `${displayBirthDate} ${ageDisplay}`.trim()
      : "정보 없음";

  return (
    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <IdentificationIcon className="h-5 w-5 text-indigo-500" />
          기본 정보
        </h3>
        {isCurrentUser && (
          <button
            onClick={onEditProfile}
            className="text-xs font-bold text-indigo-600 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
          >
            수정
          </button>
        )}
      </div>
      <div className="p-6 grid grid-cols-1 gap-1">
        <InfoRow
          icon={<UserCircleIcon />}
          label="이름"
          value={displayValue(member.name)}
        />
        <InfoRow
          icon={<KeyIcon />}
          label="아이디"
          value={displayValue(member.username)}
        />
        <InfoRow
          icon={<EnvelopeIcon />}
          label="이메일"
          value={displayValue(member.email)}
        />
        <InfoRow
          icon={<PhoneIcon />}
          label="연락처"
          value={displayValue(member.phone)}
        />
        <InfoRow icon={<CakeIcon />} label="생년월일" value={birthDateValue} />
        <InfoRow
          icon={<HomeIcon />}
          label="주소"
          value={displayValue(member.address)}
        />
      </div>
    </div>
  );
};

const ChurchInfoCard: React.FC<{ member: MemberDto }> = ({ member }) => (
  <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <BuildingLibraryIcon className="h-5 w-5 text-indigo-500" />
        교회 정보
      </h3>
    </div>
    <div className="p-6 grid grid-cols-1 gap-1">
      <InfoRow
        icon={<UserGroupIcon />}
        label="소속 셀"
        value={
          member.cell ? (
            <Link
              to={`/admin/cells/${member.cell.id}`}
              className="text-indigo-600 font-bold hover:underline"
            >
              {member.cell.name}
            </Link>
          ) : (
            <span className="text-gray-400">미배정</span>
          )
        }
      />
      <InfoRow
        icon={<CheckCircleIcon />}
        label="셀 배정일"
        value={
          member.cellAssignmentDate
            ? safeFormatDate(member.cellAssignmentDate)
            : "-"
        }
      />
      <InfoRow
        icon={<IdentificationIcon />}
        label="직분/역할"
        value={translateRole(member.role)}
      />
      <InfoRow
        icon={<FaCalendarAlt />}
        label="등록연도"
        value={member.joinYear ? `${member.joinYear}년` : "-"}
      />
      <InfoRow
        icon={
          <div
            className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
              member.active ? "bg-green-500" : "bg-gray-400"
            }`}
          />
        }
        label="상태"
        value={
          <span
            className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${
              member.active
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {member.active ? "활동 중" : "비활동"}
          </span>
        }
      />
    </div>
  </div>
);

const TeamsCard: React.FC<{
  memberTeams: TeamDto[];
  onManageClick: () => void;
  canManage: boolean;
}> = ({ memberTeams, onManageClick, canManage }) => (
  <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <UserGroupIcon className="h-5 w-5 text-indigo-500" />
        소속 팀
      </h3>
      {canManage && (
        <button
          onClick={onManageClick}
          className="text-xs font-bold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          관리
        </button>
      )}
    </div>
    <div className="p-6">
      {memberTeams.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {memberTeams.map((t) => (
            <Link
              key={t.id}
              to={`/admin/teams/${t.id}`}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 text-sm font-bold rounded-lg hover:bg-blue-100 transition-colors"
            >
              {t.name}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">
          소속된 사역 팀이 없습니다.
        </p>
      )}
    </div>
  </div>
);

const PrayersCard: React.FC<{ prayers: PrayerDto[] }> = ({ prayers }) => (
  <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-indigo-500" />
        기도제목{" "}
        <span className="text-gray-400 text-sm font-normal ml-1">
          ({prayers.length})
        </span>
      </h3>
    </div>
    <div className="max-h-80 overflow-y-auto p-2">
      {prayers.length > 0 ? (
        <ul className="space-y-1">
          {prayers.map((p) => (
            <li key={p.id}>
              <Link
                to={`/admin/prayers/${p.id}`}
                className="block p-4 hover:bg-gray-50 rounded-xl transition-colors group"
              >
                <p className="text-sm text-gray-800 font-medium group-hover:text-indigo-600 break-keep line-clamp-2">
                  {p.content}
                </p>
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <FaClock className="text-[10px]" />{" "}
                  {safeFormatDate(p.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-gray-400">
          등록된 기도제목이 없습니다.
        </p>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// [AttendanceSummaryCard]
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
  limitStartDate?: string;
  userRole?: string; // 👈 타입 정의
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
  limitStartDate,
  userRole, // 👈 ✅ 주석 해제 및 사용
}) => {
  const totalSummary = summary?.totalSummary;

  // ✅ [수정됨] 권한 및 날짜 제한에 따른 학기 필터링
  const availableSemesters = useMemo(() => {
    let filtered = semesters;

    // 1. 셀장(CELL_LEADER)은 오직 '활성화된(isActive)' 학기만 조회 가능
    if (userRole === "CELL_LEADER") {
      filtered = filtered.filter((s) => s.isActive);
    }

    // 2. limitStartDate(배정일 등)가 있으면 그 이전 학기는 제외
    if (limitStartDate) {
      filtered = filtered.filter((s) => s.endDate >= limitStartDate);
    }

    return filtered;
  }, [semesters, limitStartDate, userRole]);

  const semesterMonths = useMemo(() => {
    if (!activeSemester) return [];
    // ... (기존 로직 동일)
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

  // 미체크 계산 (미래 날짜 및 limitStartDate 적용)
  const uncheckedCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    if (!cellAssignmentDate) return 0;

    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    filterStart.setHours(0, 0, 0, 0);
    filterEnd.setHours(23, 59, 59, 999);

    const effectiveEnd = filterEnd > today ? today : filterEnd;

    // 배정일
    const assignDateObj = new Date(
      cellAssignmentDate.includes("T")
        ? cellAssignmentDate
        : `${cellAssignmentDate}T00:00:00`
    );
    assignDateObj.setHours(0, 0, 0, 0);

    // 권한 제한일 (limitStartDate)
    let restrictionDate = new Date("1900-01-01");
    if (limitStartDate) {
      restrictionDate = new Date(
        limitStartDate.includes("T")
          ? limitStartDate
          : `${limitStartDate}T00:00:00`
      );
      restrictionDate.setHours(0, 0, 0, 0);
    }

    // 최종 유효 시작일 = MAX(필터시작, 배정일, 권한제한일)
    const effectiveStart = new Date(
      Math.max(
        filterStart.getTime(),
        assignDateObj.getTime(),
        restrictionDate.getTime()
      )
    );

    if (effectiveStart > effectiveEnd) return 0;

    const targetSundays = new Set<string>();
    const current = new Date(effectiveStart);

    if (current.getDay() !== 0) {
      current.setDate(current.getDate() + (7 - current.getDay()));
    }

    while (current <= effectiveEnd) {
      targetSundays.add(toISODate(current));
      current.setDate(current.getDate() + 7);
    }

    const recordedDates = new Set<string>();
    attendances.forEach((att) => {
      if ((att.status === "PRESENT" || att.status === "ABSENT") && att.date) {
        recordedDates.add(att.date.substring(0, 10));
      }
    });

    let missingCount = 0;
    targetSundays.forEach((sunday) => {
      if (!recordedDates.has(sunday)) {
        missingCount++;
      }
    });

    return missingCount;
  }, [startDate, endDate, cellAssignmentDate, attendances, limitStartDate]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, ".");

  return (
    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5 text-indigo-500" />
          출석 현황
        </h3>
      </div>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Controls */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-auto">
              <div className="flex items-center bg-white px-3 py-2.5 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto hover:border-indigo-300 transition-colors">
                <FaCalendarAlt className="text-indigo-500 mr-2 text-sm flex-shrink-0" />
                <select
                  value={activeSemester?.id || ""}
                  onChange={(e) => onSemesterChange(Number(e.target.value))}
                  className="bg-transparent text-gray-700 font-bold text-sm focus:outline-none cursor-pointer w-full sm:min-w-[140px]"
                >
                  {availableSemesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isActive ? "(진행중)" : "(마감됨)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex bg-gray-200 p-1 rounded-lg w-full sm:w-auto">
              {(["month", "semester"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onUnitTypeChange(type)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                    unitType === type
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {type === "month" ? "월별" : "학기 전체"}
                </button>
              ))}
            </div>
          </div>

          {unitType === "month" && activeSemester && (
            <div className="animate-fadeIn">
              <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar snap-x">
                {semesterMonths.map((m) => (
                  <button
                    key={m}
                    onClick={() => onMonthSelect(m)}
                    className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-full border transition-all snap-start ${
                      selectedMonth === m
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    {m}월
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end items-center gap-2 text-xs text-gray-500 border-t border-gray-200 pt-3">
            <FaClock className="text-gray-400" />
            <span className="font-mono">
              {formatDate(startDate)} ~ {formatDate(endDate)}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        {totalSummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 shadow-sm text-center">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                {activeSemester?.name || "기간"} 출석률
              </p>
              <p className="mt-1 text-4xl font-extrabold text-indigo-700">
                {totalSummary.attendanceRate.toFixed(0)}
                <span className="text-xl ml-1 text-indigo-400">%</span>
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-gray-200 shadow-sm text-center bg-gradient-to-br from-gray-50 to-white">
              <p
                className={`text-xs font-bold uppercase tracking-wide ${
                  uncheckedCount > 0 ? "text-red-600" : "text-gray-500"
                }`}
              >
                미체크
              </p>
              <p
                className={`mt-1 text-4xl font-extrabold ${
                  uncheckedCount > 0 ? "text-red-600" : "text-gray-400"
                }`}
              >
                {uncheckedCount}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            데이터가 없습니다.
          </p>
        )}

        {/* Matrix */}
        <div className="pt-2">
          <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
            상세 출석표
          </h4>
          <AttendanceMatrix
            mode={unitType === "month" ? "month" : "semester"}
            startDate={startDate}
            endDate={endDate}
            year={new Date(startDate).getFullYear()}
            month={new Date(startDate).getMonth() + 1}
            members={[
              {
                memberId,
                memberName,
                cellAssignmentDate,
                createdAt: memberJoinDate,
                joinYear: memberJoinYear,
              },
            ]}
            attendances={attendances}
            loading={false}
            limitStartDate={limitStartDate}
            showAttendanceRate={false}
          />
        </div>
      </div>
    </div>
  );
};

const AdminActionsCard: React.FC<{
  onResetPassword: () => void;
  isResetting: boolean;
}> = ({ onResetPassword, isResetting }) => (
  <div className="bg-red-50 border border-red-100 rounded-2xl p-6 shadow-sm">
    <h3 className="text-lg font-bold text-red-800 mb-2 flex items-center gap-2">
      <ShieldExclamationIcon className="h-5 w-5" /> 관리자 도구
    </h3>
    <p className="text-sm text-red-600 mb-4 break-keep">
      멤버의 비밀번호를 강제로 초기화합니다.
    </p>
    <button
      onClick={onResetPassword}
      disabled={isResetting}
      className="w-full bg-white border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold hover:bg-red-600 hover:text-white disabled:opacity-50 transition-all shadow-sm"
    >
      {isResetting ? "초기화 중..." : "비밀번호 강제 초기화"}
    </button>
  </div>
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
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 break-keep">
            팀 관리{" "}
            <span className="text-gray-500 font-normal text-sm">
              ({memberName})
            </span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <MultiSelect
            options={teamOptions}
            selectedValues={selectedTeamIds}
            onChange={setSelectedTeamIds}
          />
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-gray-700 bg-white border border-gray-300 font-medium hover:bg-gray-50"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-white bg-indigo-600 font-bold hover:bg-indigo-700 shadow-sm"
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
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
          <CheckCircleIcon className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-gray-900">
          임시 비밀번호 생성 완료
        </h2>
        <p className="text-sm text-gray-600 mb-6 break-keep leading-relaxed">
          멤버에게 아래 비밀번호를 전달해주세요.
          {/* <br />
          로그인 후 즉시 변경하도록 안내가 필요합니다. */}
        </p>
        <div className="p-4 bg-gray-100 rounded-xl mb-6 border border-gray-200">
          <p className="text-2xl font-mono font-bold text-indigo-600 tracking-wider break-all select-all">
            {password}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full px-4 py-3 rounded-xl text-white font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all"
        >
          확인
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// [Main Page Component]
// ─────────────────────────────────────────────────────────────
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

  // ✅ [추가] 보안 방어 로직: 권한 없는 접근 차단 (URL 직접 접근 시)
  useEffect(() => {
    if (!user || !memberIdNum) return;

    // 셀장인데 본인 페이지가 아니면 쫓아냄
    if (user.role === "CELL_LEADER" && user.memberId !== memberIdNum) {
      alert("접근 권한이 없습니다.");
      navigate("/", { replace: true });
    }

    // 일반 멤버인데 본인 페이지가 아니면 쫓아냄
    if (user.role === "MEMBER" && user.memberId !== memberIdNum) {
      alert("접근 권한이 없습니다.");
      navigate("/", { replace: true });
    }
  }, [user, memberIdNum, navigate]);

  useEffect(() => {
    const loadSemesters = async () => {
      try {
        // 모든 학기 조회
        const data = await semesterService.getAllSemesters();
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

  // ✅ [핵심] 조회 권한에 따른 시작일 제한 계산 (본인 포함)
  // 셀장이나 멤버가 '본인'을 조회할 때도, '배정일' 이전의 기록은 안 보이게 할 것인가?
  // -> 보통 본인은 전체 기록을 볼 수 있어야 함.
  // -> 하지만 요청 사항은 "셀장은... 과거 이력을 보면 안 된다" 였으므로
  // -> 여기서는 셀장 본인이라도 일단은 '배정일' 기준을 적용해 둠.
  // -> (만약 본인은 다 보여야 한다면, user.memberId === memberIdNum 조건을 추가하여 return undefined 처리하면 됨)
  const viewableStartDate = useMemo(() => {
    if (!user || !member) return undefined;
    // 임원은 제한 없음
    if (user.role === "EXECUTIVE") return undefined;

    // 셀장은 멤버가 현재 셀에 배정된 날짜부터만 조회 가능
    if (user.role === "CELL_LEADER") {
      // 본인이라도 제한을 걸지, 아닐지 결정 필요.
      // 현재 로직: 본인이어도 배정일 기준 제한 (요청의 취지에 맞춤)
      if (member.cellAssignmentDate) {
        return member.cellAssignmentDate;
      }
      return `${new Date().getFullYear()}-01-01`;
    }
    return undefined;
  }, [user, member]);

  // 기간 계산 (viewableStartDate 적용)
  const periodRange = useMemo(() => {
    if (!activeSemester) return { startDate: "", endDate: "" };

    const { startDate: semStart, endDate: semEnd } = activeSemester;

    let targetStart = semStart;
    let targetEnd = semEnd;

    if (unitType === "month" && selectedMonth !== null) {
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

      targetStart = monthStartStr < semStart ? semStart : monthStartStr;
      targetEnd = monthEndStr > semEnd ? semEnd : monthEndStr;
    }

    // ✅ [핵심] 제한일(viewableStartDate)보다 이전 날짜는 조회 불가하도록 조정
    if (viewableStartDate && targetStart < viewableStartDate) {
      targetStart = viewableStartDate;
    }

    return {
      startDate: targetStart,
      endDate: targetEnd,
    };
  }, [activeSemester, unitType, selectedMonth, viewableStartDate]);

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
      // 셀장은 자신의 셀 멤버가 아니면 조회 불가 (물론 위 useEffect에서 본인 아니면 튕겨내지만, API단 방어도 중요)
      // 하지만 현재 로직은 "본인"만 허용하므로 아래 조건은 사실상 user.memberId === memberData.id 만 통과됨.
      if (user.role === "CELL_LEADER" && user.memberId !== memberData.id) {
        throw new Error("접근 권한이 없습니다.");
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
    if (!memberIdNum || !periodRange.startDate || !periodRange.endDate) return;

    if (periodRange.startDate > periodRange.endDate) {
      setAttendanceSummary(null);
      setAttendanceList([]);
      return;
    }

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  if (error)
    return <div className="p-10 text-center text-red-500">{error}</div>;
  if (!member)
    return (
      <div className="p-10 text-center text-gray-500">
        멤버 정보를 찾을 수 없습니다.
      </div>
    );

  const isExecutive = user?.role === "EXECUTIVE";

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                {member.name}{" "}
                <span className="text-lg font-normal text-gray-400">
                  상세 정보
                </span>
              </h1>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {isExecutive && (
              <button
                onClick={() => navigate(`/admin/users/${id}/edit`)}
                className="flex-1 sm:flex-none bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm"
              >
                수정
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="flex-1 sm:flex-none bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              뒤로 가기
            </button>
          </div>
        </div>

        {resetPasswordError && (
          <div className="mb-6 p-4 text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
            <ShieldExclamationIcon className="h-5 w-5" />
            {resetPasswordError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <BasicInfoCard
              member={member}
              isCurrentUser={user?.memberId === member.id && !!isExecutive}
              onEditProfile={() => navigate("/my-profile")}
            />
            {/* ✅ AttendanceSummaryCard에 limitStartDate 전달 */}
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
              limitStartDate={viewableStartDate} // 추가
              userRole={user?.role} // 추가
            />
          </div>

          <div className="space-y-6">
            <ChurchInfoCard member={member} />
            <TeamsCard
              memberTeams={memberTeams}
              onManageClick={() => setIsTeamModalOpen(true)}
              canManage={!!isExecutive}
            />
            <PrayersCard prayers={prayers} />
            {isExecutive && (
              <AdminActionsCard
                onResetPassword={() => setShowConfirmResetModal(true)}
                isResetting={isResettingPassword}
              />
            )}
          </div>
        </div>

        {/* ... (Modals) ... */}
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
          message={`정말로 ${member.name}님의 비밀번호를 초기화하시겠습니까?`}
        />
        <TempPasswordModal
          isOpen={showTempPasswordModal}
          onClose={() => setShowTempPasswordModal(false)}
          password={temporaryPassword}
        />
      </div>
    </div>
  );
};

export default MemberDetailPage;
