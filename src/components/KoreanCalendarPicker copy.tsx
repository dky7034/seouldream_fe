import React, { useMemo, useState, forwardRef } from "react";
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
  filterDate?: (date: Date) => boolean;
  /* ✅ 안내 문구 설정 */
  placeholder?: string;
};

// ─── 날짜 파싱/포맷 헬퍼 ───
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

// ─── 모바일 키보드 방지용 커스텀 인풋 (Button) ───
const CustomInput = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; placeholder?: string }
>(({ value, onClick, placeholder }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm text-left focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer bg-white"
  >
    {/* 값이 있으면 검은색, 없으면 회색(placeholder) */}
    <span className={value ? "text-gray-900" : "text-gray-400"}>
      {value || placeholder}
    </span>
  </button>
));
CustomInput.displayName = "CustomInput";

const KoreanCalendarPicker: React.FC<Props> = ({
  value,
  onChange,
  minDate,
  maxDate,
  monthCols = 3,
  yearCols = 4,
  filterDate,
  placeholder = "YYYY-MM-DD",
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
        .react-datepicker-wrapper { width: 100%; }
        .react-datepicker__input-container { width: 100%; }

        /* 요일 및 날짜 기본 스타일 (데스크탑) */
        .react-datepicker__day-name, 
        .react-datepicker__day, 
        .react-datepicker__time-name {
          width: 2.1rem; 
          line-height: 2.1rem;
          margin: 0.1rem;
        }

        /* ─── 모바일 반응형 수정 (간격 넓힘) ─── */
        @media (max-width: 640px) {
          .react-datepicker { font-size: 0.8rem; }
          .react-datepicker__header { padding-top: 0.5rem; padding-bottom: 0.4rem; }
          
          /* ✅ 모바일에서도 크기와 간격을 데스크탑과 비슷하게 유지하여 터치 편의성 증대 */
          .react-datepicker__day-name, 
          .react-datepicker__day {
            width: 2rem;       /* 1.7rem -> 2rem (확대) */
            line-height: 2rem; /* 1.7rem -> 2rem (확대) */
            margin: 0.1rem;    /* 0 -> 0.1rem (간격 추가) */
          }
          
          .react-datepicker__month { margin: 0.4rem; }
        }

        /* 색상 커스텀 */
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

        .react-datepicker__day--today {
          font-weight: 900 !important;
          border: 2px solid #6366f1 !important;
          background-color: #eef2ff !important;
          color: #4338ca !important;
          border-radius: 0.3rem !important;
        }

        .react-datepicker__day--today.react-datepicker__day--selected,
        .react-datepicker__day--today.react-datepicker__day--keyboard-selected {
          background-color: #216ba5 !important;
          color: #ffffff !important;
          border: 2px solid #216ba5 !important;
        }

        .react-datepicker {
          font-family: inherit;
          font-size: 0.85rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .react-datepicker__header {
          padding-top: 0.4rem;
          padding-bottom: 0.4rem;
        }
        
        .react-datepicker__current-month {
          font-size: 0.95rem;
          margin-bottom: 0.2rem;
        }

        .react-datepicker__day--disabled {
          color: #d1d5db !important;
          cursor: not-allowed;
          opacity: 0.6;
        }
      `}</style>

      <DatePicker
        // ✅ placeholderText 속성을 사용해야 customInput에 정상적으로 전달됩니다.
        customInput={<CustomInput />}
        placeholderText={placeholder}
        filterDate={filterDate}
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

          return (
            <div className="flex items-center justify-center gap-2 px-2 pb-2 mt-1">
              <button
                type="button"
                onClick={goPrev}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 active:bg-gray-100 transition-colors"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm font-bold text-gray-800 px-3 py-1 rounded-md hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
              >
                {title}
              </button>
              <button
                type="button"
                onClick={goNext}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 active:bg-gray-100 transition-colors"
              >
                ›
              </button>
            </div>
          );
        }}
      />
    </div>
  );
};

export default KoreanCalendarPicker;
