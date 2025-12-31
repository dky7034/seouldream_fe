// src/pages/ProcessAttendancePage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { attendanceService } from "../services/attendanceService";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import type {
  MemberDto,
  ProcessAttendanceRequest,
  AttendanceStatus,
  CellDto,
  ProcessAttendanceWithPrayersRequest,
  AttendanceAndPrayerItem,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import {
  ATTENDANCE_STATUSES,
  translateAttendanceStatus,
} from "../utils/attendanceUtils";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";

interface MemberAttendanceForm extends ProcessAttendanceRequest {
  id?: number;
  prayerContent?: string;
  // memo 필드는 더 이상 사용하지 않음
}

// --- UI Sub Components ---

const StatusButton: React.FC<{
  status: AttendanceStatus;
  currentStatus: AttendanceStatus;
  onClick: (status: AttendanceStatus) => void;
  disabled: boolean;
}> = ({ status, currentStatus, onClick, disabled }) => {
  const baseClasses =
    "px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500";
  const statusClasses: Record<AttendanceStatus, string> = {
    PRESENT: `border-green-500 ${
      currentStatus === "PRESENT"
        ? "bg-green-500 text-white"
        : "text-green-600 hover:bg-green-50"
    }`,
    ABSENT: `border-red-500 ${
      currentStatus === "ABSENT"
        ? "bg-red-500 text-white"
        : "text-red-600 hover:bg-red-50"
    }`,
  };
  return (
    <button
      type="button"
      onClick={() => onClick(status)}
      className={`${baseClasses} ${statusClasses[status]}`}
      disabled={disabled}
    >
      {translateAttendanceStatus(status)}
    </button>
  );
};

