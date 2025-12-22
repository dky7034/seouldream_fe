// src/components/CellAttendanceManager.tsx
import React, { useState } from "react";
import type { User } from "../types";
import TakeAttendanceView from "./attendance/TakeAttendanceView";
import AttendanceLogView from "./attendance/AttendanceLogView";
import AttendanceStatisticsView from "./attendance/AttendanceStatisticsView";

// [추가] Props 인터페이스 정의
interface CellAttendanceManagerProps {
  user: User;
  allMembers: { id: number; name: string; birthDate?: string }[];
}

const CellAttendanceManager: React.FC<CellAttendanceManagerProps> = ({
  user,
  allMembers, // [추가]
}) => {
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

      {/* 콘텐츠 영역 - [수정] 하위 뷰에 allMembers 전달 */}
      <div className="mt-4 sm:mt-8">
        {viewMode === "check" && (
          // @ts-ignore: 하위 컴포넌트 수정 전 임시 처리
          <TakeAttendanceView user={user} allMembers={allMembers} />
        )}
        {viewMode === "log" && (
          // @ts-ignore: 하위 컴포넌트 수정 전 임시 처리
          <AttendanceLogView user={user} allMembers={allMembers} />
        )}
        {viewMode === "stats" && (
          // @ts-ignore: 하위 컴포넌트 수정 전 임시 처리
          <AttendanceStatisticsView user={user} allMembers={allMembers} />
        )}
      </div>
    </div>
  );
};

export default CellAttendanceManager;
