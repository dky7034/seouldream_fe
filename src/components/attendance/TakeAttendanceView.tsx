// src/components/attendance/TakeAttendanceView.tsx
import React, { useEffect, useState } from "react";
import { attendanceService } from "../../services/attendanceService";
import { memberService } from "../../services/memberService";
import type {
  MemberDto,
  AttendanceStatus,
  User,
  ProcessAttendanceRequest,
  ProcessAttendanceWithPrayersRequest,
  AttendanceAndPrayerItem,
} from "../../types";
import StatusButton from "./StatusButton";
import ConfirmationModal from "./ConfirmationModal";

interface MemberAttendanceForm extends ProcessAttendanceRequest {
  id?: number;
  prayerContent?: string; // ✅ 통합 저장용 기도제목 필드
}

// 가장 최근 일요일을 yyyy-MM-dd (로컬 기준) 문자열로 반환
const getMostRecentSundayString = (): string => {
  const now = new Date();

  // 오늘 기준으로 가장 최근 일요일 날짜 구하기
  const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
  const sunday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - dayOfWeek
  );

  const year = sunday.getFullYear();
  const month = String(sunday.getMonth() + 1).padStart(2, "0");
  const day = String(sunday.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const TakeAttendanceView: React.FC<{ user: User }> = ({ user }) => {
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [memberAttendances, setMemberAttendances] = useState<
    MemberAttendanceForm[]
  >([]);

  const [selectedDate, setSelectedDate] = useState<string>(
    getMostRecentSundayString()
  );

  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // ✅ 추가

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

  // ✅ 날짜 변경 시 일요일만 허용
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) {
      setSelectedDate(value);
      return;
    }

    const selected = new Date(value + "T00:00:00");
    const dayOfWeek = selected.getDay(); // 0: 일요일

    if (dayOfWeek !== 0) {
      setSubmitError(
        "출석 체크는 일요일만 가능합니다. 일요일 날짜를 선택해 주세요."
      );
      return;
    }

    setSubmitError(null);
    setSelectedDate(value);
  };

  useEffect(() => {
    const cellId = user.cellId;
    if (!cellId || !selectedDate) {
      setMembers([]);
      setMemberAttendances([]);
      if (!cellId) {
        setSubmitError("셀장 정보에 셀 ID가 없습니다. 관리자에게 문의하세요.");
      }
      return;
    }

    const fetchMembersAndAttendances = async () => {
      setLoading(true);
      setSubmitError(null);
      try {
        const [membersPage, existingAttendancesPage] = await Promise.all([
          memberService.getAllMembers({
            cellId,
            size: 200,
            active: true,
          }),
          attendanceService.getAttendances({
            startDate: selectedDate,
            endDate: selectedDate,
            cellId,
            size: 200,
          }),
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
            prayerContent: "", // ✅ 기도제목 초기값
          };
        });
        setMemberAttendances(initialAttendances);
      } catch {
        setSubmitError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchMembersAndAttendances();
  }, [selectedDate, user]);

  const handleBulkChange = (status: AttendanceStatus) => {
    setMemberAttendances((prev) => prev.map((att) => ({ ...att, status })));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate) {
      setSubmitError("출석 날짜를 선택해 주세요.");
      return;
    }
    const selected = new Date(selectedDate + "T00:00:00");
    if (selected.getDay() !== 0) {
      setSubmitError(
        "출석 체크는 일요일만 가능합니다. 일요일 날짜를 선택해 주세요."
      );
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
      const cellId = user.cellId;
      if (!cellId) {
        setSubmitError("셀 정보가 없습니다. 관리자에게 문의하세요.");
        return;
      }

      const items: AttendanceAndPrayerItem[] = memberAttendances.map((att) => ({
        memberId: att.memberId,
        date: selectedDate,
        status: att.status,
        memo: att.memo?.trim() || undefined,
        prayerContent: att.prayerContent?.trim() || undefined,
      }));

      const payload: ProcessAttendanceWithPrayersRequest = { items };

      await attendanceService.processAttendanceWithPrayers(cellId, payload);

      // ✅ 성공 메시지 표시
      setSubmitError(null);
      setSuccessMessage("출석 및 기도제목이 저장되었습니다.");

      // 3초 뒤에 자동으로 숨기기
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      setSuccessMessage(null);
      setSubmitError(
        err.response?.data?.message ||
          "출석/기도제목 처리 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {successMessage && (
        <div className="p-3 text-sm font-medium text-green-700 bg-green-100 border border-green-400 rounded-md">
          {successMessage}
        </div>
      )}

      {submitError && (
        <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
          {submitError}
        </div>
      )}

      <div className="p-4 bg-gray-50 rounded-lg">
        <label
          htmlFor="attendanceDate"
          className="block text-sm font-medium text-gray-700"
        >
          날짜 선택
        </label>
        <input
          id="attendanceDate"
          type="date"
          required
          value={selectedDate}
          onChange={handleDateChange}
          className="mt-1 block w-full md:w-1/3 rounded-md border-gray-300 shadow-sm"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">
          일요일만 선택할 수 있습니다.
        </p>
      </div>

      {loading && <div className="text-center p-8">로딩 중...</div>}

      {!loading && members.length > 0 && (
        <>
          <div className="p-3 mb-2 text-xs md:text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-md">
            출석 체크는 필수이고, 기도제목은 선택입니다. 오늘은 출석만 먼저
            저장하시고, 여유가 되실 때 기도제목을 적으셔도 괜찮습니다.
          </div>
          <div className="flex items-center justify-start space-x-2 mb-4">
            <span className="text-sm font-medium text-gray-700">
              일괄 변경:
            </span>
            <button
              type="button"
              onClick={() => handleBulkChange("PRESENT")}
              className="px-3 py-1 text-sm border border-green-500 text-green-600 rounded-md hover:bg-green-100 disabled:opacity-50"
              disabled={loading}
            >
              모두 출석
            </button>
            <button
              type="button"
              onClick={() => handleBulkChange("ABSENT")}
              className="px-3 py-1 text-sm border border-red-500 text-red-600 rounded-md hover:bg-red-100 disabled:opacity-50"
              disabled={loading}
            >
              모두 결석
            </button>
          </div>

          <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이름
                  </th>
                  <th className="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출석
                  </th>
                  <th className="w-[45%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기도제목
                  </th>
                  <th className="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    메모
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => {
                  const attendance = memberAttendances.find(
                    (att) => att.memberId === member.id
                  );
                  if (!attendance) return null;

                  return (
                    <tr key={member.id}>
                      {/* 이름 */}
                      <td className="w-[12%] px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-800 align-top">
                        {member.name}
                      </td>

                      {/* 출석 상태 */}
                      <td className="w-[18%] px-4 py-4 whitespace-nowrap align-top">
                        <div className="flex items-center space-x-2">
                          {(["PRESENT", "ABSENT"] as AttendanceStatus[]).map(
                            (status) => (
                              <StatusButton
                                key={status}
                                status={status}
                                currentStatus={attendance.status}
                                onClick={(s) =>
                                  handleAttendanceChange(member.id, "status", s)
                                }
                                disabled={loading}
                              />
                            )
                          )}
                        </div>
                      </td>

                      {/* 기도제목 */}
                      <td className="w-[45%] px-4 py-4 align-top">
                        <textarea
                          placeholder="기도제목을 입력하세요..."
                          value={attendance.prayerContent || ""}
                          onChange={(e) =>
                            handleAttendanceChange(
                              member.id,
                              "prayerContent",
                              e.target.value
                            )
                          }
                          className="mt-1 block w-full text-sm p-2 rounded-md border-gray-300 shadow-sm 
                  focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 
                  resize-y max-h-40"
                          rows={2}
                          disabled={loading}
                        />
                        <p className="mt-1 text-[11px] text-gray-400">
                          기도제목은 오늘 다 적지 않아도 됩니다. 떠오르는 내용만
                          간단히 적어 두셔도 괜찮아요.
                        </p>
                      </td>

                      {/* 메모 */}
                      <td className="w-[25%] px-4 py-4 align-top">
                        <textarea
                          placeholder="메모..."
                          value={attendance.memo || ""}
                          onChange={(e) =>
                            handleAttendanceChange(
                              member.id,
                              "memo",
                              e.target.value
                            )
                          }
                          className="mt-1 block w-full text-sm p-2 rounded-md border-gray-300 shadow-sm 
                  focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 
                  resize-y max-h-32"
                          rows={1}
                          disabled={loading}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
              disabled={loading || memberAttendances.length === 0}
            >
              {loading ? "저장 중..." : "출석 및 기도제목 저장"}
            </button>
          </div>
        </>
      )}

      {!loading && members.length === 0 && !submitError && (
        <div className="text-center p-8 bg-white rounded-lg shadow-sm">
          해당 셀에 활동중인 멤버가 없습니다.
        </div>
      )}

      <ConfirmationModal
        isOpen={isModalOpen}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setIsModalOpen(false)}
        title="출석 및 기도제목 저장 확인"
      >
        <p>
          {selectedDate} 날짜의 출석 정보와 기도제목을 함께 저장하시겠습니까?
        </p>
      </ConfirmationModal>
    </form>
  );
};

export default TakeAttendanceView;
