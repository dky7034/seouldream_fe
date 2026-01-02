// src/components/AttendanceMatrix.tsx
import React, { useMemo } from "react";
import type { AttendanceDto, SemesterDto } from "../types";

export interface MatrixMember {
  memberId: number;
  memberName: string;
  cellAssignmentDate?: string;
  createdAt?: string;
  joinYear?: number;
}

interface AttendanceMatrixProps {
  mode?: "semester" | "month" | "year";
  startDate?: string;
  endDate?: string;
  year: number;
  month: number;
  members: MatrixMember[];
  attendances: AttendanceDto[];
  loading?: boolean;
  limitStartDate?: string;
  limitEndDate?: string;
  semesters?: SemesterDto[];
  showAttendanceRate?: boolean;
}

type MatrixStatus = "PRESENT" | "ABSENT";

const AttendanceMatrix: React.FC<AttendanceMatrixProps> = ({
  mode = "month",
  startDate,
  endDate,
  year,
  month,
  members,
  attendances,
  loading = false,
  limitStartDate,
  limitEndDate,
  semesters,
  showAttendanceRate = true,
}) => {
  const toDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const normalizeISODate = (v: string | undefined | null) => {
    if (!v) return "";
    return v.slice(0, 10);
  };

  const today = new Date();
  const todayStr = toDateKey(today);

  // 1. 테이블 헤더 날짜 계산 (학기 필터링 적용)
  const targetDays = useMemo(() => {
    const days: Date[] = [];

    if ((mode === "semester" || mode === "year") && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      const current = new Date(start);
      if (current.getDay() !== 0) {
        current.setDate(current.getDate() + (7 - current.getDay()));
      }

      while (current <= end) {
        const currentDateStr = toDateKey(current);
        let isValid = true;

        // ✅ [수정] 연간 모드일 때: 방학 기간(학기 범위 밖)은 제외 (교집합만 표시)
        if (mode === "year" && semesters && semesters.length > 0) {
          const isInAnySemester = semesters.some(
            (sem) =>
              currentDateStr >= sem.startDate && currentDateStr <= sem.endDate
          );
          if (!isInAnySemester) {
            isValid = false; // 학기 중이 아니면 숨김
          }
        }

        if (isValid) {
          days.push(new Date(current));
        }
        current.setDate(current.getDate() + 7);
      }
      return days;
    }

    // 월간 모드
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === 0) {
        const dateString = toDateKey(date);
        let isWithinRange = true;
        if (limitStartDate && dateString < limitStartDate)
          isWithinRange = false;
        if (limitEndDate && dateString > limitEndDate) isWithinRange = false;

        if (isWithinRange) {
          days.push(new Date(date));
        }
      }
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [
    mode,
    startDate,
    endDate,
    year,
    month,
    limitStartDate,
    limitEndDate,
    semesters,
  ]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, MatrixStatus>();
    for (const att of attendances) {
      const memberId = att.member?.id;
      const dateKey = normalizeISODate(att.date);
      if (!memberId || !dateKey) continue;
      if (att.status === "PRESENT" || att.status === "ABSENT") {
        map.set(`${memberId}-${dateKey}`, att.status);
      }
    }
    return map;
  }, [attendances]);

  const formatDateShort = (date: Date) =>
    `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <div className="bg-white rounded-2xl">
      <div className="flex items-center justify-between mb-4 px-2">
        {mode === "year" ? (
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            {year}년 전체 (학기 중)
          </h3>
        ) : mode === "semester" ? (
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            {startDate} ~ {endDate}
          </h3>
        ) : (
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            {year}년 {month}월
          </h3>
        )}
      </div>

      {loading && (
        <div className="h-40 flex flex-col items-center justify-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2" />
          데이터를 불러오는 중...
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto relative pb-2 min-h-[200px]">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 p-2 min-w-[80px] text-left font-medium text-gray-500 border-b border-r border-gray-200 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                  이름
                </th>
                {targetDays.length > 0 ? (
                  targetDays.map((day) => (
                    <th
                      key={toDateKey(day)}
                      className="p-2 min-w-[50px] text-center font-medium border-b border-gray-100 text-red-500 bg-red-50/30"
                    >
                      <div className="text-xs font-semibold">
                        {formatDateShort(day)}
                      </div>
                      <div className="text-[10px] opacity-75">(일)</div>
                    </th>
                  ))
                ) : (
                  <th className="p-2 text-gray-400 font-normal border-b border-gray-100">
                    일정 없음
                  </th>
                )}
                {showAttendanceRate && (
                  <th className="sticky right-0 z-20 bg-gray-50 p-2 min-w-[60px] text-center font-medium text-gray-500 border-b border-l border-gray-200 shadow-[-1px_0_3px_rgba(0,0,0,0.05)]">
                    출석률
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                let joinDateStr = "2000-01-01";
                if (member.cellAssignmentDate) {
                  joinDateStr = normalizeISODate(member.cellAssignmentDate);
                } else if (member.createdAt) {
                  joinDateStr = normalizeISODate(member.createdAt);
                } else if (member.joinYear) {
                  joinDateStr = `${member.joinYear}-01-01`;
                }

                let presentCount = 0;
                let validWeeksCount = 0;

                targetDays.forEach((day) => {
                  const currentDayStr = toDateKey(day);
                  const status = attendanceMap.get(
                    `${member.memberId}-${currentDayStr}`
                  );

                  if (currentDayStr > todayStr) return;

                  if (currentDayStr >= joinDateStr || status) {
                    validWeeksCount++;
                    if (status === "PRESENT") {
                      presentCount++;
                    }
                  }
                });

                const attendanceRate =
                  validWeeksCount > 0
                    ? Math.min(
                        100,
                        Math.round((presentCount / validWeeksCount) * 100)
                      )
                    : 0;

                return (
                  <tr
                    key={member.memberId}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="sticky left-0 z-30 bg-white p-2 font-medium text-gray-700 border-b border-r border-gray-100 whitespace-nowrap shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                      {member.memberName}
                    </td>
                    {targetDays.length > 0 ? (
                      targetDays.map((day) => {
                        const currentDayStr = toDateKey(day);
                        const status = attendanceMap.get(
                          `${member.memberId}-${currentDayStr}`
                        );
                        const isBeforeJoin =
                          currentDayStr < joinDateStr && !status;
                        const isFuture = currentDayStr > todayStr;

                        let content: React.ReactNode;
                        if (isFuture) {
                          content = (
                            <span className="text-gray-300 text-xs">-</span>
                          );
                        } else if (isBeforeJoin) {
                          content = (
                            <div
                              className="mx-auto w-2 h-2 rounded-full bg-gray-200"
                              title="배정 전"
                            />
                          );
                        } else if (status === "PRESENT") {
                          content = (
                            <div className="mx-auto w-7 h-7 flex items-center justify-center rounded-full bg-green-500 text-white font-bold text-xs shadow-sm">
                              ✓
                            </div>
                          );
                        } else if (status === "ABSENT") {
                          content = (
                            <div className="mx-auto w-7 h-7 flex items-center justify-center rounded-full bg-red-500 text-white font-bold text-xs shadow-sm">
                              ✕
                            </div>
                          );
                        } else {
                          content = (
                            <div
                              className="mx-auto w-3 h-3 rounded-full bg-gray-300 border border-gray-400"
                              title="미체크"
                            />
                          );
                        }
                        return (
                          <td
                            key={currentDayStr}
                            className="p-1 border-b border-gray-50 text-center align-middle h-10"
                          >
                            {content}
                          </td>
                        );
                      })
                    ) : (
                      <td className="p-2 border-b border-gray-50"></td>
                    )}
                    {showAttendanceRate && (
                      <td className="sticky right-0 z-20 bg-white p-2 text-center border-b border-l border-gray-100 font-bold text-indigo-600 shadow-[-1px_0_3px_rgba(0,0,0,0.05)]">
                        {attendanceRate}%
                      </td>
                    )}
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={targetDays.length + (showAttendanceRate ? 2 : 1)}
                    className="p-8 text-center text-gray-400 bg-gray-50"
                  >
                    등록된 셀원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendanceMatrix;
