import React, { useMemo } from "react";
import {
  FaChevronLeft,
  FaChevronRight,
  FaRegCalendarTimes,
} from "react-icons/fa";
import type { AttendanceDto } from "../types";

interface AttendanceMatrixProps {
  year: number;
  month: number;
  members: { memberId: number; memberName: string }[];
  attendances: AttendanceDto[];
  onMonthChange: (increment: number) => void;
  loading?: boolean;
  limitStartDate?: string;
  limitEndDate?: string;
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

  // 해당 월의 "학기 내 일요일"만 생성
  const targetDays = useMemo(() => {
    const date = new Date(year, month - 1, 1);
    const days: Date[] = [];

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

  // 날짜 표시 포맷 (MM.DD)
  const formatDatePretty = (date: Date) =>
    `${date.getMonth() + 1}.${date.getDate()}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 헤더: 월 이동 컨트롤 */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-800">
            {year}년 {month}월 출석표
          </h3>
          <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
            주일 기준
          </span>
        </div>

        <div className="flex items-center bg-white rounded-lg border border-gray-200 p-0.5 shadow-sm">
          <button
            onClick={() => onMonthChange(-1)}
            disabled={loading}
            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 disabled:opacity-30 transition-all"
          >
            <FaChevronLeft size={14} />
          </button>
          <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
          <button
            onClick={() => onMonthChange(1)}
            disabled={loading}
            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 disabled:opacity-30 transition-all"
          >
            <FaChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="h-64 flex flex-col items-center justify-center text-gray-400 bg-white">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-100 border-t-indigo-500 mb-4"></div>
          <p className="text-sm font-medium">데이터를 불러오고 있습니다...</p>
        </div>
      )}

      {/* 테이블 영역 */}
      {!loading && (
        <div className="overflow-x-auto">
          {targetDays.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <FaRegCalendarTimes size={32} className="mb-2 opacity-50" />
              <p className="text-sm">이 달에는 학기 중인 주일이 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  {/* 이름 컬럼 (Sticky) */}
                  <th className="sticky left-0 z-20 w-[100px] bg-gray-50 p-3 text-left font-semibold text-gray-600 border-b border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    이름
                  </th>
                  {/* 날짜 컬럼들 */}
                  {targetDays.map((day) => (
                    <th
                      key={toDateKey(day)}
                      className="p-2 min-w-[70px] border-b border-gray-100 text-center align-bottom pb-3"
                    >
                      <div className="inline-flex flex-col items-center justify-center bg-white border border-red-100 rounded-lg px-3 py-1.5 shadow-sm">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                          SUN
                        </span>
                        <span className="text-sm font-bold text-gray-800">
                          {formatDatePretty(day)}
                        </span>
                      </div>
                    </th>
                  ))}
                  {/* 여백 채우기용 빈 컬럼 (선택사항) */}
                  <th className="w-full border-b border-gray-100"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((member) => (
                  <tr
                    key={member.memberId}
                    className="group hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50/30 p-3 font-medium text-gray-700 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap transition-colors">
                      {member.memberName}
                    </td>

                    {targetDays.map((day) => {
                      const dateStr = toDateKey(day);
                      const status = attendanceMap.get(
                        `${member.memberId}-${dateStr}`
                      );

                      let content;
                      if (status === "PRESENT") {
                        content = (
                          <div className="w-8 h-8 mx-auto flex items-center justify-center rounded-full bg-green-100 text-green-600 shadow-sm border border-green-200 transition-transform group-hover:scale-110">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                d="M5 13l4 4L19 7"
                              ></path>
                            </svg>
                          </div>
                        );
                      } else if (status === "ABSENT") {
                        content = (
                          <div className="w-8 h-8 mx-auto flex items-center justify-center rounded-full bg-red-50 text-red-500 shadow-sm border border-red-100 opacity-80 group-hover:opacity-100 transition-transform group-hover:scale-110">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                d="M6 18L18 6M6 6l12 12"
                              ></path>
                            </svg>
                          </div>
                        );
                      } else {
                        // 미체크 (회색 점)
                        content = (
                          <div className="w-8 h-8 mx-auto flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-gray-200 group-hover:bg-gray-300 transition-colors"></div>
                          </div>
                        );
                      }

                      return (
                        <td key={dateStr} className="p-2 text-center">
                          {content}
                        </td>
                      );
                    })}
                    {/* 여백 채우기용 빈 셀 */}
                    <td></td>
                  </tr>
                ))}

                {members.length === 0 && (
                  <tr>
                    <td
                      colSpan={targetDays.length + 2}
                      className="py-12 text-center text-gray-400 bg-gray-50/30"
                    >
                      등록된 셀원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceMatrix;
