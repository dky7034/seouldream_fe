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
import ConfirmationModal from "./ConfirmationModal";
import KoreanCalendarPicker from "../KoreanCalendarPicker";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/solid";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2 break-keep">
            {title}
          </h3>
          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed break-keep">
            {message}
          </p>
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-3 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:text-sm"
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
  const [isEditMode, setIsEditMode] = useState(false); // true면 수정 불가

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

  // ── 1. 학기 목록 로드 (활성 학기만) ──
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
  }, [allSemesters, selectedDate]);

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
      setSubmitError("셀장 정보에 셀 ID가 없습니다.");
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
        const hasExistingData = !!cellReportData;
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

  // ── Handlers ──
  const onDateSelect = (newDateStr: string) => {
    if (!newDateStr) return;
    const selected = new Date(newDateStr + "T00:00:00");
    if (selected.getDay() !== 0) {
      showAlert("날짜 선택 불가", "출석 체크는 주일(일요일)만 가능합니다.");
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

    // 학기 기간 체크
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

    // 유효성 검사 (기도제목 필수)
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
      <form onSubmit={handleFormSubmit} className="space-y-8 pb-24 sm:pb-12">
        {successMessage && (
          <div className="p-4 text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5" /> {successMessage}
          </div>
        )}
        {submitError && (
          <div className="p-4 text-sm font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" /> {submitError}
          </div>
        )}

        {/* 1. 날짜 선택 섹션 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
              <CalendarDaysIcon className="h-5 w-5 text-indigo-500" />
              날짜 선택
            </h3>
            {!loading && selectedDate && (
              <>
                {isEditMode ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                    🔒 제출 완료
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 whitespace-nowrap">
                    ✨ 작성 중
                  </span>
                )}
              </>
            )}
          </div>

          <div className="p-5">
            <KoreanCalendarPicker
              value={selectedDate}
              onChange={onDateSelect}
            />

            {semesterForSelectedDate ? (
              <div className="mt-3 flex justify-end">
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                  {semesterForSelectedDate.name} 기간입니다
                </span>
              </div>
            ) : selectedDate ? (
              <div className="mt-3 flex justify-end">
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100 whitespace-nowrap">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5 mr-1" />
                  학기 기간이 아닙니다
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {!loading && members.length > 0 && selectedDate && (
          <>
            {/* 2. 멤버별 출석 체크 섹션 */}
            <div className="space-y-4">
              {/* ✅ [개선] 헤더 영역 레이아웃 재구성: 제목과 버튼 분리 및 반응형 처리 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 mb-2">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-indigo-500" />
                  멤버 출석 & 기도제목
                </h3>

                {/* ✅ [개선] 일괄 변경 버튼 Grid Layout + 스타일 통일 */}
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleBulkChange("PRESENT")}
                    disabled={loading || isEditMode}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl border border-green-200 bg-white text-green-700 shadow-sm hover:bg-green-50 active:scale-[0.98] transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    <CheckCircleIcon className="h-4 w-4" /> 전원 출석
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkChange("ABSENT")}
                    disabled={loading || isEditMode}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl border border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50 active:scale-[0.98] transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    <XCircleIcon className="h-4 w-4" /> 전원 결석
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {members.map((member) => {
                  const attendance = getAttendanceForMember(member.id);
                  if (!attendance) return null;

                  return (
                    <div
                      key={member.id}
                      className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden"
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex justify-between items-center mb-4">
                          <div className="min-w-0 mr-2">
                            <h4 className="text-base font-bold text-gray-900 truncate">
                              {formatDisplayName(member, allMembers)}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {member.role === "CELL_LEADER"
                                ? "셀리더"
                                : "셀원"}
                            </p>
                          </div>

                          {/* Custom Toggle Buttons */}
                          <div className="flex bg-gray-100 p-1 rounded-xl flex-shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleAttendanceChange(
                                  member.id,
                                  "status",
                                  "PRESENT"
                                )
                              }
                              disabled={isEditMode}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                                attendance.status === "PRESENT"
                                  ? "bg-white text-green-600 shadow-sm ring-1 ring-black/5"
                                  : "text-gray-400 hover:text-gray-600"
                              }`}
                            >
                              <CheckCircleIcon className="h-4 w-4" /> 출석
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAttendanceChange(
                                  member.id,
                                  "status",
                                  "ABSENT"
                                )
                              }
                              disabled={isEditMode}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                                attendance.status === "ABSENT"
                                  ? "bg-white text-red-500 shadow-sm ring-1 ring-black/5"
                                  : "text-gray-400 hover:text-gray-600"
                              }`}
                            >
                              <XCircleIcon className="h-4 w-4" /> 결석
                            </button>
                          </div>
                        </div>

                        {/* Prayer Input */}
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1 whitespace-nowrap">
                            기도제목 및 특이사항{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            required
                            placeholder="기도제목 및 특이사항을 입력해 주세요."
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
                            rows={3}
                            className={`w-full text-sm p-3 rounded-xl resize-none transition-colors
                                  ${
                                    isEditMode
                                      ? "bg-gray-50 text-gray-600 border-none"
                                      : "bg-gray-50 border border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                  }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. 보고서 섹션 */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden mt-6">
              <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-900 whitespace-nowrap">
                  셀 모임 보고서
                </h3>
              </div>
              <div className="p-5 space-y-6">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5 whitespace-nowrap">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-400" />
                    셀 은혜 나눔 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    value={cellShare}
                    onChange={(e) => setCellShare(e.target.value)}
                    readOnly={isEditMode}
                    placeholder="셀 모임에서 나눈 은혜를 기록해 주세요."
                    rows={4}
                    className={`w-full text-sm p-4 rounded-xl shadow-sm resize-y min-h-[120px] transition-colors
                    ${
                      isEditMode
                        ? "bg-gray-50 text-gray-600 border-gray-200"
                        : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5 whitespace-nowrap">
                    <ExclamationTriangleIcon className="h-4 w-4 text-gray-400" />
                    셀 특이사항 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    readOnly={isEditMode}
                    placeholder="셀 특이사항을 적어주세요."
                    rows={3}
                    className={`w-full text-sm p-4 rounded-xl shadow-sm resize-y min-h-[100px] transition-colors
                    ${
                      isEditMode
                        ? "bg-gray-50 text-gray-600 border-gray-200"
                        : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* 4. 하단 버튼 (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 sm:static sm:bg-transparent sm:border-0 sm:p-0">
              <div className="container mx-auto max-w-2xl">
                {!isEditMode ? (
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white text-base font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:bg-gray-300 disabled:shadow-none whitespace-nowrap"
                    disabled={loading || memberAttendances.length === 0}
                  >
                    {loading ? "저장 중..." : "출석 및 보고서 제출하기"}
                  </button>
                ) : (
                  <div className="w-full bg-gray-100 text-gray-500 text-sm font-bold py-3.5 rounded-xl border border-gray-200 text-center flex items-center justify-center gap-2 whitespace-nowrap">
                    <CheckCircleIcon className="h-5 w-5" /> 이미 제출 완료된
                    보고서입니다
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </form>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setIsConfirmModalOpen(false)}
        title="보고서 제출 확인"
      >
        <div className="text-center py-2">
          <p className="text-gray-600 mb-2">
            <span className="font-bold text-gray-900">{selectedDate}</span>{" "}
            날짜로
          </p>
          <p className="text-gray-900 font-bold text-lg mb-4">
            출석 체크와 보고서를 제출하시겠습니까?
          </p>
          <p className="text-xs text-gray-400">
            * 제출 후에는 수정이 불가능합니다.
          </p>
        </div>
      </ConfirmationModal>

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
