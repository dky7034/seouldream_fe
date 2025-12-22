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
  const selectedDate = useMemo(() => parseLocalDate(value), [value]);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("day");

  const wrapperClass = `rdp-month-${monthCols} rdp-year-${yearCols}`;

  const getDayClassName = (date: Date) => {
    const day = date.getDay();
    const isHoliday = isPublicHoliday(date);

    if (isHoliday || day === 0) {
      return "day-sunday";
    }
    if (day === 6) {
      return "day-saturday";
    }
    return "";
  };

  return (
    <div className={wrapperClass}>
      <style>{`
        /* 기존 스타일 (색상) */
        .react-datepicker__day-name:first-child { color: #dc2626; }
        .react-datepicker__day-name:last-child { color: #2563eb; }
        .react-datepicker__day.day-sunday { color: #dc2626 !important; }
        .react-datepicker__day.day-saturday { color: #2563eb !important; }
        .react-datepicker__day--selected.day-sunday,
        .react-datepicker__day--selected.day-saturday,
        .react-datepicker__day--keyboard-selected.day-sunday,
        .react-datepicker__day--keyboard-selected.day-saturday {
          color: #ffffff !important;
        }

        /* ✅ [추가] 모바일(640px 이하) 반응형 크기 조절 */
        @media (max-width: 640px) {
          .react-datepicker {
            font-size: 0.8rem; /* 전체 폰트 축소 */
          }
          .react-datepicker__header {
            padding-top: 0.5rem; /* 헤더 여백 축소 */
          }
          .react-datepicker__day-name, 
          .react-datepicker__day, 
          .react-datepicker__time-name {
            width: 1.9rem;      /* 날짜 셀 너비 축소 (기본값 약 1.7rem~2.5rem) */
            line-height: 1.9rem;/* 높이 축소 */
            margin: 0.1rem;     /* 셀 간격 축소 */
          }
          .react-datepicker__current-month {
            font-size: 1rem;
            margin-bottom: 0.5rem;
          }
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
        dayClassName={getDayClassName}
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

          // ✅ [변경] 버튼 스타일: 모바일에서는 작게(w-8 h-8), 데스크탑은 크게(sm:w-10 sm:h-10)
          const btnClass =
            "w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 active:bg-gray-100";
          const titleClass =
            "text-sm sm:text-base font-semibold text-gray-900 px-2 py-1 rounded-md active:bg-gray-100 cursor-pointer";

          return (
            <div className="flex items-center justify-between px-1 sm:px-3 pb-2">
              <div className="flex items-center gap-1 sm:gap-3">
                <button type="button" onClick={goPrevFast} className={btnClass}>
                  «
                </button>
                <button type="button" onClick={goPrev} className={btnClass}>
                  ‹
                </button>
              </div>
              <button type="button" onClick={toggleMode} className={titleClass}>
                {title}
              </button>
              <div className="flex items-center gap-1 sm:gap-3">
                <button type="button" onClick={goNext} className={btnClass}>
                  ›
                </button>
                <button type="button" onClick={goNextFast} className={btnClass}>
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
