// src/components/attendance/StatusButton.tsx
import React from "react";
import type { AttendanceStatus } from "../../types";
import { translateAttendanceStatus } from "../../utils/attendanceUtils";

interface StatusButtonProps {
  status: AttendanceStatus;
  currentStatus: AttendanceStatus;
  onClick: (status: AttendanceStatus) => void;
  disabled: boolean;
  small?: boolean; // 🔥 compact mode 지원
}

const StatusButton: React.FC<StatusButtonProps> = ({
  status,
  currentStatus,
  onClick,
  disabled,
  small = false,
}) => {
  const sizeClasses = small
    ? "px-2 py-0.5 text-xs" // 🔥 compact 모드
    : "px-3 py-1 text-sm"; // 기존 기본 모드

  const baseClasses = `${sizeClasses} font-medium rounded-md transition-colors border`;

  const statusClasses: Record<AttendanceStatus, string> = {
    PRESENT:
      currentStatus === "PRESENT"
        ? "border-green-500 bg-green-500 text-white"
        : "border-green-500 text-green-600 hover:bg-green-100",
    ABSENT:
      currentStatus === "ABSENT"
        ? "border-red-500 bg-red-500 text-white"
        : "border-red-500 text-red-600 hover:bg-red-100",
  };

  return (
    <button
      type="button"
      onClick={() => onClick(status)}
      className={`${baseClasses} ${statusClasses[status]}`}
      disabled={disabled}
    >
      {translateAttendanceStatus(status)}
    </button>
  );
};

export default StatusButton;
