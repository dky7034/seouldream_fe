// src/components/CellAttendanceManager.tsx
import React, { useState } from "react";
import type { User } from "../types";
import TakeAttendanceView from "./attendance/TakeAttendanceView";
import AttendanceLogView from "./attendance/AttendanceLogView";
import AttendanceStatisticsView from "./attendance/AttendanceStatisticsView";

interface CellAttendanceManagerProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

const CellAttendanceManager: React.FC<CellAttendanceManagerProps> = ({
  user,
  allMembers,
}) => {
  const [viewMode, setViewMode] = useState<"check" | "log" | "stats">("check");

  // ✅ [수정] 탭 네이밍 변경
  const tabs: { id: "check" | "log" | "stats"; label: string }[] = [
    { id: "check", label: "출석/기도제목/보고서 작성" }, // ✨ 출석+기도+보고서를 모두 포함하는 포괄적 단어
    { id: "log", label: "출석 기록" }, // ✨ 단순히 '출석' 기록이 아닌 전체 보고서 내역임
    { id: "stats", label: "출석 통계" }, // 그대로 유지
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 탭 영역 */}
      <div className="border-b border-gray-200">
        <div>
          <nav className="-mb-px flex w-full px-1" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
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
        {viewMode === "check" && (
          <TakeAttendanceView user={user} allMembers={allMembers} />
        )}
        {viewMode === "log" && (
          <AttendanceLogView user={user} allMembers={allMembers} />
        )}
        {viewMode === "stats" && (
          <AttendanceStatisticsView user={user} allMembers={allMembers} />
        )}
      </div>
    </div>
  );
};

export default CellAttendanceManager;
