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
  const start = Math.floor((year - 1) / 12) * 12 + 1;
  const end = start + 11;
  return `${start}-${end}`;
};

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

    if (isHoliday || day === 0) return "day-sunday";
    if (day === 6) return "day-saturday";
    return "";
  };

  return (
    <div className={wrapperClass}>
      <style>{`
        /* ─── 색상 커스텀 (기존 동일) ─── */
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

        /* ─── 크기 조절 (Desktop 기본) ─── */
        .react-datepicker {
          font-family: inherit; /* 폰트 상속 */
          font-size: 0.85rem;   /* 기본 폰트 줄임 */
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        /* 헤더 높이 줄이기 */
        .react-datepicker__header {
          padding-top: 0.4rem;
          padding-bottom: 0.4rem;
        }

        /* 날짜 셀 크기 (정사각형 유지) */
        .react-datepicker__day-name, 
        .react-datepicker__day, 
        .react-datepicker__time-name {
          width: 2rem;        /* 32px */
          line-height: 2rem;  /* 32px */
          margin: 0.1rem;
        }
        
        /* 현재 월 표시 텍스트 크기 */
        .react-datepicker__current-month {
          font-size: 0.95rem;
          margin-bottom: 0.2rem;
        }

        /* ─── 크기 조절 (Mobile 반응형) ─── */
        @media (max-width: 640px) {
          .react-datepicker {
            font-size: 0.75rem; /* 모바일에서 폰트 더 작게 */
          }
          
          .react-datepicker__header {
            padding-top: 0.3rem;
            padding-bottom: 0.2rem;
          }

          /* 모바일 셀 크기 대폭 축소 */
          .react-datepicker__day-name, 
          .react-datepicker__day {
            width: 1.7rem;       /* 약 27px */
            line-height: 1.7rem; /* 약 27px */
            margin: 0;           /* 마진 제거로 밀집도 높임 */
          }
          
          .react-datepicker__month {
            margin: 0.2rem 0.4rem; /* 전체 월 마진 축소 */
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
        // 입력 필드 스타일
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer caret-transparent"
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
            if (mode === "year") changeYear(year - 12);
          };

          const goNext = () => {
            if (mode === "day") increaseMonth();
            if (mode === "month") increaseYear();
            if (mode === "year") changeYear(year + 12);
          };

          const toggleMode = () => {
            if (mode === "year") setMode("month");
            else if (mode === "month") setMode("day");
            else setMode("year");
          };

          // 버튼 크기도 함께 축소
          const btnClass =
            "w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 active:bg-gray-100 transition-colors";
          const titleClass =
            "text-sm font-bold text-gray-800 px-2 py-1 rounded-md hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors";

          return (
            <div className="flex items-center justify-between px-2 pb-2 mt-1">
              <div className="flex items-center">
                <button type="button" onClick={goPrev} className={btnClass}>
                  ‹
                </button>
              </div>

              <button type="button" onClick={toggleMode} className={titleClass}>
                {title}
              </button>

              <div className="flex items-center">
                <button type="button" onClick={goNext} className={btnClass}>
                  ›
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
