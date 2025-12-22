// src/pages/CellDetailPage.tsx
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
        setCandidateMembers(page.content);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <h2 className="text-xl font-bold mb-2 break-keep">셀에 멤버 추가</h2>
        <p className="text-xs sm:text-sm text-gray-600 mb-4 break-keep">
          현재 어떤 셀에도 속하지 않은 멤버만 목록에 표시됩니다.
        </p>

        <div className="flex-1 overflow-y-auto mb-4 px-1">
          <input
            type="text"
            placeholder="이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
          />
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
            {isLoadingMembers ? (
              <p className="p-3 text-xs sm:text-sm text-gray-500">
                미소속 멤버를 불러오는 중입니다...
              </p>
            ) : filteredMembers.length === 0 ? (
              <p className="p-3 text-xs sm:text-sm text-gray-500">
                {candidateMembers.length === 0
                  ? "현재 셀에 소속되지 않은 멤버가 없습니다."
                  : "검색 결과가 없습니다."}
              </p>
            ) : (
              <ul>
                {filteredMembers.map((member) => (
                  <li
                    key={member.id}
                    className={`flex items-center text-xs sm:text-sm hover:bg-indigo-50 ${
                      selectedMemberIds.includes(member.id)
                        ? "bg-indigo-100"
                        : ""
                    }`}
                  >
                    <label
                      htmlFor={`add-member-checkbox-${member.id}`}
                      className="flex items-center w-full px-3 py-2 cursor-pointer"
                    >
                      <input
                        id={`add-member-checkbox-${member.id}`}
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={() => handleToggleMember(member.id)}
                        className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      {formatNameWithBirthdate(member)}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-600">
            선택된 멤버:{" "}
            <span className="font-semibold">{selectedMemberIds.length}명</span>
          </p>
          {selectedMembers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedMembers.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100"
                >
                  {formatNameWithBirthdate(m)}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    className="ml-1 text-indigo-400 hover:text-indigo-700"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-auto pt-2 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-gray-700 bg-gray-200 hover:bg-gray-300"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
            disabled={selectedMemberIds.length === 0 || isSaving}
          >
            {isSaving ? "추가 중..." : `${selectedMemberIds.length}명 추가`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ───────────────── [컴포넌트] CellReportHistory (신규 추가) ─────────────────
// 날짜 하나에 대한 아코디언 아이템 (클릭 시 데이터 로딩)
const CellReportHistoryItem: React.FC<{
  cellId: number;
  date: string; // YYYY-MM-DD (일요일)
}> = ({ cellId, date }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<{
    cellShare: string;
    specialNotes: string;
    attendances: AttendanceDto[];
  } | null>(null);

  const fetchReport = async () => {
    if (reportData) return; // 이미 데이터가 있으면 다시 부르지 않음
    setLoading(true);
    try {
      // 1. 셀 보고서(나눔, 특이사항) 조회
      const report = await attendanceService
        .getCellReport(cellId, date)
        .catch(() => null);

      // 2. 멤버별 출석/기도제목 조회
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

  // 데이터가 아예 없는 경우(미입력) 체크
  const isEmpty =
    reportData &&
    !reportData.cellShare &&
    !reportData.specialNotes &&
    reportData.attendances.length === 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden mb-3 shadow-sm">
      {/* 헤더 (날짜 클릭 영역) */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-700">{date} (일)</span>
          {!loading && reportData && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                isEmpty
                  ? "bg-gray-100 text-gray-400 border-gray-200"
                  : "bg-green-50 text-green-600 border-green-200"
              }`}
            >
              {isEmpty ? "미작성" : "작성됨"}
            </span>
          )}
        </div>
        <div className="text-gray-400">
          {isOpen ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
        </div>
      </button>

      {/* 본문 (아코디언 내용) */}
      {isOpen && (
        <div className="p-4 border-t border-gray-200 bg-white animate-fadeIn">
          {loading ? (
            <div className="text-center py-4 text-sm text-gray-500">
              보고서 정보를 불러오는 중...
            </div>
          ) : isEmpty ? (
            <div className="text-center py-4 text-sm text-gray-400">
              등록된 보고서 및 출석 데이터가 없습니다.
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. 셀 보고서 섹션 */}
              {(reportData!.cellShare || reportData!.specialNotes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 은혜 나눔 */}
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
                      <FaQuoteLeft className="opacity-50" /> 셀 은혜 나눔
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {reportData!.cellShare || "내용 없음"}
                    </p>
                  </div>
                  {/* 특이사항 */}
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <h4 className="text-xs font-bold text-red-800 mb-2">
                      ⚠ 셀 특이사항
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {reportData!.specialNotes || "내용 없음"}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. 멤버별 기도제목/특이사항 */}
              {reportData!.attendances.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-3 pl-1 border-l-4 border-indigo-500">
                    &nbsp;멤버별 기도제목 및 특이사항
                  </h4>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24 whitespace-nowrap">
                            이름
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20 whitespace-nowrap">
                            출석
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            기도제목 / 메모
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {reportData!.attendances.map((att) => (
                          <tr key={att.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900 align-top whitespace-nowrap">
                              {formatNameWithBirthdate(att.member)}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span
                                className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                                  att.status === "PRESENT"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {att.status === "PRESENT" ? "출석" : "결석"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 align-top whitespace-pre-wrap">
                              {att.prayerContent || att.memo ? (
                                <>
                                  {att.prayerContent && (
                                    <div className="mb-1 text-gray-800">
                                      {att.prayerContent}
                                    </div>
                                  )}
                                  {att.memo &&
                                    att.memo !== att.prayerContent && (
                                      <div className="text-xs text-gray-400 mt-1">
                                        (메모: {att.memo})
                                      </div>
                                    )}
                                </>
                              ) : (
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

// 주차별 컨테이너
const CellReportHistoryContainer: React.FC<{
  cellId: number;
  startDate: string;
  endDate: string;
}> = ({ cellId, startDate, endDate }) => {
  const sundayDates = useMemo(() => {
    if (!startDate || !endDate) return [];
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    const current = new Date(start);
    const day = current.getDay();
    // 시작일이 일요일이 아니면 다음 일요일로 이동
    if (day !== 0) {
      current.setDate(current.getDate() + (7 - day));
    }

    // 종료일까지 루프
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 7);
    }
    // 최신 날짜가 위로 오도록 역순 정렬
    return dates.reverse();
  }, [startDate, endDate]);

  if (sundayDates.length === 0) return null;

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-4 py-4 sm:px-6 border-b border-gray-100">
        <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">
          🗓️ 주간 보고서 기록
        </h3>
        <p className="mt-1 text-sm text-gray-500 break-keep">
          선택된 조회 기간 내의 셀 보고서와 기도제목을 확인합니다.
        </p>
      </div>
      <div className="p-4 bg-gray-50 min-h-[200px]">
        {sundayDates.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            조회할 수 있는 주일(일요일) 날짜가 없습니다.
          </p>
        ) : (
          sundayDates.map((date) => (
            <CellReportHistoryItem key={date} cellId={cellId} date={date} />
          ))
        )}
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
  unitType: "semester" | "month";
  onUnitTypeChange: (type: "semester" | "month") => void;
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

  const uncheckedCount = useMemo(() => {
    if (!startDate || !endDate || sortedMembers.length === 0) return 0;
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    let totalPossibleChecks = 0;

    sortedMembers.forEach((member) => {
      let joinDate: Date;
      if (member.createdAt) {
        joinDate = new Date(member.createdAt);
      } else if (member.joinYear) {
        joinDate = new Date(member.joinYear, 0, 1);
      } else {
        joinDate = new Date("2000-01-01");
      }
      joinDate.setHours(0, 0, 0, 0);
      const effectiveStart = filterStart < joinDate ? joinDate : filterStart;
      if (effectiveStart > filterEnd) return;

      const current = new Date(effectiveStart);
      current.setHours(0, 0, 0, 0);

      while (current <= filterEnd) {
        if (current.getDay() === 0) {
          totalPossibleChecks++;
        }
        current.setDate(current.getDate() + 1);
      }
    });

    const recordedChecks =
      (periodSummary?.totalPresent || 0) + (periodSummary?.totalAbsent || 0);

    return Math.max(0, totalPossibleChecks - recordedChecks);
  }, [startDate, endDate, sortedMembers, periodSummary]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, ".");

  const matrixMembers = useMemo(
    () => sortedMembers.map((m) => ({ memberId: m.id, memberName: m.name })),
    [sortedMembers]
  );

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-4 py-4 sm:px-6 border-b border-gray-100">
        <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900 break-keep">
          출석 요약 & 현황
        </h3>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* 컨트롤 패널 */}
        <div className="bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* 학기 선택 Dropdown */}
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

              {/* 보기 모드 Toggle */}
              <div className="flex bg-gray-200 p-1 rounded-lg w-full sm:w-auto">
                <button
                  onClick={() => onUnitTypeChange("month")}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    unitType === "month"
                      ? "bg-white text-indigo-700 shadow ring-1 ring-black/5"
                      : "text-gray-500 hover:bg-gray-300"
                  }`}
                >
                  월별
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

            {/* 월 선택 (월별 보기일 때만) */}
            {unitType === "month" && activeSemester && (
              <div className="animate-fadeIn mt-1">
                <span className="text-xs font-bold text-gray-500 block mb-2 px-1">
                  상세 월 선택
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

          {/* 실제 기간 표시 */}
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-gray-500 border-t border-gray-200 pt-3 mt-1">
            {/* 라벨과 아이콘을 하나의 그룹으로 묶어 줄바꿈 시 같이 다니도록 함 */}
            <div className="flex items-center flex-shrink-0">
              <FaClock className="mr-1.5 text-gray-400" />
              <span className="font-medium whitespace-nowrap">조회 기간:</span>
            </div>

            {/* 날짜 표시 영역: truncate 제거, 모바일 대응 */}
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
              {formatDate(startDate)} ~ {formatDate(endDate)}
            </span>
          </div>
        </div>

        {/* 4칸 통계 카드 */}
        {periodSummary ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-center border-t border-b py-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <p className="text-xs sm:text-sm font-medium text-indigo-500 break-keep">
                출석률
              </p>
              <p className="mt-1 text-xl sm:text-3xl font-semibold text-indigo-600">
                {periodSummary.attendanceRate.toFixed(0)}
                <span className="text-sm sm:text-lg">%</span>
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs sm:text-sm font-medium text-green-600 break-keep">
                출석
              </p>
              <p className="mt-1 text-xl sm:text-3xl font-semibold text-green-700">
                {periodSummary.totalPresent}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs sm:text-sm font-medium text-red-600 break-keep">
                결석
              </p>
              <p className="mt-1 text-xl sm:text-3xl font-semibold text-red-700">
                {periodSummary.totalAbsent}
              </p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <p className="text-xs sm:text-sm font-medium text-gray-500 break-keep">
                미체크
              </p>
              <p className="mt-1 text-xl sm:text-3xl font-semibold text-gray-600">
                {uncheckedCount}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4 text-center">
            선택된 기간에 대한 데이터가 없습니다.
          </p>
        )}

        {/* 매트릭스 */}
        <div className="pt-2">
          <h4 className="text-sm font-medium text-gray-700 mb-3 ml-1 break-keep">
            {unitType === "semester"
              ? `[${activeSemester?.name}] 전체 현황`
              : `${selectedMonth}월 상세 현황`}
          </h4>
          <AttendanceMatrix
            mode={unitType === "month" ? "month" : "semester"}
            startDate={startDate}
            endDate={endDate}
            year={new Date(startDate).getFullYear()}
            month={new Date(startDate).getMonth() + 1}
            onMonthChange={() => {}}
            members={matrixMembers}
            attendances={matrixAttendances}
            loading={false}
            limitStartDate={activeSemester?.startDate}
            limitEndDate={activeSemester?.endDate}
          />
        </div>
      </div>
    </div>
  );
};

// ───────────────── 메인 페이지 ─────────────────
const CellDetailPage: React.FC = () => {
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
  const [unitType, setUnitType] = useState<"semester" | "month">("semester");
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

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  if (!cell) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 mb-4">셀 정보를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="셀 삭제"
        message={`'${cell.name}' 셀을 정말 삭제하시겠습니까? 셀에 속한 모든 셀원은 '*소속 셀 없음' 상태가 됩니다.`}
      />
      <AddMemberToCellModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        onSave={handleAddMemberToCell}
      />

      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* 상단 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-keep">
              {cell.name} 상세 정보
            </h1>
            <p className="text-sm text-gray-600 break-keep">
              셀 기본 정보, 출석 요약, 셀원 목록, 셀 보고서를 확인할 수
              있습니다.
            </p>
          </div>
          {user?.role === "EXECUTIVE" && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => navigate(`/admin/cells/${id}/edit`)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 text-center"
              >
                수정
              </button>
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 text-center"
              >
                삭제
              </button>
            </div>
          )}
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 왼쪽 영역 */}
          <div className="xl:col-span-2 space-y-6">
            {/* 기본 정보 카드 */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-4 sm:px-6 border-b border-gray-100">
                <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">
                  기본 정보
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="px-4 py-3 sm:px-6 flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-4 bg-gray-50">
                  <dt className="text-xs sm:text-sm font-medium text-gray-500">
                    셀 이름
                  </dt>
                  <dd className="text-sm text-gray-900 sm:col-span-2">
                    {cell.name}
                  </dd>
                </div>
                <div className="px-4 py-3 sm:px-6 flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-4 bg-white">
                  <dt className="text-xs sm:text-sm font-medium text-gray-500">
                    설명
                  </dt>
                  <dd className="text-sm text-gray-900 sm:col-span-2 break-keep">
                    {cell.description || "없음"}
                  </dd>
                </div>
                <div className="px-4 py-3 sm:px-6 flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-4 bg-gray-50">
                  <dt className="text-xs sm:text-sm font-medium text-gray-500">
                    활동 여부
                  </dt>
                  <dd className="text-sm text-gray-900 sm:col-span-2">
                    {cell.active ? "활동 중" : "비활동"}
                  </dd>
                </div>
                <div className="px-4 py-3 sm:px-6 flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-4 bg-white">
                  <dt className="text-xs sm:text-sm font-medium text-gray-500">
                    편성 연도
                  </dt>
                  <dd className="text-sm text-gray-900 sm:col-span-2">
                    {new Date(cell.createdAt).getFullYear()}년
                  </dd>
                </div>
                <div className="px-4 py-3 sm:px-6 flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-4 bg-gray-50">
                  <dt className="text-xs sm:text-sm font-medium text-gray-500">
                    인원 구성
                  </dt>
                  <dd className="text-sm text-gray-900 sm:col-span-2">
                    남 {cell.maleCount}명, 여 {cell.femaleCount}명
                  </dd>
                </div>
              </div>
            </div>

            {/* 출석 매트릭스 카드 */}
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

            {/* [신규] 셀 보고서 기록 */}
            {cell && periodRange.startDate && (
              <CellReportHistoryContainer
                cellId={cell.id}
                startDate={periodRange.startDate}
                endDate={periodRange.endDate}
              />
            )}
          </div>

          {/* 오른쪽 영역 */}
          <div className="space-y-6">
            {/* 셀원 목록 카드 */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-4 sm:px-6 flex items-center justify-between border-b border-gray-100">
                <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">
                  셀원 목록 ({cell.members.length}명)
                </h3>
                {user?.role === "EXECUTIVE" && (
                  <button
                    onClick={() => setAddMemberModalOpen(true)}
                    className="px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  >
                    + 셀원 추가
                  </button>
                )}
              </div>
              <div className="border-t border-gray-100 max-h-[500px] overflow-y-auto">
                {sortedMembers.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {sortedMembers.map((member) => (
                      <li
                        key={member.id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}`)
                            }
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-900 truncate text-left"
                          >
                            {formatNameWithBirthdate(member)}
                          </button>
                          <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                            (
                            {member.gender
                              ? member.gender.toUpperCase() === "MALE"
                                ? "남"
                                : "여"
                              : ""}
                            )
                          </span>
                        </div>
                        <div className="ml-3 flex-shrink-0 flex gap-1">
                          {member.id === cell.leader?.id && (
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                              셀장
                            </span>
                          )}
                          {member.id === cell.viceLeader?.id && (
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                              예비
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-4 text-sm text-gray-500">
                    이 셀에 등록된 셀원이 없습니다.
                  </p>
                )}
              </div>
            </div>

            {/* 데이터 추출 카드 */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-4 sm:px-6 border-b border-gray-100">
                <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900 break-keep">
                  데이터 추출 (xlsx)
                </h3>
              </div>
              <div className="p-4 sm:p-6 space-y-5">
                <div>
                  <button
                    onClick={handleExportMembers}
                    className="w-full px-4 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    셀 멤버 명단 다운로드
                  </button>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-2 break-keep">
                    출석 현황 다운로드 기간 설정
                  </p>
                  <div className="flex flex-col gap-2">
                    <KoreanCalendarPicker
                      value={exportStartDate}
                      onChange={setExportStartDate}
                    />
                    <div className="text-center text-gray-400 text-xs">▼</div>
                    <KoreanCalendarPicker
                      value={exportEndDate}
                      onChange={setExportEndDate}
                    />
                  </div>
                  <button
                    onClick={handleExportAttendances}
                    className="w-full mt-4 px-4 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    출석 현황 다운로드
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 뒤로가기 버튼 */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default CellDetailPage;
