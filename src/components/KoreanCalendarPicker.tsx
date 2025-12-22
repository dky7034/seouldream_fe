import React, { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { ko } from "date-fns/locale";
import { format } from "date-fns";

type Mode = "day" | "month" | "year";
type GridCols = 3 | 4;

type Props = {
  value: string; // "YYYY-MM-DD"
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

const KoreanCalendarPicker: React.FC<Props> = ({
  value,
  onChange,
  minDate,
  maxDate,
  monthCols = 3,
  yearCols = 4,
}) => {
  const externalSelectedDate = useMemo(() => parseLocalDate(value), [value]);

  // ✅ 초기값은 한 번만(Effect로 동기화하지 않음)
  const initialDate = useMemo(
    () => externalSelectedDate ?? new Date(),
    [externalSelectedDate]
  );
  const [draftDate, setDraftDate] = useState<Date | null>(initialDate);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("day");

  const wrapperClass = `rdp-month-${monthCols} rdp-year-${yearCols}`;

  return (
    <div className={wrapperClass}>
      <DatePicker
        open={open}
        onInputClick={() => {
          // ✅ 팝업을 열 때만 외부 value를 draft로 반영
          setDraftDate(externalSelectedDate ?? new Date());
          setOpen(true);
          setMode("day");
        }}
        onClickOutside={() => setOpen(false)}
        onCalendarClose={() => setMode("day")}
        shouldCloseOnSelect={false}
        selected={draftDate}
        locale={ko}
        dateFormat="yyyy-MM-dd"
        minDate={minDate}
        maxDate={maxDate}
        showPopperArrow={false}
        placeholderText="YYYY-MM-DD"
        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        showYearPicker={mode === "year"}
        showMonthYearPicker={mode === "month"}
        yearItemNumber={12}
        onChange={(date) => {
          if (!date) return;

          if (mode === "year") {
            setDraftDate(date);
            setMode("month");
            return;
          }

          if (mode === "month") {
            setDraftDate(date);
            setMode("day");
            return;
          }

          setDraftDate(date);
          onChange(formatLocalDate(date));
          setMode("day");
          setOpen(false);
        }}
        renderCustomHeader={({
          date,
          decreaseMonth,
          increaseMonth,
          decreaseYear,
          increaseYear,
          changeYear,
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
                  aria-label="prev fast"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={goPrev}
                  className="min-w-10 min-h-10 px-2 rounded-md text-gray-400 hover:text-gray-700 active:bg-gray-100"
                  aria-label="prev"
                >
                  ‹
                </button>
              </div>

              <button
                type="button"
                onClick={toggleMode}
                className="text-base font-semibold text-gray-900 px-2 py-1 rounded-md active:bg-gray-100"
                aria-label="toggle picker mode"
              >
                {title}
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goNext}
                  className="min-w-10 min-h-10 px-2 rounded-md text-gray-400 hover:text-gray-700 active:bg-gray-100"
                  aria-label="next"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={goNextFast}
                  className="min-w-10 min-h-10 px-2 rounded-md text-gray-400 hover:text-gray-700 active:bg-gray-100"
                  aria-label="next fast"
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
