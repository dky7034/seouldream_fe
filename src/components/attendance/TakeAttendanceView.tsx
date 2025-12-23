// src/components/attendance/TakeAttendanceView.tsx
import React, { useEffect, useState, useMemo } from "react";
import { attendanceService } from "../../services/attendanceService";
import { memberService } from "../../services/memberService";
import { semesterService } from "../../services/semesterService";
import { formatDisplayName } from "../../utils/memberUtils";
import type {
  MemberDto,
  AttendanceStatus,
  User,
  ProcessAttendanceRequest,
  SemesterDto,
  ProcessAttendanceWithPrayersRequest,
} from "../../types";
import StatusButton from "./StatusButton";
import ConfirmationModal from "./ConfirmationModal";
import KoreanCalendarPicker from "../KoreanCalendarPicker";
import { FaCalendarAlt } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────
// [Internal Component] 단순 알림 모달
// ─────────────────────────────────────────────────────────────
const AlertModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}> = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-2 break-keep">
            {title}
          </h3>
          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed break-keep">
            {message}
          </p>
        </div>
        <div className="bg-gray-50 px-4 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// [Types & Helpers]
// ─────────────────────────────────────────────────────────────

interface MemberAttendanceForm extends ProcessAttendanceRequest {
  id?: number;
  prayerContent?: string;
  isExistingData?: boolean;
}

interface TakeAttendanceViewProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMostRecentSunday = (): Date => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dayOfWeek);
  return sunday;
};

// 🗑️ getRecentSundays 함수 삭제됨 (더 이상 사용 안 함)

// ─────────────────────────────────────────────────────────────
// [Component] Main
// ─────────────────────────────────────────────────────────────

