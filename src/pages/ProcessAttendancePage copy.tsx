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
  prayerContent?: string; // ✅ 통합 저장을 위한 기도제목 필드
}

// --- NEW UI COMPONENTS ---

const StatusButton: React.FC<{
  status: AttendanceStatus;
  currentStatus: AttendanceStatus;
  onClick: (status: AttendanceStatus) => void;
  disabled: boolean;
}> = ({ status, currentStatus, onClick, disabled }) => {
  const baseClasses =
    "px-3 py-1 text-sm font-medium rounded-md transition-colors border";
  const statusClasses: { [key in AttendanceStatus]: string } = {
    PRESENT: `border-green-500 ${
      currentStatus === "PRESENT"
        ? "bg-green-500 text-white"
        : "text-green-600 hover:bg-green-100"
    }`,
    ABSENT: `border-red-500 ${
      currentStatus === "ABSENT"
        ? "bg-red-500 text-white"
        : "text-red-600 hover:bg-red-100"
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
  const statusColor: { [key in AttendanceStatus]: string } = {
    PRESENT: "border-green-500 bg-green-50",
    ABSENT: "border-red-500 bg-red-50",
  };
  return (
    <div
      className={`p-4 border-l-4 rounded-r-lg shadow-sm ${
        statusColor[attendance.status]
      }`}
    >
      <p className="font-bold text-gray-800">{member.name}</p>
      <div className="flex items-center space-x-2 mt-3">
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
      <input
        type="text"
        placeholder="메모..."
        value={attendance.memo || ""}
        onChange={(e) => onAttendanceChange(member.id, "memo", e.target.value)}
        className="mt-3 block w-full text-sm p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        disabled={loading}
      />

      {/* 🔽 여기 기도제목 입력 필드 추가 */}
      <textarea
        placeholder="기도제목을 입력하세요..."
        value={attendance.prayerContent || ""}
        onChange={(e) =>
          onAttendanceChange(member.id, "prayerContent", e.target.value)
        }
        className="mt-3 block w-full text-sm p-2 rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
    <div className="flex justify-around p-4 bg-white rounded-lg shadow-sm mb-6">
      <div className="text-center">
        <p className="text-2xl font-bold text-green-600">
          {summary.PRESENT || 0}
        </p>
        <p className="text-sm font-medium text-gray-500">출석</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-red-600">{summary.ABSENT || 0}</p>
        <p className="text-sm font-medium text-gray-500">결석</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-800">{attendances.length}</p>
        <p className="text-sm font-medium text-gray-500">총원</p>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="mb-6">{children}</div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// 가장 최근 일요일을 Date (로컬 기준)로 반환
const getMostRecentSunday = (): Date => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
};

const ProcessAttendancePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [cells, setCells] = useState<CellDto[]>([]);
  const [memberAttendances, setMemberAttendances] = useState<
    MemberAttendanceForm[]
  >([]);

  const [selectedCellId, setSelectedCellId] = useState<number | undefined>(
    undefined
  );
  const [selectedDate, setSelectedDate] = useState<Date>(getMostRecentSunday());

  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    if (user?.role === "EXECUTIVE") {
      cellService
        .getAllCells({ size: 1000, active: true })
        .then((page) => setCells(page.content))
        .catch((_err) => setSubmitError("셀 목록을 불러오는 데 실패했습니다."));
    } else if (user?.role === "CELL_LEADER" && user.cellId) {
      setSelectedCellId(user.cellId);
    } else if (user?.role === "CELL_LEADER" && !user.cellId) {
      setSubmitError("셀장 정보에 셀 ID가 없습니다. 관리자에게 문의하세요.");
    }
  }, [user]);

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

        const initialAttendances = relevantMembers.map((member) => {
          const existing = existingAttendances.find(
            (att) => att.member.id === member.id
          );
          return {
            id: existing?.id,
            memberId: member.id,
            date: dateString,
            status: existing?.status || "ABSENT",
            memo: existing?.memo || "",
            createdById: user.id,
            prayerContent: "",
          };
        });
        setMemberAttendances(initialAttendances);
      } catch (err) {
        setSubmitError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchMembersAndAttendances();
  }, [selectedCellId, selectedDate, user]);

  if (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role)) return null;

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
        date: dateString,
        status: att.status,
        memo: att.memo?.trim() || undefined,
        prayerContent: att.prayerContent?.trim() || undefined, // 빈 문자열은 undefined로 정리
      }));

      const payload: ProcessAttendanceWithPrayersRequest = { items };

      await attendanceService.processAttendanceWithPrayers(
        selectedCellId,
        payload
      );

      navigate(user.role === "EXECUTIVE" ? "/admin/attendances" : "/");
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || "출석/기도 저장 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () =>
    navigate(user.role === "EXECUTIVE" ? "/admin/attendances" : "/");

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">출석 관리</h1>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md mb-4">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end p-4 bg-gray-50 rounded-lg">
          {user.role === "EXECUTIVE" && (
            <div>
              <label
                htmlFor="cell"
                className="block text-sm font-medium text-gray-700"
              >
                셀 선택
              </label>
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
          )}

          <div className="relative">
            <label
              htmlFor="attendanceDate"
              className="block text-sm font-medium text-gray-700"
            >
              날짜
            </label>
            <button
              type="button"
              id="attendanceDate"
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              className="mt-1 block w-full text-left p-2 rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            >
              {format(selectedDate, "PPP")}
            </button>

            {isDatePickerOpen && (
              <div className="absolute z-10 mt-1 bg-white rounded-md shadow-lg">
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

            <p className="mt-1 text-xs text-gray-500">
              출석 체크는 일요일만 선택 가능합니다.
            </p>
          </div>
        </div>

        {selectedCellId !== undefined && !loading && members.length > 0 && (
          <>
            <AttendanceSummary attendances={memberAttendances} />

            <div className="flex items-center justify-start space-x-2 mb-4">
              <span className="text-sm font-medium text-gray-700">
                일괄 변경:
              </span>
              <button
                type="button"
                onClick={() => handleBulkChange("PRESENT")}
                className="px-3 py-1 text-sm border border-green-500 text-green-600 rounded-md hover:bg-green-100"
              >
                모두 출석
              </button>
              <button
                type="button"
                onClick={() => handleBulkChange("ABSENT")}
                className="px-3 py-1 text-sm border border-red-500 text-red-600 rounded-md hover:bg-red-100"
              >
                모두 결석
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
          <div className="text-center p-8">멤버 목록을 불러오는 중...</div>
        )}

        {!loading && selectedCellId !== undefined && members.length === 0 && (
          <div className="text-center p-8 bg-white rounded-lg shadow-sm">
            선택하신 셀에 등록된 멤버가 없습니다.
          </div>
        )}

        {selectedCellId === undefined && user.role === "EXECUTIVE" && (
          <div className="text-center p-8 bg-white rounded-lg shadow-sm">
            출석을 처리할 셀을 선택해주세요.
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md mr-2"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-6 py-2 rounded-md"
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
        <p>출석 정보와 기도제목을 함께 저장하시겠습니까?</p>
      </ConfirmationModal>
    </div>
  );
};

export default ProcessAttendancePage;
