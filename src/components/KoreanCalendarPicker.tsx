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

// ─── 커스텀 인풋 (인디고 포커스링 적용) ───
const CustomInput = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; placeholder?: string }
>(({ value, onClick, placeholder }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    // focus:ring-indigo-500 으로 변경하여 선택 시 보라색 테두리
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
    if (isSubmitted) classes.push("day-submitted");
    if (isHoliday || day === 0) classes.push("day-sunday");
    else if (day === 6) classes.push("day-saturday");

    return classes.join(" ");
  };

  // ✅ 점(Dot) 스타일 렌더링 유지
  const renderDayContents = (day: number, date: Date) => {
    const dateStr = formatLocalDate(date);
    const isSubmitted = submittedDates.includes(dateStr);

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span className="z-10">{day}</span>
        {isSubmitted && (
          // 점 색상은 그대로 초록색(green-500) 유지하여 '완료' 의미 전달
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
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

        .react-datepicker__day-name, 
        .react-datepicker__day, 
        .react-datepicker__time-name {
          width: 2.2rem; 
          line-height: 2.2rem;
          margin: 0.15rem;
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .react-datepicker { font-size: 0.85rem; }
          .react-datepicker__day-name, 
          .react-datepicker__day {
            width: 2.1rem;
            line-height: 2.1rem;
            margin: 0.1rem;
          }
        }

        .react-datepicker__day--disabled {
          color: #d1d5db !important; 
          opacity: 0.3;              
          cursor: not-allowed;
          background-color: transparent !important;
        }

        .react-datepicker__day:not(.react-datepicker__day--disabled).day-sunday { 
          color: #e11d48 !important; 
          font-weight: 700;
        }
        .react-datepicker__day:not(.react-datepicker__day--disabled).day-saturday { 
          color: #2563eb !important; 
        }

        /* ─── 제출 완료 (점 스타일) ─── */
        /* 배경 없음, 글자색 초록 */
        .react-datepicker__day:not(.react-datepicker__day--disabled).day-submitted {
          background-color: transparent !important; 
          border: none !important; 
          color: #059669 !important;
          font-weight: 700;
        }

        /* ─── 오늘 날짜 (Today) ─── */
        /* 인디고 계열로 맞춤 (Indigo-400 테두리) */
        .react-datepicker__day--today {
          font-weight: 900 !important;
          border: 2px solid #818cf8 !important; 
          background-color: transparent;
          color: #4f46e5 !important;
          border-radius: 50% !important;
        }

        /* ─── 선택된 날짜 (Selected) : 인디고(Indigo) 적용 ─── */
        /* 슬레이트(회색) 대신 쨍한 인디고 사용으로 시인성 확보 */
        .react-datepicker__day--selected {
          background-color: #4f46e5 !important; /* Indigo-600 */
          color: #ffffff !important;
          border: none !important;
          border-radius: 50% !important;
          box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3); /* 보라색 그림자 */
        }

        .react-datepicker__day--keyboard-selected {
          background-color: transparent !important;
          color: inherit !important;
          border: none !important;
        }

        .react-datepicker__day--selected.react-datepicker__day--keyboard-selected {
          background-color: #4f46e5 !important;
          color: #ffffff !important;
        }
        
        .react-datepicker__day--selected.day-sunday,
        .react-datepicker__day--selected.day-submitted {
          color: white !important;
        }

        .react-datepicker {
          font-family: inherit;
          border: 1px solid #e5e7eb;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
          border-radius: 1rem;
          overflow: hidden;
        }
        
        .react-datepicker__header {
          background-color: #ffffff;
          border-bottom: 1px solid #e5e7eb;
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
            else if (mode === "month") decreaseYear();
            else changeYear(year - 12);
          };
          const goNext = () => {
            if (mode === "day") increaseMonth();
            else if (mode === "month") increaseYear();
            else changeYear(year + 12);
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
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm font-bold text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {title}
              </button>
              <button
                type="button"
                onClick={goNext}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
