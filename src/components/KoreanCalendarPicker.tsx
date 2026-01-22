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
  placeholder?: string;
  /* 이미 제출된 날짜 리스트 (YYYY-MM-DD) */
  submittedDates?: string[];
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

// ─── 커스텀 인풋 ───
const CustomInput = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; placeholder?: string }
>(({ value, onClick, placeholder }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm text-left focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer bg-white transition-colors hover:bg-gray-50"
  >
    <span className={value ? "text-gray-900 font-medium" : "text-gray-400"}>
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
  placeholder = "날짜 선택",
  submittedDates = [],
}) => {
  const selectedDate = useMemo(() => parseLocalDate(value), [value]);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("day");

  const wrapperClass = `rdp-month-${monthCols} rdp-year-${yearCols}`;

  const getDayClassName = (date: Date) => {
    const dateStr = formatLocalDate(date);
    const isSubmitted = submittedDates.includes(dateStr);
    const day = date.getDay();
    const isHoliday = isPublicHoliday(date);

    const classes = [];

    // 1. 제출 완료 여부
    if (isSubmitted) classes.push("day-submitted");

    // 2. 휴일/주말 표시
    if (isHoliday || day === 0) classes.push("day-sunday");
    else if (day === 6) classes.push("day-saturday");

    return classes.join(" ");
  };

  // ✅ 날짜 내용 커스텀 렌더링 (제출된 날짜에 체크 표시 추가)
  const renderDayContents = (day: number, date: Date) => {
    const dateStr = formatLocalDate(date);
    const isSubmitted = submittedDates.includes(dateStr);

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span>{day}</span>
        {isSubmitted && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
            <div className="w-1 h-1 rounded-full bg-green-500"></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={wrapperClass}>
      <style>{`
        .react-datepicker-wrapper { width: 100%; }
        .react-datepicker__input-container { width: 100%; }

        /* ─── 기본 셀 크기 및 간격 ─── */
        .react-datepicker__day-name, 
        .react-datepicker__day, 
        .react-datepicker__time-name {
          width: 2.2rem; 
          line-height: 2.2rem;
          margin: 0.15rem;
          font-weight: 500;
        }

        /* ─── 모바일 최적화 ─── */
        @media (max-width: 640px) {
          .react-datepicker { font-size: 0.85rem; }
          .react-datepicker__day-name, 
          .react-datepicker__day {
            width: 2.1rem;
            line-height: 2.1rem;
            margin: 0.1rem;
          }
        }

        /* ─── 1. 비활성 날짜 (filterDate false) 시각적 약화 ─── */
        .react-datepicker__day--disabled {
          color: #d1d5db !important; 
          opacity: 0.3;              
          cursor: not-allowed;
          background-color: transparent !important;
        }
        .react-datepicker__day--disabled:hover {
          background-color: transparent !important;
          border-radius: 0 !important;
        }

        /* ─── 2. 주말 색상 ─── */
        .react-datepicker__day:not(.react-datepicker__day--disabled).day-sunday { 
          color: #e11d48 !important; 
          font-weight: 700;
        }
        .react-datepicker__day:not(.react-datepicker__day--disabled).day-saturday { 
          color: #2563eb !important; 
        }

        /* ─── 3. 제출 완료된 날짜 (Submitted) ─── */
        .react-datepicker__day:not(.react-datepicker__day--disabled).day-submitted {
          background-color: #ecfdf5 !important; 
          border: 1px solid #10b981 !important; 
          color: #059669 !important;            
          border-radius: 50% !important;
          font-weight: bold;
        }

        /* ─── 4. 오늘 날짜 (Today) ─── */
        .react-datepicker__day--today {
          font-weight: 900 !important;
          border: 2px solid #6366f1 !important; 
          background-color: transparent;
          color: #4338ca !important;
          border-radius: 50% !important;
        }

        /* ─── 5. 선택된 날짜 (Selected) - 최우선 순위 ─── */
        .react-datepicker__day--selected {
          background-color: #4f46e5 !important; /* 진한 인디고 */
          color: #ffffff !important;
          border: none !important;
          border-radius: 50% !important;
          box-shadow: 0 2px 4px rgba(79, 70, 229, 0.4);
        }

        /* ✅ [수정 핵심] 키보드 포커스(임시 선택) 상태 투명화 */
        /* 월 이동 시 따라다니는 '가짜 선택'을 제거합니다 */
        .react-datepicker__day--keyboard-selected {
          background-color: transparent !important;
          color: inherit !important;
          border: none !important;
        }

        /* 단, '진짜 선택'이면서 '포커스'된 경우는 파란색 유지 */
        .react-datepicker__day--selected.react-datepicker__day--keyboard-selected {
          background-color: #4f46e5 !important;
          color: #ffffff !important;
        }
        
        /* 선택된 날짜 내부의 주일/제출 스타일 덮어쓰기 */
        .react-datepicker__day--selected.day-sunday,
        .react-datepicker__day--selected.day-submitted {
          color: white !important;
        }

        /* 달력 외관 */
        .react-datepicker {
          font-family: inherit;
          border: 1px solid #f3f4f6;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          border-radius: 1rem;
          overflow: hidden;
        }
        
        .react-datepicker__header {
          background-color: #ffffff;
          border-bottom: 1px solid #f3f4f6;
          padding-top: 1rem;
        }
        
        .react-datepicker__day-names {
          margin-top: 0.5rem;
          margin-bottom: -0.2rem;
        }
        
        .react-datepicker__triangle { display: none; }
      `}</style>

      <DatePicker
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
        renderDayContents={renderDayContents}
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
            <div className="flex items-center justify-between px-4 pb-2">
              <button
                type="button"
                onClick={goPrev}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm font-bold text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {title}
              </button>
              <button
                type="button"
                onClick={goNext}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
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
