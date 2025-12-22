// src/components/attendance/AttendanceStats.tsx
import React from "react";
import type { OverallAttendanceStatDto } from "../../types";
import { UsersIcon, ChartBarIcon } from "@heroicons/react/24/outline";

const AttendanceStats: React.FC<{
  stats: OverallAttendanceStatDto | null;
  loading: boolean;
}> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-center">
          <p className="text-gray-600 text-sm">통계 불러오는 중...</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-center">
          <p className="text-gray-600 text-sm">통계 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4">
        <div className="bg-blue-100 p-3 rounded-full">
          <UsersIcon className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">총 기록</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.totalRecords}
          </p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4">
        <div className="bg-indigo-100 p-3 rounded-full">
          <ChartBarIcon className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">출석률</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.attendanceRate.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default AttendanceStats;
