// 상단에 이미 쓰고 있는 아이콘들 중에서 골라서 사용해도 됩니다.
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { ChartBarIcon } from "@heroicons/react/24/solid";
import type { AttendanceSummaryGroupBy } from "../types";

const PERIOD_OPTIONS = [
  { id: "1m", label: "1개월" },
  { id: "3m", label: "3개월" },
  { id: "6m", label: "6개월" },
  { id: "12m", label: "1년" },
];

const GROUP_BY_OPTIONS: { id: AttendanceSummaryGroupBy; label: string }[] = [
  { id: "DAY", label: "일별" },
  { id: "WEEK", label: "주별" },
  { id: "MONTH", label: "월별" },
];

interface AttendanceFilterBarProps {
  period: string;
  groupBy: AttendanceSummaryGroupBy;
  onChangePeriod: (period: string) => void;
  onChangeGroupBy: (groupBy: AttendanceSummaryGroupBy) => void;
}

const AttendanceFilterBar: React.FC<AttendanceFilterBarProps> = ({
  period,
  groupBy,
  onChangePeriod,
  onChangeGroupBy,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
      {/* 기간 선택 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1 text-xs sm:text-sm text-gray-600">
          <CalendarDaysIcon className="h-4 w-4 text-indigo-500" />
          <span className="font-medium">기간</span>
        </div>

        <div className="inline-flex flex-wrap gap-1">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChangePeriod(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition
                ${
                  period === p.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                }
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 단위 선택 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1 text-xs sm:text-sm text-gray-600">
          <ChartBarIcon className="h-4 w-4 text-emerald-500" />
          <span className="font-medium">단위</span>
        </div>

        <div className="inline-flex flex-wrap gap-1">
          {GROUP_BY_OPTIONS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onChangeGroupBy(g.id)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition
                ${
                  groupBy === g.id
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                }
              `}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AttendanceFilterBar;