const TakeAttendanceView: React.FC<TakeAttendanceViewProps> = ({
  user,
  allMembers,
}) => {
  // ── Data State ──
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [memberAttendances, setMemberAttendances] = useState<
    MemberAttendanceForm[]
  >([]);
  const [allSemesters, setAllSemesters] = useState<SemesterDto[]>([]);

  // ── UI State ──
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [cellShare, setCellShare] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  // ── Status & Modal State ──
  const [loading, setLoading] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Helpers ──
  const showAlert = (
    title: string,
    message: string,
    onConfirm?: () => void
  ) => {
    setAlertState({ isOpen: true, title, message, onConfirm });
  };

  const closeAlert = () => {
    if (alertState.onConfirm) {
      alertState.onConfirm();
    }
    setAlertState((prev) => ({ ...prev, isOpen: false, onConfirm: undefined }));
  };

  // ── 1. 학기 목록 로드 ──
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semesters = await semesterService.getAllSemesters(true);
        setAllSemesters(semesters);
      } catch (e) {
        console.error("학기 정보 로드 실패", e);
      }
    };
    fetchSemesters();
  }, []);

  // ── 스마트 초기 날짜 설정 ──
  useEffect(() => {
    if (selectedDate || allSemesters.length === 0) return;

    const defaultSunday = toISODate(getMostRecentSunday());
    const isValidDate = allSemesters.some(
      (s) => defaultSunday >= s.startDate && defaultSunday <= s.endDate
    );

    if (isValidDate) {
      setSelectedDate(defaultSunday);
    } else {
      const sortedSemesters = [...allSemesters].sort((a, b) =>
        b.endDate.localeCompare(a.endDate)
      );
      const latestSemester = sortedSemesters[0];
      if (latestSemester) {
        setSelectedDate(latestSemester.endDate);
      } else {
        setSelectedDate(defaultSunday);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSemesters]);

  const semesterForSelectedDate = useMemo(() => {
    if (!selectedDate || allSemesters.length === 0) return null;
    return allSemesters.find(
      (s) => selectedDate >= s.startDate && selectedDate <= s.endDate
    );
  }, [selectedDate, allSemesters]);

  // ── 2. 데이터 불러오기 ──
  useEffect(() => {
    const cellId = user.cellId;
    if (!selectedDate) return;

    if (!cellId) {
      setMembers([]);
      setMemberAttendances([]);
      if (!cellId) setSubmitError("셀장 정보에 셀 ID가 없습니다.");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setSubmitError(null);
      setIsEditMode(false);

      try {
        const [membersPage, existingAttendancesPage, cellReportData] =
          await Promise.all([
            memberService.getAllMembers({ cellId, size: 200, active: true }),
            attendanceService.getAttendances({
              startDate: selectedDate,
              endDate: selectedDate,
              cellId,
              size: 200,
            }),
            attendanceService
              .getCellReport(cellId, selectedDate)
              .catch(() => null),
          ]);

        const relevantMembers = membersPage.content.sort((a, b) => {
          const isALeader = a.role === "CELL_LEADER";
          const isBLeader = b.role === "CELL_LEADER";
          if (isALeader && !isBLeader) return -1;
          if (!isALeader && isBLeader) return 1;
          return a.name.localeCompare(b.name);
        });
        setMembers(relevantMembers);

        const existingAttendances = existingAttendancesPage.content;
        const hasExistingData =
          existingAttendances.length > 0 || !!cellReportData;

        setIsEditMode(hasExistingData);

        const initialAttendances = relevantMembers.map((member) => {
          const existing = existingAttendances.find(
            (att) => att.member.id === member.id
          );
          return {
            id: existing?.id,
            memberId: member.id,
            date: selectedDate,
            status: existing?.status || "PRESENT",
            memo: existing?.memo || "",
            createdById: user.id,
            prayerContent: existing?.prayerContent || "",
            isExistingData: !!existing,
          };
        });
        setMemberAttendances(initialAttendances);

        if (cellReportData) {
          setCellShare(cellReportData.cellShare);
          setSpecialNotes(cellReportData.specialNotes);
        } else {
          setCellShare("");
          setSpecialNotes("");
        }
      } catch (error) {
        console.error("데이터 로드 실패:", error);
        setSubmitError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate, user]);

  // 🗑️ useMemo(recentSundays) 삭제됨

  // ── Handlers ──
  const onDateSelect = (newDateStr: string) => {
    if (!newDateStr) return;
    const selected = new Date(newDateStr + "T00:00:00");
    if (selected.getDay() !== 0) {
      showAlert("날짜 선택 불가", "출석 체크는 일요일만 선택 가능합니다.");
      return;
    }

    if (allSemesters.length > 0) {
      const belongsToAnySemester = allSemesters.some(
        (s) => newDateStr >= s.startDate && newDateStr <= s.endDate
      );

      if (!belongsToAnySemester) {
        showAlert(
          "날짜 선택 불가",
          "선택하신 날짜는 등록된 학기 기간에 포함되지 않습니다.\n(방학 기간이거나 등록되지 않은 날짜입니다.)"
        );
        return;
      }
    }
    setSubmitError(null);
    setSelectedDate(newDateStr);
  };

  const handleBulkChange = (status: AttendanceStatus) => {
    setMemberAttendances((prev) => prev.map((att) => ({ ...att, status })));
  };

  const handleAttendanceChange = (
    memberId: number,
    field: keyof MemberAttendanceForm,
    value: any
  ) => {
    setMemberAttendances((prev) =>
      prev.map((att) =>
        att.memberId === memberId ? { ...att, [field]: value } : att
      )
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode) return;

    if (!selectedDate) return setSubmitError("출석 날짜를 선택해 주세요.");

    if (allSemesters.length > 0) {
      const belongsToAnySemester = allSemesters.some(
        (s) => selectedDate >= s.startDate && selectedDate <= s.endDate
      );
      if (!belongsToAnySemester) {
        showAlert(
          "저장 불가",
          "선택하신 날짜는 학기 기간에 포함되지 않아 저장할 수 없습니다."
        );
        return;
      }
    }

    if (memberAttendances.length === 0)
      return setSubmitError("출석을 처리할 멤버가 없습니다.");

    for (const member of members) {
      const attendance = memberAttendances.find(
        (a) => a.memberId === member.id
      );
      if (!attendance || !attendance.prayerContent?.trim()) {
        setSubmitError(`${member.name}님의 기도제목/특이사항을 입력해 주세요.`);
        return;
      }
    }
    if (!cellShare.trim())
      return setSubmitError("셀 나눔 내용을 입력해 주세요.");
    if (!specialNotes.trim())
      return setSubmitError("셀 특이사항을 입력해 주세요.");

    setIsConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsConfirmModalOpen(false);
    setLoading(true);
    try {
      const cellId = user.cellId;
      if (!cellId) throw new Error("셀 정보가 없습니다.");

      const items = memberAttendances.map((att) => ({
        id: att.id,
        memberId: att.memberId,
        status: att.status,
        memo: undefined,
        prayerContent: att.prayerContent?.trim() || undefined,
      }));

      const payload: ProcessAttendanceWithPrayersRequest = {
        meetingDate: selectedDate,
        cellShare: cellShare.trim(),
        specialNotes: specialNotes.trim(),
        items: items,
      };

      await attendanceService.processAttendanceWithPrayers(cellId, payload);

      setSubmitError(null);
      setSuccessMessage(null);

      // 모드 변경 (읽기 전용)
      setIsEditMode(true);

      showAlert(
        "저장 완료",
        "출석 및 보고서가 성공적으로 저장되었습니다.",
        () => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      );
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "오류가 발생했습니다.";
      setSubmitError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceForMember = (memberId: number) =>
    memberAttendances.find((att) => att.memberId === memberId);

  // ── Render ──
  return (
    <>
      <form onSubmit={handleFormSubmit} className="space-y-6 pb-20 sm:pb-0">
        {successMessage && (
          <div className="p-3 text-sm font-medium text-green-700 bg-green-100 border border-green-400 rounded-md break-keep">
            {successMessage}
          </div>
        )}
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md break-keep">
            {submitError}
          </div>
        )}

        {/* 날짜 선택 영역 */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-bold text-gray-800">날짜 선택</label>
            {!loading && selectedDate && (
              <>
                {isEditMode ? (
                  // 수정 모드: 단순 텍스트 경고
                  <span className="text-xs font-bold text-red-600">
                    ⚠ 기존 내용 수정이 불가합니다
                  </span>
                ) : (
                  // 신규 모드: 기존 배지 유지
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                    ✨ 신규 작성
                  </span>
                )}
              </>
            )}
          </div>

          {!selectedDate ? (
            <div className="flex justify-center items-center py-10 text-gray-500 text-sm">
              <div className="flex flex-col items-center">
                <span className="block mb-2">📅</span>
                <span>학기 정보를 불러와 날짜를 설정 중입니다...</span>
              </div>
            </div>
          ) : (
            <>
              {/* 🗑️ 퀵 선택 버튼 및 '또는' 구분선 삭제됨 */}

              {/* 달력 선택만 남김 */}
              <div className="relative">
                <label className="mb-2 text-xs font-bold text-gray-600 flex items-center gap-1.5">
                  <FaCalendarAlt className="text-indigo-500 text-sm" />
                  <span>달력에서 날짜 선택</span>
                </label>

                <KoreanCalendarPicker
                  value={selectedDate}
                  onChange={onDateSelect}
                />

                {semesterForSelectedDate ? (
                  <p className="mt-2 text-xs text-gray-500 text-right break-keep flex justify-end items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span>
                      <span className="font-bold text-gray-700">
                        {semesterForSelectedDate.name}
                      </span>{" "}
                      기간 ({semesterForSelectedDate.startDate} ~{" "}
                      {semesterForSelectedDate.endDate})
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-red-500 text-right font-medium break-keep flex justify-end items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    ⚠ 선택한 날짜는 등록된 학기 기간에 포함되지 않습니다.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {loading && (
          <div className="text-center p-8 text-gray-500">
            데이터를 불러오는 중...
          </div>
        )}

        {!loading && members.length > 0 && selectedDate && (
          <>
            {/* 일괄 변경 버튼 */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">
                일괄 상태 변경:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkChange("PRESENT")}
                  className="px-3 py-1.5 text-xs border border-green-500 text-green-600 rounded-md hover:bg-green-50 font-medium active:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || isEditMode}
                >
                  모두 출석
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkChange("ABSENT")}
                  className="px-3 py-1.5 text-xs border border-red-500 text-red-600 rounded-md hover:bg-red-50 font-medium active:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || isEditMode}
                >
                  모두 결석
                </button>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="space-y-4 md:hidden">
              {members.map((member) => {
                const attendance = getAttendanceForMember(member.id);
                if (!attendance) return null;

                return (
                  <div
                    key={member.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3"
                  >
                    {/* 🔹 수정됨: flex justify-between 및 파란 점 로직 삭제 */}
                    <div className="border-b border-gray-100 pb-2 mb-2">
                      <span className="text-base font-bold text-gray-800 break-keep">
                        {formatDisplayName(member, allMembers)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center justify-start">
                      {(["PRESENT", "ABSENT"] as AttendanceStatus[]).map(
                        (status) => (
                          <StatusButton
                            key={status}
                            status={status}
                            currentStatus={attendance.status}
                            onClick={(s) =>
                              handleAttendanceChange(member.id, "status", s)
                            }
                            disabled={loading || isEditMode}
                            small
                          />
                        )
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center">
                        기도제목 및 특이사항
                      </label>
                      <textarea
                        placeholder="상세 내용을 기록해 주세요."
                        required
                        value={attendance.prayerContent || ""}
                        onChange={(e) =>
                          handleAttendanceChange(
                            member.id,
                            "prayerContent",
                            e.target.value
                          )
                        }
                        readOnly={isEditMode}
                        disabled={loading}
                        className={`block w-full text-sm p-3 rounded-md shadow-sm resize-y min-h-[100px] 
                        ${
                          isEditMode
                            ? "bg-gray-100 text-gray-800 border-transparent focus:ring-0"
                            : "border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        }`}
                        rows={3}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[15%] px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      이름
                    </th>
                    <th className="w-[20%] px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      출석<span className="text-red-500 ml-0.5">*</span>
                    </th>
                    <th className="w-[65%] px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      기도제목 및 특이사항
                      <span className="text-red-500 ml-0.5">*</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => {
                    const attendance = getAttendanceForMember(member.id);
                    if (!attendance) return null;
                    return (
                      <tr
                        key={member.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="w-[15%] px-6 py-4 font-medium text-gray-900 align-top pt-5">
                          {/* 🔹 수정됨: flex, gap, 파란 점 로직 삭제하고 이름만 출력 */}
                          <div className="break-keep">
                            {formatDisplayName(member, allMembers)}
                          </div>
                        </td>
                        <td className="w-[20%] px-6 py-4 align-top pt-5">
                          <div className="flex gap-2">
                            {(["PRESENT", "ABSENT"] as AttendanceStatus[]).map(
                              (status) => (
                                <StatusButton
                                  key={status}
                                  status={status}
                                  currentStatus={attendance.status}
                                  onClick={(s) =>
                                    handleAttendanceChange(
                                      member.id,
                                      "status",
                                      s
                                    )
                                  }
                                  disabled={loading || isEditMode}
                                  small
                                />
                              )
                            )}
                          </div>
                        </td>
                        <td className="w-[65%] px-6 py-4 align-top">
                          <textarea
                            placeholder="상세 내용을 기록해 주세요. (필수)"
                            required
                            value={attendance.prayerContent || ""}
                            onChange={(e) =>
                              handleAttendanceChange(
                                member.id,
                                "prayerContent",
                                e.target.value
                              )
                            }
                            readOnly={isEditMode}
                            disabled={loading}
                            className={`mt-1 block w-full text-sm p-3 rounded-md shadow-sm resize-y min-h-[80px]
                            ${
                              isEditMode
                                ? "bg-gray-100 text-gray-800 border-transparent focus:ring-0"
                                : "border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            }`}
                            rows={2}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 my-8"></div>

            {/* 셀 보고서 입력 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <span className="text-lg">📝</span>
                <h3 className="text-sm font-bold text-gray-800">
                  셀 모임 보고서
                </h3>
              </div>
              <div className="p-4 sm:p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    셀 은혜나눔
                  </label>
                  <textarea
                    required
                    value={cellShare}
                    onChange={(e) => setCellShare(e.target.value)}
                    readOnly={isEditMode}
                    placeholder="셀 나눔 내용과 은혜를 나눠주세요. (필수)"
                    rows={4}
                    className={`w-full text-sm p-3 rounded-md shadow-sm min-h-[100px]
                    ${
                      isEditMode
                        ? "bg-gray-100 text-gray-800 border-transparent focus:ring-0"
                        : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    셀 특이사항
                  </label>
                  <textarea
                    required
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    readOnly={isEditMode}
                    placeholder="공유할 내용을 적어주세요. (필수)"
                    rows={3}
                    className={`w-full text-sm p-3 rounded-md shadow-sm min-h-[80px]
                    ${
                      isEditMode
                        ? "bg-gray-100 text-gray-800 border-transparent focus:ring-0"
                        : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* 저장 버튼 영역 */}
            {!isEditMode ? (
              <div className="flex justify-center md:justify-end pt-6 pb-8 sticky bottom-0 bg-gray-50 p-4 -mx-4 sm:static sm:bg-transparent sm:p-0 sm:mx-0 border-t sm:border-t-0 border-gray-200 z-10">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 text-base font-bold shadow-md transition-all active:scale-95"
                  disabled={loading || memberAttendances.length === 0}
                >
                  {loading ? "저장 중..." : "보고서 및 출석 저장"}
                </button>
              </div>
            ) : (
              <div className="flex justify-center md:justify-end pt-6 pb-8 sticky bottom-0 bg-gray-50 p-4 -mx-4 sm:static sm:bg-transparent sm:p-0 sm:mx-0 border-t sm:border-t-0 border-gray-200 z-10">
                <div className="w-full sm:w-auto px-8 py-3 rounded-md bg-gray-200 text-gray-500 font-bold border border-gray-300 text-center cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
                  <span>✅ 이미 제출 완료된 보고서입니다</span>
                </div>
              </div>
            )}
          </>
        )}
      </form>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setIsConfirmModalOpen(false)}
        title="보고서 저장 확인"
      >
        <div className="text-sm space-y-3 break-keep">
          <p>
            <span className="font-bold text-indigo-600">{selectedDate}</span>{" "}
            날짜의
          </p>
          <p>멤버들의 출석 및 셀 모임 보고서 내용을 저장하시겠습니까?</p>
          {isEditMode && (
            <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 font-medium">
              ⚠ 이미 저장된 보고서가 있습니다. 저장 시 덮어씌워집니다.
            </p>
          )}
        </div>
      </ConfirmationModal>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onClose={closeAlert}
      />
    </>
  );
};

export default TakeAttendanceView;
