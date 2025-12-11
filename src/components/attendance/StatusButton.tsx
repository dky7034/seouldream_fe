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
  const isActive = currentStatus === status;

  // 🔥 모바일 터치 영역 보강 + small 대응
  // - small: 모바일에서 살짝 컴팩트하지만 여전히 터치 충분 (min-h)
  // - 기본: 기존과 동일한 크기
  const sizeClasses = small
    ? "px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm min-h-[32px]"
    : "px-3 py-1.5 text-sm min-h-[36px]";

  const baseClasses = [
    sizeClasses,
    "font-medium rounded-md transition-colors border",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500",
  ].join(" ");

  const statusClasses: Record<AttendanceStatus, string> = {
    PRESENT: isActive
      ? "border-green-500 bg-green-500 text-white"
      : "border-green-500 text-green-600 hover:bg-green-50",
    ABSENT: isActive
      ? "border-red-500 bg-red-500 text-white"
      : "border-red-500 text-red-600 hover:bg-red-50",
  };

  const disabledClasses = disabled
    ? "opacity-60 cursor-not-allowed hover:bg-transparent"
    : "";

  return (
    <button
      type="button"
      // 🔥 disabled일 때 onClick 막기
      onClick={() => {
        if (!disabled) {
          onClick(status);
        }
      }}
      className={`${baseClasses} ${statusClasses[status]} ${disabledClasses}`}
      disabled={disabled}
      // 🔥 토글 버튼 역할을 위한 접근성 속성
      aria-pressed={isActive}
      aria-label={`${translateAttendanceStatus(status)}로 변경`}
    >
      {translateAttendanceStatus(status)}
    </button>
  );
};

export default StatusButton;
