import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cellService } from "../services/cellService";
import { memberService } from "../services/memberService";
import { attendanceService } from "../services/attendanceService";
import { semesterService } from "../services/semesterService";
import { exportService } from "../services/exportService";
import type { CellDto, MemberDto, AttendanceDto, SemesterDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import ConfirmModal from "../components/ConfirmModal";
import { formatNameWithBirthdate } from "../utils/memberUtils";
import AttendanceMatrix from "../components/AttendanceMatrix";
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";
import {
  FaCalendarAlt,
  FaClock,
  FaChevronDown,
  FaChevronUp,
  FaQuoteLeft,
} from "react-icons/fa";
import {
  UserCircleIcon,
  UserPlusIcon,
  InformationCircleIcon,
  DocumentArrowDownIcon,
  UsersIcon,
  CheckCircleIcon,
  XMarkIcon,
  MegaphoneIcon,
} from "@heroicons/react/24/solid";

// ───────────────── [컴포넌트] AddMemberToCellModal ─────────────────
const AddMemberToCellModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberIds: number[]) => Promise<void>;
}> = ({ isOpen, onClose, onSave }) => {
  const [candidateMembers, setCandidateMembers] = useState<MemberDto[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    const fetchUnassignedMembers = async () => {
      if (!isOpen) {
        setCandidateMembers([]);
        setSelectedMemberIds([]);
        setSearchTerm("");
        setIsSaving(false);
        setIsLoadingMembers(false);
        return;
      }
      try {
        setIsLoadingMembers(true);
        const page = await memberService.getAllMembers({
          unassigned: true,
          size: 1000,
        });
        const filteredContent = page.content.filter(
          (m) => m.role !== "EXECUTIVE"
        );
        setCandidateMembers(filteredContent);
      } catch (error) {
        console.error("Failed to fetch unassigned members:", error);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    fetchUnassignedMembers();
  }, [isOpen]);

  const filteredMembers = useMemo(
    () =>
      candidateMembers.filter((member) =>
        formatNameWithBirthdate(member)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ),
    [candidateMembers, searchTerm]
  );

  const selectedMembers = useMemo(
    () => candidateMembers.filter((m) => selectedMemberIds.includes(m.id)),
    [candidateMembers, selectedMemberIds]
  );

  const handleToggleMember = (memberId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleRemoveMember = (memberId: number) => {
    setSelectedMemberIds((prev) => prev.filter((id) => id !== memberId));
  };

  const handleSave = async () => {
    if (selectedMemberIds.length === 0) return;
    setIsSaving(true);
    await onSave(selectedMemberIds);
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserPlusIcon className="h-5 w-5 text-indigo-600" /> 셀 멤버 추가
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Search & Selected Pills */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <p className="text-xs text-gray-500 mb-2 break-keep">
            * 현재 소속이 없는 멤버만 검색됩니다.
          </p>
          <input
            type="text"
            placeholder="이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3 transition-all"
          />

          {/* 선택된 멤버 뱃지 (가로 스크롤) */}
          {selectedMembers.length > 0 && (
            <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
              {selectedMembers.map((m) => (
                <span
                  key={m.id}
                  className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                >
                  {formatNameWithBirthdate(m)}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    className="ml-1 text-indigo-400 hover:text-indigo-700 rounded-full hover:bg-indigo-200 p-0.5"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* List Area */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingMembers ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              {candidateMembers.length === 0
                ? "현재 추가 가능한(미소속) 멤버가 없습니다."
                : "검색 결과가 없습니다."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filteredMembers.map((member) => (
                <li key={member.id}>
                  <label
                    htmlFor={`add-member-checkbox-${member.id}`}
                    className={`flex items-center px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                      selectedMemberIds.includes(member.id)
                        ? "bg-indigo-50 border border-indigo-100"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <input
                      id={`add-member-checkbox-${member.id}`}
                      type="checkbox"
                      checked={selectedMemberIds.includes(member.id)}
                      onChange={() => handleToggleMember(member.id)}
                      className="mr-3 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span
                      className={`text-sm ${
                        selectedMemberIds.includes(member.id)
                          ? "font-bold text-indigo-900"
                          : "text-gray-700"
                      }`}
                    >
                      {formatNameWithBirthdate(member)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors"
            disabled={selectedMemberIds.length === 0 || isSaving}
          >
            {isSaving ? "추가 중..." : `${selectedMemberIds.length}명 추가하기`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ───────────────── [컴포넌트] CellReportHistoryItem ─────────────────
const CellReportHistoryItem: React.FC<{
  cellId: number;
  date: string;
  isWritten: boolean;
}> = ({ cellId, date, isWritten }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<{
    cellShare: string;
    specialNotes: string;
    attendances: AttendanceDto[];
  } | null>(null);

  const fetchReport = async () => {
    if (reportData) return;
    setLoading(true);
    try {
      const report = await attendanceService
        .getCellReport(cellId, date)
        .catch(() => null);
      const attRes = await attendanceService.getAttendances({
        startDate: date,
        endDate: date,
        cellId: cellId,
        size: 100,
      });

      setReportData({
        cellShare: report?.cellShare || "",
        specialNotes: report?.specialNotes || "",
        attendances: attRes.content || [],
      });
    } catch (e) {
      console.error("보고서 로딩 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleOpen = () => {
    if (!isOpen && !reportData) {
      fetchReport();
    }
    setIsOpen(!isOpen);
  };

  const isEmpty =
    reportData &&
    !reportData.cellShare &&
    !reportData.specialNotes &&
    reportData.attendances.length === 0;

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden mb-3 shadow-sm transition-all hover:shadow-md">
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-800 text-sm sm:text-base">
            {date} (일)
          </span>
          <span
            className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full border font-medium ${
              !isWritten
                ? "bg-gray-100 text-gray-500 border-gray-200"
                : "bg-green-50 text-green-700 border-green-200"
            }`}
          >
            {!isWritten ? "미작성" : "작성됨"}
          </span>
        </div>
        <div className="text-gray-400">
          {isOpen ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 py-5 border-t border-gray-100 bg-gray-50/30 animate-fadeIn">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
            </div>
          ) : isEmpty ? (
            <div className="text-center py-4 text-sm text-gray-400">
              등록된 보고서 내용이 없습니다.
            </div>
          ) : (
            <div className="space-y-6">
              {(reportData!.cellShare || reportData!.specialNotes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1.5">
                      <FaQuoteLeft className="opacity-50" /> 셀 은혜 나눔
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {reportData!.cellShare || "내용 없음"}
                    </p>
                  </div>
                  <div className="bg-red-50/60 p-4 rounded-xl border border-red-100">
                    <h4 className="text-xs font-bold text-red-800 mb-2 flex items-center gap-1.5">
                      <MegaphoneIcon className="h-3 w-3" /> 셀 특이사항
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {reportData!.specialNotes || "내용 없음"}
                    </p>
                  </div>
                </div>
              )}

              {reportData!.attendances.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-3 pl-2 border-l-4 border-indigo-500 flex items-center">
                    멤버별 출석 & 기도제목
                  </h4>

                  {/* 모바일 뷰 */}
                  <div className="md:hidden space-y-3">
                    {reportData!.attendances.map((att) => (
                      <div
                        key={att.id}
                        className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                          <span className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <UserCircleIcon className="h-5 w-5 text-gray-300" />
                            {formatNameWithBirthdate(att.member)}
                          </span>
                          <span
                            className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${
                              att.status === "PRESENT"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {att.status === "PRESENT" ? "출석" : "결석"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">
                          {att.prayerContent ? (
                            <div className="bg-gray-50 p-3 rounded-lg text-xs leading-relaxed">
                              {att.prayerContent}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs pl-1">
                              기도제목 없음
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 데스크탑 뷰 */}
                  <div className="hidden md:block overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-32">
                            이름
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-24">
                            출석
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                            기도제목
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {reportData!.attendances.map((att) => (
                          <tr key={att.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {formatNameWithBirthdate(att.member)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${
                                  att.status === "PRESENT"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {att.status === "PRESENT" ? "출석" : "결석"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-pre-wrap">
                              {att.prayerContent || (
                                <span className="text-gray-300 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ───────────────── [컴포넌트] CellReportHistoryContainer ─────────────────
const CellReportHistoryContainer: React.FC<{
  cellId: number;
  startDate: string;
  endDate: string;
  attendances: AttendanceDto[];
}> = ({ cellId, startDate, endDate, attendances }) => {
  const writtenDates = useMemo(() => {
    const dates = new Set<string>();
    if (attendances)
      attendances.forEach((att) => att.date && dates.add(att.date));
    return dates;
  }, [attendances]);

  const sundayDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    const day = current.getDay();
    if (day !== 0) current.setDate(current.getDate() + (7 - day));

    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 7);
    }
    return dates.reverse();
  }, [startDate, endDate]);

  if (sundayDates.length === 0) return null;

  return (
    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden mt-6">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <InformationCircleIcon className="h-5 w-5 text-indigo-500" />
          주간 보고서 기록
        </h3>
      </div>
      <div className="p-4 sm:p-6 bg-white min-h-[200px]">
        {sundayDates.map((date) => (
          <CellReportHistoryItem
            key={date}
            cellId={cellId}
            date={date}
            isWritten={writtenDates.has(date)}
          />
        ))}
      </div>
    </div>
  );
};

// ───────────────── [컴포넌트] CellAttendanceMatrixCard ─────────────────
const CellAttendanceMatrixCard: React.FC<{
  cellId: number;
  sortedMembers: MemberDto[];
  semesters: SemesterDto[];
  activeSemester: SemesterDto | null;
  onSemesterChange: (id: number) => void;
  unitType: "semester" | "month" | "year";
  onUnitTypeChange: (type: "semester" | "month" | "year") => void;
  selectedMonth: number | null;
  onMonthSelect: (month: number) => void;
  matrixAttendances: AttendanceDto[];
  periodSummary: any;
  startDate: string;
  endDate: string;
}> = ({
  sortedMembers,
  semesters,
  activeSemester,
  onSemesterChange,
  unitType,
  onUnitTypeChange,
  selectedMonth,
  onMonthSelect,
  matrixAttendances,
  periodSummary,
  startDate,
  endDate,
}) => {
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

  const stats = useMemo(() => {
    if (!startDate || !endDate || sortedMembers.length === 0) {
      return { unchecked: 0, rate: 0 };
    }
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    filterStart.setHours(0, 0, 0, 0);
    filterEnd.setHours(23, 59, 59, 999);

    let totalPossibleChecks = 0;
    sortedMembers.forEach((member) => {
      const joinDate = member.cellAssignmentDate
        ? new Date(member.cellAssignmentDate)
        : member.createdAt
        ? new Date(member.createdAt)
        : new Date("2000-01-01");
      joinDate.setHours(0, 0, 0, 0);
      const effectiveStart = filterStart < joinDate ? joinDate : filterStart;
      if (effectiveStart > filterEnd) return;
      const current = new Date(effectiveStart);
      current.setHours(0, 0, 0, 0);
      while (current <= filterEnd) {
        if (current.getDay() === 0) totalPossibleChecks++;
        current.setDate(current.getDate() + 1);
      }
    });

    const totalPresent = periodSummary?.totalPresent || 0;
    const totalRecorded = totalPresent + (periodSummary?.totalAbsent || 0);
    const unchecked = Math.max(0, totalPossibleChecks - totalRecorded);
    const rate = periodSummary?.attendanceRate ?? 0;
    return { unchecked, rate };
  }, [startDate, endDate, sortedMembers, periodSummary]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, ".");
  const matrixMembers = useMemo(
    () =>
      sortedMembers.map((m) => ({
        memberId: m.id,
        memberName: m.name,
        cellAssignmentDate: m.cellAssignmentDate,
        createdAt: m.createdAt,
        joinYear: m.joinYear,
      })),
    [sortedMembers]
  );

  return (
    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5 text-indigo-500" />
          출석 현황
        </h3>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Controls Container */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Left: Selectors */}
            <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
              {unitType !== "year" ? (
                <div className="relative w-full sm:w-auto">
                  <div className="flex items-center bg-white px-3 py-2.5 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto hover:border-indigo-300 transition-colors">
                    <FaCalendarAlt className="text-indigo-500 mr-2 text-sm flex-shrink-0" />
                    <select
                      value={activeSemester?.id || ""}
                      onChange={(e) => onSemesterChange(Number(e.target.value))}
                      className="bg-transparent text-gray-700 font-semibold text-sm focus:outline-none cursor-pointer w-full sm:min-w-[160px]"
                    >
                      {semesters.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex items-center bg-white px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto justify-center sm:justify-start">
                  <FaCalendarAlt className="text-indigo-500 mr-2 text-sm" />
                  <span className="text-gray-900 font-bold text-sm">
                    {new Date(startDate).getFullYear()}년
                  </span>
                </div>
              )}

              {/* Toggle Buttons */}
              <div className="flex bg-gray-200 p-1 rounded-lg w-full sm:w-auto">
                {(["month", "semester", "year"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => onUnitTypeChange(type)}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                      unitType === type
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-300/50"
                    }`}
                  >
                    {type === "month"
                      ? "월별"
                      : type === "semester"
                      ? "학기"
                      : "연간"}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Date Range Display */}
            <div className="flex items-center justify-end text-xs text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
              <FaClock className="mr-1.5 text-gray-400" />
              <span className="font-mono text-gray-700">
                {formatDate(startDate)} ~ {formatDate(endDate)}
              </span>
            </div>
          </div>

          {/* Detailed Month Selector */}
          {unitType === "month" && activeSemester && (
            <div className="animate-fadeIn">
              <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar snap-x pt-1">
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
        </div>

        {/* Stats Cards */}
        {periodSummary ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 shadow-sm text-center">
              <p className="text-xs sm:text-sm font-bold text-indigo-600 uppercase tracking-wide">
                출석률
              </p>
              <p className="mt-1 text-3xl sm:text-4xl font-extrabold text-indigo-700">
                {stats.rate.toFixed(0)}
                <span className="text-lg sm:text-xl ml-1 text-indigo-400">
                  %
                </span>
              </p>
            </div>
            <div
              className={`p-5 rounded-2xl border shadow-sm text-center bg-gradient-to-br ${
                stats.unchecked > 0
                  ? "from-red-50 to-white border-red-100"
                  : "from-gray-50 to-white border-gray-200"
              }`}
            >
              <p
                className={`text-xs sm:text-sm font-bold uppercase tracking-wide ${
                  stats.unchecked > 0 ? "text-red-600" : "text-gray-500"
                }`}
              >
                미체크
              </p>
              <p
                className={`mt-1 text-3xl sm:text-4xl font-extrabold ${
                  stats.unchecked > 0 ? "text-red-600" : "text-gray-400"
                }`}
              >
                {stats.unchecked}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            선택된 기간에 대한 데이터가 없습니다.
          </div>
        )}

        {/* Matrix Component Wrapper */}
        <div className="pt-2">
          <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
            상세 출석표
          </h4>
          <AttendanceMatrix
            mode={unitType}
            startDate={startDate}
            endDate={endDate}
            year={new Date(startDate).getFullYear()}
            month={new Date(startDate).getMonth() + 1}
            members={matrixMembers}
            attendances={matrixAttendances}
            loading={false}
            limitStartDate={activeSemester?.startDate}
            limitEndDate={activeSemester?.endDate}
            semesters={semesters}
          />
        </div>
      </div>
    </div>
  );
};

// ... (메인 페이지 로직은 동일하되 UI만 아래 리턴문으로 교체) ...

const CellDetailPage: React.FC = () => {
  // ... (기존 로직 동일: Hooks, useEffect, handlers ...)
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cell, setCell] = useState<CellDto | null>(null);

  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);

  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [activeSemester, setActiveSemester] = useState<SemesterDto | null>(
    null
  );
  const [unitType, setUnitType] = useState<"semester" | "month" | "year">(
    "semester"
  );
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [matrixAttendances, setMatrixAttendances] = useState<AttendanceDto[]>(
    []
  );
  const [periodSummary, setPeriodSummary] = useState<any>(null);

  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  const cellIdNum = useMemo(() => (id ? Number(id) : null), [id]);

  const isDateInSemesterMonthRange = (date: Date, semester: SemesterDto) => {
    const targetYm = date.getFullYear() * 12 + date.getMonth();
    const s = new Date(semester.startDate);
    const sYm = s.getFullYear() * 12 + s.getMonth();
    const e = new Date(semester.endDate);
    const eYm = e.getFullYear() * 12 + e.getMonth();
    return targetYm >= sYm && targetYm <= eYm;
  };

  // ... (useEffect 및 핸들러 로직들 - 위 코드와 동일하게 유지)
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

  // periodRange 계산 (연간, 학기, 월간)
  const periodRange = useMemo(() => {
    if (unitType === "year") {
      const targetYear = activeSemester
        ? new Date(activeSemester.startDate).getFullYear()
        : new Date().getFullYear();

      return {
        startDate: `${targetYear}-01-01`,
        endDate: `${targetYear}-12-31`,
      };
    }

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

    return { startDate: finalStart, endDate: finalEnd };
  }, [activeSemester, unitType, selectedMonth]);

  const fetchCellDetails = useCallback(async () => {
    try {
      setLoading(true);
      if (!cellIdNum) {
        setError("유효하지 않은 셀 ID입니다.");
        return;
      }
      const fetchedCell = await cellService.getCellById(cellIdNum);

      if (
        user?.role !== "EXECUTIVE" &&
        !(user?.role === "CELL_LEADER" && user.cellId === cellIdNum)
      ) {
        setError("셀 정보를 조회할 권한이 없습니다.");
        setLoading(false);
        return;
      }
      setCell(fetchedCell);
    } catch (err) {
      console.error(err);
      setError("셀 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [cellIdNum, user]);

  const fetchPeriodData = useCallback(async () => {
    if (!cellIdNum || !periodRange.startDate) return;

    try {
      const summary = await cellService.getCellAttendanceSummary(cellIdNum, {
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
      });
      setPeriodSummary(summary.totalSummary);

      const listData = await attendanceService.getAttendances({
        cellId: cellIdNum,
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
        page: 0,
        size: 2000,
        sort: "date,asc",
      });
      setMatrixAttendances(listData.content || []);
    } catch (err) {
      console.error("Failed to fetch period attendance data:", err);
    }
  }, [cellIdNum, periodRange]);

  useEffect(() => {
    if (user) {
      fetchCellDetails();
    }
  }, [user, fetchCellDetails]);

  useEffect(() => {
    if (cell) {
      fetchPeriodData();
    }
  }, [cell, fetchPeriodData]);

  const handleSemesterChange = (semesterId: number) => {
    const target = semesters.find((s) => s.id === semesterId);
    if (target) {
      setActiveSemester(target);
      setSelectedMonth(null);
      setUnitType("semester");
    }
  };

  const handleUnitTypeChange = (type: "semester" | "month" | "year") => {
    setUnitType(type);
    if (type === "semester" || type === "year") {
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

  const handleDelete = async () => {
    if (!cell) return;
    try {
      await cellService.deleteCell(cell.id);
      navigate("/admin/cells");
    } catch (err: any) {
      let errorMessage = "셀 삭제 중 오류가 발생했습니다.";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      setError(errorMessage);
      setDeleteModalOpen(false);
    }
  };

  const handleAddMemberToCell = async (memberIds: number[]) => {
    if (!cellIdNum) return;
    try {
      await Promise.all(
        memberIds.map((memberId) =>
          memberService.updateMember(memberId, { cellId: cellIdNum })
        )
      );
      fetchCellDetails();
    } catch (error) {
      console.error("Failed to add members to cell:", error);
    }
  };

  const handleExportMembers = () =>
    cell && exportService.exportCellMembers(cell.id);

  const handleExportAttendances = () =>
    cell &&
    exportService.exportCellAttendances(
      cell.id,
      exportStartDate,
      exportEndDate
    );

  const sortedMembers = useMemo(() => {
    if (!cell?.members) return [];
    const leaderId = cell.leader?.id;
    const viceLeaderId = cell.viceLeader?.id;

    const leader = cell.members.find((m) => m.id === leaderId);
    const viceLeader = cell.members.find((m) => m.id === viceLeaderId);
    const others = cell.members.filter(
      (m) => m.id !== leaderId && m.id !== viceLeaderId
    );

    others.sort((a, b) => a.name.localeCompare(b.name));

    const list: MemberDto[] = [];
    if (leader) list.push(leader);
    if (viceLeader && viceLeader.id !== leaderId) list.push(viceLeader);
    list.push(...others);

    return list;
  }, [cell]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  if (error)
    return <div className="p-10 text-center text-red-500">{error}</div>;
  if (!cell) return null;

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="셀 삭제"
        message={`'${cell.name}' 셀을 삭제하시겠습니까? 소속된 멤버는 '소속 셀 없음' 상태가 됩니다.`}
      />
      <AddMemberToCellModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        onSave={handleAddMemberToCell}
      />

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              {cell.name}{" "}
              <span className="text-lg font-normal text-gray-400">
                상세 정보
              </span>
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              셀의 정보를 관리하고 출석 및 보고서 데이터를 확인합니다.
            </p>
          </div>
          <div className="flex gap-2">
            {user?.role === "EXECUTIVE" && (
              <>
                <button
                  onClick={() => navigate(`/admin/cells/${id}/edit`)}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors shadow-sm"
                >
                  수정
                </button>
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors shadow-sm"
                >
                  삭제
                </button>
              </>
            )}
            <button
              onClick={() => navigate(-1)}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
            >
              목록으로
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column (Main Info & Charts) */}
          <div className="xl:col-span-2 space-y-6">
            {/* Info Card */}
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5 text-indigo-500" />
                기본 정보
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    셀 설명
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">
                    {cell.description || "설명 없음"}
                  </dd>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase">
                      활동 상태
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-gray-900">
                      {cell.active ? "활동 중" : "비활동"}
                    </dd>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      cell.active ? "bg-green-500" : "bg-gray-400"
                    }`}
                  ></div>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    인원 구성
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900 flex gap-3">
                    <span className="text-blue-600">남 {cell.maleCount}명</span>
                    <span className="text-pink-600">
                      여 {cell.femaleCount}명
                    </span>
                  </dd>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    편성 연도
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">
                    {new Date(cell.createdAt).getFullYear()}년
                  </dd>
                </div>
              </div>
            </div>

            {/* Attendance Matrix */}
            <CellAttendanceMatrixCard
              cellId={cell.id}
              sortedMembers={sortedMembers}
              semesters={semesters}
              activeSemester={activeSemester}
              onSemesterChange={handleSemesterChange}
              unitType={unitType}
              onUnitTypeChange={handleUnitTypeChange}
              selectedMonth={selectedMonth}
              onMonthSelect={setSelectedMonth}
              matrixAttendances={matrixAttendances}
              periodSummary={periodSummary}
              startDate={periodRange.startDate}
              endDate={periodRange.endDate}
            />

            {/* Reports */}
            {cell && periodRange.startDate && (
              <CellReportHistoryContainer
                cellId={cell.id}
                startDate={periodRange.startDate}
                endDate={periodRange.endDate}
                attendances={matrixAttendances}
              />
            )}
          </div>

          {/* Right Column (Members & Exports) */}
          <div className="space-y-6">
            {/* Members Card */}
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-indigo-500" />
                  셀원 목록
                  <span className="bg-indigo-100 text-indigo-700 text-xs py-0.5 px-2 rounded-full">
                    {cell.members.length}
                  </span>
                </h3>
                {user?.role === "EXECUTIVE" && (
                  <button
                    onClick={() => setAddMemberModalOpen(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                  >
                    + 추가
                  </button>
                )}
              </div>
              <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {sortedMembers.map((member) => (
                  <li
                    key={member.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <button
                      onClick={() => navigate(`/admin/users/${member.id}`)}
                      className="w-full flex items-center p-4 text-left"
                    >
                      <UserCircleIcon className="h-10 w-10 text-gray-300 mr-3" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            {formatNameWithBirthdate(member)}
                          </span>
                          {member.id === cell.leader?.id && (
                            <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                              셀장
                            </span>
                          )}
                          {member.id === cell.viceLeader?.id && (
                            <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">
                              예비
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {member.gender === "MALE" ? "남성" : "여성"}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
                {sortedMembers.length === 0 && (
                  <li className="p-8 text-center text-sm text-gray-400">
                    등록된 셀원이 없습니다.
                  </li>
                )}
              </ul>
            </div>

            {/* Export Card */}
            <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DocumentArrowDownIcon className="h-5 w-5 text-green-600" />
                엑셀 다운로드
              </h3>
              <div className="space-y-4">
                <button
                  onClick={handleExportMembers}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
                >
                  명단 다운로드 (.xlsx)
                </button>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">
                    출석부 기간 설정
                  </label>
                  <div className="flex flex-col gap-2">
                    <KoreanCalendarPicker
                      value={exportStartDate}
                      onChange={setExportStartDate}
                    />
                    <div className="flex justify-center -my-2 z-10 relative">
                      <span className="bg-white px-2 text-gray-300 text-xs">
                        ▼
                      </span>
                    </div>
                    <KoreanCalendarPicker
                      value={exportEndDate}
                      onChange={setExportEndDate}
                    />
                  </div>
                  <button
                    onClick={handleExportAttendances}
                    className="w-full mt-3 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm"
                  >
                    출석부 다운로드 (.xlsx)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CellDetailPage;
