import React, { useMemo } from "react";
// 화살표 아이콘 import 제거
import type { AttendanceDto } from "../types";

interface AttendanceMatrixProps {
  mode?: "semester" | "month";
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD

  year: number;
  month: number; // 1 ~ 12
  members: { memberId: number; memberName: string }[];
  attendances: AttendanceDto[];

  // onMonthChange 제거 (이제 부모에서만 처리하므로 여기선 필요 없음)

  loading?: boolean;
  limitStartDate?: string; // YYYY-MM-DD
  limitEndDate?: string; // YYYY-MM-DD
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
}) => {
  // ----------------------------------------------------------------------
  // 공통: 날짜 키(YYYY-MM-DD)
  // ----------------------------------------------------------------------
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

  // ----------------------------------------------------------------------
  // targetDays: 학기 전체(일요일만) / 월간(해당 월의 일요일, 학기 범위 제한 적용)
  // ----------------------------------------------------------------------
  const targetDays = useMemo(() => {
    const days: Date[] = [];

    // CASE A: 학기 전체 보기
    if (mode === "semester" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);

      while (current <= end) {
        if (current.getDay() === 0) {
          days.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
      return days;
    }

    // CASE B: 월간 보기
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
  }, [mode, startDate, endDate, year, month, limitStartDate, limitEndDate]);

  // ----------------------------------------------------------------------
  // 버튼 비활성화 로직 제거 (버튼이 없으므로 불필요)
  // ----------------------------------------------------------------------

  // ----------------------------------------------------------------------
  // attendanceMap 생성
  // ----------------------------------------------------------------------
  const attendanceMap = useMemo(() => {
    const map = new Map<string, MatrixStatus>();

    for (const att of attendances) {
      const memberId = att.member?.id;
      const dateKey = normalizeISODate(att.date);

      if (!memberId || !dateKey) continue;
      if (att.status !== "PRESENT" && att.status !== "ABSENT") continue;

      map.set(`${memberId}-${dateKey}`, att.status);
    }

    return map;
  }, [attendances]);

  const formatDateShort = (date: Date) =>
    `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <div className="bg-white rounded-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 px-2">
        {mode === "semester" ? (
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            {startDate} ~ {endDate}
          </h3>
        ) : (
          <h3 className="text-lg sm:text-xl font-bold text-gray-800">
            {year}년 {month}월
          </h3>
        )}

        {/* 화살표 버튼 영역 제거됨 */}
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="h-40 flex flex-col items-center justify-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mb-2" />
          데이터를 불러오는 중...
        </div>
      )}

      {/* 매트릭스 테이블 */}
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

                      let content: React.ReactNode;
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
