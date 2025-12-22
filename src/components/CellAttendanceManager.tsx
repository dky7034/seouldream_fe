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
        {/* [수정 1] overflow-x-auto 제거 -> div로 변경하거나 클래스 삭제 */}
        <div>
          <nav
            /* [수정 2] min-w-max, space-x-* 제거하고 w-full 추가 */
            className="-mb-px flex w-full px-1"
            aria-label="Tabs"
          >
            {tabs.map((tab) => {
              const isActive = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  /* [수정 3] flex-1 (균등분할), text-center (중앙정렬), justify-center 추가 */
                  className={`flex-1 text-center justify-center whitespace-nowrap border-b-2 font-medium 
                    text-xs sm:text-sm
                    py-2 sm:py-3 px-1
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
