// src/components/attendance/TakeAttendanceView.tsx
import React, { useEffect, useState } from "react";
import { attendanceService } from "../../services/attendanceService";
import { memberService } from "../../services/memberService";
import type {
  MemberDto,
  AttendanceStatus,
  User,
  ProcessAttendanceRequest,
  AttendanceAndPrayerItem,
} from "../../types";
import StatusButton from "./StatusButton";
import ConfirmationModal from "./ConfirmationModal";

// 로컬 상태 관리를 위한 인터페이스
interface MemberAttendanceForm extends ProcessAttendanceRequest {
  id?: number;
  prayerContent?: string;
}

// 가장 최근 일요일 반환 함수
const getMostRecentSundayString = (): string => {
  const now = new Date();
  const dayOfWeek = now.getDay();
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

  // 셀 보고서 관련 State
  const [cellShare, setCellShare] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) {
      setSelectedDate(value);
      return;
    }
    const selected = new Date(value + "T00:00:00");
    const dayOfWeek = selected.getDay();
    if (dayOfWeek !== 0) {
      setSubmitError(
        "출석 체크는 일요일만 가능합니다. 일요일 날짜를 선택해 주세요."
      );
      return;
    }
    setSubmitError(null);
    setSelectedDate(value);
  };

  // ✅ [수정됨] 데이터 불러오기 로직 (보고서 조회 + 기도제목 매핑)
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
        // Promise.all에 getCellReport 추가
        // 보고서가 없는 경우(404 등) 에러를 무시하고 null을 반환하도록 catch 처리
        const [membersPage, existingAttendancesPage, cellReportData] =
          await Promise.all([
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
            attendanceService
              .getCellReport(cellId, selectedDate)
              .catch(() => null), // 실패 시 null 반환
          ]);

        const relevantMembers = membersPage.content.sort((a, b) => {
          const isALeader = a.role === "CELL_LEADER";
          const isBLeader = b.role === "CELL_LEADER";
          if (isALeader && !isBLeader) return -1;
          if (!isALeader && isBLeader) return 1;
          return a.name.localeCompare(b.name);
        });
        setMembers(relevantMembers);

        // 🔹 1. 출석 및 기도제목 매핑
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
            // ✅ 기존 기도제목이 있으면 불러오고, 없으면 빈 문자열
            prayerContent: existing?.prayerContent || "",
          };
        });
        setMemberAttendances(initialAttendances);

        // 🔹 2. 셀 보고서 데이터 반영 (데이터가 있으면 채우고, 없으면 초기화)
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
      setSubmitError("출석 체크는 일요일만 가능합니다.");
      return;
    }
    if (memberAttendances.length === 0) {
      setSubmitError("출석을 처리할 멤버가 없습니다.");
      return;
    }

    // ✅ 1. 멤버별 기도제목/특이사항 필수 검증
    for (const member of members) {
      const attendance = memberAttendances.find(
        (a) => a.memberId === member.id
      );
      if (!attendance || !attendance.prayerContent?.trim()) {
        setSubmitError(`${member.name}님의 기도제목/특이사항을 입력해 주세요.`);
        return;
      }
    }

    // ✅ 2. 셀 보고서 필수항목 검증
    if (!cellShare.trim()) {
      setSubmitError("셀 나눔(은혜나눔) 내용을 입력해 주세요.");
      return;
    }

    // ✅ 3. 특이사항 필수 체크
    if (!specialNotes.trim()) {
      setSubmitError(
        "셀 특이사항을 입력해 주세요. (없으면 '없음'이라도 적어주세요)"
      );
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
        status: att.status,
        memo: undefined, // 메모는 입력받지 않으므로 undefined 처리
        prayerContent: att.prayerContent?.trim() || undefined,
      }));

      const payload: any = {
        meetingDate: selectedDate,
        cellShare: cellShare.trim(),
        specialNotes: specialNotes.trim(),
        items: items,
      };

      await attendanceService.processAttendanceWithPrayers(cellId, payload);

      setSubmitError(null);
      setSuccessMessage("셀 보고서 및 출석이 저장되었습니다.");

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

  const getAttendanceForMember = (memberId: number) =>
    memberAttendances.find((att) => att.memberId === memberId);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* 알림 영역 */}
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

      {/* 날짜 선택 영역 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <label
          htmlFor="attendanceDate"
          className="block text-sm font-medium text-gray-700"
        >
          모임 날짜
        </label>
        <div className="mt-1">
          <input
            id="attendanceDate"
            type="date"
            required
            value={selectedDate}
            onChange={handleDateChange}
            className="block w-full sm:max-w-xs rounded-md border-gray-300 shadow-sm"
            disabled={loading}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          일요일만 선택할 수 있습니다.
        </p>
      </div>

      {loading && <div className="text-center p-8">로딩 중...</div>}

      {!loading && members.length > 0 && (
        <>
          {/* ✅ 1. 일괄 변경 버튼 */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">
              셀원 출석 일괄 변경:
            </span>
            <button
              type="button"
              onClick={() => handleBulkChange("PRESENT")}
              className="px-3 py-1 text-xs sm:text-sm border border-green-500 text-green-600 rounded-md hover:bg-green-100 disabled:opacity-50"
              disabled={loading}
            >
              모두 출석
            </button>
            <button
              type="button"
              onClick={() => handleBulkChange("ABSENT")}
              className="px-3 py-1 text-xs sm:text-sm border border-red-500 text-red-600 rounded-md hover:bg-red-100 disabled:opacity-50"
              disabled={loading}
            >
              모두 결석
            </button>
          </div>

          {/* ✅ 2. 멤버 리스트 */}
          {/* 🔹 모바일: 카드 리스트 */}
          <div className="space-y-3 md:hidden">
            {members.map((member) => {
              const attendance = getAttendanceForMember(member.id);
              if (!attendance) return null;

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">
                      {member.name}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      출석 및 기도제목/특이사항
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
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
                          small
                        />
                      )
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-600">
                      기도제목 및 특이사항{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      placeholder="기도제목 및 특이사항 (셀장 본인 또는 셀원의 상황을 상세하게 기록해 주시면 상황을 보고 목회자가 연락하겠습니다.)"
                      required
                      value={attendance.prayerContent || ""}
                      onChange={(e) =>
                        handleAttendanceChange(
                          member.id,
                          "prayerContent",
                          e.target.value
                        )
                      }
                      className="block w-full text-xs p-2 rounded-md border-gray-300 shadow-sm 
                        focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 
                        resize-y max-h-40"
                      rows={2}
                      disabled={loading}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 🔹 데스크탑: 테이블 */}
          <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이름
                  </th>
                  <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출석
                  </th>
                  <th className="w-[65%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기도제목 및 특이사항<span className="text-red-500">*</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => {
                  const attendance = getAttendanceForMember(member.id);
                  if (!attendance) return null;
                  return (
                    <tr key={member.id}>
                      <td className="w-[15%] px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-800 align-top">
                        {member.name}
                      </td>
                      <td className="w-[20%] px-4 py-4 whitespace-nowrap align-top">
                        <div className="flex flex-wrap gap-2 items-center">
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
                                small
                              />
                            )
                          )}
                        </div>
                      </td>
                      <td className="w-[65%] px-4 py-4 align-top">
                        <textarea
                          placeholder="기도제목 및 특이사항 (셀원의 상황을 상세하게 기록해 주시면 상황을 보고 목회자가 연락하겠습니다.)"
                          required
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-200 my-6"></div>

          {/* ✅ 3. 셀 보고서 입력 섹션 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-800">
                📝 셀 모임 보고서
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {/* 셀 나눔 */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  셀 은혜나눔 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={cellShare}
                  onChange={(e) => setCellShare(e.target.value)}
                  placeholder="셀 나눔 내용과 은혜를 나눠주세요."
                  rows={3}
                  className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              {/* 특이사항 (필수) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  셀 특이사항 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="심방요청, 결혼, 질병, 장례 등 공유할 내용을 적어주세요."
                  rows={2}
                  className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-center md:justify-end pt-4 pb-8">
            <button
              type="submit"
              className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 text-sm font-semibold shadow-sm"
              disabled={loading || memberAttendances.length === 0}
            >
              {loading ? "저장 중..." : "셀 보고서 및 출석 저장"}
            </button>
          </div>
        </>
      )}

      {!loading && members.length === 0 && !submitError && (
        <div className="text-center p-8 bg-white rounded-lg shadow-sm text-sm text-gray-600">
          해당 셀에 활동중인 멤버가 없습니다.
        </div>
      )}

      <ConfirmationModal
        isOpen={isModalOpen}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setIsModalOpen(false)}
        title="보고서 저장 확인"
      >
        <div className="text-sm space-y-2">
          <p>
            <span className="font-semibold">{selectedDate}</span> 날짜의 셀
            보고서와
          </p>
          <p>멤버들의 출석 및 셀 모임 보고서 내용을 저장하시겠습니까?</p>
          <p className="text-xs text-gray-500 mt-2">
            (기존에 저장된 내용이 있다면 덮어씌워집니다.)
          </p>
        </div>
      </ConfirmationModal>
    </form>
  );
};

export default TakeAttendanceView;
