// src/components/attendance/AttendanceTrend.tsx
import React, { useMemo } from "react";
import type { AggregatedTrendDto, AttendanceSummaryGroupBy } from "../../types";

// ✅ [수정] 안전한 로컬 날짜 파싱 및 포맷팅
const formatDateKorean = (dateStr: string) => {
  if (!dateStr) return "-";
  // YYYY-MM-DD 형식만 처리
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${y}년 ${m}월 ${d}일`;
};

const formatDateGroupLabel = (
  groupBy: AttendanceSummaryGroupBy,
  raw: string
): string => {
  if (!raw) return raw;

  // ✅ [수정] 학기 포맷팅 추가 (ex: "2025-1" -> "2025년 1학기")
  if (groupBy === "SEMESTER") {
    const match = raw.match(/^(\d{4})-(\d{1})$/); // 혹은 백엔드 포맷에 맞게 조정
    if (match) {
      return `${match[1]}년 ${match[2]}학기`;
    }
    // "2025-1" 처럼 단순 하이픈 연결일 경우 대비
    if (raw.includes("-")) {
      const [y, s] = raw.split("-");
      return `${y}년 ${s}학기`;
    }
    return raw;
  }

  if (groupBy === "QUARTER") {
    const match = raw.match(/^(\d{4})-Q([1-4])$/);
    if (match) {
      const year = match[1];
      const quarter = match[2];
      return `${year}년 ${quarter}분기`;
    }
    return raw;
  }

  if (groupBy === "HALF_YEAR") {
    const match = raw.match(/^(\d{4})-H([12])$/);
    if (match) {
      const year = match[1];
      const half = match[2] === "1" ? "상반기" : "하반기";
      return `${year}년 ${half}`;
    }
    return raw;
  }

  if (groupBy === "YEAR") {
    const match = raw.match(/^(\d{4})$/);
    if (match) {
      return `${match[1]}년`;
    }
    return raw;
  }

  if (groupBy === "MONTH") {
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = match[1];
      const month = parseInt(match[2], 10);
      return `${year}년 ${month}월`;
    }
    return raw;
  }

  if (groupBy === "WEEK") {
    const match = raw.match(/^(\d{4})-W(\d{1,2})$/);
    if (match) {
      const year = match[1];
      const week = parseInt(match[2], 10);
      return `${year}년 ${week}주차`;
    }
    return raw;
  }

  if (groupBy === "DAY") {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = match[1];
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      return `${year}년 ${month}월 ${day}일`;
    }
    return raw;
  }

  return raw;
};

type TrendItem = AggregatedTrendDto;

type AttendanceTrendProps = {
  data: TrendItem[];
  selectedGroupBy: AttendanceSummaryGroupBy;
  title: string;
  dateRange?: { startDate: string; endDate: string } | null;
};

const AttendanceTrend: React.FC<AttendanceTrendProps> = ({
  data,
  selectedGroupBy,
  title,
  dateRange,
}) => {
  if (data.length === 0) return null;

  // 그래프가 너무 길어지지 않게 최근 데이터만 보여줌 (일간/주간)
  const shouldLimitItems =
    selectedGroupBy === "DAY" || selectedGroupBy === "WEEK";
  const MAX_ITEMS = 12;

  const slicedData = useMemo(() => {
    const base = data.filter((item) => typeof item.attendanceRate === "number");
    if (!shouldLimitItems) return base;
    // 최근 데이터가 뒤에 있다고 가정하고 뒤에서 자름 (Trend이므로)
    return base.length > MAX_ITEMS ? base.slice(-MAX_ITEMS) : base;
  }, [data, shouldLimitItems]);

  const summary = useMemo(() => {
    if (!slicedData.length) return null;

    const sorted = [...slicedData];
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const max = sorted.reduce((acc, cur) =>
      cur.attendanceRate > acc.attendanceRate ? cur : acc
    );
    const min = sorted.reduce((acc, cur) =>
      cur.attendanceRate < acc.attendanceRate ? cur : acc
    );

    return {
      start: first,
      end: last,
      startRate: first.attendanceRate,
      endRate: last.attendanceRate,
      diff: last.attendanceRate - first.attendanceRate,
      max,
      min,
    };
  }, [slicedData]);

  const formatDiff = (diff: number) => {
    const fixed = diff.toFixed(1);
    if (diff > 0) return `+${fixed}p`;
    if (diff < 0) return `${fixed}p`;
    return "변화 없음";
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-xs">조회 기간 (필터 기준)</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {dateRange
                ? `${formatDateKorean(
                    dateRange.startDate
                  )} ~ ${formatDateKorean(dateRange.endDate)}`
                : "기간이 설정되지 않았습니다."}
            </p>
            <p className="mt-1.5 font-medium text-gray-800 text-sm">
              {summary.startRate.toFixed(1)}% → {summary.endRate.toFixed(1)}%{" "}
              <span className="ml-2 text-xs text-blue-600">
                ({formatDiff(summary.diff)})
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-gray-500">
              ({formatDateGroupLabel(selectedGroupBy, summary.start.dateGroup)}{" "}
              → {formatDateGroupLabel(selectedGroupBy, summary.end.dateGroup)}
              기준 )
            </p>
          </div>

          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-xs">최고 출석률</p>
            <p className="font-medium text-gray-800 text-sm">
              {summary.max.attendanceRate.toFixed(1)}%{" "}
              <span className="ml-1 text-xs text-gray-600">
                ({formatDateGroupLabel(selectedGroupBy, summary.max.dateGroup)})
              </span>
            </p>
          </div>

          <div className="bg-gray-50 rounded-md px-3 py-2">
            <p className="text-gray-500 text-xs">최저 출석률</p>
            <p className="font-medium text-gray-800 text-sm">
              {summary.min.attendanceRate.toFixed(1)}%{" "}
              <span className="ml-1 text-xs text-gray-600">
                ({formatDateGroupLabel(selectedGroupBy, summary.min.dateGroup)})
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {slicedData.map((item) => (
          <div key={item.dateGroup} className="space-y-1">
            <div className="flex justify-between text-[11px] sm:text-xs text-gray-600">
              <span>
                {formatDateGroupLabel(selectedGroupBy, item.dateGroup)}
              </span>
              <span>
                {item.attendanceRate.toFixed(1)}% ({item.presentRecords}/
                {item.totalRecords})
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${item.attendanceRate}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {shouldLimitItems && data.length > MAX_ITEMS && (
        <p className="mt-2 text-[11px] text-gray-400">
          * 최근 {MAX_ITEMS}개의 데이터만 표시합니다.
        </p>
      )}
    </div>
  );
};

export default AttendanceTrend;
