// src/components/attendance/CellAttendanceManager.tsx
import React, { useState } from "react";
import type { User } from "../types";
import TakeAttendanceView from "./attendance/TakeAttendanceView";
import AttendanceLogView from "./attendance/AttendanceLogView";
import AttendanceStatisticsView from "./attendance/AttendanceStatisticsView";

const CellAttendanceManager: React.FC<{ user: User }> = ({ user }) => {
  const [viewMode, setViewMode] = useState<"check" | "log" | "stats">("check");

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setViewMode("check")}
            className={`${
              viewMode === "check"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            출석 및 기도제목
          </button>
          <button
            onClick={() => setViewMode("log")}
            className={`${
              viewMode === "log"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            출석 기록
          </button>
          <button
            onClick={() => setViewMode("stats")}
            className={`${
              viewMode === "stats"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            출석 통계
          </button>
        </nav>
      </div>

      <div className="mt-8">
        {viewMode === "check" && <TakeAttendanceView user={user} />}
        {viewMode === "log" && <AttendanceLogView user={user} />}
        {viewMode === "stats" && <AttendanceStatisticsView user={user} />}
      </div>
    </div>
  );
};

export default CellAttendanceManager;
