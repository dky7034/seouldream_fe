// src/components/attendance/CellAttendanceManager.tsx
import React, { useState } from "react";
import type { User } from "../types";
import TakeAttendanceView from "./attendance/TakeAttendanceView";
import AttendanceLogView from "./attendance/AttendanceLogView";
import AttendanceStatisticsView from "./attendance/AttendanceStatisticsView";

const CellAttendanceManager: React.FC<{ user: User }> = ({ user }) => {
  const [viewMode, setViewMode] = useState<"check" | "log" | "stats">("check");

  const tabs: { id: "check" | "log" | "stats"; label: string }[] = [
    { id: "check", label: "출석 및 기도제목" },
    { id: "log", label: "출석 기록" },
    { id: "stats", label: "출석 통계" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 탭 영역 */}
      <div className="border-b border-gray-200">
        {/* 모바일에서 가로 스크롤 허용 */}
        <div className="overflow-x-auto">
          <nav
            className="-mb-px flex min-w-max space-x-4 sm:space-x-8 px-1"
            aria-label="Tabs"
          >
            {tabs.map((tab) => {
              const isActive = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`whitespace-nowrap border-b-2 font-medium 
                    text-xs sm:text-sm
                    py-2 sm:py-3 px-1 sm:px-0
                    ${
                      isActive
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="mt-4 sm:mt-8">
        {viewMode === "check" && <TakeAttendanceView user={user} />}
        {viewMode === "log" && <AttendanceLogView user={user} />}
        {viewMode === "stats" && <AttendanceStatisticsView user={user} />}
      </div>
    </div>
  );
};

export default CellAttendanceManager;
