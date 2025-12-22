import React, { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { ko } from "date-fns/locale";
import { format } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";

type Mode = "day" | "month" | "year";
type GridCols = 3 | 4;

type Props = {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (next: string) => void;
  minDate?: Date;
  maxDate?: Date;
  monthCols?: GridCols;
  yearCols?: GridCols;
};

const parseLocalDate = (yyyyMMdd: string): Date | null => {
  if (!yyyyMMdd) return null;
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const formatLocalDate = (date: Date): string => format(date, "yyyy-MM-dd");

const getDecadeRangeText = (year: number) => {
  const start = Math.floor(year / 10) * 10;
  return `${start}-${start + 9}`;
};

// 1. 공휴일 체크 로직 (양력)
const isPublicHoliday = (date: Date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateString = `${month}-${day}`;

  const solarHolidays = [
    "1-1",
    "3-1",
    "5-5",
    "6-6",
    "8-15",
    "10-3",
    "10-9",
    "12-25",
  ];

  return solarHolidays.includes(dateString);
};

const KoreanCalendarPicker: React.FC<Props> = ({
  value,
  onChange,
  minDate,
  maxDate,
  monthCols = 3,
  yearCols = 4,
}) => {
  // ✅ 입력창에 표시될 "선택된 날짜"는 value로만 결정
  const selectedDate = useMemo(() => parseLocalDate(value), [value]);

  // ✅ 달력 탐색(연/월 이동)용 날짜는 별도 state로 관리
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("day");

  const wrapperClass = `rdp-month-${monthCols} rdp-year-${yearCols}`;

  // 2. 날짜별 클래스 지정 (CSS 식별자용 클래스 리턴)
  const getDayClassName = (date: Date) => {
    const day = date.getDay();
    const isHoliday = isPublicHoliday(date);

    if (isHoliday || day === 0) {
      return "day-sunday"; // 일요일 또는 공휴일
    }
    if (day === 6) {
      return "day-saturday"; // 토요일
    }
    return "";
  };

  return (
    <div className={wrapperClass}>
      {/* 3. 색상 적용을 위한 CSS 스타일 */}
      <style>{`
        /* 요일 헤더 (일요일: 빨강, 토요일: 파랑) */
        .react-datepicker__day-name:first-child { color: #dc2626; }
        .react-datepicker__day-name:last-child { color: #2563eb; }

        /* 날짜 숫자 색상 (공휴일/일요일: 빨강, 토요일: 파랑) */
        .react-datepicker__day.day-sunday { color: #dc2626 !important; }
        .react-datepicker__day.day-saturday { color: #2563eb !important; }

        /* 선택된 날짜는 배경색이 진하므로 글자색을 흰색으로 강제 */
        .react-datepicker__day--selected.day-sunday,
        .react-datepicker__day--selected.day-saturday,
        .react-datepicker__day--keyboard-selected.day-sunday,
        .react-datepicker__day--keyboard-selected.day-saturday {
          color: #ffffff !important;
        }
      `}</style>

      <DatePicker
        open={open}
        onInputClick={() => {
          setViewDate(selectedDate ?? new Date());
          setOpen(true);
          setMode("day");
        }}
        onClickOutside={() => setOpen(false)}
        onCalendarClose={() => setMode("day")}
        shouldCloseOnSelect={false}
        selected={selectedDate}
        openToDate={selectedDate ?? viewDate}
        locale={ko}
        dateFormat="yyyy-MM-dd"
        minDate={minDate}
        maxDate={maxDate}
        showPopperArrow={false}
        placeholderText="YYYY-MM-DD"
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        // --- 추가된 부분 ---
        dayClassName={getDayClassName}
        // -----------------

        showYearPicker={mode === "year"}
        showMonthYearPicker={mode === "month"}
        yearItemNumber={12}
        onChange={(date) => {
          if (!date) return;

          setViewDate(date);

          if (mode === "year") {
            setMode("month");
            return;
          }
          if (mode === "month") {
            setMode("day");
            return;
          }

          onChange(formatLocalDate(date));
          setMode("day");
          setOpen(false);
        }}
        renderCustomHeader={({
          date,
          decreaseMonth,
          increaseMonth,
          changeYear,
          decreaseYear,
          increaseYear,
        }) => {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;

          const title =
            mode === "day"
              ? `${year}년 ${month}월`
              : mode === "month"
              ? `${year}년`
              : getDecadeRangeText(year);

          const goPrev = () => {
            if (mode === "day") decreaseMonth();
            if (mode === "month") decreaseYear();
            if (mode === "year") changeYear(year - 10);
          };

          const goNext = () => {
            if (mode === "day") increaseMonth();
            if (mode === "month") increaseYear();
            if (mode === "year") changeYear(year + 10);
          };

          const goPrevFast = () => {
            if (mode === "day") decreaseYear();
            if (mode === "month") changeYear(year - 10);
            if (mode === "year") changeYear(year - 100);
          };

          const goNextFast = () => {
            if (mode === "day") increaseYear();
            if (mode === "month") changeYear(year + 10);
            if (mode === "year") changeYear(year + 100);
          };

          const toggleMode = () => {
            if (mode === "year") setMode("month");
            else if (mode === "month") setMode("day");
            else setMode("year");
          };

          return (
            <div className="flex items-center justify-between px-3 pb-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goPrevFast}
                  className="min-w-10 min-h-10 px-2 rounded-md text-gray-400 hover:text-gray-700 active:bg-gray-100"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={goPrev}
                  className="min-w-10 min-h-10 px-2 rounded-md text-gray-400 hover:text-gray-700 active:bg-gray-100"
                >
                  ‹
                </button>
              </div>
              <button
                type="button"
                onClick={toggleMode}
                className="text-base font-semibold text-gray-900 px-2 py-1 rounded-md active:bg-gray-100"
              >
                {title}
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goNext}
                  className="min-w-10 min-h-10 px-2 rounded-md text-gray-400 hover:text-gray-700 active:bg-gray-100"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={goNextFast}
                  className="min-w-10 min-h-10 px-2 rounded-md text-gray-400 hover:text-gray-700 active:bg-gray-100"
                >
                  »
                </button>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

export default KoreanCalendarPicker;
