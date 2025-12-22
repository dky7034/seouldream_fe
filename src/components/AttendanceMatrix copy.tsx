import React, { useMemo } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import type { AttendanceDto } from "../types";

interface AttendanceMatrixProps {
  year: number;
  month: number; // 1 ~ 12
  members: { memberId: number; memberName: string }[];
  attendances: AttendanceDto[];
  onMonthChange: (increment: number) => void;
  loading?: boolean;
  // [추가] 학기 기간 내의 일요일만 보여주기 위한 범위 제한
  limitStartDate?: string; // YYYY-MM-DD
  limitEndDate?: string; // YYYY-MM-DD
}

const AttendanceMatrix: React.FC<AttendanceMatrixProps> = ({
  year,
  month,
  members,
  attendances,
  onMonthChange,
  loading = false,
  limitStartDate,
  limitEndDate,
}) => {
  // 날짜 포맷 (YYYY-MM-DD)
  const toDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // [수정 1] 해당 월의 날짜 중 "일요일"이면서 "학기 범위 내"인 날짜만 생성
  const targetDays = useMemo(() => {
    const date = new Date(year, month - 1, 1);
    const days: Date[] = [];

    // 해당 월의 1일부터 말일까지 루프
    while (date.getMonth() === month - 1) {
      // 1. 일요일인지 확인 (0: 일요일)
      if (date.getDay() === 0) {
        const dateString = toDateKey(date);

        // 2. 학기 범위 체크
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
  }, [year, month, limitStartDate, limitEndDate]);

  // 출석 데이터 매핑
  const attendanceMap = useMemo(() => {
    const map = new Map<string, string>();
    attendances.forEach((att) => {
      if (!att.member?.id || !att.date) return;
      const key = `${att.member.id}-${att.date}`;
      map.set(key, att.status);
    });
    return map;
  }, [attendances]);

  // 유틸: 날짜 표시 (M/D)
  const formatDateShort = (date: Date) =>
    `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <div className="bg-white rounded-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800">
          {year}년 {month}월
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => onMonthChange(-1)}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 border border-gray-200 disabled:opacity-50 transition-colors"
          >
            <FaChevronLeft />
          </button>
          <button
            onClick={() => onMonthChange(1)}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 border border-gray-200 disabled:opacity-50 transition-colors"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="h-40 flex flex-col items-center justify-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2"></div>
          데이터를 불러오는 중...
        </div>
      )}

      {/* 매트릭스 테이블 */}
      {!loading && (
        <div className="overflow-x-auto relative pb-2 min-h-[200px]">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                {/* 이름 컬럼 (Sticky) */}
                <th className="sticky left-0 z-20 bg-gray-50 p-2 min-w-[80px] text-left font-medium text-gray-500 border-b border-r border-gray-200 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                  이름
                </th>
                {/* 날짜 컬럼들 (일요일만 표시됨) */}
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
                  // 해당 월에 학기에 포함된 일요일이 없는 경우 빈 헤더 처리
                  <th className="p-2 text-gray-400 font-normal border-b border-gray-100">
                    일정 없음
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.memberId}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="sticky left-0 z-10 bg-white p-2 font-medium text-gray-700 border-b border-r border-gray-100 whitespace-nowrap shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                    {member.memberName}
                  </td>

                  {targetDays.length > 0 ? (
                    targetDays.map((day) => {
                      const dateStr = toDateKey(day);
                      const status = attendanceMap.get(
                        `${member.memberId}-${dateStr}`
                      );

                      let content;
                      if (status === "PRESENT") {
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
                        // 미체크
                        content = (
                          <div className="mx-auto w-3 h-3 rounded-full bg-gray-200 border border-gray-300" />
                        );
                      }

                      return (
                        <td
                          key={dateStr}
                          className="p-1 border-b border-gray-50 text-center align-middle h-10"
                        >
                          {content}
                        </td>
                      );
                    })
                  ) : (
                    // 데이터가 없을 때 빈 칸 채움
                    <td className="p-2 border-b border-gray-50"></td>
                  )}
                </tr>
              ))}

              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={targetDays.length + 1}
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