// [수정] 메모 입력 필드 제거됨
const AttendanceCard: React.FC<{
  member: MemberDto;
  attendance: MemberAttendanceForm;
  onAttendanceChange: (
    memberId: number,
    field: keyof MemberAttendanceForm,
    value: any
  ) => void;
  loading: boolean;
}> = ({ member, attendance, onAttendanceChange, loading }) => {
  const statusColor: Record<AttendanceStatus, string> = {
    PRESENT: "border-green-500 bg-green-50",
    ABSENT: "border-red-500 bg-red-50",
  };

  return (
    <div
      className={`flex flex-col h-full p-4 border-l-4 rounded-r-lg shadow-sm ${
        statusColor[attendance.status]
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-gray-800 text-sm sm:text-base truncate">
          {member.name}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {ATTENDANCE_STATUSES.map((status) => (
          <StatusButton
            key={status}
            status={status}
            currentStatus={attendance.status}
            onClick={(s) => onAttendanceChange(member.id, "status", s)}
            disabled={loading}
          />
        ))}
      </div>

      {/* 메모 input 필드 제거됨 */}

      <textarea
        placeholder="기도제목을 입력하세요..."
        value={attendance.prayerContent || ""}
        onChange={(e) =>
          onAttendanceChange(member.id, "prayerContent", e.target.value)
        }
        className="mt-3 block w-full text-xs sm:text-sm p-2 rounded-md border border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        rows={2}
        disabled={loading}
      />
    </div>
  );
};

const AttendanceSummary: React.FC<{ attendances: MemberAttendanceForm[] }> = ({
  attendances,
}) => {
  const summary = useMemo(() => {
    return attendances.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<AttendanceStatus, number>);
  }, [attendances]);

  return (
    <div className="flex flex-col sm:flex-row justify-between gap-4 p-4 bg-white rounded-lg shadow-sm mb-4 sm:mb-6">
      <div className="flex-1 text-center">
        <p className="text-xl sm:text-2xl font-bold text-green-600">
          {summary.PRESENT || 0}
        </p>
        <p className="text-xs sm:text-sm font-medium text-gray-500">출석</p>
      </div>
      <div className="flex-1 text-center">
        <p className="text-xl sm:text-2xl font-bold text-red-600">
          {summary.ABSENT || 0}
        </p>
        <p className="text-xs sm:text-sm font-medium text-gray-500">결석</p>
      </div>
      <div className="flex-1 text-center">
        <p className="text-xl sm:text-2xl font-bold text-gray-800">
          {attendances.length}
        </p>
        <p className="text-xs sm:text-sm font-medium text-gray-500">총원</p>
      </div>
    </div>
  );
};

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onConfirm, onCancel, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4 bg-black bg-opacity-40">
      <div className="w-full max-w-md bg-white p-5 sm:p-6 rounded-lg shadow-xl">
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">{title}</h2>
        <div className="mb-5 text-sm sm:text-base text-gray-700">
          {children}
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// 가장 최근 일요일
const getMostRecentSunday = (): Date => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
};

const ProcessAttendancePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- State 선언 (항상 최상위) ---
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [cells, setCells] = useState<CellDto[]>([]);
  const [memberAttendances, setMemberAttendances] = useState<
    MemberAttendanceForm[]
  >([]);

  // 셀 나눔(은혜 나눔) 상태
  const [cellShare, setCellShare] = useState<string>("");

  const [selectedCellId, setSelectedCellId] = useState<number | undefined>(
    undefined
  );
  const [selectedDate, setSelectedDate] = useState<Date>(getMostRecentSunday());

  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // --- useMemo 선언 (Early Return 위로 이동) ---
  const cellOptions = useMemo(
    () => cells.map((c) => ({ value: c.id, label: c.name })),
    [cells]
  );

  const sortedMembers = useMemo(() => {
    if (members.length === 0) return [];
    return [...members].sort((a, b) => {
      const isALeader = a.role === "CELL_LEADER";
      const isBLeader = b.role === "CELL_LEADER";
      if (isALeader && !isBLeader) return -1;
      if (!isALeader && isBLeader) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [members]);

  // --- useEffect 선언 (Early Return 위로 이동) ---

  // 1. 셀 목록 / 기본 셀 설정
  useEffect(() => {
    // Hook 내부에서 조건 처리
    if (!user) return;

    if (user.role === "EXECUTIVE") {
      cellService
        .getAllCells({ size: 1000, active: true })
        .then((page) => setCells(page.content))
        .catch(() => setSubmitError("셀 목록을 불러오는 데 실패했습니다."));
    } else if (user.role === "CELL_LEADER" && user.cellId) {
      setSelectedCellId(user.cellId);
    } else if (user.role === "CELL_LEADER" && !user.cellId) {
      setSubmitError("셀장 정보에 셀 ID가 없습니다. 관리자에게 문의하세요.");
    }
  }, [user]);

  // 2. 멤버 + 기존 출석 내역 로딩 useEffect 수정
  useEffect(() => {
    const dateString = format(selectedDate, "yyyy-MM-dd");
    if (selectedCellId === undefined || !dateString || !user) {
      setMembers([]);
      setMemberAttendances([]);
      return;
    }

    const fetchMembersAndAttendances = async () => {
      setLoading(true);
      setSubmitError(null);
      try {
        // ... (API 호출 부분 동일)
        const [membersPage, existingAttendancesPage] = await Promise.all([
          memberService.getAllMembers({
            cellId: selectedCellId,
            size: 200,
            active: true,
          }),
          attendanceService.getAttendances({
            startDate: dateString,
            endDate: dateString,
            cellId: selectedCellId,
            size: 200,
          }),
        ]);

        const relevantMembers = membersPage.content;
        setMembers(relevantMembers);

        const existingAttendances = existingAttendancesPage.content;

        // ✅ [수정] 셀 나눔(Cell Share) 데이터 로딩 (첫 번째 기록에서 가져오거나 별도 API 필요)
        // 참고: 보통 getAttendances에는 cellShare가 없을 수 있습니다.
        // 만약 cellShare가 필요하다면 'getCellReport' 같은 API를 여기서 한 번 더 호출해야 할 수도 있습니다.
        // 현재 코드엔 없으므로 일단 패스하지만, 수정 모드일 때 '셀 나눔' 텍스트도 불러와야 한다면 확인 필요합니다.

        const initialAttendances: MemberAttendanceForm[] = relevantMembers.map(
          (member) => {
            const existing = existingAttendances.find(
              (att) => att.member.id === member.id
            );
            return {
              id: existing?.id,
              memberId: member.id,
              date: dateString,
              status: existing?.status || "ABSENT",
              createdById: user.id,
              // ✅ [수정 완료] 기존 기도제목이 있으면 불러오고, 없으면 빈 값
              prayerContent: existing?.prayerContent || "",
            };
          }
        );

        setMemberAttendances(initialAttendances);
      } catch (err) {
        setSubmitError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchMembersAndAttendances();
  }, [selectedCellId, selectedDate, user]);

  // --- Early Returns (Hook 선언 이후에 배치) ---

  // 권한 체크 1: 로그인 여부
  if (!user) {
    return (
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
        <p className="text-center text-sm sm:text-base text-red-600">
          출석 관리 페이지는 로그인 후 이용할 수 있습니다.
        </p>
      </div>
    );
  }

  // 권한 체크 2: 역할 여부
  if (!["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
    return (
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
        <p className="text-center text-sm sm:text-base text-red-600">
          출석 관리는 임원과 셀장만 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  // --- Handlers ---

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

  const handleBulkChange = (status: AttendanceStatus) => {
    setMemberAttendances((prev) => prev.map((att) => ({ ...att, status })));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedDate.getDay() !== 0) {
      setSubmitError("출석 체크는 일요일만 가능합니다.");
      return;
    }

    if (memberAttendances.length === 0) {
      setSubmitError("출석을 처리할 멤버가 없습니다.");
      return;
    }

    setIsModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setIsModalOpen(false);
    setLoading(true);

    try {
      if (!selectedCellId) {
        setSubmitError(
          "셀 정보가 없습니다. 다시 시도하거나 관리자에게 문의하세요."
        );
        return;
      }

      const dateString = format(selectedDate, "yyyy-MM-dd");

      const items: AttendanceAndPrayerItem[] = memberAttendances.map((att) => ({
        memberId: att.memberId,
        status: att.status,
        // [수정] memo 데이터 전송 제거
        prayerContent: att.prayerContent?.trim() || undefined,
      }));

      // 변경된 DTO 구조에 맞춰 payload 생성
      const payload: ProcessAttendanceWithPrayersRequest = {
        meetingDate: dateString, // 모임 날짜
        cellShare: cellShare.trim(), // 셀 나눔 내용
        items, // 멤버별 출석/기도 목록
      };

      await attendanceService.processAttendanceWithPrayers(
        selectedCellId,
        payload
      );

      navigate(user.role === "EXECUTIVE" ? "/admin/attendances" : "/");
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message || "출석/기도 저장 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () =>
    navigate(user.role === "EXECUTIVE" ? "/admin/attendances" : "/");

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              출석 관리
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              일요일 기준으로 셀 출석과 기도제목을 한 번에 기록할 수 있습니다.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="space-y-5 sm:space-y-6 mb-4"
        >
          {submitError && (
            <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md">
              {submitError}
            </div>
          )}

          {/* 1. 필터(셀/날짜) 영역 */}
          <div className="p-4 sm:p-5 bg-white rounded-lg shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4 md:items-end">
              {user.role === "EXECUTIVE" && (
                <div className="w-full md:w-1/2">
                  <label
                    htmlFor="cell"
                    className="block text-xs sm:text-sm font-medium text-gray-700"
                  >
                    셀 선택
                  </label>
                  <div className="mt-1">
                    <SimpleSearchableSelect
                      options={cellOptions}
                      value={selectedCellId}
                      onChange={(value) =>
                        setSelectedCellId(
                          typeof value === "number" ? value : undefined
                        )
                      }
                      placeholder="셀을 선택하세요..."
                    />
                  </div>
                </div>
              )}

              <div className="w-full md:flex-1 relative">
                <label
                  htmlFor="attendanceDate"
                  className="block text-xs sm:text-sm font-medium text-gray-700"
                >
                  날짜
                </label>
                <button
                  type="button"
                  id="attendanceDate"
                  onClick={() => setIsDatePickerOpen((prev) => !prev)}
                  className="mt-1 inline-flex w-full justify-between items-center text-left px-3 py-2 rounded-md border border-gray-300 bg-white shadow-sm text-xs sm:text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <span>{format(selectedDate, "PPP")}</span>
                  <span className="text-gray-400 text-xs sm:text-sm">
                    달력 열기
                  </span>
                </button>

                {isDatePickerOpen && (
                  <div className="absolute z-20 mt-1 bg-white rounded-md shadow-lg border border-gray-200 w-full max-w-sm">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (!date) return;
                        if (date.getDay() !== 0) {
                          setSubmitError(
                            "출석 체크는 일요일만 가능합니다. 일요일 날짜를 선택해 주세요."
                          );
                          return;
                        }
                        setSubmitError(null);
                        setSelectedDate(date);
                        setIsDatePickerOpen(false);
                      }}
                      disabled={(date) => date.getDay() !== 0}
                      initialFocus
                    />
                  </div>
                )}

                <p className="mt-1 text-[11px] sm:text-xs text-gray-500">
                  출석 체크는 일요일만 선택 가능합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 2. 셀 나눔(Cell Share) 입력 영역 */}
          {selectedCellId !== undefined && (
            <div className="p-4 sm:p-5 bg-white rounded-lg shadow-sm">
              <label
                htmlFor="cellShare"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                셀 나눔 (모임 내용 및 은혜 나눔)
              </label>
              <textarea
                id="cellShare"
                value={cellShare}
                onChange={(e) => setCellShare(e.target.value)}
                placeholder="이번 주 셀 모임에서 나눈 주요 내용이나 은혜 받은 점을 자유롭게 기록해주세요."
                className="w-full p-3 text-sm rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                rows={4}
                disabled={loading}
              />
            </div>
          )}

          {/* 3. 요약 + 목록 */}
          {selectedCellId !== undefined && !loading && members.length > 0 && (
            <>
              <AttendanceSummary attendances={memberAttendances} />

              <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  일괄 변경:
                </span>
                <button
                  type="button"
                  onClick={() => handleBulkChange("PRESENT")}
                  className="px-3 py-1.5 text-xs sm:text-sm border border-green-500 text-green-600 rounded-md hover:bg-green-50"
                >
                  모두 출석
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkChange("ABSENT")}
                  className="px-3 py-1.5 text-xs sm:text-sm border border-red-500 text-red-600 rounded-md hover:bg-red-50"
                >
                  모두 결석
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                {sortedMembers.map((member) => {
                  const attendance = memberAttendances.find(
                    (att) => att.memberId === member.id
                  );
                  if (!attendance) return null;
                  return (
                    <AttendanceCard
                      key={member.id}
                      member={member}
                      attendance={attendance}
                      onAttendanceChange={handleAttendanceChange}
                      loading={loading}
                    />
                  );
                })}
              </div>
            </>
          )}

          {loading && (
            <div className="text-center py-8 text-sm sm:text-base text-gray-600">
              멤버 목록을 불러오는 중입니다...
            </div>
          )}

          {!loading && selectedCellId !== undefined && members.length === 0 && (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm text-sm sm:text-base text-gray-600">
              선택하신 셀에 등록된 멤버가 없습니다.
            </div>
          )}

          {selectedCellId === undefined && user.role === "EXECUTIVE" && (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm text-sm sm:text-base text-gray-600">
              출석을 처리할 셀을 먼저 선택해주세요.
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto bg-gray-200 text-gray-800 px-4 sm:px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-300 disabled:opacity-60"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto bg-indigo-600 text-white px-4 sm:px-6 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              disabled={loading || memberAttendances.length === 0}
            >
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>

        <ConfirmationModal
          isOpen={isModalOpen}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setIsModalOpen(false)}
          title="출석 및 기도제목 저장 확인"
        >
          <p className="text-sm sm:text-base">
            선택하신 날짜에 대한 출석 정보와 기도제목, 그리고 셀 나눔 내용을
            함께 저장하시겠습니까?
          </p>
        </ConfirmationModal>
      </div>
    </div>
  );
};

export default ProcessAttendancePage;
