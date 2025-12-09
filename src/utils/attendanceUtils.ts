import type { AttendanceStatus } from '../types';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT'];

export const ATTENDANCE_STATUS_MAP: Record<AttendanceStatus, string> = {
  PRESENT: '출석',
  ABSENT: '결석',
};

export const translateAttendanceStatus = (status?: AttendanceStatus): string => {
  if (!status) return '';
  return ATTENDANCE_STATUS_MAP[status] || status;
};
